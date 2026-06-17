import type { Signal, SignalResult, TokenWithHistory } from '@noname/core';
import { clamp, historyConfidence, pctChange, squash } from '../util.js';

/**
 * Price family. Detects sustained directional momentum by blending a short and
 * medium-term rate of change. Sustained, accelerating moves score highest.
 */
export class PriceMomentumSignal implements Signal {
  readonly id = 'price.momentum';
  readonly family = 'price' as const;
  readonly description = 'Short- and medium-term price momentum';

  constructor(
    private readonly shortLookback = 3,
    private readonly mediumLookback = 10,
  ) {}

  evaluate(subject: TokenWithHistory): SignalResult {
    const { history, latest } = subject;

    // Prefer the source's live short-window price changes (e.g. DexScreener
    // m5/h1) when available — far more responsive than tick-derived deltas.
    if (latest.priceChange5m !== undefined || latest.priceChange1h !== undefined) {
      const short = latest.priceChange5m ?? latest.priceChange1h ?? 0;
      const medium = latest.priceChange1h ?? latest.priceChange5m ?? 0;
      const blended = short * 0.6 + medium * 0.4;
      return {
        signalId: this.id,
        family: this.family,
        score: squash(blended * 4),
        confidence: 0.9,
        evidence: [
          `Price ${(short * 100).toFixed(1)}% over 5m, ${(medium * 100).toFixed(1)}% over 1h`,
        ],
      };
    }

    const shortChange = pctChange(history, this.shortLookback, 'priceUsd');
    const mediumChange = pctChange(history, this.mediumLookback, 'priceUsd');

    if (shortChange === undefined) {
      return {
        signalId: this.id,
        family: this.family,
        score: 0,
        confidence: 0,
        evidence: ['Insufficient price history for momentum'],
      };
    }

    const medium = mediumChange ?? shortChange;
    // Weight short-term move, reward agreement with the medium-term trend.
    const blended = shortChange * 0.6 + medium * 0.4;
    const score = squash(blended * 6);
    const confidence = historyConfidence(history, this.mediumLookback + 1) * 0.9 + 0.1;

    return {
      signalId: this.id,
      family: this.family,
      score,
      confidence: clamp(confidence, 0, 1),
      evidence: [
        `Short-term price change ${(shortChange * 100).toFixed(1)}% over ${this.shortLookback} ticks`,
        `Medium-term price change ${(medium * 100).toFixed(1)}% over ${this.mediumLookback} ticks`,
      ],
    };
  }
}
