import type { DexScreenerOptions } from '@noname/market-data';
import type { RiskConfig, StrategyConfig } from '@noname/strategy';
import type { PaperVenueConfig } from '@noname/paper-trading';

/** Reads runtime configuration from the environment with safe defaults. */
export interface ApiConfig {
  readonly port: number;
  readonly host: string;
  readonly startingCashUsd: number;
  readonly tickIntervalMs: number;
  readonly seed: number;
  readonly includeSimulator: boolean;
  readonly dexScreener?: DexScreenerOptions;
  readonly riskConfig: Partial<RiskConfig>;
  readonly strategyConfig: Partial<StrategyConfig>;
  readonly venueConfig: Partial<PaperVenueConfig>;
  /** Use real Jupiter quotes for execution pricing. */
  readonly jupiterExecution: boolean;
  readonly lpFeePct?: number;
  readonly autoStart: boolean;
  /** Absolute or relative path to the built dashboard to serve, if present. */
  readonly staticDir: string;
}

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function list(name: string): string[] {
  return (process.env[name] ?? '')
    .split(',')
    .map((q) => q.trim())
    .filter(Boolean);
}

function optNum(name: string): number | undefined {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Scales risk defaults down for small paper balances so it can actually trade. */
function smallAccountDefaults(cash: number): Partial<RiskConfig> {
  if (cash > 500) return {};
  return {
    riskPerTradePct: 0.04,
    maxPositionPct: 0.3,
    maxConcurrentPositions: 3,
    minPositionUsd: Math.max(2, Math.round(cash * 0.05)),
  };
}

function pick<T extends object>(entries: [keyof T, number | undefined][]): Partial<T> {
  const out: Partial<T> = {};
  for (const [key, value] of entries) {
    if (value !== undefined) (out as Record<string, number>)[key as string] = value;
  }
  return out;
}

export function loadApiConfig(): ApiConfig {
  const startingCashUsd = num('STARTING_CASH_USD', 10_000);
  const queries = list('DEXSCREENER_QUERIES');
  const discoverChains = list('DEXSCREENER_DISCOVER');
  const hasRealData = queries.length > 0 || discoverChains.length > 0;

  const riskOverrides = pick<RiskConfig>([
    ['riskPerTradePct', optNum('RISK_PER_TRADE_PCT')],
    ['maxPositionPct', optNum('MAX_POSITION_PCT')],
    ['maxConcurrentPositions', optNum('MAX_CONCURRENT_POSITIONS')],
    ['maxPortfolioExposurePct', optNum('MAX_EXPOSURE_PCT')],
    ['minPositionUsd', optNum('MIN_POSITION_USD')],
    ['minLiquidityUsd', optNum('MIN_LIQUIDITY_USD')],
    ['stopLossPct', optNum('STOP_LOSS_PCT')],
    ['takeProfitPct', optNum('TAKE_PROFIT_PCT')],
    ['trailingStopPct', optNum('TRAILING_STOP_PCT')],
  ]);

  const strategyOverrides = pick<StrategyConfig>([
    ['minConfirmations', optNum('MIN_CONFIRMATIONS')],
    ['minConviction', optNum('MIN_CONVICTION')],
  ]);

  const venueOverrides = pick<PaperVenueConfig>([
    ['takerFeePct', optNum('TAKER_FEE_PCT')],
    ['networkFeeUsd', optNum('NETWORK_FEE_USD')],
  ]);

  return {
    port: num('PORT', 4000),
    host: process.env.HOST ?? '0.0.0.0',
    startingCashUsd,
    tickIntervalMs: num('TICK_INTERVAL_MS', hasRealData ? 15_000 : 2_000),
    seed: num('SIM_SEED', 1337),
    // Default to real-data-only when real sources are configured.
    includeSimulator: (process.env.INCLUDE_SIMULATOR ?? (hasRealData ? 'false' : 'true')) !== 'false',
    dexScreener: hasRealData ? { queries, discoverChains } : undefined,
    riskConfig: { ...smallAccountDefaults(startingCashUsd), ...riskOverrides },
    strategyConfig: strategyOverrides,
    venueConfig: venueOverrides,
    // Default to real Jupiter pricing whenever Solana discovery is on.
    jupiterExecution: (process.env.EXECUTION ?? (discoverChains.includes('solana') ? 'jupiter' : 'model')) === 'jupiter',
    lpFeePct: optNum('LP_FEE_PCT'),
    autoStart: (process.env.AUTO_START ?? 'true') !== 'false',
    staticDir: process.env.STATIC_DIR ?? '../dashboard/dist',
  };
}
