#!/bin/bash

#  Get the version from package.json
VERSION=$(node -p "require('./package.json').version")

# Define constants
URL="https://github.com/succinctlabs/zcam1-sdk/releases/download/v$VERSION/Zcam1C2paFramework.xcframework.zip"
ZIP_FILE="Zcam1C2paFramework.xcframework.zip"
FRAMEWORK_DIR="Zcam1C2paFramework.xcframework"

# Check if framework already exists
if [ -d "$FRAMEWORK_DIR" ]; then
  echo "✅ $FRAMEWORK_DIR already exists. Skipping download."
  exit 0
fi

# Skip if environment variable is set
if [ -n "$SKIP_FRAMEWORK_DOWNLOAD" ]; then
  echo "⏭️  SKIP_FRAMEWORK_DOWNLOAD is set. Skipping framework download."
  exit 0
fi


echo "📦 Preparing to download version v$VERSION..."

# Download the file
# -L follows redirects (crucial for GitHub)
# -f fails silently on server errors (404, etc) so we can catch them
if curl -L -f -o "$ZIP_FILE" "$URL"; then
  echo "✅ Download complete."
else
  echo "❌ Error: Failed to download asset for v$VERSION. Does the release exist?"
  exit 1
fi

# Extract the file
echo "📂 Extracting..."
# -o overwrites existing files without asking
# -q is quiet mode
unzip -o -q "$ZIP_FILE"

# Cleanup
rm "$ZIP_FILE"
echo "✨ Done! $FRAMEWORK_DIR is ready."
