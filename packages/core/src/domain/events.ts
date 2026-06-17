import type { TradeDecision } from './decision.js';
import type { TokenWithHistory } from './market.js';
import type { Position } from './position.js';
import type { PortfolioSnapshot } from './portfolio.js';
import type { Trade } from './trade.js';

export type SourceHealth = {
  readonly source: string;
  readonly ok: boolean;
  readonly lastUpdate: number;
  readonly note?: string;
};

/** The typed event stream the engine emits and the API forwards over WS. */
export type EngineEvent =
  | { type: 'tick'; timestamp: number; tokensObserved: number }
  | { type: 'market'; timestamp: number; tokens: readonly TokenWithHistory[] }
  | { type: 'decision'; timestamp: number; decision: TradeDecision }
  | { type: 'position-opened'; timestamp: number; position: Position }
  | { type: 'position-closed'; timestamp: number; trade: Trade }
  | { type: 'portfolio'; timestamp: number; portfolio: PortfolioSnapshot }
  | { type: 'sources'; timestamp: number; sources: readonly SourceHealth[] }
  | { type: 'alert'; timestamp: number; level: 'info' | 'warn' | 'error'; message: string };

export type EngineEventType = EngineEvent['type'];
export type EngineEventListener = (event: EngineEvent) => void;
