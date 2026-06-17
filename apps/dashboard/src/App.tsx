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
    <div className="h-screen flex flex-col">
      <Header state={state} status={status} onControl={control} />

      {!state ? (
        <div className="flex-1 flex items-center justify-center text-terminal-muted">
          {status === 'offline' ? 'API offline — start the @noname/api server' : 'Connecting to engine…'}
        </div>
      ) : (
        <main className="flex-1 overflow-hidden grid grid-cols-12 gap-3 p-3">
          <div className="col-span-5 flex flex-col gap-3 min-h-0">
            <Opportunities opportunities={state.opportunities} />
            <Trades trades={state.recentTrades} />
          </div>

          <div className="col-span-4 flex flex-col gap-3 min-h-0">
            <Portfolio portfolio={state.portfolio} perf={state.performance} />
            <Market market={state.market} />
            <Positions positions={state.positions} />
          </div>

          <div className="col-span-3 flex flex-col gap-3 min-h-0">
            <Reasoning decisions={state.recentDecisions} />
            <Activity items={activity} />
            <Sources sources={state.sources} />
          </div>
        </main>
      )}
    </div>
  );
}
