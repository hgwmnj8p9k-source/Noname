# Architecture — AI Memecoin Trading Platform ("Noname")

This document describes the system design, the reasoning behind the technology
choices, the module boundaries, the data model, the trading/decision pipeline,
the identified risks, and how the platform evolves from paper trading to live
execution **without rewriting the rest of the system**.

> **Status:** Paper trading is the first milestone. Real-money execution is
> explicitly out of scope for the first release, but the execution layer is
> isolated behind an interface so it can be swapped later.

---

## 1. Design principles

1. **Every decision must be explainable.** No trade is taken without a recorded
   chain of evidence. The decision log is a first-class subsystem, not an
   afterthought.
2. **Never trust a single signal.** A trade requires *confluence*: multiple
   independent confirmations across independent data families (price, liquidity,
   on-chain, social). This is enforced structurally by the `ConfluenceEngine`,
   not by convention.
3. **The execution layer is replaceable.** Paper trading and (future) live
   trading both implement the same `ExecutionVenue` interface. The strategy,
   signal, risk, and analytics layers never know which one is wired in.
4. **Modular monolith first, microservices later.** Each responsibility is an
   independent package with an explicit public contract. The packages can run
   in one process today and be split into separately deployed services later
   without changing their interfaces. This avoids premature distributed-systems
   complexity while keeping the seams clean.
5. **Determinism where it matters.** The execution simulator, fee/slippage
   model, risk math, and scoring are pure and deterministic so they can be unit
   tested and so that a backtest and a live paper-run produce reproducible,
   auditable results.
6. **Money is never a float.** All monetary and quantity math goes through a
   fixed-precision helper to avoid floating-point drift in PnL accounting.

---

## 2. Technology choices and reasoning

| Concern | Choice | Why |
| --- | --- | --- |
| Language (backend + frontend) | **TypeScript (Node 22, ESM)** | One language across the whole stack reduces context-switching and lets domain types be *shared over the wire* between server and dashboard. Node's event loop is ideal for I/O-bound, real-time monitoring of many data sources and websockets. |
| API / server framework | **Fastify** | Among the fastest Node HTTP frameworks, first-class JSON-schema validation, native WebSocket support, low overhead — appropriate for a real-time data plane. |
| Frontend | **React + Vite + TypeScript + Tailwind** | Vite gives instant dev feedback; React is the most maintainable choice for a dense, component-heavy "trading terminal" UI; Tailwind keeps the professional dark aesthetic consistent. |
| Real-time transport | **WebSocket (server push)** | The dashboard must reflect engine state live (prices, signals, trades, reasoning) without polling. |
| Durable storage (production) | **PostgreSQL + TimescaleDB** | Relational integrity for trades/decisions plus hypertables for high-volume time-series market data. |
| Cache / pub-sub (production) | **Redis** | Hot market snapshots, rate-limit buckets, and cross-service fan-out. |
| Persistence (today, zero-infra) | **In-memory repositories behind interfaces** | The whole system runs with `pnpm dev` and no database, which keeps the feedback loop fast and the CI green. Swapping to Postgres is a repository implementation, not a code change in the engine. |
| Package/workspace | **pnpm workspaces** | Fast, disk-efficient, strict dependency resolution — good fit for a multi-package monorepo. |
| Test runner | **Vitest** | Native TS/ESM, fast, same config story as Vite. |
| Runtime (dev) | **tsx** | Run TypeScript directly with no build step for a tight dev loop. |

**Why not Python for the core?** Python is excellent for research/ML, but the
heart of this platform is *real-time I/O orchestration + a live dashboard +
shared domain types over the wire*, where a single TypeScript codebase is more
maintainable and type-safe end to end. The architecture deliberately keeps a
clean service boundary (`@noname/signals`) so that a **Python analytics/ML
service** can be added later as just another signal provider over HTTP/gRPC,
without disturbing the core. We get the best of both: TS for the real-time
plane, Python available for heavy modelling when justified.

---

## 3. Module map

The repo is a monorepo. `packages/*` are libraries with explicit contracts;
`apps/*` are deployable processes.

```
packages/
  core            Domain types, value objects (Money), Result, ids, clock, logger.
  market-data     Data-source adapter interface + adapters (simulated feed,
                  DexScreener) + aggregator/normalizer. The "senses".
  signals         Signal interface + concrete signal generators. Each emits a
                  normalized score in [-1,1] with confidence and human evidence.
  strategy        ConfluenceEngine (multi-confirmation), RiskManager,
                  PositionSizer. Turns signals into a TradeDecision.
  paper-trading   ExecutionVenue interface + PaperExecutionVenue (fees, slippage,
                  partial fills), Portfolio accounting, SL/TP monitor.
  decision-log    Immutable decision + trade journal and post-trade analysis
                  ("strongest/weakest signal, followed strategy?, what to improve").
  persistence     Repository interfaces + in-memory implementations.
  engine          The orchestrator that ties the pipeline together and runs the
                  continuous research/trade loop. Emits events.
apps/
  api             Fastify server: REST + WebSocket; hosts an Engine instance.
  dashboard       React trading terminal.
```

### Dependency direction

```
core  <-  market-data, signals, strategy, paper-trading, decision-log, persistence
       \-  engine  ->  (depends on all of the above)
api    ->  engine
dashboard -> api (over HTTP/WS)
```

`core` depends on nothing. Nothing depends on `api`/`dashboard`. This keeps the
dependency graph acyclic and the domain logic framework-free.

---

## 4. The decision pipeline

Each engine tick runs this pipeline. Every stage is recorded.

