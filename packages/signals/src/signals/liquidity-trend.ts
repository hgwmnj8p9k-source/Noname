import type { Signal, SignalResult, TokenWithHistory } from '@noname/core';
import { clamp, historyConfidence, pctChange, squash } from '../util.js';

/**
 * Liquidity family. Rising liquidity alongside a move signals real capital
 * commitment and a safer exit; draining liquidity is a classic rug/exit tell
 * and is scored strongly negative.
 */
export class LiquidityTrendSignal implements Signal {
  readonly id = 'liquidity.trend';
  readonly family = 'liquidity' as const;
  readonly description = 'Direction and stability of pool liquidity';

  constructor(private readonly lookback = 8, private readonly minLiquidityUsd = 15_000) {}

  evaluate(subject: TokenWithHistory): SignalResult {
    const { history, latest } = subject;
    const change = pctChange(history, this.lookback, 'liquidityUsd');

    if (change === undefined) {
      return {
        signalId: this.id,
        family: this.family,
        score: 0,
        confidence: 0,
        evidence: ['Insufficient liquidity history'],
      };
    }

    let score = squash(change * 4);
    const evidence = [`Liquidity changed ${(change * 100).toFixed(1)}% over ${this.lookback} ticks`];

    // Thin pools cap upside regardless of trend: hard to enter/exit cleanly.
    if (latest.liquidityUsd < this.minLiquidityUsd) {
      score = Math.min(score, 0);
      evidence.push(`Liquidity ${Math.round(latest.liquidityUsd).toLocaleString()} USD below safe floor`);
    }

    return {
      signalId: this.id,
      family: this.family,
      score,
      confidence: clamp(historyConfidence(history, this.lookback + 1), 0, 1),
      evidence,
    };
  }
}
