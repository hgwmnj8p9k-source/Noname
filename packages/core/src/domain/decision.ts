import type { DecisionId, TokenId } from '../ids.js';
import type { SignalFamily, SignalResult } from './signal.js';

export type DecisionAction = 'ENTER' | 'SKIP' | 'EXIT';

/** A signal's contribution to a decision, as recorded in the journal. */
export interface SignalContribution {
  readonly signalId: string;
  readonly family: SignalFamily;
  readonly score: number;
  readonly confidence: number;
  /** Weighted contribution to the final conviction. */
  readonly weightedScore: number;
  readonly evidence: readonly string[];
}

/**
 * An immutable record of a decision the engine reached for a token at a tick,
 * including the full reasoning. Every decision — including SKIPs — is journaled
 * so the system can explain why it did *not* trade as well as why it did.
 */
export interface TradeDecision {
  readonly id: DecisionId;
  readonly tokenId: TokenId;
  readonly timestamp: number;
  readonly action: DecisionAction;

  /** Final conviction in [-1, 1]; sizing scales with magnitude. */
  readonly conviction: number;
  /** Number of independent families that confirmed the direction. */
  readonly confirmations: number;

  /** Present for ENTER decisions. */
  readonly sizeUsd?: number;
  readonly stopLossPrice?: number;
  readonly takeProfitPrice?: number;

  readonly contributions: readonly SignalContribution[];
  /** Ordered, human-readable reasoning lines. */
  readonly reasoning: readonly string[];
  /** Why a SKIP/EXIT happened, when applicable. */
  readonly rejectionReason?: string;
}

export function rawSignalToContribution(s: SignalResult, weight: number): SignalContribution {
  return {
    signalId: s.signalId,
    family: s.family,
    score: s.score,
    confidence: s.confidence,
    weightedScore: s.score * s.confidence * weight,
    evidence: s.evidence,
  };
}
