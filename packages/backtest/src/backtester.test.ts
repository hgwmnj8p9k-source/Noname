import { describe, expect, it } from 'vitest';
import { runBacktest } from './backtester.js';

describe('runBacktest', () => {
  it('produces a complete, internally consistent report', async () => {
    const r = await runBacktest({ seed: 1337, ticks: 200 });
    expect(r.config.ticks).toBe(200);
    expect(r.equityCurve.length).toBe(200);
    expect(r.trades).toBe(r.wins + r.losses);
    expect(r.finalEquityUsd).toBeGreaterThan(0);
    // Exit reasons must account for exactly the closed trades.
    const exitTotal = Object.values(r.exitReasons).reduce((a, b) => a + b, 0);
    expect(exitTotal).toBe(r.trades);
  });

  it('is deterministic for a fixed seed', async () => {
    const a = await runBacktest({ seed: 7, ticks: 150 });
    const b = await runBacktest({ seed: 7, ticks: 150 });
    expect(a.finalEquityUsd).toBe(b.finalEquityUsd);
    expect(a.trades).toBe(b.trades);
    expect(a.signalEfficacy.map((s) => s.signalId)).toEqual(b.signalEfficacy.map((s) => s.signalId));
  });

  it('computes signal efficacy across observed trades', async () => {
    const r = await runBacktest({ seed: 1337, ticks: 300 });
    if (r.trades > 0) {
      expect(r.signalEfficacy.length).toBeGreaterThan(0);
      for (const s of r.signalEfficacy) {
        expect(Number.isFinite(s.edge)).toBe(true);
        expect(s.tradesObserved).toBeGreaterThan(0);
      }
    }
  });
});
