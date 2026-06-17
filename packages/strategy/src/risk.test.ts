import { describe, expect, it } from 'vitest';
import { fixed } from '@noname/core';
import { RiskManager } from './risk.js';
import { DEFAULT_RISK_CONFIG } from './config.js';

describe('RiskManager', () => {
  const rm = new RiskManager(DEFAULT_RISK_CONFIG);
  const base = {
    equityUsd: fixed(10_000),
    cashUsd: fixed(10_000),
    openPositions: 0,
    exposurePct: 0,
  };

  it('sizes from the fixed-fractional risk model and sets SL/TP', () => {
    const r = rm.size({ portfolio: base, entryPrice: fixed(2), conviction: 1 });
    expect(r.approved).toBe(true);
    if (r.approved) {
      // risk budget 2% of 10k = 200; /15% stop = 1333; capped at 20% equity = 2000.
      expect(r.sizeUsd.toNumber()).toBeCloseTo(1333.33, 0);
      expect(r.stopLossPrice.toNumber()).toBeCloseTo(2 * 0.85, 6);
      expect(r.takeProfitPrice.toNumber()).toBeCloseTo(2 * 1.4, 6);
    }
  });

  it('scales size down with conviction', () => {
    const high = rm.size({ portfolio: base, entryPrice: fixed(2), conviction: 1 });
    const low = rm.size({ portfolio: base, entryPrice: fixed(2), conviction: 0.5 });
    if (high.approved && low.approved) {
      expect(low.sizeUsd.toNumber()).toBeLessThan(high.sizeUsd.toNumber());
    }
  });

  it('rejects when max concurrent positions reached', () => {
    const r = rm.size({
      portfolio: { ...base, openPositions: DEFAULT_RISK_CONFIG.maxConcurrentPositions },
      entryPrice: fixed(2),
      conviction: 1,
    });
    expect(r.approved).toBe(false);
  });

  it('respects available cash', () => {
    const r = rm.size({
      portfolio: { ...base, cashUsd: fixed(100) },
      entryPrice: fixed(2),
      conviction: 1,
    });
    if (r.approved) expect(r.sizeUsd.toNumber()).toBeLessThanOrEqual(100);
  });
});
