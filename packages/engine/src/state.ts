import type {
  PerformanceStats,
  PortfolioSnapshot,
  PositionMark,
  SourceHealth,
  Token,
  TradeDecision,
  Trade,
} from '@noname/core';

export interface MarketRow {
  readonly token: Token;
  readonly priceUsd: number;
  readonly liquidityUsd: number;
  readonly volume24hUsd: number;
  readonly change: number;
  readonly socialMentions: number;
  readonly hasPosition: boolean;
}

export interface Opportunity {
  readonly token: Token;
  readonly decision: TradeDecision;
}

/** The complete engine state served over REST and seeded into the dashboard. */
export interface EngineState {
  readonly running: boolean;
  readonly startedAt: number | null;
  readonly now: number;
  readonly ticks: number;
  readonly portfolio: PortfolioSnapshot;
  readonly performance: PerformanceStats;
  readonly positions: readonly PositionMark[];
  readonly opportunities: readonly Opportunity[];
  readonly recentDecisions: readonly TradeDecision[];
  readonly recentTrades: readonly Trade[];
  readonly market: readonly MarketRow[];
  readonly sources: readonly SourceHealth[];
}
