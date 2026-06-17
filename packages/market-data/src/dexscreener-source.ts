import { tokenId, type Chain, type SourceHealth, type Token } from '@noname/core';
import type { MarketDataSource, RawObservation, SnapshotMetrics } from './source.js';

interface DexPair {
  chainId?: string;
  baseToken?: { address?: string; name?: string; symbol?: string };
  priceUsd?: string;
  liquidity?: { usd?: number };
  volume?: { h24?: number };
  marketCap?: number;
  fdv?: number;
  pairCreatedAt?: number;
  txns?: { h24?: { buys?: number; sells?: number } };
}

const CHAIN_MAP: Record<string, Chain> = {
  solana: 'solana',
  ethereum: 'ethereum',
  base: 'base',
  bsc: 'bsc',
};

/**
 * Real, opt-in adapter for the public DexScreener API. It is intentionally
 * defensive: any network/parse failure flips the source to unhealthy and
 * returns no observations, so the aggregator simply continues with whatever
 * other sources are available. Enable by passing search queries; otherwise the
 * platform runs purely on the deterministic simulator.
 */
export class DexScreenerSource implements MarketDataSource {
  readonly name = 'dexscreener';
  private ok = false;
  private lastUpdate = 0;
  private note = 'not yet polled';

  constructor(
    private readonly queries: readonly string[] = [],
    private readonly opts: { timeoutMs?: number; maxPairsPerQuery?: number } = {},
  ) {}

  private mapPair(pair: DexPair): RawObservation | undefined {
    const chain = CHAIN_MAP[pair.chainId ?? ''];
    const address = pair.baseToken?.address;
    const price = pair.priceUsd ? Number(pair.priceUsd) : NaN;
    if (!chain || !address || !Number.isFinite(price) || price <= 0) return undefined;

    const token: Token = {
      id: tokenId(chain, address),
      chain,
      address,
      symbol: pair.baseToken?.symbol ?? 'UNKNOWN',
      name: pair.baseToken?.name ?? 'Unknown',
      createdAt: pair.pairCreatedAt,
    };
    const buys = pair.txns?.h24?.buys ?? 0;
    const sells = pair.txns?.h24?.sells ?? 0;
    const metrics: SnapshotMetrics = {
      priceUsd: price,
      liquidityUsd: pair.liquidity?.usd ?? 0,
      volume24hUsd: pair.volume?.h24 ?? 0,
      marketCapUsd: pair.marketCap ?? pair.fdv ?? 0,
      buys,
      sells,
      // Holder distribution / social are not provided by DexScreener; left at
      // neutral so signals that need them report low confidence rather than
      // fabricating data. These come from dedicated sources in Milestone 2.
      holders: 0,
      topHolderConcentration: 0,
      liquidityLocked: false,
      socialMentions: 0,
      socialSentiment: 0,
    };
    return { token, metrics };
  }

  async poll(now: number): Promise<readonly RawObservation[]> {
    this.lastUpdate = now;
    if (this.queries.length === 0) {
      this.ok = false;
      this.note = 'disabled (no queries configured)';
      return [];
    }
    const timeoutMs = this.opts.timeoutMs ?? 8_000;
    const max = this.opts.maxPairsPerQuery ?? 10;
    const out: RawObservation[] = [];
    const seen = new Set<string>();
    try {
      for (const q of this.queries) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const res = await fetch(
            `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`,
            { signal: controller.signal, headers: { accept: 'application/json' } },
          );
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const body = (await res.json()) as { pairs?: DexPair[] };
          const pairs = (body.pairs ?? []).slice(0, max);
          for (const pair of pairs) {
            const obs = this.mapPair(pair);
            if (obs && !seen.has(obs.token.id)) {
              seen.add(obs.token.id);
              out.push(obs);
            }
          }
        } finally {
          clearTimeout(timer);
        }
      }
      this.ok = true;
      this.note = `ok (${out.length} tokens)`;
      return out;
    } catch (e) {
      this.ok = false;
      this.note = `error: ${(e as Error).message}`;
      return [];
    }
  }

  health(): SourceHealth {
    return { source: this.name, ok: this.ok, lastUpdate: this.lastUpdate, note: this.note };
  }
}
