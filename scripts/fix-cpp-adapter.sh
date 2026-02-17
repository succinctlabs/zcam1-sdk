#!/bin/bash
# fix-cpp-adapter.sh — Fix ubrn-generated cpp-adapter.cpp for RN 0.80+.
#
# uniffi-bindgen-react-native generates cpp-adapter.cpp with CallInvokerHolder
# code that doesn't work on React Native 0.80+ because CallInvokerHolder now
# requires fbjni's cthis() to access the C++ instance.
#
# Usage: ./scripts/fix-cpp-adapter.sh <path-to-cpp-adapter.cpp>
# Safe to run multiple times (idempotent).

set -euo pipefail

FILE="${1:?Usage: $0 <path-to-cpp-adapter.cpp>}"

if [ ! -f "$FILE" ]; then
  echo "Error: $FILE not found" >&2
  exit 1
fi

# Skip if already fixed
if grep -q 'cthis()' "$FILE"; then
  echo "Already fixed: $FILE"
  exit 0
fi

# 1. Add fbjni include if missing (required for cthis())
if ! grep -q 'fbjni/fbjni.h' "$FILE"; then
  sed -i '' 's|#include <jsi/jsi.h>|#include <jsi/jsi.h>\
#include <fbjni/fbjni.h>|' "$FILE"
fi

# 2. Add jni namespace alias if missing
if ! grep -q 'namespace jni' "$FILE"; then
  sed -i '' 's|namespace jsi = facebook::jsi;|namespace jsi = facebook::jsi;\
namespace jni = facebook::jni;|' "$FILE"
fi

# 3. Add cthis() before getCallInvoker()
sed -i '' 's/->getCallInvoker()/->cthis()->getCallInvoker()/' "$FILE"

echo "Fixed: $FILE"
