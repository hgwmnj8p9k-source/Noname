import type {
  MarketSnapshot,
  Position,
  PositionId,
  TokenId,
  Trade,
  TradeDecision,
} from '@noname/core';
import type {
  DecisionRepository,
  PositionRepository,
  Repositories,
  SnapshotRepository,
  TradeRepository,
} from './repositories.js';

/** Bounded ring of snapshots per token to keep memory flat over long runs. */
class InMemorySnapshotRepository implements SnapshotRepository {
  private readonly byToken = new Map<TokenId, MarketSnapshot[]>();

  constructor(private readonly maxPerToken = 5_000) {}

  append(snapshot: MarketSnapshot): void {
    const list = this.byToken.get(snapshot.tokenId) ?? [];
    list.push(snapshot);
    if (list.length > this.maxPerToken) list.splice(0, list.length - this.maxPerToken);
    this.byToken.set(snapshot.tokenId, list);
  }

  history(tokenId: TokenId, limit?: number): readonly MarketSnapshot[] {
    const list = this.byToken.get(tokenId) ?? [];
    return limit ? list.slice(-limit) : list.slice();
  }

  latest(tokenId: TokenId): MarketSnapshot | undefined {
    const list = this.byToken.get(tokenId);
    return list && list.length > 0 ? list[list.length - 1] : undefined;
  }
}

class InMemoryDecisionRepository implements DecisionRepository {
  private readonly items: TradeDecision[] = [];
  private readonly index = new Map<string, TradeDecision>();

  constructor(private readonly max = 10_000) {}

  save(decision: TradeDecision): void {
    this.items.push(decision);
    this.index.set(decision.id, decision);
    if (this.items.length > this.max) {
      const removed = this.items.shift();
      if (removed) this.index.delete(removed.id);
    }
  }

  list(limit?: number): readonly TradeDecision[] {
    const reversed = this.items.slice().reverse();
    return limit ? reversed.slice(0, limit) : reversed;
  }

  get(id: string): TradeDecision | undefined {
    return this.index.get(id);
  }
}

class InMemoryPositionRepository implements PositionRepository {
  private readonly items = new Map<PositionId, Position>();

  upsert(position: Position): void {
    this.items.set(position.id, position);
  }

  get(id: PositionId): Position | undefined {
    return this.items.get(id);
  }

  open(): readonly Position[] {
    return [...this.items.values()].filter((p) => p.status === 'OPEN');
  }

  byToken(tokenId: TokenId): Position | undefined {
    return [...this.items.values()].find((p) => p.tokenId === tokenId && p.status === 'OPEN');
  }
}

class InMemoryTradeRepository implements TradeRepository {
  private readonly items: Trade[] = [];

  save(trade: Trade): void {
    this.items.push(trade);
  }

  list(limit?: number): readonly Trade[] {
    const reversed = this.items.slice().reverse();
    return limit ? reversed.slice(0, limit) : reversed;
  }
}

export function createInMemoryRepositories(): Repositories {
  return {
    snapshots: new InMemorySnapshotRepository(),
    decisions: new InMemoryDecisionRepository(),
    positions: new InMemoryPositionRepository(),
    trades: new InMemoryTradeRepository(),
  };
}
