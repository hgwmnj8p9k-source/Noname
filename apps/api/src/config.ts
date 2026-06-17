/** Reads runtime configuration from the environment with safe defaults. */
export interface ApiConfig {
  readonly port: number;
  readonly host: string;
  readonly startingCashUsd: number;
  readonly tickIntervalMs: number;
  readonly seed: number;
  readonly dexScreenerQueries: string[];
  readonly autoStart: boolean;
}

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function loadApiConfig(): ApiConfig {
  return {
    port: num('PORT', 4000),
    host: process.env.HOST ?? '0.0.0.0',
    startingCashUsd: num('STARTING_CASH_USD', 10_000),
    tickIntervalMs: num('TICK_INTERVAL_MS', 2_000),
    seed: num('SIM_SEED', 1337),
    dexScreenerQueries: (process.env.DEXSCREENER_QUERIES ?? '')
      .split(',')
      .map((q) => q.trim())
      .filter(Boolean),
    autoStart: (process.env.AUTO_START ?? 'true') !== 'false',
  };
}
