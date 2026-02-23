# Changelog

All notable changes to OpenClaw Memory will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.2.0] - 2026-02-23

**Bulletproof setup release** — complete overhaul of developer experience, testing, CI/CD, and documentation.

### Added

#### Developer Experience

- Interactive setup wizard (`pnpm setup`) with prereq checks, env generator, DB validation, smoke test
- Unified `pnpm dev` running daemon + web concurrently
- Zod-based config validation with rich boxed error messages for every failure path
- Port-in-use detection before daemon startup
- Database scripts: `db:setup`, `db:seed` (50 demo memories), `db:status`
- Graceful degradation tiers (Minimal/Standard/Production) logged at startup and in API responses
- Release versioning scripts (`version:patch`, `version:minor`, `version:major`)

#### Web Dashboard

- Migrated from Material UI to MongoDB LeafyGreen UI
- Setup checklist widget (dismissible, shows actionable items)
- Word cloud, semantic memory map (PCA), and activity timeline visualizations

#### Testing & Quality

- 12 route test files + integration test + config validation tests
- Coverage thresholds enforced (70% branches, 80% functions/lines/statements)
- ESLint flat config + Prettier + Husky pre-commit hooks
- GitHub Actions CI with MongoDB 7 service container
- GitHub Actions Docker build + smoke test workflow

#### API Endpoints

- `GET /health/setup` — setup checklist for dashboard
- `GET /wordcloud` — word frequency analysis
- `GET /embeddings` — 2D PCA projection for visualization
- `GET /timeline` — memory creation activity heatmap
- `GET /agents` — list all agents with counts
- `GET /export` — export memories (without embeddings)
- `POST /purge` — delete memories older than a date
- `DELETE /clear` — delete all memories for an agent

#### Documentation

- 7 canonical docs: getting-started, configuration, api-reference, architecture, deployment, troubleshooting, contributing
- Comprehensive `.env.example` files (root + daemon)
- README rewritten with accurate information

### Changed

- Root `package.json` rewritten as proper monorepo root (was a copy of web package)
- Root `tsconfig.json` rewritten as minimal base (was Next.js-specific)
- CLI workspace dependency fixed (`workspace:*` protocol)
- Daemon default port standardized to 7654
- Config uses validated `DaemonConfig` object instead of raw `process.env` reads

### Fixed

- React 19 hydration errors from localStorage reads in useState initializers
- `VOYAGE_MOCK=true` now works without `VOYAGE_API_KEY` set
- vitest version mismatch (`@vitest/ui` v4 with vitest v1)
- Next.js ESLint conflict with root flat config

---

## [0.1.0] - 2026-02-23

**Initial release** — production-ready memory system.

### Added

- MongoDB-backed persistent memory storage
- Semantic search via Voyage AI embeddings (voyage-3, 1024 dimensions)
- Mock embeddings for testing (deterministic, zero cost)
- TTL-based auto-expiration of memories
- Agent isolation (per-agent memory namespaces)
- Tag-based organization and filtering
- Express.js daemon with REST API (`/remember`, `/recall`, `/forget`, `/status`, `/health`)
- OpenClaw plugin integration (auto-start daemon, memory_search tool)
- Next.js web dashboard (memory browser, semantic search, health monitoring)
- CLI tool (`ocmem`: status, export, purge, clear)
- TypeScript client SDK (`@openclaw-memory/client`)
- Unit tests (41 tests, Vitest + supertest)

---

**Repository:** https://github.com/mrlynn/openclaw-memory
**Maintainer:** Michael Lynn
**License:** MIT
