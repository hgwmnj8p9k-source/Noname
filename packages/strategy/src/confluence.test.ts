import { describe, expect, it } from 'vitest';
import {
  newSnapshotId,
  tokenId,
  type MarketSnapshot,
  type Signal,
  type SignalFamily,
  type SignalResult,
  type TokenWithHistory,
} from '@noname/core';
import { ConfluenceEngine } from './confluence.js';
import { DEFAULT_STRATEGY_CONFIG } from './config.js';

function stub(id: string, family: SignalFamily, score: number, confidence = 1, veto = false): Signal {
  return {
    id,
    family,
    description: id,
    evaluate(): SignalResult {
      return { signalId: id, family, score, confidence, evidence: [`${id}=${score}`], veto };
    },
  };
}

const tid = tokenId('simulated', 'x');
const snap: MarketSnapshot = {
  id: newSnapshotId(),
  tokenId: tid,
  source: 'test',
  timestamp: 1,
  priceUsd: 1,
  liquidityUsd: 100_000,
  volume24hUsd: 100_000,
  marketCapUsd: 1_000_000,
  buys: 1,
  sells: 1,
  holders: 1000,
  topHolderConcentration: 0.1,
  liquidityLocked: true,
  socialMentions: 1,
  socialSentiment: 0,
};
const subject: TokenWithHistory = {
  token: { id: tid, chain: 'simulated', address: 'x', symbol: 'X', name: 'X' },
  history: [snap],
  latest: snap,
};

describe('ConfluenceEngine', () => {
  it('rejects when only one family confirms, however strong', () => {
    const engine = new ConfluenceEngine([stub('a', 'price', 1)], DEFAULT_STRATEGY_CONFIG);
    const a = engine.assess(subject);
    expect(a.confirmations).toBe(1);
    expect(a.enter).toBe(false);
  });

  it('enters when enough independent families confirm', () => {
    const engine = new ConfluenceEngine(
      [
        stub('a', 'price', 0.8),
        stub('b', 'liquidity', 0.7),
        stub('c', 'onchain', 0.7),
        stub('d', 'social', 0.6),
      ],
      DEFAULT_STRATEGY_CONFIG,
    );
    const a = engine.assess(subject);
    expect(a.confirmations).toBe(4);
    expect(a.enter).toBe(true);
    expect(a.conviction).toBeGreaterThan(DEFAULT_STRATEGY_CONFIG.minConviction);
  });

  it('honours a veto regardless of other strong signals', () => {
    const engine = new ConfluenceEngine(
      [
        stub('a', 'price', 1),
        stub('b', 'liquidity', 1),
        stub('c', 'onchain', 1),
        stub('veto', 'onchain', -1, 1, true),
      ],
      DEFAULT_STRATEGY_CONFIG,
    );
    const a = engine.assess(subject);
    expect(a.vetoed).toBe(true);
    expect(a.enter).toBe(false);
  });

  it('does not count two signals in the same family as two confirmations', () => {
    const engine = new ConfluenceEngine(
      [stub('a', 'price', 0.9), stub('b', 'price', 0.9), stub('c', 'price', 0.9)],
      DEFAULT_STRATEGY_CONFIG,
    );
    const a = engine.assess(subject);
    expect(a.confirmations).toBe(1);
    expect(a.enter).toBe(false);
  });
});
