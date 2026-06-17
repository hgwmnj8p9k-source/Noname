import type { SnapshotId, TokenId } from '../ids.js';
import type { Token } from './token.js';

/**
 * A point-in-time observation of a token's market & on-chain state, normalized
 * across data sources. Stored append-only so signals only ever see information
 * that was available at decision time (no look-ahead bias).
 */
export interface MarketSnapshot {
  readonly id: SnapshotId;
  readonly tokenId: TokenId;
  readonly source: string;
  readonly timestamp: number;

  readonly priceUsd: number;
  readonly liquidityUsd: number;
  readonly volume24hUsd: number;
  readonly marketCapUsd: number;

  /** Buy/sell transaction counts in the trailing short window. */
  readonly buys: number;
  readonly sells: number;

  readonly holders: number;
  /** Fraction of supply held by the top 10 wallets, 0..1. Rug-risk proxy. */
  readonly topHolderConcentration: number;
  /** Whether liquidity is locked/burned, when known. */
  readonly liquidityLocked: boolean;

  /** Aggregated social mentions in the trailing window. */
  readonly socialMentions: number;
  /** Normalized social sentiment, -1..1. */
  readonly socialSentiment: number;

  /**
   * Short-window metrics, when the source provides them (e.g. DexScreener's
   * m5/h1 windows). These make signals responsive on real data that otherwise
   * only exposes slow 24h aggregates. Signals use them when present and fall
   * back to deriving deltas from snapshot history when absent.
   */
  readonly priceChange5m?: number;
  readonly priceChange1h?: number;
  readonly volume5mUsd?: number;
  readonly volume1hUsd?: number;
  readonly buys5m?: number;
  readonly sells5m?: number;
}

export interface TokenWithHistory {
  readonly token: Token;
  /** Snapshots ordered oldest → newest. */
  readonly history: readonly MarketSnapshot[];
  readonly latest: MarketSnapshot;
}
