import {
  Fixed,
  fixed,
  type ExecutionVenue,
  type Fill,
  type OrderRequest,
} from '@noname/core';

export interface PaperVenueConfig {
  /** Taker fee as a fraction of notional, e.g. 0.003 = 0.30%. */
  readonly takerFeePct: number;
  /** Flat network/gas cost per fill in USD. */
  readonly networkFeeUsd: number;
  /** Slippage coefficient applied to the convex impact function. */
  readonly slippageK: number;
  /** Convexity exponent of price impact w.r.t. size/liquidity. */
  readonly slippageExp: number;
  /** Max fraction of pool liquidity a single order can consume before it is
   * partially filled. */
  readonly maxFillFraction: number;
}

export const DEFAULT_PAPER_VENUE_CONFIG: PaperVenueConfig = {
  takerFeePct: 0.003,
  networkFeeUsd: 0.75,
  slippageK: 0.9,
  slippageExp: 0.85,
  maxFillFraction: 0.05,
};

/**
 * Deterministic paper-execution venue. It models the frictions that decide
 * whether a memecoin strategy is actually viable:
 *
 *  - **Slippage** grows convexly with order size relative to pool liquidity, so
 *    large orders in thin pools are punished.
 *  - **Partial fills** when an order would consume more than `maxFillFraction`
 *    of liquidity.
 *  - **Fees**: a proportional taker fee plus a flat network cost.
 *
 * It implements the exact same {@link ExecutionVenue} interface a future live
 * venue will, so nothing upstream changes when real execution is wired in.
 */
export class PaperExecutionVenue implements ExecutionVenue {
  readonly kind = 'paper' as const;

  constructor(private readonly config: PaperVenueConfig = DEFAULT_PAPER_VENUE_CONFIG) {}

  async execute(order: OrderRequest): Promise<Fill> {
    const c = this.config;
    const liquidity = Math.max(1, order.referenceSnapshot.liquidityUsd);
    const refPrice = fixed(order.referenceSnapshot.priceUsd.toString());
    const requested = order.notionalUsd;

    // Partial fill if the order is too large for the pool.
    const maxNotional = liquidity * c.maxFillFraction;
    let filledNotional = requested.toNumber();
    let partial = false;
    if (filledNotional > maxNotional) {
      filledNotional = maxNotional;
      partial = true;
    }

    // Convex price impact: slippage = k * (size / liquidity) ^ exp.
    const fraction = filledNotional / liquidity;
    const slippagePct = c.slippageK * Math.pow(fraction, c.slippageExp);

    // Buyers pay up, sellers receive less.
    const direction = order.side === 'BUY' ? 1 : -1;
    const avgPrice = refPrice.mul(fixed(1 + direction * slippagePct));

    const quantity = avgPrice.isZero() ? Fixed.ZERO : fixed(filledNotional.toString()).div(avgPrice);
    const notionalUsd = avgPrice.mul(quantity);
    const feesUsd = notionalUsd.mul(fixed(c.takerFeePct)).add(fixed(c.networkFeeUsd));

    return {
      tokenId: order.tokenId,
      side: order.side,
      avgPrice,
      quantity,
      notionalUsd,
      feesUsd,
      slippagePct,
      partial,
      timestamp: order.referenceSnapshot.timestamp,
    };
  }
}
