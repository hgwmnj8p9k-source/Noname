import { describe, expect, it } from 'vitest';
import { fixed, newPositionId, newDecisionId, tokenId, type Position } from '@noname/core';
import { ExitEvaluator } from './exit.js';
import { DEFAULT_RISK_CONFIG } from './config.js';

function position(): Position {
  return {
    id: newPositionId(),
    tokenId: tokenId('simulated', 'x'),
    symbol: 'X',
    status: 'OPEN',
    entryDecisionId: newDecisionId(),
    entryPrice: fixed(1),
    quantity: fixed(1000),
    costBasisUsd: fixed(1000),
    entryFeesUsd: fixed(3),
    openedAt: 0,
    stopLossPrice: fixed(0.85),
    takeProfitPrice: fixed(1.4),
    highWaterPrice: fixed(1),
  };
}

describe('ExitEvaluator', () => {
  const evaluator = new ExitEvaluator(DEFAULT_RISK_CONFIG);

  it('triggers stop-loss at or below the stop price', () => {
    const r = evaluator.evaluate(position(), fixed(0.84));
    expect(r.exit).toBe(true);
    expect(r.reason).toBe('STOP_LOSS');
  });

  it('triggers take-profit at or above the target', () => {
    const r = evaluator.evaluate(position(), fixed(1.41));
    expect(r.exit).toBe(true);
    expect(r.reason).toBe('TAKE_PROFIT');
  });

  it('holds inside the band and advances the high-water mark', () => {
    const r = evaluator.evaluate(position(), fixed(1.2));
    expect(r.exit).toBe(false);
    expect(r.newHighWaterPrice.toNumber()).toBe(1.2);
  });

  it('trails after moving into profit', () => {
    const p = { ...position(), highWaterPrice: fixed(1.3) };
    // trailing stop = 1.3 * (1 - 0.18) = 1.066
    const r = evaluator.evaluate(p, fixed(1.05));
    expect(r.exit).toBe(true);
    expect(r.reason).toBe('TRAILING_STOP');
  });
});
