#!/bin/bash
# Package openclaw-memory for distribution

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DIST_DIR="$PROJECT_ROOT/dist"
VERSION=$(node -p "require('$PROJECT_ROOT/package.json').version")
PACKAGE_NAME="openclaw-memory-v$VERSION"

echo "📦 Packaging OpenClaw Memory v$VERSION"
echo "======================================="
echo

# Clean dist directory
rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

# Create package directory
PACKAGE_DIR="$DIST_DIR/$PACKAGE_NAME"
mkdir -p "$PACKAGE_DIR"

echo "Copying files..."

# Copy source packages (excluding build artifacts)
echo "  - packages/"
rsync -a --exclude='node_modules' \
         --exclude='.next' \
         --exclude='dist' \
         --exclude='build' \
         --exclude='.turbo' \
         "$PROJECT_ROOT/packages/" "$PACKAGE_DIR/packages/"

# Copy plugin
if [ -d "$PROJECT_ROOT/plugin" ]; then
    echo "  - plugin/"
    rsync -a --exclude='node_modules' \
             --exclude='dist' \
             --exclude='build' \
             "$PROJECT_ROOT/plugin/" "$PACKAGE_DIR/plugin/"
else
    echo "  ⚠️  Plugin directory not found, skipping"
fi

# Copy documentation
echo "  - documentation"
cp "$PROJECT_ROOT/README.md" "$PACKAGE_DIR/"
cp "$PROJECT_ROOT/INSTALL.md" "$PACKAGE_DIR/"
cp "$PROJECT_ROOT/CHANGELOG.md" "$PACKAGE_DIR/" 2>/dev/null || true
cp "$PROJECT_ROOT/TROUBLESHOOTING.md" "$PACKAGE_DIR/" 2>/dev/null || true

# Copy docs directory
if [ -d "$PROJECT_ROOT/docs" ]; then
    echo "  - docs/"
    cp -r "$PROJECT_ROOT/docs" "$PACKAGE_DIR/"
else
    echo "  ⚠️  Docs directory not found, skipping"
fi

# Copy scripts
echo "  - scripts/"
cp -r "$PROJECT_ROOT/scripts" "$PACKAGE_DIR/"

# Copy root package.json and pnpm files
echo "  - package config"
cp "$PROJECT_ROOT/package.json" "$PACKAGE_DIR/"
cp "$PROJECT_ROOT/pnpm-workspace.yaml" "$PACKAGE_DIR/" 2>/dev/null || true
cp "$PROJECT_ROOT/pnpm-lock.yaml" "$PACKAGE_DIR/" 2>/dev/null || true

# Copy .env.example
if [ -f "$PROJECT_ROOT/packages/daemon/.env.example" ]; then
    cp "$PROJECT_ROOT/packages/daemon/.env.example" "$PACKAGE_DIR/packages/daemon/"
fi

# Create archive
echo "Creating archive..."
cd "$DIST_DIR"

# Create .tar.gz
tar -czf "$PACKAGE_NAME.tar.gz" "$PACKAGE_NAME"
echo "✅ Created $PACKAGE_NAME.tar.gz"

# Create .zip
zip -r -q "$PACKAGE_NAME.zip" "$PACKAGE_NAME"
echo "✅ Created $PACKAGE_NAME.zip"

# Cleanup temp directory
rm -rf "$PACKAGE_DIR"

echo
echo "======================================="
echo "✅ Package created successfully!"
echo
echo "Archives:"
echo "  - $DIST_DIR/$PACKAGE_NAME.tar.gz"
echo "  - $DIST_DIR/$PACKAGE_NAME.zip"
echo
echo "Distribution size:"
ls -lh "$DIST_DIR"/*.{tar.gz,zip} 2>/dev/null | awk '{print "  ", $9, "-", $5}'
echo
echo "To install, extract and run:"
echo "  ./scripts/install.sh"
echo "======================================="
