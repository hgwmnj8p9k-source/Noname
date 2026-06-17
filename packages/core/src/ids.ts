import { randomUUID } from 'node:crypto';

/** Branded id helpers keep entity ids from being accidentally interchanged. */
export type Brand<T, B extends string> = T & { readonly __brand: B };

export type TokenId = Brand<string, 'TokenId'>;
export type DecisionId = Brand<string, 'DecisionId'>;
export type PositionId = Brand<string, 'PositionId'>;
export type TradeId = Brand<string, 'TradeId'>;
export type SnapshotId = Brand<string, 'SnapshotId'>;

export const newDecisionId = (): DecisionId => `dec_${randomUUID()}` as DecisionId;
export const newPositionId = (): PositionId => `pos_${randomUUID()}` as PositionId;
export const newTradeId = (): TradeId => `trd_${randomUUID()}` as TradeId;
export const newSnapshotId = (): SnapshotId => `snp_${randomUUID()}` as SnapshotId;

/** Deterministic token id: `${chain}:${address}` (lowercased). */
export const tokenId = (chain: string, address: string): TokenId =>
  `${chain.toLowerCase()}:${address.toLowerCase()}` as TokenId;
