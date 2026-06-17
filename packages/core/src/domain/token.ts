import type { TokenId } from '../ids.js';

export type Chain = 'solana' | 'ethereum' | 'base' | 'bsc' | 'simulated';

export interface Token {
  readonly id: TokenId;
  readonly chain: Chain;
  readonly address: string;
  readonly symbol: string;
  readonly name: string;
  /** Unix ms when the token/pair was created, if known. */
  readonly createdAt?: number;
}
