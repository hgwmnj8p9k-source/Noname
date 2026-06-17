import { Fixed, fixed } from '@noname/core';
import type { RiskConfig } from './config.js';

export interface PortfolioState {
  readonly equityUsd: Fixed;
  readonly cashUsd: Fixed;
  readonly openPositions: number;
  /** Current deployed exposure as a fraction of equity, 0..1. */
  readonly exposurePct: number;
}

export type SizingResult =
  | {
      readonly approved: true;
      readonly sizeUsd: Fixed;
      readonly stopLossPrice: Fixed;
      readonly takeProfitPrice: Fixed;
      readonly notes: readonly string[];
    }
  | { readonly approved: false; readonly reason: string };

/**
 * Volatility-aware position sizing with portfolio-level guardrails. Size is
 * derived from a fixed fractional risk model (risk per trade ÷ stop distance),
 * scaled by conviction, then clamped by the per-position cap, remaining
 * exposure headroom, and available cash.
 */
export class RiskManager {
  constructor(private readonly config: RiskConfig) {}

  size(params: {
    portfolio: PortfolioState;
    entryPrice: Fixed;
    conviction: number;
  }): SizingResult {
    const { portfolio, entryPrice, conviction } = params;
    const c = this.config;

    if (portfolio.openPositions >= c.maxConcurrentPositions) {
      return { approved: false, reason: `Max concurrent positions (${c.maxConcurrentPositions}) reached` };
    }
    if (portfolio.exposurePct >= c.maxPortfolioExposurePct) {
      return {
        approved: false,
        reason: `Portfolio exposure ${(portfolio.exposurePct * 100).toFixed(0)}% at cap`,
      };
    }

    const notes: string[] = [];
    const equity = portfolio.equityUsd.toNumber();

    // Fixed-fractional sizing: risk budget / stop distance = notional at risk.
    const riskBudget = equity * c.riskPerTradePct;
    const convictionScale = Math.max(0, Math.min(1, conviction));
    let sizeUsd = (riskBudget / c.stopLossPct) * convictionScale;
    notes.push(`Risk budget $${riskBudget.toFixed(2)} (${(c.riskPerTradePct * 100).toFixed(1)}% equity) scaled by conviction ${convictionScale.toFixed(2)}`);

    // Per-position cap.
    const positionCap = equity * c.maxPositionPct;
    if (sizeUsd > positionCap) {
      sizeUsd = positionCap;
      notes.push(`Capped to ${(c.maxPositionPct * 100).toFixed(0)}% of equity ($${positionCap.toFixed(2)})`);
    }

    // Remaining exposure headroom.
    const exposureHeadroom = (c.maxPortfolioExposurePct - portfolio.exposurePct) * equity;
    if (sizeUsd > exposureHeadroom) {
      sizeUsd = exposureHeadroom;
      notes.push(`Reduced to exposure headroom $${exposureHeadroom.toFixed(2)}`);
    }

    // Cash constraint.
    const cash = portfolio.cashUsd.toNumber();
    if (sizeUsd > cash) {
      sizeUsd = cash;
      notes.push(`Reduced to available cash $${cash.toFixed(2)}`);
    }

    if (sizeUsd < c.minPositionUsd) {
      return { approved: false, reason: `Sized position $${sizeUsd.toFixed(2)} below minimum $${c.minPositionUsd}` };
    }

    const stopLossPrice = entryPrice.mul(fixed(1 - c.stopLossPct));
    const takeProfitPrice = entryPrice.mul(fixed(1 + c.takeProfitPct));

    return {
      approved: true,
      sizeUsd: fixed(sizeUsd.toFixed(6)),
      stopLossPrice,
      takeProfitPrice,
      notes,
    };
  }
}
