import { describe, expect, it } from 'vitest';
import { newSnapshotId, tokenId, type MarketSnapshot, type TokenWithHistory } from '@noname/core';
import { PriceMomentumSignal } from './signals/price-momentum.js';
import { VolumeSurgeSignal } from './signals/volume-surge.js';
import { BuyPressureSignal } from './signals/buy-pressure.js';

const tid = tokenId('solana', 'abc');

function subjectWith(extra: Partial<MarketSnapshot>): TokenWithHistory {
  const latest: MarketSnapshot = {
    id: newSnapshotId(),
    tokenId: tid,
    source: 'dexscreener',
    timestamp: 1,
    priceUsd: 0.001,
    liquidityUsd: 50_000,
    volume24hUsd: 200_000,
    marketCapUsd: 1_000_000,
    buys: 0,
    sells: 0,
    holders: 0,
    topHolderConcentration: 0,
    liquidityLocked: false,
    socialMentions: 0,
    socialSentiment: 0,
    ...extra,
  };
  return {
    token: { id: tid, chain: 'solana', address: 'abc', symbol: 'ABC', name: 'ABC' },
    history: [latest],
    latest,
  };
}

describe('signals on live short-window data', () => {
  it('momentum reads m5/h1 price change directly (no long history needed)', () => {
    const r = new PriceMomentumSignal().evaluate(subjectWith({ priceChange5m: 0.42, priceChange1h: 0.8 }));
    expect(r.score).toBeGreaterThan(0.5);
    expect(r.confidence).toBeGreaterThan(0.5);
  });

  it('volume surge compares 5m volume to hourly pace', () => {
    // 5m volume of 5000 vs hourly 12000 (pace 1000/5m) => 5x surge.
    const hot = new VolumeSurgeSignal().evaluate(subjectWith({ volume5mUsd: 5_000, volume1hUsd: 12_000 }));
    const cold = new VolumeSurgeSignal().evaluate(subjectWith({ volume5mUsd: 500, volume1hUsd: 12_000 }));
    expect(hot.score).toBeGreaterThan(cold.score);
    expect(hot.score).toBeGreaterThan(0);
  });

  it('buy pressure uses 5m flow imbalance', () => {
    const r = new BuyPressureSignal().evaluate(subjectWith({ buys5m: 80, sells5m: 20 }));
    expect(r.score).toBeGreaterThan(0);
    expect(r.confidence).toBeGreaterThan(0.5);
  });
});
