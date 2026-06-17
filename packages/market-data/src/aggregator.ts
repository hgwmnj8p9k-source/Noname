import {
  newSnapshotId,
  type Logger,
  type MarketSnapshot,
  type SourceHealth,
  type Token,
  type TokenWithHistory,
} from '@noname/core';
import type { SnapshotRepository } from '@noname/persistence';
import type { MarketDataSource, RawObservation } from './source.js';

/**
 * Pulls from every configured source, normalizes observations into immutable
 * snapshots, persists them append-only, and exposes the current universe as
 * `TokenWithHistory`. When multiple sources report the same token, the one with
 * the deepest liquidity wins (most reliable price), and the rest are ignored
 * for that tick.
 */
export class MarketAggregator {
  private readonly tokens = new Map<string, Token>();
  private readonly log: Logger;

  constructor(
    private readonly sources: readonly MarketDataSource[],
    private readonly snapshots: SnapshotRepository,
    logger: Logger,
  ) {
    this.log = logger.child('market');
  }

  /** Poll all sources for one tick and return the refreshed universe. */
  async refresh(now: number): Promise<readonly TokenWithHistory[]> {
    const results = await Promise.allSettled(this.sources.map((s) => s.poll(now)));

    const best = new Map<string, RawObservation>();
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        this.log.warn('source poll failed', { source: this.sources[i]?.name, error: String(r.reason) });
        return;
      }
      for (const obs of r.value) {
        const existing = best.get(obs.token.id);
        if (!existing || obs.metrics.liquidityUsd > existing.metrics.liquidityUsd) {
          best.set(obs.token.id, obs);
        }
      }
    });

    const universe: TokenWithHistory[] = [];
    for (const obs of best.values()) {
      this.tokens.set(obs.token.id, obs.token);
      const snapshot: MarketSnapshot = {
        id: newSnapshotId(),
        tokenId: obs.token.id,
        source: 'aggregate',
        timestamp: now,
        ...obs.metrics,
      };
      this.snapshots.append(snapshot);
      const history = this.snapshots.history(obs.token.id);
      universe.push({ token: obs.token, history, latest: snapshot });
    }
    return universe;
  }

  sourceHealth(): readonly SourceHealth[] {
    return this.sources.map((s) => s.health());
  }
}
