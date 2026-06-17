import type { Signal, SignalResult, TokenWithHistory } from '@noname/core';
import { clamp, squash } from '../util.js';

/**
 * On-chain family. Net buy/sell imbalance plus holder growth. More buyers than
 * sellers and a growing holder base indicates organic accumulation rather than
 * a single-whale pump.
 */
export class BuyPressureSignal implements Signal {
  readonly id = 'onchain.buy_pressure';
  readonly family = 'onchain' as const;
  readonly description = 'Buy/sell imbalance and holder growth';

  constructor(private readonly holderLookback = 6) {}

  evaluate(subject: TokenWithHistory): SignalResult {
    const { history, latest } = subject;
    const totalTxns = latest.buys + latest.sells;

    if (totalTxns === 0) {
      return {
        signalId: this.id,
        family: this.family,
        score: 0,
        confidence: 0,
        evidence: ['No transaction data available'],
      };
    }

    const imbalance = (latest.buys - latest.sells) / totalTxns; // -1..1
    const evidence = [
      `Buys ${latest.buys} vs sells ${latest.sells} (${(imbalance * 100).toFixed(0)}% net)`,
    ];

    let holderScore = 0;
    let holderConfidence = 0;
    const prevHolders = history[history.length - 1 - this.holderLookback]?.holders;
    if (latest.holders > 0 && prevHolders && prevHolders > 0) {
      const growth = (latest.holders - prevHolders) / prevHolders;
      holderScore = squash(growth * 10);
      holderConfidence = 1;
      evidence.push(`Holders grew ${(growth * 100).toFixed(1)}% over ${this.holderLookback} ticks`);
    } else {
      evidence.push('Holder data unavailable; relying on flow imbalance only');
    }

    const score = squash(imbalance * 1.5) * 0.6 + holderScore * 0.4;
    // Confidence rises with transaction count and holder-data availability.
    const flowConfidence = clamp(totalTxns / 200, 0.2, 1);
    const confidence = clamp(flowConfidence * 0.6 + holderConfidence * 0.4, 0, 1);

    return { signalId: this.id, family: this.family, score, confidence, evidence };
  }
}
