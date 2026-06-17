import type { Signal, SignalResult, TokenWithHistory } from '@noname/core';
import { clamp, historyConfidence, mean, squash } from '../util.js';

/**
 * Price family (activity). Compares current volume to its trailing average; a
 * surge is an early tell that a move has participation behind it rather than a
 * thin-liquidity wick.
 */
export class VolumeSurgeSignal implements Signal {
  readonly id = 'price.volume_surge';
  readonly family = 'price' as const;
  readonly description = 'Trading volume relative to trailing average';

  constructor(private readonly window = 12) {}

  evaluate(subject: TokenWithHistory): SignalResult {
    const { history, latest } = subject;
    const avg = mean(history.slice(0, -1), this.window, 'volume24hUsd');

    if (avg === undefined || avg <= 0) {
      return {
        signalId: this.id,
        family: this.family,
        score: 0,
        confidence: 0,
        evidence: ['Insufficient volume history'],
      };
    }

    const ratio = latest.volume24hUsd / avg;
    // ratio 1 → neutral, 3x → strongly positive, <0.5x → negative (fading).
    const score = squash((ratio - 1) * 0.8);
    const confidence = historyConfidence(history, this.window + 1);

    return {
      signalId: this.id,
      family: this.family,
      score,
      confidence: clamp(confidence, 0, 1),
      evidence: [`Volume is ${ratio.toFixed(2)}x its ${this.window}-tick average`],
    };
  }
}
