#!/bin/bash
# ─────────────────────────────────────────────────────────────────────
# Publish @openclaw-memory packages to npm
#
# Usage:
#   ./scripts/publish.sh              # publish all packages (dry-run)
#   ./scripts/publish.sh --run        # actually publish to npm
#   ./scripts/publish.sh --run --otp 123456   # with 2FA OTP
#   ./scripts/publish.sh --canary     # publish canary (pre-release)
#   ./scripts/publish.sh --help       # show help
# ─────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
DIM='\033[2m'
BOLD='\033[1m'
NC='\033[0m'

# Publishable packages (order matters: client before cli since cli depends on client)
# web is NOT published — it's a Next.js app
PACKAGES=("client" "daemon" "cli")

# Flags
DRY_RUN=true
OTP=""
CANARY=false
SKIP_CHECKS=false

# ─────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────

info()    { echo -e "${BLUE}ℹ${NC}  $*"; }
success() { echo -e "${GREEN}✅${NC} $*"; }
warn()    { echo -e "${YELLOW}⚠️${NC}  $*"; }
fail()    { echo -e "${RED}❌${NC} $*"; exit 1; }
step()    { echo -e "\n${BOLD}${CYAN}── $* ──${NC}"; }
dim()     { echo -e "${DIM}   $*${NC}"; }

get_pkg_name() {
  node -p "require('$PROJECT_ROOT/packages/$1/package.json').name"
}

get_pkg_version() {
  node -p "require('$PROJECT_ROOT/packages/$1/package.json').version"
}

usage() {
  cat <<EOF
${BOLD}Usage:${NC} ./scripts/publish.sh [options]

${BOLD}Options:${NC}
  --run            Actually publish to npm (default: dry-run)
  --otp <code>     npm OTP code for 2FA
  --canary         Publish as canary pre-release (0.2.0 → 0.2.1-canary.1706...)
  --skip-checks    Skip build/test/lint checks (use with caution)
  --help           Show this help

${BOLD}Examples:${NC}
  ./scripts/publish.sh                 # dry-run (see what would happen)
  ./scripts/publish.sh --run           # publish for real
  ./scripts/publish.sh --run --otp 123456
  ./scripts/publish.sh --canary --run  # publish canary release

${BOLD}Packages published:${NC}
  @openclaw-memory/client    TypeScript client SDK
  @openclaw-memory/daemon    Memory daemon server
  @openclaw-memory/cli       CLI tool (ocmem)

${DIM}Note: @openclaw-memory/web is NOT published (Next.js app, not a library)${NC}
EOF
}

# ─────────────────────────────────────────────────────────────────────
# Parse args
# ─────────────────────────────────────────────────────────────────────

while [[ $# -gt 0 ]]; do
  case "$1" in
    --run)        DRY_RUN=false; shift ;;
    --otp)        OTP="$2"; shift 2 ;;
    --canary)     CANARY=true; shift ;;
    --skip-checks) SKIP_CHECKS=true; shift ;;
    --help|-h)    usage; exit 0 ;;
    *)            fail "Unknown option: $1 (use --help for usage)" ;;
  esac
done

# ─────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────

echo ""
echo -e "${BOLD}╔═══════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║    📦 OpenClaw Memory — npm Publish           ║${NC}"
echo -e "${BOLD}╚═══════════════════════════════════════════════╝${NC}"
echo ""

if $DRY_RUN; then
  warn "DRY RUN — no packages will be published"
  warn "Add ${BOLD}--run${NC} to publish for real"
  echo ""
fi

# ─── Step 1: Verify npm auth ─────────────────────────────────────

step "Checking npm authentication"

NPM_USER=$(npm whoami 2>/dev/null) || fail "Not logged in to npm. Run: npm login"
success "Logged in as ${BOLD}${NPM_USER}${NC}"

# Check org access
if npm org ls @openclaw-memory 2>/dev/null | grep -q "$NPM_USER"; then
  success "Has access to @openclaw-memory org"
else
  warn "Could not verify @openclaw-memory org membership (may still work if you're the owner)"
fi

# ─── Step 2: Check git status ────────────────────────────────────

step "Checking git status"

cd "$PROJECT_ROOT"

BRANCH=$(git branch --show-current)
info "On branch: ${BOLD}${BRANCH}${NC}"

if ! git diff --quiet HEAD 2>/dev/null; then
  if $DRY_RUN; then
    warn "Uncommitted changes detected (OK for dry-run)"
  else
    warn "Uncommitted changes detected"
    echo ""
    git status --short
    echo ""
    read -p "Continue publishing with uncommitted changes? [y/N] " -n 1 -r
    echo
    [[ $REPLY =~ ^[Yy]$ ]] || fail "Aborted. Commit changes first."
  fi
else
  success "Working tree is clean"
fi

# ─── Step 3: Run checks ──────────────────────────────────────────

if $SKIP_CHECKS; then
  warn "Skipping build/test/lint checks (--skip-checks)"
else
  step "Running pre-publish checks"

  info "Building all packages..."
  pnpm build || fail "Build failed. Fix errors before publishing."
  success "Build passed"

  info "Running tests..."
  pnpm test || fail "Tests failed. Fix errors before publishing."
  success "Tests passed"

  info "Running linter..."
  pnpm lint || fail "Lint failed. Fix errors before publishing."
  success "Lint passed"
fi

# ─── Step 4: Resolve versions ────────────────────────────────────

