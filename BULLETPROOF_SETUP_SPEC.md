# Bulletproof Setup Spec: openclaw-memory

> Making installation, setup, and developer experience absolutely bulletproof.

## Current State Audit

| Area | Grade | Issues |
|------|-------|--------|
| Installation | B- | Works but fragile — no prereq checks, no validation, silent failures |
| First-run experience | C | Developer must manually: create .env, know which vars matter, know port mismatches, create Atlas vector index |
| Testing | C+ | 5 test files covering happy paths only; no e2e, no integration, no coverage gates |
| CI/CD | F | None — no GitHub Actions, no pre-commit hooks, no automated quality gates |
| Docker | F | Missing entirely — no Dockerfile, no docker-compose |
| Error messages | B- | Zod validation good, but startup failures are cryptic; no "did you mean?" suggestions |
| Docs | A- | 15+ files is excellent, but they're disconnected — no guided flow |
| Monorepo DX | B | pnpm workspaces work, but no unified `pnpm dev` at root, no orchestration |
| Portability | C | Hard-coded port assumptions, .env scattered, Atlas Vector Search is a manual black box |

---

## 1. Zero-to-Working in One Command

### Goal
A developer clones the repo, runs ONE command, and has a fully working system in under 2 minutes.

### Spec: `pnpm setup`

Add a root-level `setup` script that orchestrates everything:

```
pnpm setup
```

**What it does (in order):**

1. **Prerequisite check** — Validates:
   - Node.js >= 18 (with exact version in error if too old)
   - pnpm >= 8
   - MongoDB accessible (local `mongosh` or Atlas URI)
   - Prints clear ✓/✗ for each with actionable fix instructions

2. **Dependency install** — `pnpm install` (already works)

3. **Environment setup** — Interactive `.env.local` generator:
   - If `.env.local` exists: ask "Use existing? [Y/n]"
   - If not: copy `.env.example` → `.env.local`, then prompt for:
     - `MONGODB_URI` (default: `mongodb://localhost:27017`)
     - `VOYAGE_API_KEY` (or press Enter for mock mode)
     - `MEMORY_DAEMON_PORT` (default: 7654)
   - Write validated `.env.local`

4. **Build all packages** — `pnpm -r build` (parallel where possible)

