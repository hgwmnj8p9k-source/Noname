import type { DecisionId, PositionId, TokenId } from '../ids.js';
import type { Fixed } from '../money.js';

export type PositionStatus = 'OPEN' | 'CLOSED';

export interface Position {
  readonly id: PositionId;
  readonly tokenId: TokenId;
  readonly symbol: string;
  readonly status: PositionStatus;

  /** Decision that opened the position. */
  readonly entryDecisionId: DecisionId;
  readonly entryPrice: Fixed;
  readonly quantity: Fixed;
  readonly costBasisUsd: Fixed;
  readonly entryFeesUsd: Fixed;
  readonly openedAt: number;

  readonly stopLossPrice: Fixed;
  readonly takeProfitPrice: Fixed;
  /** Highest price seen since entry, for trailing logic. */
  readonly highWaterPrice: Fixed;
}

/** Mark-to-market view of an open position against a current price. */
export interface PositionMark {
  readonly position: Position;
  readonly currentPrice: Fixed;
  readonly marketValueUsd: Fixed;
  readonly unrealizedPnlUsd: Fixed;
  readonly unrealizedPnlPct: number;
}
