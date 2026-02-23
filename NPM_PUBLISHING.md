# NPM Publishing Guide

**Status:** Week 2 Day 1-2 (Package & Distribute)  
**Goal:** Publish @openclaw-memory packages to npm registry  
**Target Version:** v0.2.0

---

## 📦 Packages to Publish

| Package | Name | Description | Priority |
|---------|------|-------------|----------|
| **Daemon** | @openclaw-memory/daemon | Memory daemon HTTP API | 🔴 Critical |
| **Client** | @openclaw-memory/client | Client library for agents | 🔴 Critical |
| **CLI** | @openclaw-memory/cli | Management CLI (`ocmem`) | 🟡 Important |
| **Web** | @openclaw-memory/web | Next.js dashboard | 🟢 Optional |

**Publishing Order:** daemon → client → cli → web (dependency order)

---

## ✅ Pre-Publishing Checklist

### 1. Repository Metadata (All Packages)

Each package.json needs:

```json
{
  "repository": {
    "type": "git",
    "url": "https://github.com/mrlynn/openclaw-mongodb-memory.git",
    "directory": "packages/{daemon|client|cli|web}"
  },
  "keywords": [
    "openclaw",
    "memory",
    "mongodb",
    "voyage-ai",
    "semantic-search",
    "rag",
    "ai-agent"
  ],
  "author": "Michael Lynn <michael.lynn@mongodb.com>",
  "license": "MIT",
  "bugs": {
    "url": "https://github.com/mrlynn/openclaw-mongodb-memory/issues"
  },
  "homepage": "https://github.com/mrlynn/openclaw-mongodb-memory#readme"
}
```

### 2. Build Configuration

- [ ] `daemon`: TypeScript build produces `dist/`
- [ ] `client`: TypeScript build produces `dist/`
- [ ] `cli`: TypeScript build produces `dist/`, executable shebang
- [ ] `web`: Next.js build produces `.next/` (for deployment, not npm)

### 3. Files Inclusion

Each package needs `.npmignore` or `files` whitelist:

**Recommended approach:** `files` array in package.json

```json
{
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ]
}
```

### 4. Version Bumping

Current: `0.1.0` (alpha)  
Target: `0.2.0` (beta ready for distribution)

**Semantic Versioning:**
- `0.x.x` = Pre-1.0, breaking changes allowed
- `v0.2.0` = First public npm release (beta)
- `v1.0.0` = Stable API commitment

### 5. README.md Per Package

Each publishable package needs a README with:
- Installation instructions
- Quick start example
- Link to main repo docs

### 6. License File

- [ ] Copy `LICENSE` to root (if missing)
- [ ] Ensure each package references it

---

## 🚀 Publishing Workflow

### Step 1: Update Package Metadata (15 min)

```bash
cd /Users/michael.lynn/code/openclaw-memory

# Update each package.json with repository, keywords, author, license
# packages/daemon/package.json
# packages/client/package.json
# packages/cli/package.json
```

### Step 2: Build All Packages (5 min)

```bash
# Build daemon
cd packages/daemon && pnpm run build

# Build client
cd ../client && pnpm run build

# Build CLI
cd ../cli && pnpm run build
```

### Step 3: Test Packages Locally (10 min)

```bash
# Pack each package (creates .tgz tarball)
cd packages/daemon && pnpm pack
cd ../client && pnpm pack
cd ../cli && pnpm pack

# Test installation from tarball
mkdir -p /tmp/test-install
cd /tmp/test-install
npm install ~/code/openclaw-memory/packages/daemon/openclaw-memory-daemon-0.2.0.tgz
```

### Step 4: Publish (Dry Run First) (5 min)

```bash
# Daemon (dry run)
cd packages/daemon
pnpm publish --dry-run --access public

# If dry run succeeds, publish for real
pnpm publish --access public

# Client
cd ../client
pnpm publish --access public

# CLI
cd ../cli
pnpm publish --access public
```

### Step 5: Verify Published Packages (5 min)

```bash
# Check on npm registry
open https://www.npmjs.com/package/@openclaw-memory/daemon
open https://www.npmjs.com/package/@openclaw-memory/client
open https://www.npmjs.com/package/@openclaw-memory/cli

# Test fresh install
mkdir -p /tmp/verify-npm
cd /tmp/verify-npm
npm install -g @openclaw-memory/cli
ocmem --version  # Should print 0.2.0
```

---

## 📝 Post-Publishing Tasks

### 1. GitHub Release

```bash
cd /Users/michael.lynn/code/openclaw-memory
git tag v0.2.0
git push origin v0.2.0

# Create GitHub release via web UI:
# https://github.com/mrlynn/openclaw-mongodb-memory/releases/new
# - Tag: v0.2.0
# - Title: "v0.2.0 - First NPM Release"
# - Body: Copy from CHANGELOG.md
```

### 2. Update Documentation

- [ ] Update README.md with npm install instructions
- [ ] Update SKILL.md with npm installation method
- [ ] Add badge: `[![npm version](https://img.shields.io/npm/v/@openclaw-memory/daemon)](https://www.npmjs.com/package/@openclaw-memory/daemon)`

### 3. Announce

- [ ] Post to OpenClaw Discord
- [ ] Tweet from MongoDB DevRel account (if appropriate)
- [ ] Update PRODUCT_PLAN.md progress tracker

---

## 🛡️ Safety Checklist

Before publishing:

- [ ] `.env` and `.env.local` files in `.gitignore`
- [ ] No API keys in package source
- [ ] No MongoDB connection strings in code
- [ ] Test suite passing (`pnpm test`)
- [ ] Build succeeds for all packages
- [ ] `pnpm publish --dry-run` succeeds
- [ ] npm account has 2FA enabled
- [ ] npm organization `@openclaw-memory` created (or permission granted)

---

## 🔧 Troubleshooting

### Error: "You must sign up for private packages"

**Solution:** Add `--access public` to `pnpm publish` command

### Error: "Package name already exists"

**Solution:** Check if package is already published. If updating, bump version first.

### Error: "Permission denied"

**Solution:** Run `npm login` to authenticate, or check npm organization permissions

### Build fails with TypeScript errors

**Solution:** Fix TypeScript errors before publishing. Run `pnpm run build` in each package.

---

## 📊 Success Metrics

After publishing, track:

- **npm downloads/week** (target: 50+ in first week)
- **GitHub stars** (bump from organic discovery)
- **Issues opened** (feedback signal)
- **Installation success rate** (via Discord/community feedback)

---

## 🎯 Estimated Time

| Task | Duration |
|------|----------|
| Update package metadata | 15 min |
| Build all packages | 5 min |
| Test locally | 10 min |
| Publish (dry run + real) | 10 min |
| Verify + GitHub release | 10 min |
| Update docs | 10 min |
| **Total** | **60 min** |

**Status:** Ready to begin ✅
