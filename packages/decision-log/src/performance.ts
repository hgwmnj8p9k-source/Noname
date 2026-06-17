import { Fixed, fixed, type PerformanceStats, type Trade } from '@noname/core';

/** Computes aggregate performance statistics over a set of closed trades. */
export function computePerformance(trades: readonly Trade[], startingEquityUsd: Fixed): PerformanceStats {
  if (trades.length === 0) {
    return {
      trades: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      netPnlUsd: Fixed.ZERO,
      avgWinUsd: Fixed.ZERO,
      avgLossUsd: Fixed.ZERO,
      profitFactor: 0,
      expectancyPct: 0,
      maxDrawdownPct: 0,
      bestTradeUsd: Fixed.ZERO,
      worstTradeUsd: Fixed.ZERO,
    };
  }

  // Order oldest → newest to build a realized equity curve for drawdown.
  const chronological = [...trades].sort((a, b) => a.closedAt - b.closedAt);

  let wins = 0;
  let losses = 0;
  let grossProfit = Fixed.ZERO;
  let grossLoss = Fixed.ZERO;
  let netPnl = Fixed.ZERO;
  let returnSum = 0;
  let best = chronological[0]!.netPnlUsd;
  let worst = chronological[0]!.netPnlUsd;

  let equity = startingEquityUsd;
  let peak = startingEquityUsd;
  let maxDrawdown = 0;

  for (const t of chronological) {
    netPnl = netPnl.add(t.netPnlUsd);
    returnSum += t.returnPct;
    if (t.netPnlUsd.gt(Fixed.ZERO)) {
      wins++;
      grossProfit = grossProfit.add(t.netPnlUsd);
    } else {
      losses++;
      grossLoss = grossLoss.add(t.netPnlUsd.abs());
    }
    if (t.netPnlUsd.gt(best)) best = t.netPnlUsd;
    if (t.netPnlUsd.lt(worst)) worst = t.netPnlUsd;

    equity = equity.add(t.netPnlUsd);
    if (equity.gt(peak)) peak = equity;
    const dd = peak.isZero() ? 0 : peak.sub(equity).div(peak).toNumber();
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  const avgWin = wins > 0 ? grossProfit.div(fixed(wins)) : Fixed.ZERO;
  const avgLoss = losses > 0 ? grossLoss.div(fixed(losses)) : Fixed.ZERO;
  const profitFactor = grossLoss.isZero()
    ? grossProfit.isZero()
      ? 0
      : Number.POSITIVE_INFINITY
    : grossProfit.div(grossLoss).toNumber();

  return {
    trades: chronological.length,
    wins,
    losses,
    winRate: wins / chronological.length,
    netPnlUsd: netPnl,
    avgWinUsd: avgWin,
    avgLossUsd: avgLoss,
    profitFactor,
    expectancyPct: (returnSum / chronological.length) * 100,
    maxDrawdownPct: maxDrawdown,
    bestTradeUsd: best,
    worstTradeUsd: worst,
  };
}
