# Contributing to OpenClaw Memory

Thank you for your interest in contributing! This guide will help you get started.

---

## Code of Conduct

Be respectful, inclusive, and constructive. We're building tools to help people, not to gatekeep or exclude.

---

## Development Setup

### Prerequisites

- **Node.js** 18+ (recommend 20+)
- **pnpm** (install: `npm install -g pnpm`)
- **MongoDB** (Atlas account or local instance)
- **Git**

### Initial Setup

```bash
# 1. Fork & clone
git clone https://github.com/YOUR_USERNAME/openclaw-mongodb-memory.git
cd openclaw-mongodb-memory

# 2. Install dependencies
pnpm install

# 3. Configure environment
cd packages/daemon
cp .env.example .env.local

# Edit .env.local:
# MONGODB_URI=your_connection_string
# VOYAGE_MOCK=true  # Use mock embeddings for development
# MEMORY_DAEMON_PORT=7751

# 4. Build packages
pnpm build

# 5. Run tests
cd packages/daemon
pnpm test
```

### Running Locally

```bash
# Terminal 1: Daemon (watch mode)
cd packages/daemon
pnpm dev

# Terminal 2: Web dashboard (optional)
cd packages/web
pnpm dev

# Terminal 3: Test
curl http://localhost:7751/health
```

---

## Project Structure

```
openclaw-mongodb-memory/
├── packages/
│   ├── daemon/          # HTTP API server
│   │   ├── src/
│   │   │   ├── routes/  # API endpoints
│   │   │   ├── db/      # MongoDB connection
│   │   │   ├── embedding.ts  # Voyage embedder
│   │   │   └── server.ts     # Entry point
│   │   └── package.json
│   ├── web/             # Next.js dashboard
│   ├── cli/             # CLI tools (ocmem)
│   └── client/          # Agent SDK
├── plugin/              # OpenClaw plugin
│   ├── index.ts         # Plugin entry point
│   └── openclaw.plugin.json
├── scripts/             # Management scripts
│   ├── install.sh
│   ├── uninstall.sh
│   ├── status.sh
│   └── cleanup.sh
├── docs/                # Documentation
├── ARCHITECTURE.md      # System design
├── TROUBLESHOOTING.md   # Common issues
└── README.md            # Getting started
```

---

## Development Workflow

### 1. Pick an Issue

