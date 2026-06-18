// Mirror of the engine's serialized state. Money fields arrive as decimal
// strings (fixed-point on the server) and are parsed for display only.

export interface Token {
  id: string;
  chain: string;
  address: string;
  symbol: string;
  name: string;
  createdAt?: number;
}

export interface SignalContribution {
  signalId: string;
  family: 'price' | 'liquidity' | 'onchain' | 'social';
  score: number;
  confidence: number;
  weightedScore: number;
  evidence: string[];
}

export interface TradeDecision {
  id: string;
  tokenId: string;
  timestamp: number;
  action: 'ENTER' | 'SKIP' | 'EXIT';
  conviction: number;
  confirmations: number;
  sizeUsd?: number;
  stopLossPrice?: number;
  takeProfitPrice?: number;
  contributions: SignalContribution[];
  reasoning: string[];
  rejectionReason?: string;
}

export interface Position {
  id: string;
  tokenId: string;
  symbol: string;
  status: 'OPEN' | 'CLOSED';
  entryPrice: string;
  quantity: string;
  costBasisUsd: string;
  stopLossPrice: string;
  takeProfitPrice: string;
  openedAt: number;
}

export interface PositionMark {
  position: Position;
  currentPrice: string;
  marketValueUsd: string;
  unrealizedPnlUsd: string;
  unrealizedPnlPct: number;
}

export interface PostTradeAnalysis {
  followedStrategy: boolean;
  successful: boolean;
  strongestSignal?: { signalId: string; weightedScore: number };
  weakestSignal?: { signalId: string; weightedScore: number };
  whatCouldImprove: string[];
  notes: string[];
}

export interface Trade {
  id: string;
  tokenId: string;
  symbol: string;
  entryPrice: string;
  exitPrice: string;
  netPnlUsd: string;
  feesUsd: string;
  returnPct: number;
  holdingPeriodMs: number;
  exitReason: string;
  closedAt: number;
  analysis: PostTradeAnalysis;
}

export interface MarketRow {
  token: Token;
  priceUsd: number;
  liquidityUsd: number;
  volume24hUsd: number;
  change: number;
  socialMentions: number;
  hasPosition: boolean;
}

export interface PortfolioSnapshot {
  cashUsd: string;
  positionsValueUsd: string;
  equityUsd: string;
  realizedPnlUsd: string;
  unrealizedPnlUsd: string;
  exposurePct: number;
  openPositions: number;
  drawdownPct: number;
}

export interface PerformanceStats {
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  netPnlUsd: string;
  avgWinUsd: string;
  avgLossUsd: string;
  profitFactor: number;
  expectancyPct: number;
  maxDrawdownPct: number;
  bestTradeUsd: string;
  worstTradeUsd: string;
}

export interface SourceHealth {
  source: string;
  ok: boolean;
  lastUpdate: number;
  note?: string;
}

export interface Opportunity {
  token: Token;
  decision: TradeDecision;
}

export interface EngineState {
  running: boolean;
  startedAt: number | null;
  now: number;
  ticks: number;
  portfolio: PortfolioSnapshot;
  performance: PerformanceStats;
  positions: PositionMark[];
  opportunities: Opportunity[];
  recentDecisions: TradeDecision[];
  recentTrades: Trade[];
  market: MarketRow[];
  sources: SourceHealth[];
}

export type EngineEvent =
  | { type: 'tick'; timestamp: number; tokensObserved: number }
  | { type: 'decision'; timestamp: number; decision: TradeDecision }
  | { type: 'position-opened'; timestamp: number; position: Position }
  | { type: 'position-closed'; timestamp: number; trade: Trade }
  | { type: 'portfolio'; timestamp: number }
  | { type: 'sources'; timestamp: number }
  | { type: 'alert'; timestamp: number; level: 'info' | 'warn' | 'error'; message: string }
  | { type: 'state'; timestamp: number; state: EngineState };

export interface ActivityItem {
  id: string;
  ts: number;
  level: 'info' | 'warn' | 'error';
  text: string;
}
