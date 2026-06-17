import type { Fixed } from '../money.js';
import type { TokenId } from '../ids.js';
import type { MarketSnapshot } from './market.js';

export type Side = 'BUY' | 'SELL';

export interface OrderRequest {
  readonly tokenId: TokenId;
  readonly side: Side;
  /** Desired notional in USD. */
  readonly notionalUsd: Fixed;
  /** The snapshot the decision was based on; the venue prices against it. */
  readonly referenceSnapshot: MarketSnapshot;
}

export interface Fill {
  readonly tokenId: TokenId;
  readonly side: Side;
  /** Average price actually paid/received, after slippage. */
  readonly avgPrice: Fixed;
  /** Token quantity filled. */
  readonly quantity: Fixed;
  /** Notional actually transacted in USD (avgPrice * quantity). */
  readonly notionalUsd: Fixed;
  /** Total fees in USD (trading + network). */
  readonly feesUsd: Fixed;
  /** Slippage as a fraction of reference price, e.g. 0.012 = 1.2%. */
  readonly slippagePct: number;
  /** True when liquidity limited the fill below the requested notional. */
  readonly partial: boolean;
  readonly timestamp: number;
}

/**
 * The single seam between the platform and "the market". Paper and live trading
 * implement this identically; swapping them changes nothing upstream.
 */
export interface ExecutionVenue {
  readonly kind: 'paper' | 'live';
  execute(order: OrderRequest): Promise<Fill>;
}
