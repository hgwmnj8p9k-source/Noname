import { useCallback, useEffect, useRef, useState } from 'react';
import type { ActivityItem, EngineEvent, EngineState } from './types.js';

const POLL_MS = 2000;
const MAX_ACTIVITY = 80;

/**
 * Demo mode runs the *real* engine entirely in the browser on the deterministic
 * simulated feed, so the dashboard works as a static site with no backend
 * (used for the public deployment). Otherwise it talks to the @noname/api
 * server over REST + WebSocket.
 */
export const DEMO = import.meta.env.VITE_DEMO === '1';
/** When set (with DEMO), the in-browser engine runs on REAL DexScreener data
 * instead of the simulator. DexScreener permits browser (CORS) access, so this
 * needs no backend. */
export const REAL_DATA = import.meta.env.VITE_REAL_DATA === '1';

export type ConnectionStatus = 'connecting' | 'live' | 'offline';

let counter = 0;
const nextId = () => `act_${Date.now()}_${counter++}`;

function eventToActivity(ev: EngineEvent): ActivityItem | null {
  switch (ev.type) {
    case 'alert':
      return { id: nextId(), ts: ev.timestamp, level: ev.level, text: ev.message };
    case 'position-opened':
      return { id: nextId(), ts: ev.timestamp, level: 'info', text: `Opened position in ${ev.position.symbol}` };
    case 'position-closed':
      return {
        id: nextId(),
        ts: ev.timestamp,
        level: Number(ev.trade.netPnlUsd) >= 0 ? 'info' : 'warn',
        text: `Closed ${ev.trade.symbol} (${ev.trade.exitReason}) · ${Number(ev.trade.netPnlUsd).toFixed(2)} USD`,
      };
    case 'decision':
      if (ev.decision.action === 'ENTER')
        return { id: nextId(), ts: ev.timestamp, level: 'info', text: `ENTER ${ev.decision.tokenId.split(':')[1] ?? ''} conviction ${ev.decision.conviction.toFixed(2)}` };
      return null;
    default:
      return null;
  }
}

// `serialize` mirrors the wire format (fixed-point money → decimal strings) so
// the in-browser engine produces exactly what the REST API would.
const serialize = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export function useEngine() {
  const [state, setState] = useState<EngineState | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const demoEngineRef = useRef<any>(null);

  const pushActivity = useCallback((ev: EngineEvent) => {
    const item = eventToActivity(ev);
    if (item) setActivity((prev) => [item, ...prev].slice(0, MAX_ACTIVITY));
  }, []);

  // --- Demo mode: run the engine in-browser -------------------------------
  useEffect(() => {
    if (!DEMO) return;
    let disposed = false;
    let unsub: (() => void) | undefined;

    void (async () => {
      const [{ createEngine }, { noopLogger }] = await Promise.all([
        import('@noname/engine'),
        import('@noname/core'),
      ]);
      if (disposed) return;
      const engine = REAL_DATA
        ? createEngine({
            startingCashUsd: 100,
            tickIntervalMs: 15_000,
            includeSimulator: false,
            dexScreener: { discoverChains: ['solana'], maxTracked: 40 },
            // $100 small-account risk profile.
            riskConfig: {
              riskPerTradePct: 0.04,
              maxPositionPct: 0.3,
              maxConcurrentPositions: 3,
              minPositionUsd: 5,
            },
            // Realistic low Solana swap cost.
            venueConfig: { networkFeeUsd: 0.03 },
            logger: noopLogger,
          })
        : createEngine({ seed: 1337, tickIntervalMs: 1500, logger: noopLogger });
      demoEngineRef.current = engine;
      unsub = engine.onEvent((ev) => {
        const wire = serialize(ev) as unknown as EngineEvent;
        pushActivity(wire);
        if (wire.type === 'tick') setState(serialize(engine.getState()) as unknown as EngineState);
      });
      engine.start();
      setStatus('live');
      setState(serialize(engine.getState()) as unknown as EngineState);
    })();

    return () => {
      disposed = true;
      unsub?.();
      demoEngineRef.current?.stop();
    };
  }, [pushActivity]);

  // --- Server mode: REST polling for snapshot panels ----------------------
  const refresh = useCallback(async () => {
    if (DEMO) return;
    try {
      const res = await fetch('/api/state');
      if (!res.ok) throw new Error(String(res.status));
      setState(await res.json());
    } catch {
      setStatus((s) => (s === 'live' ? 'live' : 'offline'));
    }
  }, []);

  useEffect(() => {
    if (DEMO) return;
    void refresh();
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  // --- Server mode: WebSocket for the live activity feed ------------------
  useEffect(() => {
    if (DEMO) return;
    let closed = false;
    let retry: ReturnType<typeof setTimeout>;

    const connect = () => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${location.host}/ws`);
      wsRef.current = ws;
      ws.onopen = () => setStatus('live');
      ws.onclose = () => {
        if (closed) return;
        setStatus('offline');
        retry = setTimeout(connect, 2000);
      };
      ws.onerror = () => ws.close();
      ws.onmessage = (msg) => {
        try {
          const ev = JSON.parse(msg.data) as EngineEvent | { type: 'state'; state: EngineState };
          if (ev.type === 'state') {
            setState(ev.state);
            return;
          }
          pushActivity(ev);
        } catch {
          /* ignore malformed frames */
        }
      };
    };

    connect();
    return () => {
      closed = true;
      clearTimeout(retry);
      wsRef.current?.close();
    };
  }, [pushActivity]);

  const control = useCallback(
    async (action: 'start' | 'stop') => {
      if (DEMO) {
        const engine = demoEngineRef.current;
        if (!engine) return;
        if (action === 'start') engine.start();
        else engine.stop();
        setState(serialize(engine.getState()) as unknown as EngineState);
        return;
      }
      await fetch(`/api/engine/${action}`, { method: 'POST' });
      void refresh();
    },
    [refresh],
  );

  return { state, status, activity, control };
}
