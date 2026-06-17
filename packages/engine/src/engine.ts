import {
  ConsoleLogger,
  EventEmitter,
  Fixed,
  fixed,
  newDecisionId,
  SystemClock,
  type Clock,
  type EngineEventListener,
  type Logger,
  type MarketSnapshot,
  type Position,
  type Token,
  type TokenId,
  type TokenWithHistory,
  type TradeDecision,
} from '@noname/core';
import { MarketAggregator } from '@noname/market-data';
import { ExitEvaluator, StrategyEngine, type PortfolioState } from '@noname/strategy';
import { PaperExecutionVenue, PaperPortfolio } from '@noname/paper-trading';
import { computePerformance, TradeAnalyzer } from '@noname/decision-log';
import { createInMemoryRepositories, type Repositories } from '@noname/persistence';
import type { EngineConfig } from './config.js';
import type { EngineState, MarketRow, Opportunity } from './state.js';

/**
 * The orchestrator. Each tick it ingests the market, manages open positions
 * (exits first), evaluates new entries under confluence + risk, executes paper
 * trades, journals every decision and trade, and emits a typed event stream the
 * API forwards to the dashboard. It owns the run loop and the only mutable
 * runtime state.
 */
export class Engine {
  private readonly log: Logger;
  private readonly emitter = new EventEmitter();
  private readonly aggregator: MarketAggregator;
  private readonly strategy: StrategyEngine;
  private readonly exits: ExitEvaluator;
  private readonly venue: PaperExecutionVenue;
  private readonly portfolio: PaperPortfolio;
  private readonly analyzer: TradeAnalyzer;
  private readonly repos: Repositories;

  private universe: readonly TokenWithHistory[] = [];
  private readonly tokenMeta = new Map<TokenId, Token>();
  private readonly lastDecisionByToken = new Map<TokenId, TradeDecision>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private startedAt: number | null = null;
  private ticks = 0;
  private ticking = false;

  constructor(
    private readonly config: EngineConfig,
    private readonly clock: Clock = new SystemClock(),
    logger: Logger = new ConsoleLogger('engine'),
    repos: Repositories = createInMemoryRepositories(),
  ) {
    this.log = logger;
    this.repos = repos;
    this.aggregator = new MarketAggregator(config.sources, repos.snapshots, logger);
    this.strategy = new StrategyEngine(config.signals, config.strategyConfig, config.riskConfig);
    this.exits = new ExitEvaluator(config.riskConfig);
    this.venue = new PaperExecutionVenue(config.venueConfig);
    this.portfolio = new PaperPortfolio(fixed(config.startingCashUsd));
    this.analyzer = new TradeAnalyzer(config.strategyConfig);
  }

  onEvent(listener: EngineEventListener): () => void {
    return this.emitter.on(listener);
  }

  start(): void {
    if (this.timer) return;
    this.startedAt = this.clock.now();
    this.log.info('engine starting', { tickIntervalMs: this.config.tickIntervalMs });
    void this.tick();
    this.timer = setInterval(() => void this.tick(), this.config.tickIntervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.log.info('engine stopped');
    }
  }

  /** Run exactly one tick. Used by tests, backtests, and manual stepping. */
  async tickOnce(): Promise<void> {
    await this.tick();
  }

  private priceOf(tokenId: TokenId): Fixed | undefined {
    const latest = this.repos.snapshots.latest(tokenId);
    return latest ? fixed(latest.priceUsd.toString()) : undefined;
  }

  private referenceSnapshot(tokenId: TokenId): MarketSnapshot | undefined {
    const inUniverse = this.universe.find((t) => t.token.id === tokenId);
    return inUniverse?.latest ?? this.repos.snapshots.latest(tokenId);
  }

  private portfolioState(now: number): PortfolioState {
    const snap = this.portfolio.snapshot(now, this.repos.positions.open(), (id) => this.priceOf(id));
    return {
      equityUsd: snap.equityUsd,
      cashUsd: snap.cashUsd,
      openPositions: snap.openPositions,
      exposurePct: snap.exposurePct,
    };
  }

  private async tick(): Promise<void> {
    if (this.ticking) return; // never overlap ticks
    this.ticking = true;
    const now = this.clock.now();
    try {
      this.universe = await this.aggregator.refresh(now);
      for (const t of this.universe) this.tokenMeta.set(t.token.id, t.token);
      this.emitter.emit({ type: 'market', timestamp: now, tokens: this.universe });

      await this.manageOpenPositions(now);
      await this.evaluateEntries(now);

      const portfolioSnap = this.portfolio.snapshot(now, this.repos.positions.open(), (id) => this.priceOf(id));
      this.emitter.emit({ type: 'portfolio', timestamp: now, portfolio: portfolioSnap });
      this.emitter.emit({ type: 'sources', timestamp: now, sources: this.aggregator.sourceHealth() });
      this.ticks++;
      this.emitter.emit({ type: 'tick', timestamp: now, tokensObserved: this.universe.length });
    } catch (e) {
      this.log.error('tick failed', { error: (e as Error).message });
      this.emitter.emit({ type: 'alert', timestamp: now, level: 'error', message: `Tick failed: ${(e as Error).message}` });
    } finally {
      this.ticking = false;
    }
  }

