import { useState } from 'react';
import type { Trade } from '../types.js';
import { Panel, TokenLink } from './ui.js';
import { duration, n, pct, price, timeAgo, tone, usd } from '../format.js';

function TradeRow({ trade }: { trade: Trade }) {
  const [open, setOpen] = useState(false);
  const win = n(trade.netPnlUsd) >= 0;
  return (
    <>
      <tr className="border-t border-terminal-border/50 cursor-pointer hover:bg-terminal-bg/40" onClick={() => setOpen((o) => !o)}>
        <td onClick={(e) => e.stopPropagation()}><TokenLink symbol={trade.symbol} tokenId={trade.tokenId} /></td>
        <td className="text-right text-terminal-muted">{price(trade.entryPrice)}</td>
        <td className="text-right text-terminal-muted">{price(trade.exitPrice)}</td>
        <td className="text-[10px] text-terminal-muted">{trade.exitReason}</td>
        <td className="text-right text-terminal-muted">{duration(trade.holdingPeriodMs)}</td>
        <td className={`text-right ${tone(trade.returnPct)}`}>
          {usd(trade.netPnlUsd)} <span className="text-[11px]">({pct(trade.returnPct)})</span>
        </td>
        <td className="text-right text-terminal-muted text-[10px]">{timeAgo(trade.closedAt)}</td>
      </tr>
      {open && (
        <tr className="bg-terminal-bg/40">
          <td colSpan={7} className="px-3 py-2">
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[11px]">
              <div>
                <span className="text-terminal-muted">Followed strategy: </span>
                <span className={trade.analysis.followedStrategy ? 'text-up' : 'text-down'}>
                  {trade.analysis.followedStrategy ? 'yes' : 'no'}
                </span>
              </div>
              <div>
                <span className="text-terminal-muted">Outcome: </span>
                <span className={win ? 'text-up' : 'text-down'}>{trade.analysis.successful ? 'win' : 'loss'}</span>
              </div>
              {trade.analysis.strongestSignal && (
                <div>
                  <span className="text-terminal-muted">Strongest: </span>
                  {trade.analysis.strongestSignal.signalId} ({trade.analysis.strongestSignal.weightedScore.toFixed(2)})
                </div>
              )}
              {trade.analysis.weakestSignal && (
                <div>
                  <span className="text-terminal-muted">Weakest: </span>
                  {trade.analysis.weakestSignal.signalId} ({trade.analysis.weakestSignal.weightedScore.toFixed(2)})
                </div>
              )}
              <div>
                <span className="text-terminal-muted">Fees: </span>
                {usd(trade.feesUsd)}
              </div>
            </div>
            {trade.analysis.whatCouldImprove.length > 0 && (
              <div className="mt-2">
                <div className="stat-label">What could improve</div>
                <ul className="text-[11px] text-terminal-muted space-y-0.5 mt-0.5">
                  {trade.analysis.whatCouldImprove.map((w, i) => (
                    <li key={i}>· {w}</li>
                  ))}
                </ul>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

export function Trades({ trades }: { trades: Trade[] }) {
  return (
    <Panel title="Closed Trades" right={<span className="text-terminal-muted">{trades.length} · click for analysis</span>}>
      {trades.length === 0 ? (
        <div className="text-terminal-muted text-xs py-6 text-center">No closed trades yet</div>
      ) : (
        <table className="w-full">
          <thead>
            <tr>
              <th>Token</th>
              <th className="text-right">Bought @</th>
              <th className="text-right">Sold @</th>
              <th>Reason</th>
              <th className="text-right">Held</th>
              <th className="text-right">Net P&L</th>
              <th className="text-right">When</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((t) => (
              <TradeRow key={t.id} trade={t} />
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
