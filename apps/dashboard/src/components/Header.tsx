import { DEMO, type ConnectionStatus } from '../useEngine.js';
import type { EngineState } from '../types.js';
import { usd, n, tone } from '../format.js';

const STATUS_STYLE: Record<ConnectionStatus, string> = {
  live: 'bg-up/20 text-up border-up/40',
  connecting: 'bg-amber-400/20 text-amber-300 border-amber-400/40',
  offline: 'bg-down/20 text-down border-down/40',
};

export function Header({
  state,
  status,
  onControl,
}: {
  state: EngineState | null;
  status: ConnectionStatus;
  onControl: (a: 'start' | 'stop') => void;
}) {
  const equity = state ? n(state.portfolio.equityUsd) : 0;
  const start = state ? 10_000 : 0; // display reference; real starting cash from config
  const totalReturn = state ? n(state.portfolio.realizedPnlUsd) + n(state.portfolio.unrealizedPnlUsd) : 0;
  const running = state?.running ?? false;

  return (
    <header className="flex items-center justify-between gap-4 px-4 py-2.5 border-b border-terminal-border bg-terminal-panel">
      <div className="flex items-center gap-3">
        <div className="text-terminal-accent font-semibold tracking-widest text-base">NONAME</div>
        <div className="text-[11px] text-terminal-muted uppercase tracking-widest">
          AI Memecoin Trading Terminal · Paper
        </div>
        {DEMO && (
          <span className="tag border-terminal-accent/40 text-terminal-accent" title="The engine is running live in your browser on a deterministic simulated market.">
            Demo · in-browser engine
          </span>
        )}
      </div>

      <div className="flex items-center gap-6">
        <div className="text-right">
          <div className="stat-label">Equity</div>
          <div className="tabular-nums text-base">{usd(equity)}</div>
        </div>
        <div className="text-right">
          <div className="stat-label">Total P&L</div>
          <div className={`tabular-nums text-base ${tone(totalReturn)}`}>
            {usd(totalReturn)} {start ? `(${((totalReturn / start) * 100).toFixed(1)}%)` : ''}
          </div>
        </div>
        <div className="text-right">
          <div className="stat-label">Ticks</div>
          <div className="tabular-nums text-base">{state?.ticks ?? 0}</div>
        </div>

        <span className={`tag ${STATUS_STYLE[status]}`}>{status}</span>

        <button
          onClick={() => onControl(running ? 'stop' : 'start')}
          className={`tag border px-2 py-1 ${
            running ? 'border-down/40 text-down hover:bg-down/10' : 'border-up/40 text-up hover:bg-up/10'
          }`}
        >
          {running ? '■ Stop' : '▶ Start'}
        </button>
      </div>
    </header>
  );
}
