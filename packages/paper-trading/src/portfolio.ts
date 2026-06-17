import {
  Fixed,
  fixed,
  newPositionId,
  type Fill,
  type Position,
  type PositionMark,
  type PortfolioSnapshot,
  type TokenId,
  type TradeDecision,
} from '@noname/core';

/** The financial outcome of closing a position, independent of analysis. */
export interface TradeFinancials {
  readonly entryPrice: Fixed;
  readonly exitPrice: Fixed;
  readonly quantity: Fixed;
  readonly grossPnlUsd: Fixed;
  readonly feesUsd: Fixed;
  readonly netPnlUsd: Fixed;
  readonly returnPct: number;
  readonly openedAt: number;
  readonly closedAt: number;
  readonly holdingPeriodMs: number;
}

export type PriceLookup = (tokenId: TokenId) => Fixed | undefined;

/**
 * Cash-accurate paper portfolio. All money math uses fixed-point arithmetic so
 * PnL never drifts. The portfolio owns cash, cumulative realized PnL and the
 * equity high-water mark (for drawdown); open positions are passed in by the
 * engine so the portfolio stays free of storage concerns.
 */
export class PaperPortfolio {
  private cash: Fixed;
  private realizedPnl = Fixed.ZERO;
  private peakEquity: Fixed;

  constructor(private readonly startingCashUsd: Fixed) {
    this.cash = startingCashUsd;
    this.peakEquity = startingCashUsd;
  }

  get cashUsd(): Fixed {
    return this.cash;
  }

  get realizedPnlUsd(): Fixed {
    return this.realizedPnl;
  }

  /** Open a position from an entry fill, debiting cash for notional + fees. */
  openPosition(decision: TradeDecision, fill: Fill, symbol: string, now: number): Position {
    const cost = fill.notionalUsd.add(fill.feesUsd);
    this.cash = this.cash.sub(cost);
    return {
      id: newPositionId(),
      tokenId: decision.tokenId,
      symbol,
      status: 'OPEN',
      entryDecisionId: decision.id,
      entryPrice: fill.avgPrice,
      quantity: fill.quantity,
      costBasisUsd: fill.notionalUsd,
      entryFeesUsd: fill.feesUsd,
      openedAt: now,
      stopLossPrice: fixed((decision.stopLossPrice ?? 0).toString()),
      takeProfitPrice: fixed((decision.takeProfitPrice ?? 0).toString()),
      highWaterPrice: fill.avgPrice,
    };
  }

  /** Settle a position against an exit fill, crediting cash and booking PnL. */
  settle(position: Position, exitFill: Fill, now: number): TradeFinancials {
    const proceeds = exitFill.notionalUsd.sub(exitFill.feesUsd);
    this.cash = this.cash.add(proceeds);

    const grossPnl = exitFill.notionalUsd.sub(position.costBasisUsd);
    const totalFees = position.entryFeesUsd.add(exitFill.feesUsd);
    const netPnl = grossPnl.sub(position.entryFeesUsd).sub(exitFill.feesUsd);
    this.realizedPnl = this.realizedPnl.add(netPnl);

    const invested = position.costBasisUsd.add(position.entryFeesUsd);
    const returnPct = invested.isZero() ? 0 : netPnl.div(invested).toNumber();

    return {
      entryPrice: position.entryPrice,
      exitPrice: exitFill.avgPrice,
      quantity: position.quantity,
      grossPnlUsd: grossPnl,
      feesUsd: totalFees,
      netPnlUsd: netPnl,
      returnPct,
      openedAt: position.openedAt,
      closedAt: now,
      holdingPeriodMs: now - position.openedAt,
    };
  }

  markPosition(position: Position, price: Fixed): PositionMark {
    const marketValue = price.mul(position.quantity);
    const unrealized = marketValue.sub(position.costBasisUsd);
    const pct = position.costBasisUsd.isZero() ? 0 : unrealized.div(position.costBasisUsd).toNumber();
    return {
      position,
      currentPrice: price,
      marketValueUsd: marketValue,
      unrealizedPnlUsd: unrealized,
      unrealizedPnlPct: pct,
    };
  }

  snapshot(now: number, openPositions: readonly Position[], priceOf: PriceLookup): PortfolioSnapshot {
    let positionsValue = Fixed.ZERO;
    let unrealized = Fixed.ZERO;
    for (const p of openPositions) {
      const price = priceOf(p.tokenId) ?? p.entryPrice;
      const mark = this.markPosition(p, price);
      positionsValue = positionsValue.add(mark.marketValueUsd);
      unrealized = unrealized.add(mark.unrealizedPnlUsd);
    }
    const equity = this.cash.add(positionsValue);
    if (equity.gt(this.peakEquity)) this.peakEquity = equity;

    const exposurePct = equity.isZero() ? 0 : positionsValue.div(equity).toNumber();
    const drawdownPct = this.peakEquity.isZero()
      ? 0
      : this.peakEquity.sub(equity).div(this.peakEquity).toNumber();

    return {
      timestamp: now,
      cashUsd: this.cash,
      positionsValueUsd: positionsValue,
      equityUsd: equity,
      realizedPnlUsd: this.realizedPnl,
      unrealizedPnlUsd: unrealized,
      exposurePct,
      openPositions: openPositions.length,
      drawdownPct: Math.max(0, drawdownPct),
    };
  }

  get startingCash(): Fixed {
    return this.startingCashUsd;
  }
}
