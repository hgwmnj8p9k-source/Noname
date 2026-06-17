import type { Signal, SignalResult, TokenWithHistory } from '@noname/core';

/**
 * On-chain family — protective veto. Concentrated holders combined with
 * unlocked liquidity is the canonical rug/honeypot setup. When detected with
 * sufficient data, this signal hard-vetoes the entry regardless of how bullish
 * every other signal is. This is the structural embodiment of "never trust a
 * single signal" working in the protective direction.
 */
export class RugRiskVetoSignal implements Signal {
  readonly id = 'onchain.rug_veto';
  readonly family = 'onchain' as const;
  readonly description = 'Holder concentration + liquidity lock safety veto';

  constructor(
    private readonly maxConcentration = 0.5,
    private readonly minLiquidityUsd = 10_000,
  ) {}

  evaluate(subject: TokenWithHistory): SignalResult {
    const { latest } = subject;

    // Without holder data we cannot assert safety; report low-confidence neutral.
    if (latest.holders === 0 && latest.topHolderConcentration === 0) {
      return {
        signalId: this.id,
        family: this.family,
        score: 0,
        confidence: 0.1,
        evidence: ['Holder distribution data unavailable; cannot clear rug-risk'],
      };
    }

    const concentrated = latest.topHolderConcentration > this.maxConcentration;
    const unlocked = !latest.liquidityLocked;
    const thin = latest.liquidityUsd < this.minLiquidityUsd;

    if (concentrated && (unlocked || thin)) {
      return {
        signalId: this.id,
        family: this.family,
        score: -1,
        confidence: 1,
        veto: true,
        evidence: [
          `Top holders control ${(latest.topHolderConcentration * 100).toFixed(0)}% of supply`,
          unlocked ? 'Liquidity is NOT locked' : `Liquidity thin (${Math.round(latest.liquidityUsd).toLocaleString()} USD)`,
          'Rug/honeypot risk — entry vetoed',
        ],
      };
    }

    return {
      signalId: this.id,
      family: this.family,
      score: 0.2,
      confidence: 0.8,
      evidence: [
        `Top-holder concentration ${(latest.topHolderConcentration * 100).toFixed(0)}% within limits`,
        latest.liquidityLocked ? 'Liquidity locked' : 'Liquidity unlocked but holders dispersed',
      ],
    };
  }
}
