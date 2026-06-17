import type { TokenWithHistory } from './market.js';

/**
 * Independent families of evidence. Confluence is enforced *across* families:
 * a trade requires confirmation from multiple distinct families so that no
 * single source or indicator can trigger a trade on its own.
 */
export type SignalFamily = 'price' | 'liquidity' | 'onchain' | 'social';

export interface SignalResult {
  readonly signalId: string;
  readonly family: SignalFamily;
  /** Directional strength, -1 (strong bearish) .. +1 (strong bullish). */
  readonly score: number;
  /** How much to trust this score given data quality, 0..1. */
  readonly confidence: number;
  /** Human-readable evidence lines shown in the reasoning panel. */
  readonly evidence: readonly string[];
  /**
   * Hard veto. If true, the entry is rejected regardless of other signals
   * (e.g. honeypot / rug-risk detected). Used sparingly.
   */
  readonly veto?: boolean;
}

/**
 * A signal generator. Pure function of point-in-time history → a scored,
 * evidenced result. Implementations must not perform side effects or look at
 * data newer than `subject.latest.timestamp`.
 */
export interface Signal {
  readonly id: string;
  readonly family: SignalFamily;
  readonly description: string;
  evaluate(subject: TokenWithHistory): SignalResult;
}
