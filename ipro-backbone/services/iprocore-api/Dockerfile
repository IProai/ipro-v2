# ═══════════════════════════════════════════════════════════
# IProCore API — Production Dockerfile
# Multi-stage: compile TypeScript → slim runtime image
# CMD: node dist/index.js   (no ts-node, no dev tooling)
# ═══════════════════════════════════════════════════════════

# ─── Stage 1: Builder ────────────────────────────────────
# Full deps (including devDependencies for tsc + prisma CLI)
FROM node:20-bullseye-slim AS builder

WORKDIR /app

# Prisma engine selection depends on OpenSSL availability.
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl libssl1.1 ca-certificates && rm -rf /var/lib/apt/lists/*

# Copy manifests first — leverages Docker layer cache
COPY package*.json ./

# Install ALL dependencies (dev included — needed for tsc & prisma CLI)
RUN npm ci

# Copy Prisma schema & migrations BEFORE generate
# migrations/ must exist in the repo (created via `npm run db:migrate:dev`)
COPY prisma ./prisma/

# Generate Prisma client for the linux/amd64 runtime engine
RUN npx prisma generate

# Copy application source
COPY tsconfig.json ./
COPY src ./src/
COPY scripts ./scripts/

# Compile TypeScript → dist/
RUN npm run build


# ─── Stage 2: Runtime ────────────────────────────────────
# Lean final image — only what the process needs to run
FROM node:20-bullseye-slim AS runtime

WORKDIR /app

# Runtime needs OpenSSL for Prisma query engine.
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl libssl1.1 ca-certificates && rm -rf /var/lib/apt/lists/*

# Build-time arg for traceability — injected by Cloud Build
ARG GIT_SHA=unknown
ENV GIT_SHA=${GIT_SHA}

# Runtime env defaults (overridden by Cloud Run service config)
ENV NODE_ENV=production
ENV PORT=8080

# Copy production dependencies from builder
# (includes @prisma/client and the compiled linux engine binary)
COPY --from=builder /app/node_modules ./node_modules

# Copy compiled application
COPY --from=builder /app/dist ./dist

# Copy Prisma schema + migrations (referenced by Prisma client at runtime)
COPY --from=builder /app/prisma ./prisma

# Copy package.json (needed for require('../../package.json').version in health.ts)
COPY --from=builder /app/package.json ./package.json

# Cloud Run routes external HTTPS → container HTTP on PORT
EXPOSE 8080

# Run compiled JS — zero dev-tool dependency in prod
CMD ["node", "dist/index.js"]
