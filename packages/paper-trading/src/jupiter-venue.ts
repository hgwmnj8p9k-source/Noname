import {
  Fixed,
  fixed,
  type ExecutionVenue,
  type Fill,
  type OrderRequest,
} from '@noname/core';

export interface JupiterVenueConfig {
  /** Liquidity-provider / router fee applied on top of price impact. Memecoin
   * pools commonly sit around 0.3–1%. */
  readonly lpFeePct: number;
  /** Flat Solana network + priority cost per fill, in USD. */
  readonly networkFeeUsd: number;
  /** USDC mint used as the quote asset. */
  readonly usdcMint: string;
  /** Slippage tolerance passed to the quote (affects routing only). */
  readonly slippageBps: number;
  readonly timeoutMs: number;
  /** Above this price impact a token is treated as too thin → fall back. */
  readonly maxImpactPct: number;
  readonly baseUrl: string;
}

export const DEFAULT_JUPITER_CONFIG: JupiterVenueConfig = {
  lpFeePct: 0.006,
  networkFeeUsd: 0.03,
  usdcMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  slippageBps: 300,
  timeoutMs: 8_000,
  maxImpactPct: 0.9,
  baseUrl: 'https://lite-api.jup.ag',
};

interface JupiterQuote {
  priceImpactPct?: string;
  outAmount?: string;
}

type FetchFn = (url: string, init?: { signal?: AbortSignal }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

/**
 * Execution venue that prices paper fills with **real on-chain liquidity** via
 * the Jupiter aggregator — the same router actual Solana swaps go through. For
 * each fill it asks Jupiter the live price impact for that token and size, then
 * applies it to the reference price along with realistic LP + network fees.
 *
 * It implements the exact same {@link ExecutionVenue} interface as the modeled
 * paper venue, and falls back to that modeled venue for non-Solana tokens or
 * when a token isn't routable (so the engine never stalls). Still 100% paper —
 * no transaction is ever broadcast.
 */
export class JupiterExecutionVenue implements ExecutionVenue {
  readonly kind = 'paper' as const;

  constructor(
    private readonly config: JupiterVenueConfig,
    private readonly fallback: ExecutionVenue,
    private readonly fetchFn: FetchFn = fetch as unknown as FetchFn,
  ) {}

  /** Extract the Solana mint from a `solana:<mint>` token id, else null. */
  private mintOf(tokenId: string): string | null {
    const [chain, address] = tokenId.split(':');
    return chain === 'solana' && address ? address : null;
  }

  private async quoteImpact(mint: string, notionalUsd: number): Promise<number | null> {
    const usdcRaw = Math.max(1, Math.round(notionalUsd * 1e6));
    const url =
      `${this.config.baseUrl}/swap/v1/quote?inputMint=${this.config.usdcMint}` +
      `&outputMint=${mint}&amount=${usdcRaw}&slippageBps=${this.config.slippageBps}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const res = await this.fetchFn(url, { signal: controller.signal });
      if (!res.ok) return null;
      const quote = (await res.json()) as JupiterQuote;
      const impact = Math.abs(Number(quote.priceImpactPct));
      return Number.isFinite(impact) ? impact : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  async execute(order: OrderRequest): Promise<Fill> {
    const mint = this.mintOf(order.tokenId);
    if (!mint) return this.fallback.execute(order);

    const impact = await this.quoteImpact(mint, order.notionalUsd.toNumber());
    if (impact === null || impact > this.config.maxImpactPct) {
      // Not routable / absurd impact → defer to the modeled venue.
      return this.fallback.execute(order);
    }

    const refPrice = fixed(order.referenceSnapshot.priceUsd.toString());
    const direction = order.side === 'BUY' ? 1 : -1;
    const avgPrice = refPrice.mul(fixed(1 + direction * impact));
    const quantity = avgPrice.isZero() ? Fixed.ZERO : order.notionalUsd.div(avgPrice);
    const notionalUsd = avgPrice.mul(quantity);
    const feesUsd = notionalUsd.mul(fixed(this.config.lpFeePct)).add(fixed(this.config.networkFeeUsd));

    return {
      tokenId: order.tokenId,
      side: order.side,
      avgPrice,
      quantity,
      notionalUsd,
      feesUsd,
      slippagePct: impact,
      partial: false,
      timestamp: order.referenceSnapshot.timestamp,
    };
  }
}
