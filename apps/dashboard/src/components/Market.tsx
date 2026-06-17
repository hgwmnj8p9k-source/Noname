import type { MarketRow } from '../types.js';
import { Panel } from './ui.js';
import { compactUsd, n, pct, price, tone } from '../format.js';

export function Market({ market }: { market: MarketRow[] }) {
  return (
    <Panel title="Trending Memecoins" right={<span className="text-terminal-muted">{market.length} tracked</span>}>
      <table className="w-full">
        <thead>
          <tr>
            <th>Token</th>
            <th className="text-right">Price</th>
            <th className="text-right">5-tick</th>
            <th className="text-right">Liquidity</th>
            <th className="text-right">Volume</th>
            <th className="text-right">Social</th>
          </tr>
        </thead>
        <tbody>
          {market.map((m) => (
            <tr key={m.token.id} className="border-t border-terminal-border/50">
              <td>
                <span className="font-semibold">{m.token.symbol}</span>
                {m.hasPosition && <span className="ml-1 tag border-terminal-accent/40 text-terminal-accent">held</span>}
                <span className="ml-1 text-[10px] text-terminal-muted uppercase">{m.token.chain}</span>
              </td>
              <td className="text-right">{price(m.priceUsd)}</td>
              <td className={`text-right ${tone(m.change)}`}>{pct(m.change)}</td>
              <td className="text-right text-terminal-muted">{compactUsd(m.liquidityUsd)}</td>
              <td className="text-right text-terminal-muted">{compactUsd(m.volume24hUsd)}</td>
              <td className="text-right text-terminal-muted">{n(m.socialMentions)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}
