#!/bin/bash

# Get the version from package.json
VERSION=$(node -p "require('./package.json').version")

# Package name comes from the first argument (used as the zip filename)
PACKAGE="$1"
if [ -z "$PACKAGE" ]; then
  echo "Error: Missing package name."
  echo "Usage: $0 <package-name>"
  exit 1
fi

JNILIBS_DIR="android/src/main/jniLibs"
URL="https://github.com/succinctlabs/zcam1-sdk/releases/download/v$VERSION/$PACKAGE-jniLibs.zip"

# Skip if we are in CI
if [ "$npm_command" == "ci" ]; then
    echo "Skipping jniLibs download in CI."
    exit 0
fi

# Skip if SKIP_FRAMEWORK_DOWNLOAD env var is set
if [ -n "$SKIP_FRAMEWORK_DOWNLOAD" ]; then
  echo "SKIP_FRAMEWORK_DOWNLOAD is set. Skipping jniLibs download."
  exit 0
fi

# Skip if jniLibs already exist
if [ -d "$JNILIBS_DIR/arm64-v8a" ] && [ -d "$JNILIBS_DIR/armeabi-v7a" ] && [ -d "$JNILIBS_DIR/x86_64" ]; then
  echo "jniLibs already exist. Skipping download."
  exit 0
fi

echo "Preparing to download jniLibs version v$VERSION..."

# Download the file
# -L follows redirects (crucial for GitHub)
# -f fails silently on server errors (404, etc) so we can catch them
if curl -L -f -o "$PACKAGE-jniLibs.zip" "$URL"; then
  echo "Download complete."
else
  echo "Error: Failed to download jniLibs for v$VERSION. Does the release exist?"
  exit 1
fi

# Extract the file
echo "Extracting..."
mkdir -p "$JNILIBS_DIR"
unzip -o -q "$PACKAGE-jniLibs.zip" -d "$JNILIBS_DIR"

# Cleanup
rm "$PACKAGE-jniLibs.zip"
echo "Done! jniLibs are ready."
