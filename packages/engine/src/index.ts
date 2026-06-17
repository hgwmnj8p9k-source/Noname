import { defaultSignals } from '@noname/signals';
import { DexScreenerSource, SimulatedFeed, type MarketDataSource } from '@noname/market-data';
import { DEFAULT_PAPER_VENUE_CONFIG } from '@noname/paper-trading';
import { DEFAULT_RISK_CONFIG, DEFAULT_STRATEGY_CONFIG } from '@noname/strategy';
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
  /** Optional DexScreener search queries; when set, the real adapter is added. */
  readonly dexScreenerQueries?: readonly string[];
  readonly clock?: Clock;
  readonly logger?: Logger;
  readonly repositories?: Repositories;
}

/**
 * Builds a fully-wired engine with sensible defaults: the deterministic
 * simulated feed plus the default multi-family signal suite. Pass DexScreener
 * queries to additionally pull live data (it degrades gracefully if the network
 * or API is unavailable).
 */
export function createEngine(options: EngineFactoryOptions = {}): Engine {
  const sources: MarketDataSource[] = [new SimulatedFeed(options.seed ?? 1337)];
  if (options.dexScreenerQueries && options.dexScreenerQueries.length > 0) {
    sources.push(new DexScreenerSource(options.dexScreenerQueries));
  }

  const config: EngineConfig = {
    startingCashUsd: options.startingCashUsd ?? 10_000,
    tickIntervalMs: options.tickIntervalMs ?? 2_000,
    sources,
    signals: defaultSignals(),
    strategyConfig: DEFAULT_STRATEGY_CONFIG,
    riskConfig: DEFAULT_RISK_CONFIG,
    venueConfig: DEFAULT_PAPER_VENUE_CONFIG,
    opportunityConvictionThreshold: 0.2,
  };

  return new Engine(config, options.clock, options.logger, options.repositories);
}
