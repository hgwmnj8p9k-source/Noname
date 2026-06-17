import { useCallback, useEffect, useRef, useState } from 'react';
import type { ActivityItem, EngineEvent, EngineState } from './types.js';

const POLL_MS = 2000;
const MAX_ACTIVITY = 80;

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
        text: `Closed ${ev.trade.symbol} (${ev.trade.exitReason}) · ${ev.trade.netPnlUsd} USD`,
      };
    case 'decision':
      if (ev.decision.action === 'ENTER')
        return { id: nextId(), ts: ev.timestamp, level: 'info', text: `ENTER ${ev.decision.tokenId.split(':')[1] ?? ''} conviction ${ev.decision.conviction.toFixed(2)}` };
      return null;
    default:
      return null;
  }
}

export function useEngine() {
  const [state, setState] = useState<EngineState | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/state');
      if (!res.ok) throw new Error(String(res.status));
      setState(await res.json());
    } catch {
      setStatus((s) => (s === 'live' ? 'live' : 'offline'));
    }
  }, []);

  // REST polling for snapshot panels.
  useEffect(() => {
    void refresh();
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  // WebSocket for the live activity feed and connection liveness.
  useEffect(() => {
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
          const ev = JSON.parse(msg.data) as EngineEvent;
          if (ev.type === 'state') {
            setState(ev.state);
            return;
          }
          const item = eventToActivity(ev);
          if (item) setActivity((prev) => [item, ...prev].slice(0, MAX_ACTIVITY));
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
  }, []);

  const control = useCallback(async (action: 'start' | 'stop') => {
    await fetch(`/api/engine/${action}`, { method: 'POST' });
    void refresh();
  }, [refresh]);

  return { state, status, activity, control };
}
