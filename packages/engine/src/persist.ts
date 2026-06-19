import {
  fixed,
  type DecisionId,
  type ExitReason,
  type Position,
  type PositionId,
  type PositionStatus,
  type PostTradeAnalysis,
  type TokenId,
  type Trade,
  type TradeId,
} from '@noname/core';

/**
 * JSON-safe snapshot of the engine's durable state (money as decimal strings).
 * Written to disk by the API so the paper account, open positions and trade
 * journal survive restarts and redeploys.
 */
export interface SerializedPosition {
  id: string;
  tokenId: string;
  symbol: string;
  status: PositionStatus;
  entryDecisionId: string;
  entryPrice: string;
  quantity: string;
  costBasisUsd: string;
  entryFeesUsd: string;
  openedAt: number;
  stopLossPrice: string;
  takeProfitPrice: string;
  highWaterPrice: string;
}

export interface SerializedTrade {
  id: string;
  positionId: string;
  tokenId: string;
  symbol: string;
  entryDecisionId: string;
  exitDecisionId: string;
  entryPrice: string;
  exitPrice: string;
  quantity: string;
  grossPnlUsd: string;
  feesUsd: string;
  netPnlUsd: string;
  returnPct: number;
  openedAt: number;
  closedAt: number;
  holdingPeriodMs: number;
  exitReason: ExitReason;
  analysis: PostTradeAnalysis;
}

export interface EngineSnapshot {
  version: number;
  savedAt: number;
  ticks: number;
  portfolio: {
    cashUsd: string;
    realizedPnlUsd: string;
    peakEquityUsd: string;
    startingCashUsd: string;
  };
  positions: SerializedPosition[];
  trades: SerializedTrade[];
}

export function revivePosition(p: SerializedPosition): Position {
  return {
    id: p.id as PositionId,
    tokenId: p.tokenId as TokenId,
    symbol: p.symbol,
    status: p.status,
    entryDecisionId: p.entryDecisionId as DecisionId,
    entryPrice: fixed(p.entryPrice),
    quantity: fixed(p.quantity),
    costBasisUsd: fixed(p.costBasisUsd),
    entryFeesUsd: fixed(p.entryFeesUsd),
    openedAt: p.openedAt,
    stopLossPrice: fixed(p.stopLossPrice),
    takeProfitPrice: fixed(p.takeProfitPrice),
    highWaterPrice: fixed(p.highWaterPrice),
  };
}

export function reviveTrade(t: SerializedTrade): Trade {
  return {
    id: t.id as TradeId,
    positionId: t.positionId as PositionId,
    tokenId: t.tokenId as TokenId,
    symbol: t.symbol,
    entryDecisionId: t.entryDecisionId as DecisionId,
    exitDecisionId: t.exitDecisionId as DecisionId,
    entryPrice: fixed(t.entryPrice),
    exitPrice: fixed(t.exitPrice),
    quantity: fixed(t.quantity),
    grossPnlUsd: fixed(t.grossPnlUsd),
    feesUsd: fixed(t.feesUsd),
    netPnlUsd: fixed(t.netPnlUsd),
    returnPct: t.returnPct,
    openedAt: t.openedAt,
    closedAt: t.closedAt,
    holdingPeriodMs: t.holdingPeriodMs,
    exitReason: t.exitReason,
    analysis: t.analysis,
  };
}
