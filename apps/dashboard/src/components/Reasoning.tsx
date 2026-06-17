import type { TradeDecision } from '../types.js';
import { Panel } from './ui.js';
import { timeAgo } from '../format.js';

const ACTION_STYLE: Record<string, string> = {
  ENTER: 'border-up/40 text-up',
  EXIT: 'border-sky-400/40 text-sky-300',
  SKIP: 'border-terminal-border text-terminal-muted',
};

export function Reasoning({ decisions }: { decisions: TradeDecision[] }) {
  const notable = decisions.filter((d) => d.action !== 'SKIP' || d.conviction >= 0.2).slice(0, 25);
  return (
    <Panel title="AI Reasoning Feed" right={<span className="text-terminal-muted">why every action happened</span>}>
      {notable.length === 0 ? (
        <div className="text-terminal-muted text-xs py-6 text-center">Awaiting decisions…</div>
      ) : (
        <div className="space-y-2">
          {notable.map((d) => (
            <div key={d.id} className="border-b border-terminal-border/40 pb-2 last:border-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`tag ${ACTION_STYLE[d.action]}`}>{d.action}</span>
                <span className="font-semibold">{d.tokenId.split(':')[1] ?? d.tokenId}</span>
                <span className="text-[10px] text-terminal-muted">conv {d.conviction.toFixed(2)}</span>
                <span className="text-[10px] text-terminal-muted">{d.confirmations} conf</span>
                <span className="ml-auto text-[10px] text-terminal-muted">{timeAgo(d.timestamp)}</span>
              </div>
              <ul className="text-[11px] text-terminal-muted space-y-0.5 pl-1">
                {d.reasoning.slice(0, 4).map((r, i) => (
                  <li key={i} className="truncate" title={r}>
                    · {r}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