step "Resolving package versions"

ROOT_VERSION=$(node -p "require('./package.json').version")
info "Root version: ${BOLD}v${ROOT_VERSION}${NC}"

for pkg in "${PACKAGES[@]}"; do
  PKG_NAME=$(get_pkg_name "$pkg")
  PKG_VERSION=$(get_pkg_version "$pkg")

  # Check if this version is already published
  PUBLISHED=$(npm view "$PKG_NAME@$PKG_VERSION" version 2>/dev/null || echo "")

  if [[ -n "$PUBLISHED" ]] && ! $CANARY; then
    warn "${PKG_NAME}@${PKG_VERSION} is already published"
  else
    info "${PKG_NAME}@${BOLD}${PKG_VERSION}${NC}"
  fi
done

# ─── Step 5: Canary version (if --canary) ────────────────────────

if $CANARY; then
  step "Generating canary versions"

  CANARY_ID=$(date +%s)

  for pkg in "${PACKAGES[@]}"; do
    PKG_DIR="$PROJECT_ROOT/packages/$pkg"
    PKG_NAME=$(get_pkg_name "$pkg")
    BASE_VERSION=$(get_pkg_version "$pkg")
    CANARY_VERSION="${BASE_VERSION}-canary.${CANARY_ID}"

    # Temporarily write canary version to package.json
    node -e "
      const fs = require('fs');
      const p = JSON.parse(fs.readFileSync('$PKG_DIR/package.json', 'utf8'));
      p.version = '$CANARY_VERSION';
      fs.writeFileSync('$PKG_DIR/package.json', JSON.stringify(p, null, 2) + '\n');
    "
    info "${PKG_NAME}@${BOLD}${CANARY_VERSION}${NC}"
  done
fi

# ─── Step 6: Publish ─────────────────────────────────────────────

step "Publishing packages"

PUBLISH_FLAGS="--access public"
if $DRY_RUN; then
  PUBLISH_FLAGS="$PUBLISH_FLAGS --dry-run"
fi
if [[ -n "$OTP" ]]; then
  PUBLISH_FLAGS="$PUBLISH_FLAGS --otp $OTP"
fi
if $CANARY; then
  PUBLISH_FLAGS="$PUBLISH_FLAGS --tag canary"
fi

PUBLISHED_COUNT=0
SKIPPED_COUNT=0
FAILED_COUNT=0

for pkg in "${PACKAGES[@]}"; do
  PKG_DIR="$PROJECT_ROOT/packages/$pkg"
  PKG_NAME=$(get_pkg_name "$pkg")
  PKG_VERSION=$(get_pkg_version "$pkg")

  echo ""
  info "Publishing ${BOLD}${PKG_NAME}@${PKG_VERSION}${NC}..."

  # Check if already published (skip for canary and dry-run)
  if ! $CANARY && ! $DRY_RUN; then
    PUBLISHED=$(npm view "$PKG_NAME@$PKG_VERSION" version 2>/dev/null || echo "")
    if [[ -n "$PUBLISHED" ]]; then
      warn "Skipping ${PKG_NAME}@${PKG_VERSION} — already published"
      SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
      continue
    fi
  fi

  # Publish with pnpm (auto-converts workspace:* to actual versions)
  if (cd "$PKG_DIR" && pnpm publish $PUBLISH_FLAGS 2>&1); then
    success "${PKG_NAME}@${PKG_VERSION} published"
    PUBLISHED_COUNT=$((PUBLISHED_COUNT + 1))
  else
    warn "Failed to publish ${PKG_NAME}@${PKG_VERSION}"
    FAILED_COUNT=$((FAILED_COUNT + 1))
  fi
done

# ─── Step 7: Revert canary versions ──────────────────────────────

if $CANARY; then
  step "Reverting canary version changes"

  for pkg in "${PACKAGES[@]}"; do
    PKG_DIR="$PROJECT_ROOT/packages/$pkg"
    git checkout "$PKG_DIR/package.json" 2>/dev/null || true
  done
  success "Reverted package.json files"
fi

# ─── Summary ─────────────────────────────────────────────────────

echo ""
echo -e "${BOLD}╔═══════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║    Publish Summary                            ║${NC}"
echo -e "${BOLD}╚═══════════════════════════════════════════════╝${NC}"
echo ""

if $DRY_RUN; then
  info "Mode:      ${YELLOW}DRY RUN${NC} (nothing was published)"
else
  info "Mode:      ${GREEN}LIVE${NC}"
fi
if $CANARY; then
  info "Tag:       canary"
fi
info "Published: ${BOLD}${PUBLISHED_COUNT}${NC}"
if [[ $SKIPPED_COUNT -gt 0 ]]; then
  info "Skipped:   ${YELLOW}${SKIPPED_COUNT}${NC} (already published)"
fi
if [[ $FAILED_COUNT -gt 0 ]]; then
  info "Failed:    ${RED}${FAILED_COUNT}${NC}"
fi

echo ""

if [[ $FAILED_COUNT -gt 0 ]]; then
  fail "Some packages failed to publish"
elif $DRY_RUN; then
  success "Dry run complete. Add ${BOLD}--run${NC} to publish for real."
else
  success "All packages published successfully! 🎉"
  echo ""
  dim "Install with:"
  dim "  npm install @openclaw-memory/client"
  dim "  npm install @openclaw-memory/daemon"
  dim "  npx @openclaw-memory/cli --help"
fi

echo ""
