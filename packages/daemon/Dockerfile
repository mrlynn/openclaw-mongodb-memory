# Build stage
FROM node:20-slim AS builder

# Install build essentials
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Enable pnpm
RUN corepack enable

# Copy workspace configuration
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy daemon package.json first (for better layer caching)
COPY packages/daemon/package.json packages/daemon/
COPY packages/daemon/tsconfig.json packages/daemon/

# Install dependencies
RUN pnpm install --frozen-lockfile --filter @openclaw-memory/daemon

# Copy daemon source code
COPY packages/daemon/ packages/daemon/

# Build TypeScript
RUN pnpm --filter @openclaw-memory/daemon build

# Production stage
FROM node:20-slim

# Install wget for healthcheck
RUN apt-get update && apt-get install -y wget && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy built artifacts from builder
COPY --from=builder /app/packages/daemon/dist ./dist
COPY --from=builder /app/packages/daemon/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules

# Expose daemon port
EXPOSE 7654

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:7654/health || exit 1

# Start daemon
CMD ["node", "dist/server.js"]
