import type { SignalFamily } from '@noname/core';

export interface StrategyConfig {
  /** Minimum number of *independent families* that must confirm to enter. */
  readonly minConfirmations: number;
  /** A family confirms when its best weighted score meets this threshold. */
  readonly familyConfirmThreshold: number;
  /** Minimum blended conviction (0..1) required to enter. */
  readonly minConviction: number;
  /** Per-signal weights; defaults to 1 when unspecified. */
  readonly weights: Readonly<Record<string, number>>;
}

export interface RiskConfig {
  readonly maxConcurrentPositions: number;
  /** Max fraction of equity deployed across all open positions, 0..1. */
  readonly maxPortfolioExposurePct: number;
  /** Fraction of equity risked per trade (distance to stop), 0..1. */
  readonly riskPerTradePct: number;
  /** Hard cap on a single position as a fraction of equity, 0..1. */
  readonly maxPositionPct: number;
  /** Stop-loss distance below entry, 0..1. */
  readonly stopLossPct: number;
  /** Take-profit distance above entry, 0..1. */
  readonly takeProfitPct: number;
  /** Trailing stop distance from the high-water mark, 0..1. */
  readonly trailingStopPct: number;
  /** Smallest position worth opening, in USD. */
  readonly minPositionUsd: number;
}

export const DEFAULT_STRATEGY_CONFIG: StrategyConfig = {
  minConfirmations: 3,
  familyConfirmThreshold: 0.15,
  minConviction: 0.35,
  weights: {
    'price.momentum': 1.2,
    'price.volume_surge': 1.0,
    'liquidity.trend': 1.1,
    'onchain.buy_pressure': 1.2,
    'onchain.rug_veto': 1.0,
    'social.momentum': 0.9,
  },
};

export const DEFAULT_RISK_CONFIG: RiskConfig = {
  maxConcurrentPositions: 5,
  maxPortfolioExposurePct: 0.6,
  riskPerTradePct: 0.02,
  maxPositionPct: 0.2,
  stopLossPct: 0.15,
  takeProfitPct: 0.4,
  trailingStopPct: 0.18,
  minPositionUsd: 25,
};

export const ALL_FAMILIES: readonly SignalFamily[] = ['price', 'liquidity', 'onchain', 'social'];
