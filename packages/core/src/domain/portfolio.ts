import type { Fixed } from '../money.js';

export interface PortfolioSnapshot {
  readonly timestamp: number;
  /** Uninvested USD available for new positions. */
  readonly cashUsd: Fixed;
  /** Mark-to-market value of all open positions. */
  readonly positionsValueUsd: Fixed;
  /** cash + positions value. */
  readonly equityUsd: Fixed;
  readonly realizedPnlUsd: Fixed;
  readonly unrealizedPnlUsd: Fixed;
  /** Open positions value / equity, 0..1. */
  readonly exposurePct: number;
  readonly openPositions: number;
  /** Peak-to-trough decline from the equity high-water mark, 0..1. */
  readonly drawdownPct: number;
}

export interface PerformanceStats {
  readonly trades: number;
  readonly wins: number;
  readonly losses: number;
  readonly winRate: number;
  readonly netPnlUsd: Fixed;
  readonly avgWinUsd: Fixed;
  readonly avgLossUsd: Fixed;
  /** Gross profit / gross loss. */
  readonly profitFactor: number;
  /** Mean return per trade, in percent. */
  readonly expectancyPct: number;
  readonly maxDrawdownPct: number;
  readonly bestTradeUsd: Fixed;
  readonly worstTradeUsd: Fixed;
}
