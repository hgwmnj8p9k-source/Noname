import { describe, expect, it } from 'vitest';
import { ManualClock, noopLogger, type EngineEvent } from '@noname/core';
import { createEngine } from './index.js';

async function run(seed: number, ticks: number, intervalMs = 60_000) {
  const clock = new ManualClock(0);
  const events: EngineEvent[] = [];
  const engine = createEngine({ seed, tickIntervalMs: intervalMs, logger: noopLogger, clock });
  engine.onEvent((e) => events.push(e));
  for (let i = 0; i < ticks; i++) {
    clock.advance(intervalMs);
    await engine.tickOnce();
  }
  return { engine, events };
}

describe('Engine (integration)', () => {
  it('runs the full pipeline and journals decisions over the simulated feed', async () => {
    const { engine, events } = await run(1337, 150);
    const state = engine.getState();

    expect(state.ticks).toBe(150);
    expect(state.recentDecisions.length).toBeGreaterThan(0);
    expect(state.market.length).toBeGreaterThan(0);
    // The simulator produces pumps; over 150 ticks the strategy should act.
    const opened = events.filter((e) => e.type === 'position-opened').length;
    const closed = events.filter((e) => e.type === 'position-closed').length;
    expect(opened + closed).toBeGreaterThan(0);
  });

  it('keeps the books consistent: equity = cash + open positions value', async () => {
    const { engine } = await run(1337, 150);
    const s = engine.getState();
    const positionsValue = s.positions.reduce((acc, p) => acc + p.marketValueUsd.toNumber(), 0);
    expect(s.portfolio.equityUsd.toNumber()).toBeCloseTo(
      s.portfolio.cashUsd.toNumber() + positionsValue,
      4,
    );
  });

  it('produces complete post-trade analysis for every closed trade', async () => {
    const { engine } = await run(42, 200);
    for (const trade of engine.getState().recentTrades) {
      expect(trade.analysis).toBeDefined();
      expect(typeof trade.analysis.successful).toBe('boolean');
      expect(trade.analysis.notes.length).toBeGreaterThan(0);
      expect(Number.isFinite(trade.returnPct)).toBe(true);
    }
  });

  it('is fully deterministic for a given seed', async () => {
    const a = await run(7, 120);
    const b = await run(7, 120);
    expect(a.engine.getState().portfolio.equityUsd.toString()).toBe(
      b.engine.getState().portfolio.equityUsd.toString(),
    );
    expect(a.engine.getState().performance.trades).toBe(b.engine.getState().performance.trades);
  });
});
