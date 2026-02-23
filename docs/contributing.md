# Contributing

## Development Setup

```bash
git clone https://github.com/mrlynn/openclaw-memory.git
cd openclaw-memory
pnpm setup
```

## Development Workflow

```bash
# Start daemon + web concurrently
pnpm dev

# Or start individually
pnpm dev:daemon    # Express API on port 7654
pnpm dev:web       # Next.js on port 3000
```

## Code Quality

### Pre-commit Hooks

Husky runs lint-staged on every commit:

- `*.{ts,tsx}` — ESLint fix + Prettier format
- `*.{json,md,yml,yaml}` — Prettier format

### Manual Checks

```bash
pnpm lint          # ESLint (daemon, cli, client)
pnpm lint:fix      # ESLint with auto-fix
pnpm format        # Prettier format
pnpm format:check  # Prettier check (CI)
pnpm typecheck     # TypeScript type checking
```

### ESLint Configuration

- **Root** (`eslint.config.mjs`): Flat config with typescript-eslint, covers daemon/cli/client
- **Web**: Uses eslint-config-next separately (excluded from root config)

### Prettier Configuration

`.prettierrc`: semi, double quotes, 2-space indent, trailing commas, 100 char line width.

## Testing

```bash
# Run all tests
pnpm test

# Run daemon tests only
pnpm --filter @openclaw-memory/daemon test

# Run with coverage
pnpm --filter @openclaw-memory/daemon test -- --coverage
```

Tests require a MongoDB instance. Set `MONGODB_URI` or start local MongoDB.

### Coverage Thresholds

| Metric     | Threshold |
| ---------- | --------- |
| Branches   | 70%       |
| Functions  | 80%       |
| Lines      | 80%       |
| Statements | 80%       |

### Test Structure

```
packages/daemon/src/__tests__/
├── routes/
│   ├── health.test.ts
│   ├── remember.test.ts
│   ├── recall.test.ts
│   ├── forget.test.ts
│   ├── wordcloud.test.ts
│   ├── embeddings.test.ts
│   ├── timeline.test.ts
│   ├── agents.test.ts
│   ├── export.test.ts
│   ├── purge.test.ts
│   ├── clear.test.ts
│   └── status.test.ts
├── integration/
│   └── full-flow.test.ts
├── config.test.ts
└── helpers.ts
```

### Writing New Tests

Follow the existing pattern:

```typescript
import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import { createTestApp, addErrorHandler, cleanupTestApp } from "../helpers";
import { yourRoute } from "../../routes/yourRoute";

describe("GET /your-route", () => {
  const { app, embedder, getDb } = createTestApp();
  app.get("/your-route", yourRoute(getDb, embedder));
  addErrorHandler(app);

  afterAll(() => cleanupTestApp(getDb));

  it("returns expected data", async () => {
    const res = await request(app).get("/your-route?agentId=test");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
```

## Pull Request Process

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make changes and add tests
3. Ensure all checks pass: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
4. Commit with clear messages (conventional commits preferred)
5. Push and open a PR against `main`

## Project Structure

```
openclaw-memory/
├── packages/
│   ├── daemon/          # Express API (port 7654)
│   │   └── src/
│   │       ├── server.ts
│   │       ├── config.ts
│   │       ├── embedding.ts
│   │       ├── pca.ts
│   │       ├── constants.ts
│   │       ├── db/
│   │       ├── routes/
│   │       ├── utils/
│   │       ├── scripts/
│   │       └── __tests__/
│   ├── web/             # Next.js dashboard (port 3000)
│   │   ├── app/
│   │   ├── components/
│   │   ├── contexts/
│   │   ├── hooks/
│   │   └── lib/
│   ├── client/          # TypeScript SDK
│   │   └── src/
│   └── cli/             # CLI tool
│       └── src/
├── scripts/             # Setup and management
├── docs/                # Documentation
├── .github/workflows/   # CI/CD
└── .env.example         # Config template
```

## Areas for Contribution

- Additional embedding providers (OpenAI, Cohere, etc.)
- Web dashboard enhancements
- Performance optimizations
- CLI improvements
- More comprehensive test coverage
- Documentation improvements
