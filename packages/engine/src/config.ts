import type { Signal } from '@noname/core';
import type { MarketDataSource } from '@noname/market-data';
import type { PaperVenueConfig } from '@noname/paper-trading';
import type { RiskConfig, StrategyConfig } from '@noname/strategy';

export interface EngineConfig {
  readonly startingCashUsd: number;
  readonly tickIntervalMs: number;
  readonly sources: readonly MarketDataSource[];
  readonly signals: readonly Signal[];
  readonly strategyConfig: StrategyConfig;
  readonly riskConfig: RiskConfig;
  readonly venueConfig: PaperVenueConfig;
  /** SKIP decisions are streamed as "opportunities" only above this conviction. */
  readonly opportunityConvictionThreshold: number;
}
