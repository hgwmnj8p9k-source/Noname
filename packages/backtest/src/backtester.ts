import { ManualClock, noopLogger, type SignalContribution, type Trade } from '@noname/core';
import { createEngine } from '@noname/engine';
import type {
  BacktestConfig,
  BacktestReport,
  EquityPoint,
  SignalEfficacy,
  TradeSummary,
} from './report.js';

export interface BacktestOptions {
  readonly seed?: number;
  readonly ticks?: number;
  readonly intervalMs?: number;
  readonly startingCashUsd?: number;
}

interface SignalAccumulator {
  family: string;
  sumWin: number;
  countWin: number;
  sumLoss: number;
  countLoss: number;
}

/**
 * Replays the deterministic simulated market through the exact same `Engine`
 * used in production and produces a reproducible {@link BacktestReport}. Because
 * it reuses the live engine rather than a parallel implementation, a backtest
 * and a live paper run cannot diverge — eliminating backtest/live skew.
 */
export async function runBacktest(options: BacktestOptions = {}): Promise<BacktestReport> {
  const config: BacktestConfig = {
    seed: options.seed ?? 1337,
    ticks: options.ticks ?? 500,
    intervalMs: options.intervalMs ?? 60_000,
    startingCashUsd: options.startingCashUsd ?? 10_000,
  };

  const clock = new ManualClock(0);
  const engine = createEngine({
    seed: config.seed,
    tickIntervalMs: config.intervalMs,
    startingCashUsd: config.startingCashUsd,
    logger: noopLogger,
    clock,
  });

  const contributionsByDecision = new Map<string, readonly SignalContribution[]>();
  const closedTrades: Trade[] = [];
  const equityCurve: EquityPoint[] = [];
  let entriesTaken = 0;

  const unsubscribe = engine.onEvent((event) => {
    switch (event.type) {
      case 'decision':
        contributionsByDecision.set(event.decision.id, event.decision.contributions);
        break;
      case 'position-opened':
        entriesTaken++;
        break;
      case 'position-closed':
        closedTrades.push(event.trade);
        break;
      case 'portfolio':
        equityCurve.push({ t: event.timestamp, equityUsd: event.portfolio.equityUsd.toNumber() });
        break;
      default:
        break;
    }
  });

  for (let i = 0; i < config.ticks; i++) {
    clock.advance(config.intervalMs);
    await engine.tickOnce();
  }
  unsubscribe();

  const state = engine.getState();
  const perf = state.performance;

  // --- Signal efficacy: join each closed trade to its entry contributions. ---
  const acc = new Map<string, SignalAccumulator>();
  for (const trade of closedTrades) {
    const contributions = contributionsByDecision.get(trade.entryDecisionId);
    if (!contributions) continue;
    const win = !trade.netPnlUsd.isNegative() && !trade.netPnlUsd.isZero();
    for (const c of contributions) {
      const a = acc.get(c.signalId) ?? { family: c.family, sumWin: 0, countWin: 0, sumLoss: 0, countLoss: 0 };
      if (win) {
        a.sumWin += c.weightedScore;
        a.countWin++;
      } else {
        a.sumLoss += c.weightedScore;
        a.countLoss++;
      }
      acc.set(c.signalId, a);
    }
  }

  const signalEfficacy: SignalEfficacy[] = [...acc.entries()]
    .map(([signalId, a]) => {
      const avgWin = a.countWin > 0 ? a.sumWin / a.countWin : 0;
      const avgLoss = a.countLoss > 0 ? a.sumLoss / a.countLoss : 0;
      return {
        signalId,
        family: a.family,
        tradesObserved: a.countWin + a.countLoss,
        avgScoreInWins: avgWin,
        avgScoreInLosses: avgLoss,
        edge: avgWin - avgLoss,
      } satisfies SignalEfficacy;
    })
    .sort((x, y) => y.edge - x.edge);

  const exitReasons: Record<string, number> = {};
  for (const t of closedTrades) exitReasons[t.exitReason] = (exitReasons[t.exitReason] ?? 0) + 1;

  const tradeLog: TradeSummary[] = closedTrades
    .slice(-200)
    .map((t) => ({
      symbol: t.symbol,
      netPnlUsd: t.netPnlUsd.toNumber(),
      returnPct: t.returnPct,
      exitReason: t.exitReason,
      holdingMinutes: Math.round(t.holdingPeriodMs / 60_000),
    }));

  const finalEquity = state.portfolio.equityUsd.toNumber();

  return {
    config,
    finalEquityUsd: finalEquity,
    totalReturnPct: ((finalEquity - config.startingCashUsd) / config.startingCashUsd) * 100,
    realizedPnlUsd: state.portfolio.realizedPnlUsd.toNumber(),
    maxDrawdownPct: perf.maxDrawdownPct * 100,
    trades: perf.trades,
    wins: perf.wins,
    losses: perf.losses,
    winRate: perf.winRate,
    profitFactor: perf.profitFactor,
    expectancyPct: perf.expectancyPct,
    avgWinUsd: perf.avgWinUsd.toNumber(),
    avgLossUsd: perf.avgLossUsd.toNumber(),
    entriesTaken,
    exitReasons,
    equityCurve,
    signalEfficacy,
    tradeLog,
  };
}
