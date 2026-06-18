import { defaultSignals } from '@noname/signals';
import {
  DexScreenerSource,
  SimulatedFeed,
  type DexScreenerOptions,
  type MarketDataSource,
} from '@noname/market-data';
import {
  DEFAULT_JUPITER_CONFIG,
  DEFAULT_PAPER_VENUE_CONFIG,
  JupiterExecutionVenue,
  PaperExecutionVenue,
  type JupiterVenueConfig,
  type PaperVenueConfig,
} from '@noname/paper-trading';
import {
  DEFAULT_RISK_CONFIG,
  DEFAULT_STRATEGY_CONFIG,
  type RiskConfig,
  type StrategyConfig,
} from '@noname/strategy';
import type { Clock, Logger } from '@noname/core';
import type { Repositories } from '@noname/persistence';
import { Engine } from './engine.js';
import type { EngineConfig } from './config.js';

export * from './config.js';
export * from './state.js';
export { Engine } from './engine.js';

export interface EngineFactoryOptions {
  readonly startingCashUsd?: number;
  readonly tickIntervalMs?: number;
  /** Seed for the deterministic simulated feed. */
  readonly seed?: number;
  /** Include the offline simulator in the universe (default true). Set false
   * for a real-data-only deployment. */
  readonly includeSimulator?: boolean;
  /** Real DexScreener data: search queries and/or new-token discovery chains. */
  readonly dexScreener?: DexScreenerOptions;
  /** Overrides merged onto the default risk configuration. */
  readonly riskConfig?: Partial<RiskConfig>;
  /** Overrides merged onto the default strategy configuration. */
  readonly strategyConfig?: Partial<StrategyConfig>;
  readonly venueConfig?: Partial<PaperVenueConfig>;
  /** Use real Jupiter on-chain quotes for execution pricing (Solana). Falls
   * back to the modeled venue for non-Solana tokens or unroutable quotes. */
  readonly jupiterExecution?: boolean;
  readonly jupiterConfig?: Partial<JupiterVenueConfig>;
  readonly opportunityConvictionThreshold?: number;
  readonly clock?: Clock;
  readonly logger?: Logger;
  readonly repositories?: Repositories;
}

/**
 * Builds a fully-wired engine. By default it runs on the deterministic offline
 * simulator. Provide `dexScreener` options to ingest real market data
 * (discovery of fresh pump.fun/Solana tokens and/or specific search queries);
 * the adapter degrades gracefully if the network or API is unavailable.
 */
export function createEngine(options: EngineFactoryOptions = {}): Engine {
  const sources: MarketDataSource[] = [];
  if (options.includeSimulator ?? true) {
    sources.push(new SimulatedFeed(options.seed ?? 1337));
  }
  if (options.dexScreener) {
    const ds = new DexScreenerSource(options.dexScreener);
    if (ds.enabled) sources.push(ds);
  }
  if (sources.length === 0) sources.push(new SimulatedFeed(options.seed ?? 1337));

  const venueConfig = { ...DEFAULT_PAPER_VENUE_CONFIG, ...options.venueConfig };
  const venue = options.jupiterExecution
    ? new JupiterExecutionVenue(
        { ...DEFAULT_JUPITER_CONFIG, ...options.jupiterConfig },
        new PaperExecutionVenue(venueConfig),
      )
    : undefined;

  const config: EngineConfig = {
    startingCashUsd: options.startingCashUsd ?? 10_000,
    tickIntervalMs: options.tickIntervalMs ?? 2_000,
    sources,
    signals: defaultSignals(),
    strategyConfig: { ...DEFAULT_STRATEGY_CONFIG, ...options.strategyConfig },
    riskConfig: { ...DEFAULT_RISK_CONFIG, ...options.riskConfig },
    venueConfig,
    venue,
    opportunityConvictionThreshold: options.opportunityConvictionThreshold ?? 0.2,
  };

  return new Engine(config, options.clock, options.logger, options.repositories);
}
