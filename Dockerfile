# Single-service image: builds the dashboard and serves it from the API, which
# also hosts the live trading engine. Suitable for Railway / Render / any host
# that runs a persistent Node process.
FROM node:22-slim

ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Workspace manifests first (better layer caching for installs).
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json tsconfig.json ./
COPY packages ./packages
COPY apps ./apps

RUN pnpm install --no-frozen-lockfile

# Build the dashboard in server mode (talks to same-origin /api and /ws).
RUN pnpm --filter @noname/dashboard build

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

CMD ["pnpm", "--filter", "@noname/api", "start"]
