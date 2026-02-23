# Build stage
FROM node:20-slim AS builder

WORKDIR /app

# Enable pnpm
RUN corepack enable

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy web package files
COPY packages/web/package.json packages/web/
COPY packages/web/tsconfig.json packages/web/
COPY packages/web/next.config.js packages/web/

# Install dependencies
RUN pnpm install --frozen-lockfile --filter @openclaw-memory/web

# Copy web source code
COPY packages/web/ packages/web/

# Build Next.js application
RUN pnpm --filter @openclaw-memory/web build

# Production stage
FROM node:20-slim

# Install wget for healthcheck
RUN apt-get update && apt-get install -y wget && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Enable pnpm
RUN corepack enable

# Copy built Next.js app
COPY --from=builder /app/packages/web/.next ./packages/web/.next
COPY --from=builder /app/packages/web/public ./packages/web/public
COPY --from=builder /app/packages/web/package.json ./packages/web/package.json
COPY --from=builder /app/packages/web/next.config.js ./packages/web/next.config.js
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

WORKDIR /app/packages/web

# Expose web port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000 || exit 1

# Start Next.js production server
ENV NODE_ENV=production
ENV PORT=3000
CMD ["npx", "next", "start"]
