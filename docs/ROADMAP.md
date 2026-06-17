# Development Roadmap

The platform is built in milestones. Each milestone is independently useful and
leaves the system in a working, tested state.

## Milestone 1 — Foundation & end-to-end paper trading *(this release)*

**Goal:** a runnable, tested vertical slice where the engine ingests data,
produces multi-confirmation decisions, paper-executes them realistically,
journals everything with explanations, and streams it all to a professional
dashboard.

- [x] Monorepo, shared domain types, `Money`, logger, deterministic clock.
- [x] Market-data adapter interface + deterministic **simulated feed** + a real
      **DexScreener** adapter (opt-in, degrades gracefully) + aggregator.
- [x] Signal framework + concrete signals across independent families
      (momentum, volume spike, liquidity trend, volatility, social proxy,
      holder-concentration veto).
- [x] `ConfluenceEngine` requiring N independent confirmations.
- [x] `RiskManager` + `PositionSizer` (exposure caps, per-trade risk, SL/TP).
- [x] `PaperExecutionVenue` (slippage, fees, partial fills) + portfolio.
- [x] Decision log + post-trade analysis.
- [x] `Engine` orchestrator with typed event stream.
- [x] Fastify API (REST + WebSocket) hosting the engine.
- [x] React/Vite/Tailwind dashboard: live market, opportunities, positions,
      closed trades, portfolio, AI reasoning, system health.
- [x] Unit + integration tests, CI workflow.

## Milestone 2 — Real data breadth & durability

- [ ] Postgres + TimescaleDB persistence implementations of the repositories.
- [ ] Additional real adapters: on-chain (RPC/indexer), social (X/Telegram/
      Reddit), news; rate-limit + backoff middleware; source health tracking.
- [ ] Snapshot store with retention/compaction; historical analytics queries.
- [ ] Backtesting harness that replays stored history through the same engine.

## Milestone 3 — Intelligence depth

- [ ] Optional Python analytics service exposed as a signal provider (anomaly
      detection, narrative/embedding clustering, holder-graph analysis).
- [ ] LLM-assisted narrative summarization for the reasoning panel.
- [ ] Adaptive weighting: post-trade analysis feeds signal-weight tuning.
- [ ] Regime detection (risk-on/off) gating overall aggressiveness.

## Milestone 4 — Hardening & scale

- [ ] Split engine/ingestion/api into independently deployed services.
- [ ] Redis cache + pub/sub fan-out; horizontal scaling of ingestion.
- [ ] Auth, multi-portfolio, audit export.
- [ ] Observability: metrics, tracing, alerting.

## Milestone 5 — Live execution (separate, gated release)

- [ ] `LiveExecutionVenue` against a real DEX aggregator.
- [ ] Kill-switch, balance reconciliation, pre-trade simulation, circuit breakers.
- [ ] Staged rollout: shadow → tiny size → scaled.