  private async manageOpenPositions(now: number): Promise<void> {
    for (const position of this.repos.positions.open()) {
      const price = this.priceOf(position.tokenId);
      const reference = this.referenceSnapshot(position.tokenId);
      if (!price || !reference) continue;

      const exit = this.exits.evaluate(position, price);
      if (!exit.exit || !exit.reason) {
        // Persist the trailing high-water mark.
        if (!exit.newHighWaterPrice.eq(position.highWaterPrice)) {
          this.repos.positions.upsert({ ...position, highWaterPrice: exit.newHighWaterPrice });
        }
        continue;
      }

      const fill = await this.venue.execute({
        tokenId: position.tokenId,
        side: 'SELL',
        notionalUsd: price.mul(position.quantity),
        referenceSnapshot: reference,
      });

      const exitDecision: TradeDecision = {
        id: newDecisionId(),
        tokenId: position.tokenId,
        timestamp: now,
        action: 'EXIT',
        conviction: 0,
        confirmations: 0,
        contributions: [],
        reasoning: [exit.note ?? `Exit (${exit.reason})`, `Filled ${fill.quantity.toString()} @ ${fill.avgPrice.toString()} (slippage ${(fill.slippagePct * 100).toFixed(2)}%)`],
      };
      this.repos.decisions.save(exitDecision);
      this.emitter.emit({ type: 'decision', timestamp: now, decision: exitDecision });

      const financials = this.portfolio.settle(position, fill, now);
      const entryDecision = this.repos.decisions.get(position.entryDecisionId);
      const trade = this.analyzer.buildTrade({
        position,
        entryDecision: entryDecision ?? exitDecision,
        exitDecision,
        financials,
        exitReason: exit.reason,
      });
      this.repos.trades.save(trade);
      this.repos.positions.upsert({ ...position, status: 'CLOSED' });
      this.emitter.emit({ type: 'position-closed', timestamp: now, trade });
      this.emitter.emit({
        type: 'alert',
        timestamp: now,
        level: trade.netPnlUsd.isNegative() ? 'warn' : 'info',
        message: `Closed ${position.symbol} via ${exit.reason}: ${trade.netPnlUsd.toString()} USD (${(trade.returnPct * 100).toFixed(1)}%)`,
      });
    }
  }

  private async evaluateEntries(now: number): Promise<void> {
    for (const subject of this.universe) {
      if (this.repos.positions.byToken(subject.token.id)) continue; // already holding

      const decision = this.strategy.evaluateEntry(subject, this.portfolioState(now), now);
      this.repos.decisions.save(decision);
      this.lastDecisionByToken.set(subject.token.id, decision);

      if (decision.action === 'ENTER') {
        await this.enter(subject, decision, now);
      } else if (decision.conviction >= this.config.opportunityConvictionThreshold) {
        // Stream near-miss opportunities so the operator sees the reasoning.
        this.emitter.emit({ type: 'decision', timestamp: now, decision });
      }
    }
  }

  private async enter(subject: TokenWithHistory, decision: TradeDecision, now: number): Promise<void> {
    const fill = await this.venue.execute({
      tokenId: subject.token.id,
      side: 'BUY',
      notionalUsd: fixed((decision.sizeUsd ?? 0).toString()),
      referenceSnapshot: subject.latest,
    });
    const position = this.portfolio.openPosition(decision, fill, subject.token.symbol, now);
    this.repos.positions.upsert(position);
    this.emitter.emit({ type: 'decision', timestamp: now, decision });
    this.emitter.emit({ type: 'position-opened', timestamp: now, position });
    this.emitter.emit({
      type: 'alert',
      timestamp: now,
      level: 'info',
      message: `Opened ${subject.token.symbol}: $${(decision.sizeUsd ?? 0).toFixed(2)} @ ${fill.avgPrice.toString()} (conviction ${decision.conviction.toFixed(2)})`,
    });
  }

  private marketRows(): MarketRow[] {
    const openByToken = new Set(this.repos.positions.open().map((p) => p.tokenId));
    return this.universe
      .map((t) => {
        const hist = t.history;
        const prevIdx = hist.length - 6;
        const prev = prevIdx >= 0 ? hist[prevIdx]?.priceUsd : hist[0]?.priceUsd;
        const change = prev && prev > 0 ? (t.latest.priceUsd - prev) / prev : 0;
        return {
          token: t.token,
          priceUsd: t.latest.priceUsd,
          liquidityUsd: t.latest.liquidityUsd,
          volume24hUsd: t.latest.volume24hUsd,
          change,
          socialMentions: t.latest.socialMentions,
          hasPosition: openByToken.has(t.token.id),
        } satisfies MarketRow;
      })
      .sort((a, b) => b.volume24hUsd - a.volume24hUsd);
  }

  private opportunities(): Opportunity[] {
    const open = new Set(this.repos.positions.open().map((p) => p.tokenId));
    return [...this.lastDecisionByToken.values()]
      .filter((d) => d.action !== 'EXIT' && !open.has(d.tokenId))
      .sort((a, b) => b.conviction - a.conviction)
      .slice(0, 8)
      .map((decision) => ({ token: this.tokenMeta.get(decision.tokenId)!, decision }))
      .filter((o) => o.token !== undefined);
  }

  getState(): EngineState {
    const now = this.clock.now();
    const openPositions = this.repos.positions.open();
    const portfolioSnap = this.portfolio.snapshot(now, openPositions, (id) => this.priceOf(id));
    const positions = openPositions.map((p) => this.portfolio.markPosition(p, this.priceOf(p.tokenId) ?? p.entryPrice));
    return {
      running: this.timer !== null,
      startedAt: this.startedAt,
      now,
      ticks: this.ticks,
      portfolio: portfolioSnap,
      performance: computePerformance(this.repos.trades.list(), this.portfolio.startingCash),
      positions,
      opportunities: this.opportunities(),
      recentDecisions: this.repos.decisions.list(40),
      recentTrades: this.repos.trades.list(40),
      market: this.marketRows(),
      sources: this.aggregator.sourceHealth(),
    };
  }
}