```
                 ┌────────────────────────────────────────────┐
                 │ 1. INGEST                                   │
   data sources →│  market-data adapters → normalized          │
                 │  MarketSnapshot[] (price, liquidity, volume,│
                 │  holders, social proxy, age, …)             │
                 └───────────────────┬────────────────────────┘
                                     ▼
                 ┌────────────────────────────────────────────┐
                 │ 2. SIGNAL                                   │
                 │  each Signal scores a token from history →  │
                 │  SignalResult{ score, confidence, family,   │
                 │  evidence[] }                               │
                 └───────────────────┬────────────────────────┘
                                     ▼
                 ┌────────────────────────────────────────────┐
                 │ 3. CONFLUENCE                               │
                 │  require ≥N independent FAMILIES agreeing;  │
                 │  combine into a conviction score; reject if │
                 │  confirmations insufficient.                │
                 └───────────────────┬────────────────────────┘
                                     ▼
                 ┌────────────────────────────────────────────┐
                 │ 4. RISK + SIZING                            │
                 │  portfolio exposure limits, max concurrent  │
                 │  positions, per-trade risk %, volatility-   │
                 │  scaled size, SL/TP placement.              │
                 └───────────────────┬────────────────────────┘
                                     ▼
                 ┌────────────────────────────────────────────┐
                 │ 5. DECIDE → TradeDecision (ENTER/SKIP)      │
                 │  with full reasoning attached.              │
                 └───────────────────┬────────────────────────┘
                                     ▼
                 ┌────────────────────────────────────────────┐
                 │ 6. EXECUTE (paper) via ExecutionVenue       │
                 │  realistic fill: slippage f(liquidity,size),│
                 │  fees, partial fills → Position opened.     │
                 └───────────────────┬────────────────────────┘
                                     ▼
                 ┌────────────────────────────────────────────┐
                 │ 7. MANAGE open positions every tick:        │
                 │  SL/TP, trailing, exit signals → close.     │
                 └───────────────────┬────────────────────────┘
                                     ▼
                 ┌────────────────────────────────────────────┐
                 │ 8. JOURNAL: decision-log records the full   │
                 │  lifecycle + post-trade analysis.           │
                 └────────────────────────────────────────────┘
```

The engine emits typed events at every stage; the API forwards them over
WebSocket so the dashboard is a faithful live mirror of the engine.

---

## 5. Data model (core entities)

- **Token** — chain, address, symbol, name, created-at.
- **MarketSnapshot** — point-in-time observation: priceUsd, liquidityUsd,
  volume24h, txns, holders, marketCap, social metrics, source, timestamp.
- **SignalResult** — `{ signalId, family, score∈[-1,1], confidence∈[0,1],
  evidence[] }`. `family` is one of `price | liquidity | onchain | social`,
  used to enforce *independent* confirmations.
- **TradeDecision** — `{ action: ENTER|SKIP|EXIT, token, conviction, sizeUsd,
  stopLoss, takeProfit, reasoning, contributingSignals[] }`. Immutable.
- **Order / Fill** — request vs. realistic simulated execution result.
- **Position** — open exposure with entry, size, SL/TP, unrealized PnL.
- **Trade** — a closed round-trip with entry + exit decisions, realized PnL,
  fees, holding period, and post-trade analysis.
- **Portfolio** — cash, equity, exposure, realized/unrealized PnL, drawdown.

See `packages/core/src/domain` for the authoritative definitions.

---

## 6. Realistic paper execution

The `PaperExecutionVenue` models the parts that determine whether a strategy is
actually viable:

- **Slippage** scales with order size relative to pool liquidity (a convex
  impact function), so large orders in thin pools cost more — exactly where
  memecoin strategies live or die.
- **Fees** — configurable taker fee + a network/gas component.
- **Partial fills** when size exceeds a fraction of available liquidity.
- **Stop loss / take profit** monitored every tick against live snapshots.
- **Position sizing** from the risk layer, never ad hoc.

Because the venue is deterministic given its inputs, the same run is
reproducible and unit-testable.

---

## 7. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| **Garbage data / API outages** | Adapters are isolated; the aggregator tolerates missing sources; signals carry confidence so degraded data lowers conviction rather than producing false confidence. |
| **Overfitting to a single signal** | Confluence across independent families is structurally required; a single strong signal can never trigger a trade alone. |
| **Look-ahead / survivorship bias** | Signals consume only point-in-time history available at decision time; the snapshot store is append-only. |
| **Floating-point PnL drift** | All money/quantity math via fixed-precision `Money`. |
| **Unrealistic backtests** | Slippage/fees/partial-fills modelled explicitly; the same execution code path is used for "what could have been improved" analysis. |
| **Memecoin-specific scams (rug pulls, honeypots)** | On-chain signal family includes liquidity-lock / holder-concentration checks that can hard-veto an entry regardless of other signals. |
| **Secrets / network policy in cloud env** | No secrets committed; external adapters are opt-in via env and degrade gracefully to the simulated feed so the system always runs. |
| **Distributed complexity too early** | Modular monolith; split to services only when a real scaling need appears. |

---

## 8. Path to live execution

When paper trading has been validated:

1. Implement `LiveExecutionVenue` against a real DEX/aggregator, satisfying the
   exact same `ExecutionVenue` interface.
2. Swap the venue in the engine composition root. **No other package changes.**
3. Add a kill-switch, real balance reconciliation, and pre-trade simulation.

The strategy, signals, risk, decision-log, and dashboard are untouched.

---

## 9. Testing strategy

- **Unit tests** for all deterministic logic: `Money`, slippage/fees, position
  sizing, confluence scoring, SL/TP triggering, post-trade analysis.
- **Integration test** that drives the full engine over the deterministic
  simulated feed and asserts the pipeline produces, executes, and journals
  trades end to end.
- CI runs typecheck + lint + tests on every push.
