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
    const { history } = subject;
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
