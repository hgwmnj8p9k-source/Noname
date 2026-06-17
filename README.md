# Noname — AI Memecoin Paper-Trading Platform

An institutional-grade, fully transparent AI platform that monitors the
memecoin market, finds high-probability opportunities using **multi-source
confluence**, simulates trades with **realistic execution** (slippage, fees,
partial fills), **explains every decision**, and streams everything to a
**professional trading terminal**.

Paper trading is the first milestone. The execution layer is isolated behind an
interface so real-exchange execution can be added later **without changing the
rest of the platform**.

> See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the design and the
> reasoning behind every technology choice, and [`docs/ROADMAP.md`](docs/ROADMAP.md)
> for the milestone plan.

---

## What it does

- **Continuously researches** the market every tick across independent data
  families: price, liquidity, on-chain flow, and social activity.
- **Never trades on a single signal** — the `ConfluenceEngine` structurally
  requires confirmation from multiple independent families, and a rug-risk
  signal can hard-veto an entry.
- **Sizes positions with real risk management** (fixed-fractional risk, exposure
  caps, conviction scaling) and manages stop-loss / take-profit / trailing exits.
- **Simulates execution realistically** — slippage grows convexly with order
  size vs. pool liquidity, plus taker + network fees and partial fills.
- **Journals everything**: every decision (including skips) and every trade,
  with full reasoning and post-trade analysis (strongest/weakest signal, whether
  the strategy was followed, whether it worked, what to improve).
- **Streams live** to a dark "trading terminal" dashboard.

## Architecture at a glance

```
data sources → market-data → signals → strategy (confluence + risk)
            → paper-trading (execution + portfolio) → decision-log
            → engine (orchestrator) → api (REST + WS) → dashboard
```

A modular monorepo. Each `packages/*` library has an explicit contract and can
later be split into its own service. `core` depends on nothing; the domain logic
is framework-free and deterministic. See the architecture doc for the full map.

## Tech stack

TypeScript everywhere · Node 22 / ESM · pnpm workspaces · Fastify (REST + WS) ·
React + Vite + Tailwind · Vitest. Production persistence target: PostgreSQL +
TimescaleDB + Redis (today it runs on in-memory repositories behind the same
interfaces, so no infrastructure is needed to try it).

## Getting started

```bash
pnpm install

# Terminal 1 — the engine + API (REST on :4000, WebSocket on /ws)
pnpm dev

# Terminal 2 — the dashboard (http://localhost:5173, proxies to the API)
pnpm dev:dashboard

# …or run both together
pnpm dev:all
```

Then open http://localhost:5173.

### Verify

```bash
pnpm typecheck   # project-wide TypeScript build
pnpm test        # unit + integration tests (deterministic)
pnpm lint
```

### Backtest

Replay the market through the **same engine** the live system uses and get a
reproducible report (equity curve, win rate, profit factor, exit breakdown, and
per-signal *efficacy* — which signals actually predicted winners):

```bash
pnpm backtest -- --seed 1337 --ticks 600
pnpm backtest -- --seed 7 --ticks 800 --cash 25000 --json report.json
```

## Configuration

The API reads the environment (see [`.env.example`](.env.example)):

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `4000` | API port |
| `STARTING_CASH_USD` | `10000` | Paper portfolio starting cash |
| `TICK_INTERVAL_MS` | `2000` | Engine loop interval |
| `SIM_SEED` | `1337` | Seed for the deterministic simulated feed |
| `DEXSCREENER_QUERIES` | _(empty)_ | Comma-separated queries to additionally pull **live** DexScreener data; degrades gracefully if unavailable |
| `AUTO_START` | `true` | Start the engine on boot |

By default the platform runs entirely on a deterministic, offline market
**simulator** that models pump/dump regimes and rug-prone tokens — so it runs
anywhere with no API keys. Set `DEXSCREENER_QUERIES` to also ingest real data.

## Project layout

```
packages/core           Domain types, fixed-point Money, clock, logger, events
packages/market-data    Source adapters (simulated + DexScreener) + aggregator
packages/signals        Multi-family signal suite + rug-risk veto
packages/strategy       Confluence engine, risk manager, sizing, exits
packages/paper-trading  Realistic execution venue + portfolio accounting
packages/decision-log   Post-trade analysis + performance statistics
packages/persistence    Repository contracts + in-memory store
packages/engine         Orchestrator + continuous loop + event stream
packages/backtest       Deterministic backtest harness + signal-efficacy report
apps/api                Fastify REST + WebSocket server
apps/dashboard          React/Vite/Tailwind trading terminal
```

## Status

Milestone 1 (foundation + end-to-end paper trading) is complete and tested.
See the roadmap for what comes next (durable storage, more real data sources,
ML analytics, and — gated, much later — live execution).
