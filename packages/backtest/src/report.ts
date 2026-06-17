export interface BacktestConfig {
  readonly seed: number;
  readonly ticks: number;
  readonly intervalMs: number;
  readonly startingCashUsd: number;
}

export interface EquityPoint {
  readonly t: number;
  readonly equityUsd: number;
}

export interface TradeSummary {
  readonly symbol: string;
  readonly netPnlUsd: number;
  readonly returnPct: number;
  readonly exitReason: string;
  readonly holdingMinutes: number;
}

/**
 * Per-signal efficacy: how a signal scored at entry in trades that won vs lost.
 * `edge` (avg weighted score in winners minus losers) is a forward-looking
 * measure of predictive value that Milestone 3's adaptive weighting consumes.
 */
export interface SignalEfficacy {
  readonly signalId: string;
  readonly family: string;
  readonly tradesObserved: number;
  readonly avgScoreInWins: number;
  readonly avgScoreInLosses: number;
  readonly edge: number;
}

export interface BacktestReport {
  readonly config: BacktestConfig;
  readonly finalEquityUsd: number;
  readonly totalReturnPct: number;
  readonly realizedPnlUsd: number;
  readonly maxDrawdownPct: number;
  readonly trades: number;
  readonly wins: number;
  readonly losses: number;
  readonly winRate: number;
  readonly profitFactor: number;
  readonly expectancyPct: number;
  readonly avgWinUsd: number;
  readonly avgLossUsd: number;
  readonly entriesTaken: number;
  readonly exitReasons: Readonly<Record<string, number>>;
  readonly equityCurve: readonly EquityPoint[];
  readonly signalEfficacy: readonly SignalEfficacy[];
  readonly tradeLog: readonly TradeSummary[];
}

function bar(value: number, max: number, width = 24): string {
  const filled = max <= 0 ? 0 : Math.round((value / max) * width);
  return '█'.repeat(Math.max(0, Math.min(width, filled))).padEnd(width, '·');
}

/** Render a human-readable terminal report. */
export function formatReport(r: BacktestReport): string {
  const lines: string[] = [];
  const pf = Number.isFinite(r.profitFactor) ? r.profitFactor.toFixed(2) : '∞';
  lines.push('═'.repeat(64));
  lines.push(`  BACKTEST REPORT · seed ${r.config.seed} · ${r.config.ticks} ticks`);
  lines.push('═'.repeat(64));
  lines.push(`  Starting cash    $${r.config.startingCashUsd.toLocaleString()}`);
  lines.push(`  Final equity     $${r.finalEquityUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
  lines.push(`  Total return     ${r.totalReturnPct >= 0 ? '+' : ''}${r.totalReturnPct.toFixed(1)}%`);
  lines.push(`  Realized PnL     $${r.realizedPnlUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
  lines.push(`  Max drawdown     ${r.maxDrawdownPct.toFixed(1)}%`);
  lines.push('─'.repeat(64));
  lines.push(`  Trades ${r.trades}  ·  Win rate ${(r.winRate * 100).toFixed(0)}%  ·  PF ${pf}  ·  Expectancy ${r.expectancyPct.toFixed(1)}%`);
  lines.push(`  Avg win $${r.avgWinUsd.toFixed(0)}  ·  Avg loss $${r.avgLossUsd.toFixed(0)}  ·  Entries taken ${r.entriesTaken}`);
  lines.push('─'.repeat(64));
  lines.push('  Exit reasons:');
  for (const [reason, count] of Object.entries(r.exitReasons)) {
    lines.push(`    ${reason.padEnd(16)} ${count}`);
  }
  lines.push('─'.repeat(64));
  lines.push('  Signal efficacy (edge = avg score in wins − in losses):');
  for (const s of r.signalEfficacy) {
    const sign = s.edge >= 0 ? '+' : '';
    lines.push(`    ${s.signalId.padEnd(22)} edge ${sign}${s.edge.toFixed(3)}  (n=${s.tradesObserved})`);
  }
  lines.push('─'.repeat(64));
  lines.push('  Equity curve:');
  const max = Math.max(...r.equityCurve.map((p) => p.equityUsd), r.config.startingCashUsd);
  const step = Math.max(1, Math.floor(r.equityCurve.length / 12));
  for (let i = 0; i < r.equityCurve.length; i += step) {
    const p = r.equityCurve[i]!;
    lines.push(`    ${bar(p.equityUsd, max)} $${p.equityUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
  }
  lines.push('═'.repeat(64));
  return lines.join('\n');
}
