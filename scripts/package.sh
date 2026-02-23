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

# Copy source packages
cp -r "$PROJECT_ROOT/packages" "$PACKAGE_DIR/"

# Copy plugin
if [ -d "$PROJECT_ROOT/plugin" ]; then
    cp -r "$PROJECT_ROOT/plugin" "$PACKAGE_DIR/"
else
    echo "⚠️  Plugin directory not found, skipping"
fi

# Copy documentation
cp "$PROJECT_ROOT/README.md" "$PACKAGE_DIR/"
cp "$PROJECT_ROOT/INSTALL.md" "$PACKAGE_DIR/"
cp "$PROJECT_ROOT/SCHEMA.md" "$PACKAGE_DIR/"
cp "$PROJECT_ROOT/FOR_ENGINEERS.md" "$PACKAGE_DIR/"
cp "$PROJECT_ROOT/SKILL.md" "$PACKAGE_DIR/"

# Copy scripts
cp -r "$PROJECT_ROOT/scripts" "$PACKAGE_DIR/"

# Copy root package.json and pnpm files
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
