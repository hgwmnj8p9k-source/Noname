import type { ActivityItem, SourceHealth } from '../types.js';
import { Panel } from './ui.js';
import { timeAgo } from '../format.js';

const LEVEL_STYLE: Record<string, string> = {
  info: 'text-terminal-text',
  warn: 'text-amber-300',
  error: 'text-down',
};

export function Sources({ sources }: { sources: SourceHealth[] }) {
  return (
    <Panel title="Data Sources & Health">
      <div className="space-y-2">
        {sources.length === 0 && <div className="text-terminal-muted text-xs">No sources reporting</div>}
        {sources.map((s) => (
          <div key={s.source} className="flex items-center gap-2">
            <span className={`inline-block h-2 w-2 rounded-full ${s.ok ? 'bg-up' : 'bg-down'}`} />
            <span className="font-semibold">{s.source}</span>
            <span className="text-[11px] text-terminal-muted truncate flex-1" title={s.note}>
              {s.note}
            </span>
            <span className="text-[10px] text-terminal-muted">{s.lastUpdate ? timeAgo(s.lastUpdate) : '—'}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function Activity({ items }: { items: ActivityItem[] }) {
  return (
    <Panel title="Alerts & Activity" right={<span className="text-terminal-muted">live</span>}>
      {items.length === 0 ? (
        <div className="text-terminal-muted text-xs py-4 text-center">No activity yet</div>
      ) : (
        <ul className="space-y-1">
          {items.map((it) => (
            <li key={it.id} className="flex items-start gap-2 text-[11px]">
              <span className="text-terminal-muted shrink-0 w-12">{timeAgo(it.ts)}</span>
              <span className={`${LEVEL_STYLE[it.level]}`}>{it.text}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
