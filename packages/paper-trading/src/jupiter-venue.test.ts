import { describe, expect, it } from 'vitest';
import { fixed, newSnapshotId, tokenId, type ExecutionVenue, type MarketSnapshot } from '@noname/core';
import { JupiterExecutionVenue, DEFAULT_JUPITER_CONFIG } from './jupiter-venue.js';

function snapshot(address: string, priceUsd: number): MarketSnapshot {
  return {
    id: newSnapshotId(),
    tokenId: tokenId('solana', address),
    source: 'test',
    timestamp: 1,
    priceUsd,
    liquidityUsd: 100_000,
    volume24hUsd: 50_000,
    marketCapUsd: 1_000_000,
    buys: 1,
    sells: 1,
    holders: 0,
    topHolderConcentration: 0,
    liquidityLocked: false,
    socialMentions: 0,
    socialSentiment: 0,
  };
}

const fallback: ExecutionVenue = {
  kind: 'paper',
  async execute(order) {
    return {
      tokenId: order.tokenId,
      side: order.side,
      avgPrice: fixed(order.referenceSnapshot.priceUsd.toString()),
      quantity: fixed(1),
      notionalUsd: order.notionalUsd,
      feesUsd: fixed(0),
      slippagePct: -1, // sentinel so we can detect the fallback path
      partial: false,
      timestamp: order.referenceSnapshot.timestamp,
    };
  },
};

function fakeFetch(priceImpactPct: string, ok = true) {
  return async () => ({ ok, status: ok ? 200 : 500, json: async () => ({ priceImpactPct, outAmount: '1000' }) });
}

describe('JupiterExecutionVenue', () => {
  const addr = 'So1aNaMint1111111111111111111111111111111';

  it('prices a buy using Jupiter live price impact', async () => {
    const venue = new JupiterExecutionVenue(DEFAULT_JUPITER_CONFIG, fallback, fakeFetch('0.02'));
    const fill = await venue.execute({
      tokenId: tokenId('solana', addr),
      side: 'BUY',
      notionalUsd: fixed(25),
      referenceSnapshot: snapshot(addr, 0.001),
    });
    expect(fill.slippagePct).toBeCloseTo(0.02, 6);
    // Buyers pay the reference price plus the real impact.
    expect(fill.avgPrice.toNumber()).toBeCloseTo(0.001 * 1.02, 9);
    expect(fill.feesUsd.toNumber()).toBeGreaterThan(0);
  });

  it('falls back to the modeled venue for non-Solana tokens', async () => {
    const venue = new JupiterExecutionVenue(DEFAULT_JUPITER_CONFIG, fallback, fakeFetch('0.02'));
    const fill = await venue.execute({
      tokenId: tokenId('ethereum', '0xabc'),
      side: 'BUY',
      notionalUsd: fixed(25),
      referenceSnapshot: { ...snapshot(addr, 0.001), tokenId: tokenId('ethereum', '0xabc') },
    });
    expect(fill.slippagePct).toBe(-1); // sentinel from fallback
  });

  it('falls back when the quote fails', async () => {
    const venue = new JupiterExecutionVenue(DEFAULT_JUPITER_CONFIG, fallback, fakeFetch('0', false));
    const fill = await venue.execute({
      tokenId: tokenId('solana', addr),
      side: 'BUY',
      notionalUsd: fixed(25),
      referenceSnapshot: snapshot(addr, 0.001),
    });
    expect(fill.slippagePct).toBe(-1);
  });
});
