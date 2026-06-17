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

interface TokenProfile {
  chainId?: string;
  tokenAddress?: string;
}

const CHAIN_MAP: Record<string, Chain> = {
  solana: 'solana',
  ethereum: 'ethereum',
  base: 'base',
  bsc: 'bsc',
};

export interface DexScreenerOptions {
  /** Free-text search queries (symbols, names, addresses). */
  readonly queries?: readonly string[];
  /** Chains to auto-discover the newest listed tokens on (e.g. ['solana']). */
  readonly discoverChains?: readonly string[];
  readonly timeoutMs?: number;
  /** Cap on tokens pulled from search per query. */
  readonly maxPairsPerQuery?: number;
  /** How many discovered tokens to keep on the rolling watchlist so they
   * accumulate enough history for confluence (default 60). */
  readonly maxTracked?: number;
}

/**
 * Real, opt-in adapter for the public DexScreener API.
 *
 * Two complementary modes:
 *  - **Discovery** (`discoverChains`): pulls the latest token profiles — which
 *    includes freshly-listed pump.fun tokens — and resolves each to its
 *    deepest-liquidity pair. This is how brand-new coins enter the universe.
 *  - **Search** (`queries`): tracks specific tokens by symbol/name/address.
 *
 * Defensive by construction: any network/parse failure flips the source to
 * unhealthy and returns no observations, so the aggregator degrades gracefully
 * instead of crashing. DexScreener does not expose holder distribution or
 * social metrics, so those fields are left neutral (low signal confidence)
 * rather than fabricated — they arrive from dedicated sources in a later phase.
 */
export class DexScreenerSource implements MarketDataSource {
  readonly name = 'dexscreener';
  private ok = false;
  private lastUpdate = 0;
  private note = 'not yet polled';
  private readonly timeoutMs: number;
  private readonly maxPairsPerQuery: number;
  private readonly maxTracked: number;
  /** Rolling watchlist of discovered token addresses (insertion-ordered). */
  private readonly tracked = new Map<string, true>();

  constructor(private readonly opts: DexScreenerOptions = {}) {
    this.timeoutMs = opts.timeoutMs ?? 8_000;
    this.maxPairsPerQuery = opts.maxPairsPerQuery ?? 12;
    this.maxTracked = opts.maxTracked ?? 60;
  }

  get enabled(): boolean {
    return (this.opts.queries?.length ?? 0) > 0 || (this.opts.discoverChains?.length ?? 0) > 0;
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

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
    const metrics: SnapshotMetrics = {
      priceUsd: price,
      liquidityUsd: pair.liquidity?.usd ?? 0,
      volume24hUsd: pair.volume?.h24 ?? 0,
      marketCapUsd: pair.marketCap ?? pair.fdv ?? 0,
      buys: pair.txns?.h24?.buys ?? 0,
      sells: pair.txns?.h24?.sells ?? 0,
      holders: 0,
      topHolderConcentration: 0,
      liquidityLocked: false,
      socialMentions: 0,
      socialSentiment: 0,
    };
    return { token, metrics };
  }

  /** Keep only the deepest-liquidity pair per base token. */
  private collectBest(pairs: readonly DexPair[], into: Map<string, RawObservation>): void {
    for (const pair of pairs) {
      const obs = this.mapPair(pair);
      if (!obs) continue;
      const existing = into.get(obs.token.id);
      if (!existing || obs.metrics.liquidityUsd > existing.metrics.liquidityUsd) {
        into.set(obs.token.id, obs);
      }
    }
  }

  /** Add freshly-discovered addresses to the rolling watchlist, evicting the
   * oldest beyond the cap so memory and request volume stay bounded. */
  private track(addresses: readonly string[]): void {
    for (const addr of addresses) {
      this.tracked.delete(addr); // re-insert to mark as most-recent
      this.tracked.set(addr, true);
    }
    while (this.tracked.size > this.maxTracked) {
      const oldest = this.tracked.keys().next().value;
      if (oldest === undefined) break;
      this.tracked.delete(oldest);
    }
  }

  private async discover(chains: readonly string[], into: Map<string, RawObservation>): Promise<void> {
    const wanted = new Set(chains.map((c) => c.toLowerCase()));
    // Best-effort: pull the newest listings, but don't fail the whole poll if
    // discovery is down — we still refresh the existing watchlist below.
    try {
      const profiles = await this.fetchJson<TokenProfile[]>('https://api.dexscreener.com/token-profiles/latest/v1');
      const fresh = (Array.isArray(profiles) ? profiles : [])
        .filter((p) => p.tokenAddress && wanted.has((p.chainId ?? '').toLowerCase()))
        .map((p) => p.tokenAddress as string);
      this.track(fresh);
    } catch {
      /* keep refreshing the existing watchlist */
    }

    // Re-fetch the whole watchlist so tracked tokens accumulate history.
    // /latest/dex/tokens accepts up to 30 comma-separated addresses per call.
    const watchlist = [...this.tracked.keys()];
    for (let i = 0; i < watchlist.length; i += 30) {
      const batch = watchlist.slice(i, i + 30).join(',');
      const body = await this.fetchJson<{ pairs?: DexPair[] }>(
        `https://api.dexscreener.com/latest/dex/tokens/${batch}`,
      );
      this.collectBest(body.pairs ?? [], into);
    }
  }

  private async search(queries: readonly string[], into: Map<string, RawObservation>): Promise<void> {
    for (const q of queries) {
      const body = await this.fetchJson<{ pairs?: DexPair[] }>(
        `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`,
      );
      this.collectBest((body.pairs ?? []).slice(0, this.maxPairsPerQuery), into);
    }
  }

  async poll(now: number): Promise<readonly RawObservation[]> {
    this.lastUpdate = now;
    if (!this.enabled) {
      this.ok = false;
      this.note = 'disabled (no queries or discovery chains configured)';
      return [];
    }

    const best = new Map<string, RawObservation>();
    try {
      if (this.opts.discoverChains?.length) await this.discover(this.opts.discoverChains, best);
      if (this.opts.queries?.length) await this.search(this.opts.queries, best);
      this.ok = true;
      this.note = `ok (${best.size} tokens)`;
      return [...best.values()];
    } catch (e) {
      this.ok = false;
      this.note = `error: ${(e as Error).message}`;
      // Return whatever we gathered before the failure rather than nothing.
      return [...best.values()];
    }
  }

  health(): SourceHealth {
    return { source: this.name, ok: this.ok, lastUpdate: this.lastUpdate, note: this.note };
  }
}
