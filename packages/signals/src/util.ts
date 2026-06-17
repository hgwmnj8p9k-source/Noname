import type { MarketSnapshot } from '@noname/core';

/** Squash any real number to [-1, 1] with a smooth curve. */
export function squash(x: number): number {
  return Math.tanh(x);
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/** Value of `field` `lookback` snapshots before the latest, if available. */
export function past(
  history: readonly MarketSnapshot[],
  lookback: number,
  field: keyof MarketSnapshot,
): number | undefined {
  const idx = history.length - 1 - lookback;
  if (idx < 0) return undefined;
  const v = history[idx]?.[field];
  return typeof v === 'number' ? v : undefined;
}

/** Fractional change of `field` over `lookback` snapshots (e.g. 0.2 = +20%). */
export function pctChange(
  history: readonly MarketSnapshot[],
  lookback: number,
  field: keyof MarketSnapshot,
): number | undefined {
  const prev = past(history, lookback, field);
  const latest = history[history.length - 1]?.[field];
  if (prev === undefined || typeof latest !== 'number' || prev === 0) return undefined;
  return (latest - prev) / prev;
}

/** Mean of `field` over the trailing `window` snapshots. */
export function mean(
  history: readonly MarketSnapshot[],
  window: number,
  field: keyof MarketSnapshot,
): number | undefined {
  const slice = history.slice(-window);
  if (slice.length === 0) return undefined;
  let sum = 0;
  let n = 0;
  for (const s of slice) {
    const v = s[field];
    if (typeof v === 'number') {
      sum += v;
      n++;
    }
  }
  return n > 0 ? sum / n : undefined;
}

/** Confidence that scales from 0→1 as available history approaches `needed`. */
export function historyConfidence(history: readonly MarketSnapshot[], needed: number): number {
  return clamp(history.length / needed, 0, 1);
}
