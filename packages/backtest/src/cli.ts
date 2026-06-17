import { writeFileSync } from 'node:fs';
import { runBacktest } from './backtester.js';
import { formatReport } from './report.js';

/**
 * CLI: `pnpm backtest -- --seed 7 --ticks 800 --cash 10000 --json out.json`
 */
function arg(name: string, fallback: number): number {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  const v = Number(process.argv[idx + 1]);
  return Number.isFinite(v) ? v : fallback;
}

function flag(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  return idx === -1 ? undefined : process.argv[idx + 1];
}

const report = await runBacktest({
  seed: arg('seed', 1337),
  ticks: arg('ticks', 500),
  intervalMs: arg('interval', 60_000),
  startingCashUsd: arg('cash', 10_000),
});

console.log(formatReport(report));

const jsonPath = flag('json');
if (jsonPath) {
  writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  console.log(`\nFull report written to ${jsonPath}`);
}
