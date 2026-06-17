import { Fixed, fixed, type ExitReason, type Position } from '@noname/core';
import type { RiskConfig } from './config.js';

export interface ExitDecision {
  readonly exit: boolean;
  readonly reason?: ExitReason;
  /** Updated high-water mark to persist back onto the position. */
  readonly newHighWaterPrice: Fixed;
  readonly note?: string;
}

/**
 * Evaluates open-position exits every tick: hard stop-loss, take-profit, and a
 * trailing stop that only activates once a position is in profit. Pure and
 * deterministic so exit behaviour is unit-testable.
 */
export class ExitEvaluator {
  constructor(private readonly config: RiskConfig) {}

  evaluate(position: Position, currentPrice: Fixed): ExitDecision {
    const newHighWater = currentPrice.gt(position.highWaterPrice)
      ? currentPrice
      : position.highWaterPrice;

    if (currentPrice.lte(position.stopLossPrice)) {
      return { exit: true, reason: 'STOP_LOSS', newHighWaterPrice: newHighWater, note: 'Stop-loss hit' };
    }
    if (currentPrice.gte(position.takeProfitPrice)) {
      return { exit: true, reason: 'TAKE_PROFIT', newHighWaterPrice: newHighWater, note: 'Take-profit hit' };
    }

    // Trailing stop, active only when the position has moved into profit.
    if (newHighWater.gt(position.entryPrice)) {
      const trailStop = newHighWater.mul(fixed(1 - this.config.trailingStopPct));
      if (currentPrice.lte(trailStop)) {
        return {
          exit: true,
          reason: 'TRAILING_STOP',
          newHighWaterPrice: newHighWater,
          note: `Trailing stop (${(this.config.trailingStopPct * 100).toFixed(0)}% off high)`,
        };
      }
    }

    return { exit: false, newHighWaterPrice: newHighWater };
  }
}
