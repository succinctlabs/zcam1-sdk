#!/bin/bash
set -euo pipefail

# Build Android native libraries for all Rust-based packages
#
# Requirements:
#   - ANDROID_NDK_HOME environment variable set
#   - Rust Android targets: rustup target add aarch64-linux-android armv7-linux-androideabi x86_64-linux-android
#   - cargo-ndk: cargo install cargo-ndk
#   - Node.js 20+
#   - Java 17 (for Gradle)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Validate environment
if [ -z "${ANDROID_NDK_HOME:-}" ]; then
    echo "Error: ANDROID_NDK_HOME is not set"
    echo ""
    echo "Set it to your Android NDK path, e.g.:"
    echo "  export ANDROID_NDK_HOME=\$HOME/Library/Android/sdk/ndk/27.1.12297006"
    exit 1
fi

if ! command -v cargo-ndk &> /dev/null; then
    echo "Error: cargo-ndk not found"
    echo ""
    echo "Install it with:"
    echo "  cargo install cargo-ndk"
    exit 1
fi

# Detect platform for NDK toolchain path
case "$(uname -s)" in
    Darwin*) HOST_TAG="darwin-x86_64" ;;
    Linux*)  HOST_TAG="linux-x86_64" ;;
    *)
        echo "Error: Unsupported platform $(uname -s)"
        exit 1
        ;;
esac

export PATH="$ANDROID_NDK_HOME/toolchains/llvm/prebuilt/$HOST_TAG/bin:$PATH"

# Parse arguments
RELEASE_FLAG=""
if [[ "${1:-}" == "--release" ]]; then
    RELEASE_FLAG="--release"
fi

# Build each ubrn-based package
PACKAGES=(
    "react-native-zcam1-verify"
    "react-native-zcam1-c2pa"
    "react-native-zcam1-prove"
)

for pkg in "${PACKAGES[@]}"; do
    PKG_DIR="$ROOT_DIR/$pkg"
    if [ ! -d "$PKG_DIR" ]; then
        echo "Warning: $pkg not found at $PKG_DIR, skipping"
        continue
    fi

    echo "==> Building $pkg for Android..."
    cd "$PKG_DIR"
    npx ubrn build android --and-generate $RELEASE_FLAG
done

echo ""
echo "Android build complete!"