5. **Database validation** — Connect to MongoDB, verify:
   - Connection succeeds
   - Database writable
   - Indexes exist (create if missing)
   - Vector search index status (warn if missing, don't block)

6. **Smoke test** — Start daemon in background, hit `/health`, verify response, kill daemon

7. **Print summary:**
   ```
   ✅ openclaw-memory is ready!

   Start developing:
     pnpm dev          → Start daemon + web dashboard
     pnpm test         → Run all tests
     pnpm dev:daemon   → Daemon only (port 7654)
     pnpm dev:web      → Dashboard only (port 3000)

   Your daemon URL: http://localhost:7654
   Your dashboard:  http://localhost:3000

   Mock mode: ON (no Voyage API key needed)
   MongoDB:   localhost:27017/openclaw_memory
   ```

### Implementation

**New file:** `scripts/setup.ts` (TypeScript, run via `tsx`)

Root `package.json` additions:
```json
{
  "scripts": {
    "setup": "tsx scripts/setup.ts",
    "dev": "concurrently -n daemon,web -c green,blue \"pnpm dev:daemon\" \"pnpm dev:web\"",
    "dev:daemon": "pnpm --filter @openclaw-memory/daemon dev",
    "dev:web": "pnpm --filter @openclaw-memory/web dev",
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint",
    "clean": "pnpm -r exec rm -rf dist .next out node_modules/.cache",
    "typecheck": "pnpm -r exec tsc --noEmit",
    "precommit": "pnpm lint && pnpm typecheck && pnpm test"
  }
}
```

**New dev dependency (root):** `concurrently` — for `pnpm dev` to run daemon + web simultaneously with color-coded output.

---

## 2. Environment Validation at Every Layer

### Goal
Never let a developer wonder "why isn't this working?" because of a missing or invalid env var.

### Spec: Startup Validation Module

**New file:** `packages/daemon/src/config.ts`

```typescript
export interface DaemonConfig {
  port: number;
  mongoUri: string;
  dbName: string;
  voyageApiKey: string;
  voyageBaseUrl: string;
  voyageModel: string;
  voyageMock: boolean;
  memoryApiKey: string | null;
}

export function loadAndValidateConfig(): DaemonConfig {
  // 1. Load from .env (already done via dotenv)
  // 2. Validate each var with clear error messages:
  //    - Missing MONGODB_URI → "MONGODB_URI not set. Set it in .env.local or run: pnpm setup"
  //    - Invalid MONGODB_URI format → "MONGODB_URI doesn't look like a MongoDB connection string. Expected: mongodb://... or mongodb+srv://..."
  //    - Missing VOYAGE_API_KEY without VOYAGE_MOCK=true → "No VOYAGE_API_KEY set. Either set it or add VOYAGE_MOCK=true for development."
  //    - Port in use → "Port 7654 is already in use. Set MEMORY_DAEMON_PORT to a different port."
  // 3. Return validated, typed config object
}
```

**Key behaviors:**
- Every error message includes the fix
- Port-in-use detection before `app.listen()`
- MongoDB connection test with timeout (5s) during startup
- Voyage API key format validation (not just "is it set?")
- Print config summary table on successful startup (redact secrets)

### Spec: Web Config Validation

**New file:** `packages/web/lib/configCheck.ts`

On the Settings page and Dashboard, show a prominent banner if:
- Daemon URL returns non-200 from `/health`
- Daemon is in mock mode (info banner, not error)
- Vector search index is missing (warning with setup instructions)

---

## 3. Docker: One-Command Deployment

### Goal
`docker compose up` gives you the full stack: MongoDB + daemon + web dashboard.

### Spec: Docker Compose

**New file:** `docker-compose.yml`

```yaml
services:
  mongodb:
    image: mongodb/mongodb-community-server:7.0-ubi9
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 5

  daemon:
    build:
      context: .
      dockerfile: packages/daemon/Dockerfile
    ports:
      - "${MEMORY_DAEMON_PORT:-7654}:7654"
    environment:
      - MONGODB_URI=mongodb://mongodb:27017
      - MEMORY_DB_NAME=${MEMORY_DB_NAME:-openclaw_memory}
      - VOYAGE_API_KEY=${VOYAGE_API_KEY:-}
      - VOYAGE_MOCK=${VOYAGE_MOCK:-true}
      - MEMORY_DAEMON_PORT=7654
    depends_on:
      mongodb:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:7654/health"]
      interval: 10s
      timeout: 5s
      retries: 3

  web:
    build:
      context: .
      dockerfile: packages/web/Dockerfile
    ports:
      - "${WEB_PORT:-3000}:3000"
    environment:
      - NEXT_PUBLIC_DAEMON_URL=http://daemon:7654
    depends_on:
      daemon:
        condition: service_healthy

volumes:
  mongodb_data:
```

### Spec: Dockerfiles

**New file:** `packages/daemon/Dockerfile`
```dockerfile
FROM node:20-slim AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/daemon/package.json packages/daemon/
RUN corepack enable && pnpm install --frozen-lockfile --filter @openclaw-memory/daemon
COPY packages/daemon/ packages/daemon/
RUN pnpm --filter @openclaw-memory/daemon build

FROM node:20-slim
WORKDIR /app
COPY --from=builder /app/packages/daemon/dist ./dist
COPY --from=builder /app/packages/daemon/package.json ./
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 7654
CMD ["node", "dist/server.js"]
```

**New file:** `packages/web/Dockerfile`
```dockerfile
FROM node:20-slim AS builder
WORKDIR /app
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile
RUN pnpm --filter @openclaw-memory/web build

FROM node:20-slim
WORKDIR /app
COPY --from=builder /app/packages/web/.next ./.next
COPY --from=builder /app/packages/web/public ./public
COPY --from=builder /app/packages/web/package.json ./
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["npx", "next", "start"]
```

---

## 4. Testing: Comprehensive and Gated

### Goal
Every PR must pass: unit tests, integration tests, type checking, linting. Coverage must not decrease.

### Spec: Test Suite Expansion

#### 4a. Unit Tests (Daemon)

**New test files:**

| File | Tests |
|------|-------|
| `routes/wordcloud.test.ts` | Word frequency extraction, stop words, empty agent, limit/minCount params |
| `routes/embeddings.test.ts` | PCA projection endpoint, empty agent, missing embeddings |
| `routes/timeline.test.ts` | Day aggregation, date ranges, empty agent |
| `routes/agents.test.ts` | Agent listing, counts, empty state |
| `routes/export.test.ts` | Full export, projection (no embeddings), empty agent |
| `routes/purge.test.ts` | TTL purge, date validation |
| `routes/clear.test.ts` | Clear all, confirmation, empty agent |
| `pca.test.ts` | Edge cases: 0 vectors, 1 vector, identical vectors, known 2D data, large N |
| `config.test.ts` | Config validation: missing vars, invalid formats, port conflicts |

**Target: 100% route coverage, 90%+ overall daemon coverage**

#### 4b. Integration Tests

**New file:** `packages/daemon/src/__tests__/integration/full-flow.test.ts`

End-to-end flow:
1. Start daemon (mock mode)
2. `POST /remember` 5 memories with different tags
3. `GET /recall` — verify semantic similarity ranking
4. `GET /wordcloud` — verify word frequencies
5. `GET /embeddings` — verify 2D points returned (not raw 1024-dim)
6. `GET /timeline` — verify day counts
7. `GET /agents` — verify agent listing
8. `GET /export` — verify all memories exported
9. `DELETE /forget/:id` — verify deletion
10. `DELETE /clear` — verify full wipe
11. `GET /agents` — verify agent gone

#### 4c. Web Component Tests

**New framework:** Add `vitest` + `@testing-library/react` to web package.

**Test files:**

| Component | Tests |
|-----------|-------|
| `WordCloud` | Renders SVG, click handler fires, empty state, theme switch |
| `MemoryMap` | Renders dots for points, tooltip on hover, empty state |
| `MemoryTimeline` | Renders cells, color levels correct, empty state |
| `GlassCard` | Renders children, applies glow color, click handler |
| `StatCard` | Renders icon/label/value/subtitle, color prop |

#### 4d. Coverage Gates

**Vitest config update** (all packages):
```typescript
coverage: {
  provider: 'v8',
  reporter: ['text', 'json', 'html', 'lcov'],
  thresholds: {
    branches: 70,
    functions: 80,
    lines: 80,
    statements: 80,
  },
}
```

If coverage drops below thresholds → test run fails → CI blocks merge.

---

## 5. CI/CD: GitHub Actions

### Goal
Automated quality gates on every push and PR.

### Spec: Workflows

**New file:** `.github/workflows/ci.yml`

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  quality:
    runs-on: ubuntu-latest
    services:
      mongodb:
        image: mongo:7
        ports: [27017:27017]
        options: >-
          --health-cmd "mongosh --eval 'db.adminCommand(\"ping\")'"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    env:
      MONGODB_URI: mongodb://localhost:27017
      VOYAGE_MOCK: "true"
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - name: Type Check
        run: pnpm -r exec tsc --noEmit
      - name: Lint
        run: pnpm lint
      - name: Test (with coverage)
        run: pnpm -r test -- --coverage
      - name: Build
        run: pnpm -r build
      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: packages/daemon/coverage/lcov.info
```

**New file:** `.github/workflows/docker.yml`

Build and test Docker images on push to main:
```yaml
name: Docker Build
on:
  push:
    branches: [main]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: docker compose build
      - run: docker compose up -d
      - run: sleep 10
      - run: curl -f http://localhost:7654/health
      - run: curl -f http://localhost:3000
      - run: docker compose down
```

---

## 6. Pre-commit Hooks

### Goal
Catch problems before they reach CI.

### Spec: Husky + lint-staged

**New root dev dependencies:** `husky`, `lint-staged`

**Root `package.json` additions:**
```json
{
  "lint-staged": {
    "packages/daemon/src/**/*.ts": ["eslint --fix", "prettier --write"],
    "packages/web/**/*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "packages/cli/src/**/*.ts": ["eslint --fix", "prettier --write"],
    "packages/client/src/**/*.ts": ["eslint --fix", "prettier --write"]
  }
}
```

**`.husky/pre-commit`:**
```bash
pnpm lint-staged
pnpm -r exec tsc --noEmit
```

---

## 7. Unified Linting & Formatting

### Goal
Consistent code style across all 4 packages.

### Spec

**New root files:**

**`.prettierrc`:**
```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "tabWidth": 2,
  "printWidth": 100
}
```

**`.eslintrc.json` (root):**
```json
{
  "root": true,
  "parser": "@typescript-eslint/parser",
  "plugins": ["@typescript-eslint"],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "rules": {
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "@typescript-eslint/no-explicit-any": "warn",
    "no-console": "off"
  },
  "ignorePatterns": ["dist/", ".next/", "node_modules/", "coverage/"]
}
```

**New root dev dependencies:** `eslint`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`, `prettier`, `eslint-config-prettier`