Browse [open issues](https://github.com/mrlynn/openclaw-mongodb-memory/issues) or propose a new feature in Discussions.

**Good first issues:** Look for the `good-first-issue` label.

### 2. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description
```

**Branch naming:**

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `test/` - Test additions/fixes
- `refactor/` - Code refactoring

### 3. Make Changes

**Code style:**

- Follow existing patterns in the codebase
- Use TypeScript strict mode
- Add JSDoc comments for public APIs
- Keep functions small and focused

**Commit messages:**

```
type(scope): brief description

Longer explanation if needed.

Fixes #123
```

**Types:** `feat`, `fix`, `docs`, `test`, `refactor`, `chore`

**Examples:**

```
feat(daemon): add batch embedding support
fix(recall): handle empty query gracefully
docs(readme): update installation steps
test(remember): add concurrent request tests
```

### 4. Test Your Changes

```bash
# Run unit tests
cd packages/daemon
pnpm test

# Run specific test file
pnpm test remember.test.ts

# Run with coverage
pnpm test --coverage

# Manual testing
curl -X POST http://localhost:7751/remember \
  -H "Content-Type: application/json" \
  -d '{"agentId":"test","text":"debug"}'
```

### 5. Update Documentation

If your change affects:

- **API:** Update SKILL.md or API_REFERENCE.md
- **Setup:** Update README.md or INSTALL.md
- **Troubleshooting:** Add to TROUBLESHOOTING.md
- **Architecture:** Update ARCHITECTURE.md

### 6. Submit Pull Request

```bash
git push origin feature/your-feature-name
```

Then open a PR on GitHub with:

- **Title:** Clear, concise description
- **Description:** What changed and why
- **Testing:** How you tested it
- **Issues:** Links to related issues (`Fixes #123`)

---

## Testing Guidelines

### Unit Tests

**Location:** `packages/daemon/src/__tests__/`

**Framework:** Vitest

**Structure:**

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import { yourFunction } from "../your-module";

describe("Your Module", () => {
  beforeAll(async () => {
    // Setup
  });

  it("should do something", () => {
    const result = yourFunction();
    expect(result).toBe(expected);
  });
});
```

**Run tests:**

```bash
cd packages/daemon
pnpm test
```

### Integration Tests

**Location:** `INTEGRATION_TESTS.md` (documented), `/tmp/test-*.sh` (scripts)

**Run:**

```bash
./scripts/test-integration.sh
```

### Test Coverage

**Target:** 80%+ coverage on core modules

**Check coverage:**

```bash
cd packages/daemon
pnpm test --coverage
```

---

## Code Style

### TypeScript

**Strict mode:** Enabled (no `any` unless justified)

**Naming conventions:**

- `camelCase` - variables, functions
- `PascalCase` - classes, interfaces, types
- `UPPER_SNAKE_CASE` - constants
- `kebab-case` - file names

**Example:**

```typescript
interface MemoryEntry {
  agentId: string;
  text: string;
}

const MAX_RESULTS = 10;

function searchMemories(query: string): MemoryEntry[] {
  // ...
}
```

### Error Handling

**Use custom error types:**

```typescript
class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
```

**Async error handling:**

```typescript
// Use asyncHandler middleware
export const myRoute = asyncHandler(async (req, res) => {
  // Errors automatically caught and forwarded to error handler
  const result = await riskyOperation();
  res.json(result);
});
```

### Documentation

**JSDoc for public APIs:**

```typescript
/**
 * Store a memory with semantic embedding.
 *
 * @param agentId - Agent namespace for isolation
 * @param text - Memory content (max 50K chars)
 * @param tags - Optional metadata tags
 * @returns Memory ID and metadata
 * @throws ValidationError if inputs invalid
 */
async function remember(
  agentId: string,
  text: string,
  tags?: string[],
): Promise<{ id: string; text: string }> {
  // ...
}
```

---

## Pull Request Guidelines

### Before Submitting

- [ ] Tests pass (`pnpm test`)
- [ ] Code follows style guide
- [ ] Documentation updated
- [ ] Commit messages follow convention
- [ ] Branch is up to date with `main`

### PR Template

```markdown
## Description

Brief description of changes.

## Motivation

Why is this change needed?

## Changes

- Added X
- Fixed Y
- Removed Z

## Testing

How did you test this?

## Checklist

- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No breaking changes (or documented)
- [ ] Follows code style

## Related Issues

Fixes #123
```

### Review Process

1. **Automated checks:** Tests, linting must pass
2. **Code review:** Maintainer reviews code quality
3. **Feedback:** Address review comments
4. **Approval:** At least 1 approving review required
5. **Merge:** Maintainer merges to `main`

---

## Release Process

**Versioning:** Semantic Versioning (semver)

- **v1.0.0:** Initial stable release
- **v1.1.0:** New features (backwards compatible)
- **v1.0.1:** Bug fixes
- **v2.0.0:** Breaking changes

**Release checklist:**

1. Update CHANGELOG.md
2. Bump version in package.json
3. Create git tag: `git tag v1.0.0`
4. Push tag: `git push origin v1.0.0`
5. Create GitHub release with notes
6. Publish to npm (if applicable)

---

## Communication

### Where to Ask Questions

- **GitHub Discussions:** General questions, feature ideas
- **GitHub Issues:** Bug reports, specific feature requests
- **Discord:** Real-time chat (if available)

### Reporting Bugs

**Template:**

```markdown
**Describe the bug**
A clear description.

**To Reproduce**

1. Run command...
2. See error...

**Expected behavior**
What should happen.

**System info**

- OS: [macOS 14.2]
- Node: [v20.10.0]
- MongoDB: [Atlas / Local]

**Logs**
```

Paste relevant logs here

```

**Additional context**
Any other information.
```

### Suggesting Features

**Template:**

```markdown
**Problem**
What problem does this solve?

**Proposed Solution**
How would this work?

**Alternatives Considered**
Other approaches you thought about.

**Additional Context**
Use cases, examples, mockups.
```

---

## Community Guidelines

### Be Respectful

- Assume good intent
- Be patient with newcomers
- Give constructive feedback
- Celebrate contributions

### Be Helpful

- Answer questions when you can
- Share knowledge and learnings
- Improve documentation when you find gaps
- Help newcomers get started

### Be Inclusive

- Welcome diverse perspectives
- Use inclusive language
- Make the project accessible
- Foster a safe environment

---

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

## Recognition

Contributors are recognized in:

- README.md (Contributors section)
- CHANGELOG.md (per release)
- GitHub contributors page

---

## Getting Help

**Stuck?** Reach out:

- GitHub Discussions
- Discord (if available)
- Email: [maintainer email]

**Learning resources:**

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System design
- [SKILL.md](./SKILL.md) - API reference
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Common issues

---

Thank you for contributing to OpenClaw Memory! 🎉

**Last Updated:** 2026-02-23  
**Version:** 0.1.0
