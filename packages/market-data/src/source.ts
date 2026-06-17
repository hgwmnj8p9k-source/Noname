import type { SourceHealth, Token } from '@noname/core';

/** The numeric body of a snapshot, before the aggregator stamps id/time/source. */
export interface SnapshotMetrics {
  readonly priceUsd: number;
  readonly liquidityUsd: number;
  readonly volume24hUsd: number;
  readonly marketCapUsd: number;
  readonly buys: number;
  readonly sells: number;
  readonly holders: number;
  readonly topHolderConcentration: number;
  readonly liquidityLocked: boolean;
  readonly socialMentions: number;
  readonly socialSentiment: number;
}

export interface RawObservation {
  readonly token: Token;
  readonly metrics: SnapshotMetrics;
}

/**
 * A data source ("sense") of the platform. Each source is fully isolated: a
 * failing source reports unhealthy and returns no observations rather than
 * throwing, so the aggregator degrades gracefully instead of crashing.
 */
export interface MarketDataSource {
  readonly name: string;
  poll(now: number): Promise<readonly RawObservation[]>;
  health(): SourceHealth;
}
