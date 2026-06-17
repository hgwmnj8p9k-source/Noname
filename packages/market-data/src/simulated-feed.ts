import { tokenId, type SourceHealth, type Token } from '@noname/core';
import type { MarketDataSource, RawObservation, SnapshotMetrics } from './source.js';

/** Deterministic PRNG (mulberry32) so simulated runs are fully reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Regime = 'accumulation' | 'pump' | 'distribution' | 'dump' | 'chop';

interface SimToken {
  token: Token;
  price: number;
  liquidity: number;
  baseVolume: number;
  holders: number;
  social: number;
  sentiment: number;
  topHolderConcentration: number;
  liquidityLocked: boolean;
  /** Persistent rug risk: thin liquidity + concentrated holders + unlocked. */
  rugProne: boolean;
  regime: Regime;
  regimeTicksLeft: number;
}

const SYMBOLS = [
  'DOGE2', 'PEPE9', 'WIFHAT', 'BONKX', 'FLOKIX', 'SHIBA3', 'MOON', 'CHAD',
  'WOJAK', 'TURBO', 'MOG', 'SNEK',
];

/**
 * A realistic, fully deterministic memecoin market simulator. It models regime
 * transitions (accumulation → pump → distribution → dump → chop) where during a
 * pump price, volume, social activity and liquidity rise *together* — exactly
 * the multi-family confluence the strategy is designed to detect — while a
 * subset of "rug-prone" tokens carry concentrated holders and unlocked
 * liquidity for the on-chain veto to catch.
 */
export class SimulatedFeed implements MarketDataSource {
  readonly name = 'simulated';
  private readonly rng: () => number;
  private readonly tokens: SimToken[];
  private lastUpdate = 0;

  constructor(seed = 1337, universe = SYMBOLS.length) {
    this.rng = mulberry32(seed);
    this.tokens = [];
    for (let i = 0; i < Math.min(universe, SYMBOLS.length); i++) {
      const symbol = SYMBOLS[i] as string;
      const rugProne = this.rng() < 0.35;
      const liquidity = rugProne ? 8_000 + this.rng() * 25_000 : 60_000 + this.rng() * 400_000;
      this.tokens.push({
        token: {
          id: tokenId('simulated', `sim${i}${symbol.toLowerCase()}`),
          chain: 'simulated',
          address: `sim${i}${symbol.toLowerCase()}`,
          symbol,
          name: `${symbol} (simulated)`,
          createdAt: 0,
        },
        price: 0.0000005 + this.rng() * 0.01,
        liquidity,
        baseVolume: liquidity * (0.4 + this.rng()),
        holders: rugProne ? 80 + Math.floor(this.rng() * 300) : 1_500 + Math.floor(this.rng() * 20_000),
        social: 5 + this.rng() * 30,
        sentiment: 0,
        topHolderConcentration: rugProne ? 0.55 + this.rng() * 0.35 : 0.08 + this.rng() * 0.22,
        liquidityLocked: !rugProne && this.rng() > 0.15,
        rugProne,
        regime: 'chop',
        regimeTicksLeft: 5 + Math.floor(this.rng() * 20),
      });
    }
  }

  private nextRegime(t: SimToken): Regime {
    const r = this.rng();
    // Pumps are rarer for rug-prone tokens but their dumps are violent.
    if (t.regime === 'pump') return r < 0.6 ? 'distribution' : 'dump';
    if (t.regime === 'distribution') return r < 0.5 ? 'dump' : 'chop';
    if (t.regime === 'dump') return 'chop';
    if (t.regime === 'accumulation') return r < 0.7 ? 'pump' : 'chop';
    // from chop
    if (r < 0.18) return 'accumulation';
    if (r < 0.24) return 'pump';
    return 'chop';
  }

  private step(t: SimToken): void {
    if (t.regimeTicksLeft <= 0) {
      t.regime = this.nextRegime(t);
      t.regimeTicksLeft =
        t.regime === 'pump' ? 8 + Math.floor(this.rng() * 18) : 4 + Math.floor(this.rng() * 14);
    }
    t.regimeTicksLeft -= 1;

    const noise = (this.rng() - 0.5) * 0.04;
    let drift = 0;
    let volMult = 1;
    let socialDelta = -0.5;
    let sentimentTarget = 0;

    switch (t.regime) {
      case 'accumulation':
        drift = 0.004;
        volMult = 1.2;
        socialDelta = 0.5;
        sentimentTarget = 0.25;
        break;
      case 'pump':
        drift = 0.025 + this.rng() * 0.035;
        volMult = 2.2 + this.rng() * 2.5;
        socialDelta = 3 + this.rng() * 6;
        sentimentTarget = 0.7;
        break;
      case 'distribution':
        drift = 0.0;
        volMult = 1.8;
        socialDelta = 0.5;
        sentimentTarget = 0.1;
        break;
      case 'dump':
        drift = t.rugProne ? -0.25 - this.rng() * 0.3 : -0.08 - this.rng() * 0.06;
        volMult = 2;
        socialDelta = -2;
        sentimentTarget = -0.6;
        break;
      case 'chop':
        drift = 0;
        volMult = 0.9;
        socialDelta = -0.3;
        sentimentTarget = 0;
        break;
    }

    t.price = Math.max(1e-9, t.price * (1 + drift + noise));
    // Liquidity tracks price during pumps, drains hard on rug dumps.
    const liqDrift = t.regime === 'pump' ? 0.05 : t.regime === 'dump' && t.rugProne ? -0.4 : 0;
    t.liquidity = Math.max(1_000, t.liquidity * (1 + liqDrift + noise * 0.5));
    t.baseVolume = Math.max(500, t.baseVolume * (0.85 + this.rng() * 0.3));
    t.holders = Math.max(20, Math.round(t.holders * (1 + (t.regime === 'pump' ? 0.03 : t.regime === 'dump' ? -0.02 : 0.001))));
    t.social = Math.max(0, t.social + socialDelta + (this.rng() - 0.5) * 2);
    t.sentiment = t.sentiment + (sentimentTarget - t.sentiment) * 0.3;

    // Store the volume multiplier on baseVolume for this tick via a transient.
    (t as SimToken & { _volMult?: number })._volMult = volMult;
  }

  private toMetrics(t: SimToken): SnapshotMetrics {
    const volMult = (t as SimToken & { _volMult?: number })._volMult ?? 1;
    const volume = t.baseVolume * volMult;
    const buyBias = 0.5 + Math.max(-0.4, Math.min(0.4, t.sentiment * 0.4));
    const txns = Math.round(volume / Math.max(t.price * 1e6, 50));
    const buys = Math.round(txns * buyBias);
    return {
      priceUsd: t.price,
      liquidityUsd: t.liquidity,
      volume24hUsd: volume,
      marketCapUsd: t.price * (t.holders * 1_000),
      buys,
      sells: Math.max(0, txns - buys),
      holders: t.holders,
      topHolderConcentration: t.topHolderConcentration,
      liquidityLocked: t.liquidityLocked,
      socialMentions: Math.round(t.social),
      socialSentiment: Math.max(-1, Math.min(1, t.sentiment)),
    };
  }

  async poll(now: number): Promise<readonly RawObservation[]> {
    this.lastUpdate = now;
    const observations: RawObservation[] = [];
    for (const t of this.tokens) {
      this.step(t);
      observations.push({ token: t.token, metrics: this.toMetrics(t) });
    }
    return observations;
  }

  health(): SourceHealth {
    return { source: this.name, ok: true, lastUpdate: this.lastUpdate, note: 'deterministic simulator' };
  }
}
