import { describe, expect, it } from 'vitest';
import { ManualClock, noopLogger } from '@noname/core';
import { createEngine } from './index.js';

async function run(seed: number, ticks: number) {
  const clock = new ManualClock(0);
  const engine = createEngine({ seed, tickIntervalMs: 60_000, logger: noopLogger, clock });
  for (let i = 0; i < ticks; i++) {
    clock.advance(60_000);
    await engine.tickOnce();
  }
  return { engine, clock };
}

describe('engine state persistence', () => {
  it('round-trips portfolio, positions and trades through export/import', async () => {
    const { engine } = await run(1337, 160);
    const before = engine.getState();
    const snapshot = engine.exportState();

    // Snapshot must be plain JSON (money as strings).
    const json = JSON.parse(JSON.stringify(snapshot));
    expect(typeof json.portfolio.cashUsd).toBe('string');

    // Restore into a fresh engine and compare the durable figures.
    const fresh = createEngine({ seed: 999, logger: noopLogger, clock: new ManualClock(0) });
    fresh.importState(json);
    const after = fresh.getState();

    expect(after.portfolio.cashUsd.toString()).toBe(before.portfolio.cashUsd.toString());
    expect(after.portfolio.realizedPnlUsd.toString()).toBe(before.portfolio.realizedPnlUsd.toString());
    expect(after.positions.length).toBe(before.positions.length);
    expect(after.performance.trades).toBe(before.performance.trades);
    expect(after.performance.netPnlUsd.toString()).toBe(before.performance.netPnlUsd.toString());
  });
});
