import type { Signal, SignalResult, TokenWithHistory } from '@noname/core';
import { clamp, mean, squash } from '../util.js';

/**
 * Social family. Rising mention volume combined with positive sentiment is an
 * independent confirmation that attention — the fuel of memecoin moves — is
 * arriving. Independent of price/liquidity/on-chain so it counts toward
 * confluence.
 */
export class SocialMomentumSignal implements Signal {
  readonly id = 'social.momentum';
  readonly family = 'social' as const;
  readonly description = 'Mention growth and sentiment';

  constructor(private readonly window = 8) {}

  evaluate(subject: TokenWithHistory): SignalResult {
    const { history, latest } = subject;
    const avgMentions = mean(history.slice(0, -1), this.window, 'socialMentions');

    if (latest.socialMentions === 0 && (avgMentions ?? 0) === 0) {
      return {
        signalId: this.id,
        family: this.family,
        score: 0,
        confidence: 0,
        evidence: ['No social data available'],
      };
    }

    const ratio = avgMentions && avgMentions > 0 ? latest.socialMentions / avgMentions : 1;
    const mentionScore = squash((ratio - 1) * 0.7);
    const sentimentScore = clamp(latest.socialSentiment, -1, 1);
    const score = mentionScore * 0.6 + sentimentScore * 0.4;
    const confidence = clamp(0.3 + Math.min(latest.socialMentions, 100) / 100, 0, 1);

    return {
      signalId: this.id,
      family: this.family,
      score,
      confidence,
      evidence: [
        `Mentions ${ratio.toFixed(2)}x trailing average (${latest.socialMentions} now)`,
        `Sentiment ${sentimentScore >= 0 ? '+' : ''}${(sentimentScore * 100).toFixed(0)}%`,
      ],
    };
  }
}
