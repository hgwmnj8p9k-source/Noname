import type { DecisionId, PositionId, TokenId, TradeId } from '../ids.js';
import type { Fixed } from '../money.js';

export type ExitReason =
  | 'STOP_LOSS'
  | 'TAKE_PROFIT'
  | 'TRAILING_STOP'
  | 'SIGNAL_EXIT'
  | 'MANUAL';

/**
 * Post-trade analysis answers the questions the platform must always be able to
 * answer for every completed trade.
 */
export interface PostTradeAnalysis {
  /** Did execution follow the strategy's rules (sizing, SL/TP, confluence)? */
  readonly followedStrategy: boolean;
  readonly successful: boolean;
  readonly strongestSignal?: { signalId: string; weightedScore: number };
  readonly weakestSignal?: { signalId: string; weightedScore: number };
  /** Free-form, generated lessons. */
  readonly whatCouldImprove: readonly string[];
  readonly notes: readonly string[];
}

export interface Trade {
  readonly id: TradeId;
  readonly positionId: PositionId;
  readonly tokenId: TokenId;
  readonly symbol: string;

  readonly entryDecisionId: DecisionId;
  readonly exitDecisionId: DecisionId;

  readonly entryPrice: Fixed;
  readonly exitPrice: Fixed;
  readonly quantity: Fixed;

  readonly grossPnlUsd: Fixed;
  readonly feesUsd: Fixed;
  readonly netPnlUsd: Fixed;
  readonly returnPct: number;

  readonly openedAt: number;
  readonly closedAt: number;
  readonly holdingPeriodMs: number;
  readonly exitReason: ExitReason;

  readonly analysis: PostTradeAnalysis;
}