Add `lint` scripts to daemon, cli, and client packages (web already has one).

---

## 8. Startup Error UX

### Goal
When something goes wrong, the developer knows EXACTLY what to do.

### Spec: Rich Error Messages

Replace every `throw new Error("...")` during startup with structured errors:

```
╔══════════════════════════════════════════════════════════════╗
║  ❌  MONGODB_URI not set                                     ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  The daemon requires a MongoDB connection string.            ║
║                                                              ║
║  Quick fix:                                                  ║
║    1. Create a .env.local file in the project root           ║
║    2. Add: MONGODB_URI=mongodb://localhost:27017             ║
║                                                              ║
║  Or run: pnpm setup                                          ║
║                                                              ║
║  For MongoDB Atlas:                                          ║
║    MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net   ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
```

Implement this as a utility:
```typescript
function startupError(title: string, message: string, fixes: string[]): never {
  // Print formatted box to stderr
  // Exit with code 1
}
```

**Apply to all startup failure points:**
- Missing MONGODB_URI
- Missing VOYAGE_API_KEY (when not mock)
- MongoDB connection timeout
- MongoDB auth failure
- Port already in use
- Invalid VOYAGE_BASE_URL format

---

## 9. Database Setup Automation

### Goal
MongoDB indexes and vector search should "just work" without manual steps.

