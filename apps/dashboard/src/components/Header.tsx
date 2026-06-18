import { DEMO, REAL_DATA, type ConnectionStatus } from '../useEngine.js';
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
  const start = 100;
  const totalReturn = state ? n(state.portfolio.realizedPnlUsd) + n(state.portfolio.unrealizedPnlUsd) : 0;
  const running = state?.running ?? false;

  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3 sm:px-4 py-2 border-b border-terminal-border bg-terminal-panel">
      <div className="flex items-center gap-2 mr-auto">
        <span className="text-terminal-accent font-semibold tracking-widest text-base">NONAME</span>
        {DEMO && (
          <span
            className={`tag ${REAL_DATA ? 'border-up/50 text-up' : 'border-terminal-accent/40 text-terminal-accent'}`}
            title={
              REAL_DATA
                ? 'The engine runs live in your browser on REAL DexScreener (Solana) data. Paper trades only — no funds at risk.'
                : 'The engine runs live in your browser on a deterministic simulated market.'
            }
          >
            {REAL_DATA ? 'LIVE · real Solana · paper' : 'Demo · simulated'}
          </span>
        )}
      </div>

      <div className="text-right">
        <div className="stat-label leading-none">Equity</div>
        <div className="tabular-nums text-sm sm:text-base">{usd(equity)}</div>
      </div>
      <div className="text-right">
        <div className="stat-label leading-none">Total P&L</div>
        <div className={`tabular-nums text-sm sm:text-base ${tone(totalReturn)}`}>
          {usd(totalReturn)} <span className="text-[11px]">({((totalReturn / start) * 100).toFixed(1)}%)</span>
        </div>
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
    </header>
  );
}
