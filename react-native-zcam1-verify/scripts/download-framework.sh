#!/bin/bash

#  Get the version from package.json
VERSION=$(node -p "require('./package.json').version")

# Framework name comes from the first argument
FRAMEWORK="$1"
if [ -z "$FRAMEWORK" ]; then
  echo "❌ Error: Missing framework name."
  echo "Usage: $0 <FrameworkName.xcframework>"
  exit 1
fi

# Define constants
URL="https://github.com/succinctlabs/zcam1-sdk/releases/download/v$VERSION/$FRAMEWORK.zip"

# Skip if we are in CI
if [ "$npm_command" == "ci" ]; then
    echo "⏭️ Skipping framework download in CI."
    exit 0
fi

# Skip if SKIP_FRAMEWORK_DOWNLOAD env var is set
if [ -n "$SKIP_FRAMEWORK_DOWNLOAD" ]; then
  echo "⏭️ SKIP_FRAMEWORK_DOWNLOAD is set. Skipping framework download."
  exit 0
fi

# Skip if framework already exists
if [ -d "$FRAMEWORK" ]; then
  echo "⏭️ $FRAMEWORK already exists. Skipping framework download."
  exit 0
fi

echo "📦 Preparing to download version v$VERSION..."

# Download the file
# -L follows redirects (crucial for GitHub)
# -f fails silently on server errors (404, etc) so we can catch them
if curl -L -f -o "$FRAMEWORK.zip" "$URL"; then
  echo "✅ Download complete."
else
  echo "❌ Error: Failed to download asset for v$VERSION. Does the release exist?"
  exit 1
fi

# Extract the file
echo "📂 Extracting..."
# -o overwrites existing files without asking
# -q is quiet mode
unzip -o -q "$FRAMEWORK.zip"

# Cleanup
rm "$FRAMEWORK.zip"
echo "✨ Done! $FRAMEWORK is ready."