### Spec: Setup Command

**New file:** `packages/daemon/src/scripts/db-setup.ts`

```bash
pnpm --filter @openclaw-memory/daemon db:setup
```

**What it does:**
1. Connect to MongoDB
2. Create database if missing
3. Create collections if missing
4. Create all regular indexes (already in schema.ts — reuse)
5. Attempt to create Atlas Vector Search index:
   - If Atlas: use Atlas Admin API to create `memory_vector_index`
   - If local: print instructions for manual setup, or use `mongosh` command
6. Verify all indexes exist
7. Print summary

**Add to daemon `package.json`:**
```json
{
  "scripts": {
    "db:setup": "tsx src/scripts/db-setup.ts",
    "db:status": "tsx src/scripts/db-status.ts",
    "db:seed": "tsx src/scripts/db-seed.ts"
  }
}
```

### Spec: Seed Data

**New file:** `packages/daemon/src/scripts/db-seed.ts`

Populates the database with realistic demo data so the dashboard isn't empty on first run:

- 50 memories across 2 agents (`demo-agent`, `test-agent`)
- Diverse topics: code reviews, architecture decisions, debugging notes, meeting summaries
- Spread across the last 90 days (so timeline heatmap looks good)
- Tagged with realistic labels
- Uses mock embeddings (no Voyage API needed)

