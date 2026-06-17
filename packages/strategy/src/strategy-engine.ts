import {
  newDecisionId,
  type Signal,
  type TokenWithHistory,
  type TradeDecision,
} from '@noname/core';
import { ConfluenceEngine } from './confluence.js';
import { RiskManager, type PortfolioState } from './risk.js';
import {
  DEFAULT_RISK_CONFIG,
  DEFAULT_STRATEGY_CONFIG,
  type RiskConfig,
  type StrategyConfig,
} from './config.js';
import { fixed } from '@noname/core';

/**
 * Composition root for the decision logic: confluence assessment → risk sizing
 * → a fully-reasoned, immutable {@link TradeDecision}. The engine layer calls
 * this; it owns no I/O and is therefore deterministic and unit-testable.
 */
export class StrategyEngine {
  private readonly confluence: ConfluenceEngine;
  private readonly risk: RiskManager;

  constructor(
    signals: readonly Signal[],
    private readonly strategyConfig: StrategyConfig = DEFAULT_STRATEGY_CONFIG,
    riskConfig: RiskConfig = DEFAULT_RISK_CONFIG,
  ) {
    this.confluence = new ConfluenceEngine(signals, strategyConfig);
    this.risk = new RiskManager(riskConfig);
  }

  evaluateEntry(subject: TokenWithHistory, portfolio: PortfolioState, now: number): TradeDecision {
    const assessment = this.confluence.assess(subject);
    const base = {
      id: newDecisionId(),
      tokenId: subject.token.id,
      timestamp: now,
      conviction: assessment.conviction,
      confirmations: assessment.confirmations,
      contributions: assessment.contributions,
    };

    if (!assessment.enter) {
      return {
        ...base,
        action: 'SKIP',
        reasoning: assessment.reasoning,
        rejectionReason: assessment.rejectionReason ?? 'Did not meet entry criteria',
      };
    }

    const entryPrice = fixed(subject.latest.priceUsd.toString());
    const sizing = this.risk.size({ portfolio, entryPrice, conviction: assessment.conviction });

    if (!sizing.approved) {
      return {
        ...base,
        action: 'SKIP',
        reasoning: [...assessment.reasoning, `Risk: ${sizing.reason}`],
        rejectionReason: sizing.reason,
      };
    }

    return {
      ...base,
      action: 'ENTER',
      sizeUsd: sizing.sizeUsd.toNumber(),
      stopLossPrice: sizing.stopLossPrice.toNumber(),
      takeProfitPrice: sizing.takeProfitPrice.toNumber(),
      reasoning: [...assessment.reasoning, ...sizing.notes],
    };
  }

  get config(): StrategyConfig {
    return this.strategyConfig;
  }
}
