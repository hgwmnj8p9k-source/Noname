import { useEngine } from './useEngine.js';
import { Header } from './components/Header.js';
import { Portfolio } from './components/Portfolio.js';
import { Positions } from './components/Positions.js';
import { Opportunities } from './components/Opportunities.js';
import { Market } from './components/Market.js';
import { Reasoning } from './components/Reasoning.js';
import { Trades } from './components/Trades.js';
import { Activity, Sources } from './components/SystemFeed.js';

export default function App() {
  const { state, status, activity, control } = useEngine();

  return (
    <div className="min-h-screen flex flex-col">
      <Header state={state} status={status} onControl={control} />

      {!state ? (
        <div className="flex-1 flex items-center justify-center text-terminal-muted p-6 text-center">
          {status === 'offline' ? 'Connecting to the engine…' : 'Starting the engine…'}
        </div>
      ) : (
        <main className="flex-1 p-2 sm:p-3 grid grid-cols-1 lg:grid-cols-12 gap-2 sm:gap-3 lg:h-[calc(100vh-3.25rem)] lg:overflow-hidden">
          {/* Column A — money & holdings first (top of the page on mobile) */}
          <div className="lg:col-span-4 flex flex-col gap-2 sm:gap-3 lg:min-h-0 lg:overflow-y-auto">
            <Portfolio portfolio={state.portfolio} perf={state.performance} />
            <Positions positions={state.positions} />
            <Market market={state.market} />
          </div>

          {/* Column B — opportunities & closed trades */}
          <div className="lg:col-span-5 flex flex-col gap-2 sm:gap-3 lg:min-h-0 lg:overflow-y-auto">
            <Opportunities opportunities={state.opportunities} />
            <Trades trades={state.recentTrades} />
          </div>

          {/* Column C — reasoning, activity, health */}
          <div className="lg:col-span-3 flex flex-col gap-2 sm:gap-3 lg:min-h-0 lg:overflow-y-auto">
            <Reasoning decisions={state.recentDecisions} />
            <Activity items={activity} />
            <Sources sources={state.sources} />
          </div>
        </main>
      )}
    </div>
  );
}