```bash
pnpm --filter @openclaw-memory/daemon db:seed
```

**Include in `pnpm setup` flow** with prompt: "Seed demo data? [Y/n]"

---

## 10. Health Dashboard Improvements

### Goal
The web dashboard should show system readiness at a glance with actionable guidance.

### Spec: Setup Checklist Widget

Add a "Setup Status" card to the dashboard (only shows if not all checks pass):

```
┌─────────────────────────────────────────────────┐
│  SETUP STATUS                                    │
│                                                  │
│  ✅ MongoDB connected                            │
│  ✅ Daemon running (port 7751)                   │
│  ⚠️  Mock embeddings (set VOYAGE_API_KEY for     │
│      production-quality search)                  │
│  ❌ Vector search index missing                  │
│     → Run: pnpm db:setup                         │
│                                                  │
│  [Hide this card]                                │
└─────────────────────────────────────────────────┘
```

**Implementation:**
- New `GET /health/setup` route that returns checklist items
- New `SetupChecklist` component on dashboard
- Dismissible (store in localStorage)
- Only appears when there's something actionable

---

## 11. Developer Documentation Flow

### Goal
A single, linear "getting started" experience — not 15 disconnected markdown files.

### Spec: Unified Documentation Structure

Consolidate and reorganize:

```
docs/
├── getting-started.md      ← NEW: The ONE doc to read first (replaces INSTALL.md)
├── configuration.md        ← NEW: All env vars, config options, defaults
├── api-reference.md        ← NEW: Full REST API docs (auto-generated from Zod schemas)
├── architecture.md         ← MOVE from root
├── deployment.md           ← NEW: Docker, cloud, production config
├── troubleshooting.md      ← MOVE from root
└── contributing.md         ← MOVE from root
```

**Root `README.md` stays** but becomes a brief overview with links to `docs/`.

### `docs/getting-started.md` structure:
1. What is openclaw-memory? (2 sentences)
2. Prerequisites (Node 18+, pnpm, MongoDB)
3. Quick Start (`git clone` → `pnpm setup` → `pnpm dev` → open browser)
4. What you're looking at (dashboard screenshot + labeled callouts)
5. Try it: store a memory, recall it, see the word cloud update
6. Next steps: links to configuration, API reference, deployment

### `docs/api-reference.md`
Auto-generated from Zod schemas. For each route:
- Method + path
- Query/body parameters (from Zod schema, with types + defaults)
- Response shape (with example)
- Error responses
- curl example

---

## 12. `.env.example` Overhaul

### Goal
The example file should be a complete, commented template.

### Spec

**Rewrite `.env.example`:**
```bash
# ============================================================
# openclaw-memory configuration
# Copy this file to .env.local and fill in your values:
#   cp .env.example .env.local
# ============================================================

# --- MongoDB ---
# Local: mongodb://localhost:27017
# Atlas: mongodb+srv://user:pass@cluster.mongodb.net
MONGODB_URI=mongodb://localhost:27017

# Database name (default: openclaw_memory)
# MEMORY_DB_NAME=openclaw_memory

# --- Daemon ---
# HTTP port for the memory daemon
# MEMORY_DAEMON_PORT=7654

# Optional API key to protect daemon endpoints
# If set, all requests (except /health) require X-API-Key header
# MEMORY_API_KEY=

# --- Voyage AI Embeddings ---
# Get your key at https://dash.voyageai.com/
# Leave empty and set VOYAGE_MOCK=true for development without an API key
VOYAGE_API_KEY=
VOYAGE_MOCK=true

# Voyage endpoint (default: https://api.voyageai.com/v1)
# For MongoDB Atlas AI: https://ai.mongodb.com/v1
# VOYAGE_BASE_URL=

# Embedding model (default: voyage-3)
# VOYAGE_MODEL=

# --- Web Dashboard ---
# URL where the daemon is running (used by the web UI)
# NEXT_PUBLIC_DAEMON_URL=http://localhost:7654
```

