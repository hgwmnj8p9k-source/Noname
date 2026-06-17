import type { PerformanceStats, PortfolioSnapshot } from '../types.js';
import { Meter, Panel, Stat } from './ui.js';
import { n, pct, pctRaw, tone, usd } from '../format.js';

export function Portfolio({ portfolio, perf }: { portfolio: PortfolioSnapshot; perf: PerformanceStats }) {
  const realized = n(portfolio.realizedPnlUsd);
  const unrealized = n(portfolio.unrealizedPnlUsd);
  const pf = perf.profitFactor;
  return (
    <Panel title="Portfolio & Performance">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Equity" value={usd(portfolio.equityUsd)} />
        <Stat label="Cash" value={usd(portfolio.cashUsd)} />
        <Stat label="Deployed" value={usd(portfolio.positionsValueUsd)} />
        <Stat label="Realized P&L" value={usd(realized)} tone={tone(realized)} />
        <Stat label="Unrealized P&L" value={usd(unrealized)} tone={tone(unrealized)} />
        <Stat label="Open" value={portfolio.openPositions} />
      </div>

      <div className="grid grid-cols-2 gap-4 mt-4">
        <Meter label={`Exposure ${pctRaw(portfolio.exposurePct)}`} value={portfolio.exposurePct} />
        <Meter label={`Drawdown ${pctRaw(portfolio.drawdownPct)}`} value={portfolio.drawdownPct} />
      </div>

      <div className="border-t border-terminal-border mt-4 pt-3 grid grid-cols-4 gap-3 text-center">
        <Stat label="Trades" value={perf.trades} />
        <Stat
          label="Win Rate"
          value={perf.trades ? pctRaw(perf.winRate, 0) : '—'}
          tone={perf.winRate >= 0.5 ? 'text-up' : 'text-down'}
        />
        <Stat
          label="Profit Factor"
          value={perf.trades ? (Number.isFinite(pf) ? pf.toFixed(2) : '∞') : '—'}
        />
        <Stat label="Expectancy" value={perf.trades ? pct(perf.expectancyPct / 100) : '—'} tone={tone(perf.expectancyPct)} />
        <Stat label="Avg Win" value={usd(perf.avgWinUsd)} tone="text-up" />
        <Stat label="Avg Loss" value={usd(perf.avgLossUsd)} tone="text-down" />
        <Stat label="Best" value={usd(perf.bestTradeUsd)} tone="text-up" />
        <Stat label="Worst" value={usd(perf.worstTradeUsd)} tone="text-down" />
      </div>
    </Panel>
  );
}
