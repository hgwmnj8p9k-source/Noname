import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import { ConsoleLogger, type EngineEvent } from '@noname/core';
import { createEngine } from '@noname/engine';
import { loadApiConfig } from './config.js';

const config = loadApiConfig();
const logger = new ConsoleLogger('api');

const engine = createEngine({
  startingCashUsd: config.startingCashUsd,
  tickIntervalMs: config.tickIntervalMs,
  seed: config.seed,
  includeSimulator: config.includeSimulator,
  dexScreener: config.dexScreener,
  riskConfig: config.riskConfig,
  strategyConfig: config.strategyConfig,
  venueConfig: config.venueConfig,
  logger: logger.child('engine'),
});

const app = Fastify({ logger: false });
await app.register(cors, { origin: true });
await app.register(websocket);

// --- REST API ---------------------------------------------------------------

app.get('/api/health', async () => ({ ok: true, ts: Date.now() }));

app.get('/api/state', async () => engine.getState());

app.get('/api/trades', async () => ({ trades: engine.getState().recentTrades }));

app.get('/api/decisions', async () => ({ decisions: engine.getState().recentDecisions }));

app.get('/api/config', async () => ({
  startingCashUsd: config.startingCashUsd,
  tickIntervalMs: config.tickIntervalMs,
  seed: config.seed,
  includeSimulator: config.includeSimulator,
  liveSources: config.dexScreener ? ['dexscreener'] : [],
  discovery: config.dexScreener?.discoverChains ?? [],
}));

app.post('/api/engine/start', async () => {
  engine.start();
  return { running: true };
});

app.post('/api/engine/stop', async () => {
  engine.stop();
  return { running: false };
});

// --- WebSocket: stream the live engine event feed ---------------------------

interface WsClient {
  send(data: string): void;
  on(event: string, cb: () => void): void;
}
const sockets = new Set<WsClient>();

app.register(async (instance) => {
  instance.get('/ws', { websocket: true }, (socket) => {
    sockets.add(socket);
    // Seed the client with the full current state on connect.
    socket.send(JSON.stringify({ type: 'state', timestamp: Date.now(), state: engine.getState() }));
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => sockets.delete(socket));
  });
});

engine.onEvent((event: EngineEvent) => {
  // Avoid flooding clients with the full per-tick market payload; the dashboard
  // pulls market rows from /api/state. Forward lightweight, actionable events.
  if (event.type === 'market') return;
  const payload = JSON.stringify(event);
  for (const socket of sockets) {
    try {
      socket.send(payload);
    } catch {
      sockets.delete(socket);
    }
  }
});

// --- Serve the built dashboard (single-service deployment) -------------------

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const staticRoot = resolve(apiRoot, config.staticDir);
if (existsSync(staticRoot)) {
  await app.register(fastifyStatic, { root: staticRoot, wildcard: false });
  // SPA fallback: any non-API, non-WS GET returns the app shell.
  app.setNotFoundHandler((req, reply) => {
    if (req.method === 'GET' && !req.url.startsWith('/api') && !req.url.startsWith('/ws')) {
      return reply.sendFile('index.html');
    }
    return reply.code(404).send({ error: 'not found' });
  });
  logger.info('serving dashboard', { staticRoot });
} else {
  logger.warn('dashboard build not found; API only', { staticRoot });
}

// --- Lifecycle --------------------------------------------------------------

try {
  await app.listen({ port: config.port, host: config.host });
  logger.info('API listening', { port: config.port, host: config.host });
  if (config.autoStart) engine.start();
} catch (err) {
  logger.error('failed to start API', { error: (err as Error).message });
  process.exit(1);
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    logger.info('shutting down', { signal });
    engine.stop();
    void app.close().then(() => process.exit(0));
  });
}