---

## 13. Graceful Degradation

### Goal
The system should work in progressively capable tiers, never fully broken.

### Spec: Capability Tiers

| Tier | Config | Capabilities |
|------|--------|-------------|
| **Minimal** | MongoDB only, `VOYAGE_MOCK=true` | All features work with mock embeddings. Recall uses in-memory cosine similarity. Good for development. |
| **Standard** | MongoDB + Voyage API key | Real semantic search. In-memory vector search fallback. |
| **Production** | MongoDB Atlas + Voyage + Vector Search Index | Full Atlas Vector Search. Scales to millions of memories. |

**Each tier should:**
- Be clearly identified in daemon startup logs
- Be shown on the dashboard (info badge, not error)
- Have documentation on how to upgrade to the next tier

---

## 14. Portable Configuration

### Goal
Support multiple deployment scenarios without config gymnastics.

### Spec: Config Resolution Order

```
1. Environment variables (highest priority)
2. .env.local (project root)
3. .env (project root)
4. packages/<pkg>/.env.local
5. packages/<pkg>/.env
6. Defaults (lowest priority)
```

All packages use the same resolution order. Document it once in `docs/configuration.md`.

---

## 15. Release & Versioning

### Goal
Professional, reproducible releases.

### Spec

**Versioning:** All 4 packages share the same version number. Bump all together.

**New root script:**
```json
{
  "scripts": {
    "version:patch": "pnpm -r exec npm version patch --no-git-tag-version && pnpm version patch",
    "version:minor": "pnpm -r exec npm version minor --no-git-tag-version && pnpm version minor",
    "version:major": "pnpm -r exec npm version major --no-git-tag-version && pnpm version major"
  }
}
```

**CHANGELOG.md:** Keep it updated. Each release gets:
- Version number + date
- Added / Changed / Fixed / Removed sections
- Migration notes if breaking

---

## Implementation Priority

### Phase 1: Foundation (Week 1)
1. `pnpm setup` interactive setup script
2. `pnpm dev` unified dev command (concurrently)
3. `.env.example` overhaul
4. Startup error UX (rich error boxes)
5. Config validation module (`config.ts`)

### Phase 2: Quality Gates (Week 2)
6. Expand test suite (all routes + PCA + integration)
7. Coverage thresholds (80%)
8. ESLint + Prettier across all packages
9. Husky pre-commit hooks
10. GitHub Actions CI workflow

### Phase 3: Deployment (Week 3)
11. Docker Compose + Dockerfiles
12. Database setup automation (`db:setup`, `db:seed`)
13. GitHub Actions Docker build workflow
14. Setup checklist dashboard widget

### Phase 4: Polish (Week 4)
15. Documentation consolidation (`docs/` folder)
16. API reference auto-generation
17. Graceful degradation tiers
18. Release versioning scripts
19. FRESH_INSTALL_TEST automation (replace manual checklist)

---

## Success Criteria

- [ ] `git clone` + `pnpm setup` + `pnpm dev` → working system in < 2 minutes
- [ ] `docker compose up` → full stack running in < 1 minute
- [ ] Every startup failure has an actionable error message
- [ ] CI runs in < 3 minutes, blocks bad PRs
- [ ] Test coverage > 80% across all packages
- [ ] Zero `any` types in production code
- [ ] New developer can contribute a feature within 1 hour of clone
- [ ] Dashboard shows setup issues with fix instructions
- [ ] Works offline (mock mode) with zero external dependencies except MongoDB
