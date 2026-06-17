import type {
  MarketSnapshot,
  Position,
  PositionId,
  TokenId,
  Trade,
  TradeDecision,
} from '@noname/core';

/**
 * Repository contracts. The engine depends only on these interfaces, so the
 * in-memory store used today can be replaced by Postgres/TimescaleDB in
 * Milestone 2 without touching any engine code.
 */
export interface SnapshotRepository {
  append(snapshot: MarketSnapshot): void;
  /** History for a token, oldest → newest, optionally limited to the last N. */
  history(tokenId: TokenId, limit?: number): readonly MarketSnapshot[];
  latest(tokenId: TokenId): MarketSnapshot | undefined;
}

export interface DecisionRepository {
  save(decision: TradeDecision): void;
  list(limit?: number): readonly TradeDecision[];
  get(id: string): TradeDecision | undefined;
}

export interface PositionRepository {
  upsert(position: Position): void;
  get(id: PositionId): Position | undefined;
  open(): readonly Position[];
  byToken(tokenId: TokenId): Position | undefined;
}

export interface TradeRepository {
  save(trade: Trade): void;
  list(limit?: number): readonly Trade[];
}

export interface Repositories {
  readonly snapshots: SnapshotRepository;
  readonly decisions: DecisionRepository;
  readonly positions: PositionRepository;
  readonly trades: TradeRepository;
}
