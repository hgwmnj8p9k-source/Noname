import type { PositionMark } from '../types.js';
import { Panel, TokenLink } from './ui.js';
import { price, tone, usd, pct } from '../format.js';

export function Positions({ positions }: { positions: PositionMark[] }) {
  return (
    <Panel title="Active Positions" right={<span className="text-terminal-muted">{positions.length}</span>}>
      {positions.length === 0 ? (
        <div className="text-terminal-muted text-xs py-6 text-center">No open positions</div>
      ) : (
        <table className="w-full">
          <thead>
            <tr>
              <th>Token</th>
              <th className="text-right">Bought @</th>
              <th className="text-right">Now</th>
              <th className="text-right">Value</th>
              <th className="text-right">Stop / Target</th>
              <th className="text-right">P&L</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((m) => (
              <tr key={m.position.id} className="border-t border-terminal-border/50">
                <td><TokenLink symbol={m.position.symbol} tokenId={m.position.tokenId} /></td>
                <td className="text-right text-terminal-muted">{price(m.position.entryPrice)}</td>
                <td className="text-right">{price(m.currentPrice)}</td>
                <td className="text-right">{usd(m.marketValueUsd)}</td>
                <td className="text-right text-[11px] text-terminal-muted">
                  {price(m.position.stopLossPrice)} / {price(m.position.takeProfitPrice)}
                </td>
                <td className={`text-right ${tone(m.unrealizedPnlPct)}`}>
                  {usd(m.unrealizedPnlUsd)} <span className="text-[11px]">({pct(m.unrealizedPnlPct)})</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
