import {
  Fixed,
  newTradeId,
  type ExitReason,
  type Position,
  type PostTradeAnalysis,
  type SignalContribution,
  type Trade,
  type TradeDecision,
} from '@noname/core';
import type { StrategyConfig } from '@noname/strategy';
import type { TradeFinancials } from '@noname/paper-trading';

const RULE_BASED_EXITS: readonly ExitReason[] = ['STOP_LOSS', 'TAKE_PROFIT', 'TRAILING_STOP', 'SIGNAL_EXIT'];

function strongest(contributions: readonly SignalContribution[]): SignalContribution | undefined {
  return contributions.reduce<SignalContribution | undefined>(
    (best, c) => (!best || c.weightedScore > best.weightedScore ? c : best),
    undefined,
  );
}

function weakest(contributions: readonly SignalContribution[]): SignalContribution | undefined {
  return contributions.reduce<SignalContribution | undefined>(
    (worst, c) => (!worst || c.weightedScore < worst.weightedScore ? c : worst),
    undefined,
  );
}

/**
 * Produces the post-trade analysis the platform must be able to show for every
 * completed trade: why it entered, why it exited, which signals were strongest
 * and weakest, whether the strategy was followed, whether it worked, and what
 * could be improved.
 */
export class TradeAnalyzer {
  constructor(private readonly strategyConfig: StrategyConfig) {}

  analyze(entryDecision: TradeDecision, financials: TradeFinancials, exitReason: ExitReason): PostTradeAnalysis {
    const isWin = financials.netPnlUsd.gt(Fixed.ZERO);

    const followedStrategy =
      entryDecision.action === 'ENTER' &&
      entryDecision.confirmations >= this.strategyConfig.minConfirmations &&
      entryDecision.conviction >= this.strategyConfig.minConviction &&
      entryDecision.sizeUsd !== undefined &&
      RULE_BASED_EXITS.includes(exitReason);

    const strong = strongest(entryDecision.contributions);
    const weak = weakest(entryDecision.contributions);

    const whatCouldImprove: string[] = [];
    if (!isWin) {
      if (exitReason === 'STOP_LOSS') {
        whatCouldImprove.push('Entry was stopped out — consider tighter confluence or waiting for a pullback.');
      }
      if (weak && weak.weightedScore < 0) {
        whatCouldImprove.push(`Weakest input ${weak.signalId} was negative at entry; could be used as a disqualifier.`);
      }
      if (entryDecision.confirmations === this.strategyConfig.minConfirmations) {
        whatCouldImprove.push('Entered at the minimum confirmation count; requiring one more family may filter losers.');
      }
    } else {
      if (exitReason === 'TRAILING_STOP') {
        whatCouldImprove.push('Trailing stop captured the move; a wider trail might let winners run further.');
      }
      if (exitReason === 'TAKE_PROFIT') {
        whatCouldImprove.push('Hit fixed take-profit; a partial scale-out could capture more upside on strong trends.');
      }
    }

    const notes = [
      `Held ${(financials.holdingPeriodMs / 60_000).toFixed(0)} min; exit via ${exitReason}.`,
      `Net PnL ${financials.netPnlUsd.toString()} USD (${(financials.returnPct * 100).toFixed(1)}%).`,
    ];

    return {
      followedStrategy,
      successful: isWin,
      strongestSignal: strong ? { signalId: strong.signalId, weightedScore: strong.weightedScore } : undefined,
      weakestSignal: weak ? { signalId: weak.signalId, weightedScore: weak.weightedScore } : undefined,
      whatCouldImprove,
      notes,
    };
  }

  buildTrade(params: {
    position: Position;
    entryDecision: TradeDecision;
    exitDecision: TradeDecision;
    financials: TradeFinancials;
    exitReason: ExitReason;
  }): Trade {
    const { position, entryDecision, exitDecision, financials, exitReason } = params;
    return {
      id: newTradeId(),
      positionId: position.id,
      tokenId: position.tokenId,
      symbol: position.symbol,
      entryDecisionId: entryDecision.id,
      exitDecisionId: exitDecision.id,
      entryPrice: financials.entryPrice,
      exitPrice: financials.exitPrice,
      quantity: financials.quantity,
      grossPnlUsd: financials.grossPnlUsd,
      feesUsd: financials.feesUsd,
      netPnlUsd: financials.netPnlUsd,
      returnPct: financials.returnPct,
      openedAt: financials.openedAt,
      closedAt: financials.closedAt,
      holdingPeriodMs: financials.holdingPeriodMs,
      exitReason,
      analysis: this.analyze(entryDecision, financials, exitReason),
    };
  }
}
