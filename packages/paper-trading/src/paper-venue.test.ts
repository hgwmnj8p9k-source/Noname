import { describe, expect, it } from 'vitest';
import { fixed, newSnapshotId, tokenId, type MarketSnapshot } from '@noname/core';
import { PaperExecutionVenue } from './paper-venue.js';

function snapshot(priceUsd: number, liquidityUsd: number): MarketSnapshot {
  return {
    id: newSnapshotId(),
    tokenId: tokenId('simulated', 'abc'),
    source: 'test',
    timestamp: 1,
    priceUsd,
    liquidityUsd,
    volume24hUsd: liquidityUsd,
    marketCapUsd: liquidityUsd * 10,
    buys: 10,
    sells: 5,
    holders: 1000,
    topHolderConcentration: 0.1,
    liquidityLocked: true,
    socialMentions: 10,
    socialSentiment: 0.2,
  };
}

describe('PaperExecutionVenue', () => {
  const venue = new PaperExecutionVenue();
  const tid = tokenId('simulated', 'abc');

  it('charges slippage and fees on a buy', async () => {
    const fill = await venue.execute({
      tokenId: tid,
      side: 'BUY',
      notionalUsd: fixed(1000),
      referenceSnapshot: snapshot(0.01, 500_000),
    });
    expect(fill.slippagePct).toBeGreaterThan(0);
    // Buyers pay above the reference price.
    expect(fill.avgPrice.toNumber()).toBeGreaterThan(0.01);
    expect(fill.feesUsd.toNumber()).toBeGreaterThan(0);
    expect(fill.partial).toBe(false);
  });

  it('applies larger slippage in thinner pools', async () => {
    const deep = await venue.execute({
      tokenId: tid,
      side: 'BUY',
      notionalUsd: fixed(1000),
      referenceSnapshot: snapshot(0.01, 1_000_000),
    });
    const thin = await venue.execute({
      tokenId: tid,
      side: 'BUY',
      notionalUsd: fixed(1000),
      referenceSnapshot: snapshot(0.01, 50_000),
    });
    expect(thin.slippagePct).toBeGreaterThan(deep.slippagePct);
  });

  it('partially fills orders that exceed the pool fraction', async () => {
    const fill = await venue.execute({
      tokenId: tid,
      side: 'BUY',
      notionalUsd: fixed(100_000),
      referenceSnapshot: snapshot(0.01, 200_000), // max fill = 5% = 10k
    });
    expect(fill.partial).toBe(true);
    expect(fill.notionalUsd.toNumber()).toBeLessThan(100_000);
  });

  it('sells below the reference price', async () => {
    const fill = await venue.execute({
      tokenId: tid,
      side: 'SELL',
      notionalUsd: fixed(1000),
      referenceSnapshot: snapshot(0.01, 500_000),
    });
    expect(fill.avgPrice.toNumber()).toBeLessThan(0.01);
  });
});
