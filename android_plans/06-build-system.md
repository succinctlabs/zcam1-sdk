# Task 06: Build System Configuration

## Overview

Configure the build system to support Android targets across all React Native packages. This includes Gradle configuration, Rust cross-compilation, uniffi-bindgen-react-native setup, and CI/CD updates.

**Estimated complexity:** Medium

**Dependencies:**
- Task 02 (Rust Android crate) provides the Rust code to compile
- Can be partially parallelized with other tasks

---

## Background Context

### Current Build Setup

The SDK uses:
- **uniffi-bindgen-react-native (ubrn)**: Generates React Native bindings from Rust
- **Cargo**: Builds Rust crates
- **CocoaPods**: iOS native dependencies
- **Gradle**: Android native dependencies (to be added)

### What Needs Configuration

1. **Rust targets**: Add Android NDK targets
2. **ubrn configs**: Add Android output settings
3. **Gradle files**: Configure Android modules
4. **CI/CD**: Add Android build and test jobs

---

## Implementation Steps

### Step 1: Install Rust Android Targets

```bash
# Install Android targets
rustup target add aarch64-linux-android   # ARM64 (most modern devices)
rustup target add armv7-linux-androideabi  # ARM32 (older devices)
rustup target add x86_64-linux-android     # x86_64 (emulators)
rustup target add i686-linux-android       # x86 (older emulators)
```

### Step 2: Configure Cargo for Android

**File:** `crates/.cargo/config.toml`

```toml
# Android NDK configuration
# Requires ANDROID_NDK_HOME environment variable

[target.aarch64-linux-android]
linker = "aarch64-linux-android21-clang"

[target.armv7-linux-androideabi]
linker = "armv7a-linux-androideabi21-clang"

[target.x86_64-linux-android]
linker = "x86_64-linux-android21-clang"

[target.i686-linux-android]
linker = "i686-linux-android21-clang"

[env]
# These are set by the build script or CI
# ANDROID_NDK_HOME = "/path/to/ndk"
```

**Alternative (using cargo-ndk):**

```bash
# Install cargo-ndk for easier cross-compilation
cargo install cargo-ndk

# Build for Android
cargo ndk -t arm64-v8a -t armeabi-v7a -t x86_64 -o ./jniLibs build --release
```

### Step 3: Update Workspace Cargo.toml

**File:** `crates/Cargo.toml`

```toml
[workspace]
resolver = "2"
members = [
    "ios",
    "android",  # NEW
    "verify-utils",
    "verify-bindings",
    "c2pa-bindings",
    "prove-bindings",
]

[workspace.dependencies]
# Shared dependencies across crates
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
thiserror = "1.0"
base64ct = { version = "1.6", features = ["alloc"] }
sha2 = "0.10"
p256 = { version = "0.13", features = ["ecdsa"] }
x509-cert = { version = "0.2", features = ["pem"] }
der-parser = "9.0"
hex = "0.4"

[profile.release]
lto = true
opt-level = "z"
strip = true
```

### Step 4: Configure ubrn for Android

**File:** `react-native-zcam1-verify/ubrn.config.yaml`

```yaml
name: Zcam1Verify

rust:
  manifestPath: ../../crates/verify-bindings/Cargo.toml
  crate: zcam1-verify-bindings

# iOS configuration (existing)
ios:
  frameworkName: Zcam1VerifyFramework
  targets:
    - aarch64-apple-ios
    - aarch64-apple-ios-sim
    - x86_64-apple-ios

# Android configuration (NEW)
android:
  # Output directory for JNI libraries
  jniLibs: android/src/main/jniLibs

  # Targets to build
  targets:
    - aarch64-linux-android
    - armv7-linux-androideabi
    - x86_64-linux-android

  # Minimum SDK version (24 for Key Attestation)
  minSdkVersion: 24

  # Kotlin package name
  package: com.zcam1sdk.verify

  # Enable release optimization
  release: true

# uniffi configuration
uniffi:
  # Path to uniffi.toml
  config: ../../crates/verify-bindings/uniffi.toml
```

**File:** `react-native-zcam1-c2pa/ubrn.config.yaml`

```yaml
name: Zcam1C2PA

rust:
  manifestPath: ../../crates/c2pa-bindings/Cargo.toml
  crate: zcam1-c2pa-bindings

ios:
  frameworkName: Zcam1C2PAFramework
  targets:
    - aarch64-apple-ios
    - aarch64-apple-ios-sim
    - x86_64-apple-ios

android:
  jniLibs: android/src/main/jniLibs
  targets:
    - aarch64-linux-android
    - armv7-linux-androideabi
    - x86_64-linux-android
  minSdkVersion: 24
  package: com.zcam1sdk.c2pa
  release: true

uniffi:
  config: ../../crates/c2pa-bindings/uniffi.toml
```

**File:** `react-native-zcam1-prove/ubrn.config.yaml`

```yaml
name: Zcam1Prove

rust:
  manifestPath: ../../crates/prove-bindings/Cargo.toml
  crate: zcam1-prove-bindings

ios:
  frameworkName: Zcam1ProveFramework
  targets:
    - aarch64-apple-ios
    - aarch64-apple-ios-sim
    - x86_64-apple-ios

android:
  jniLibs: android/src/main/jniLibs
  targets:
    - aarch64-linux-android
    - armv7-linux-androideabi
    - x86_64-linux-android
  minSdkVersion: 24
  package: com.zcam1sdk.prove
  release: true

uniffi:
  config: ../../crates/prove-bindings/uniffi.toml
```

### Step 5: Configure Android Gradle

**File:** `react-native-zcam1-capture/android/build.gradle`

```groovy
buildscript {
    ext.kotlin_version = '1.9.22'
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        classpath 'com.android.tools.build:gradle:8.2.2'
        classpath "org.jetbrains.kotlin:kotlin-gradle-plugin:$kotlin_version"
    }
}

apply plugin: 'com.android.library'
apply plugin: 'kotlin-android'

def safeExtGet(prop, fallback) {
    rootProject.ext.has(prop) ? rootProject.ext.get(prop) : fallback
}

android {
    namespace 'com.zcam1sdk.capture'
    compileSdkVersion safeExtGet('compileSdkVersion', 34)

    defaultConfig {
        minSdkVersion safeExtGet('minSdkVersion', 24)
        targetSdkVersion safeExtGet('targetSdkVersion', 34)

        // Required for CameraX
        vectorDrawables.useSupportLibrary = true
    }

    buildFeatures {
        buildConfig true
    }

    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = '17'
    }

    sourceSets {
        main {
            java.srcDirs = ['src/main/java']
        }
    }

    lintOptions {
        abortOnError false
    }
}

repositories {
    google()
    mavenCentral()
}

def camerax_version = "1.3.1"
def coroutines_version = "1.7.3"

dependencies {
    // React Native
    implementation "com.facebook.react:react-android"

    // Kotlin
    implementation "org.jetbrains.kotlin:kotlin-stdlib:$kotlin_version"
    implementation "org.jetbrains.kotlinx:kotlinx-coroutines-android:$coroutines_version"

    // CameraX
    implementation "androidx.camera:camera-core:$camerax_version"
    implementation "androidx.camera:camera-camera2:$camerax_version"
    implementation "androidx.camera:camera-lifecycle:$camerax_version"
    implementation "androidx.camera:camera-view:$camerax_version"

    // ExifInterface for metadata
    implementation "androidx.exifinterface:exifinterface:1.3.7"

    // Play Integrity
    implementation "com.google.android.play:integrity:1.3.0"

    // AndroidX
    implementation "androidx.core:core-ktx:1.12.0"
    implementation "androidx.appcompat:appcompat:1.6.1"
}
```

**File:** `react-native-zcam1-capture/android/src/main/AndroidManifest.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.zcam1sdk.capture">

    <!-- Camera permissions -->
    <uses-permission android:name="android.permission.CAMERA" />

    <!-- Required for hardware features -->
    <uses-feature android:name="android.hardware.camera" android:required="false" />
    <uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />
    <uses-feature android:name="android.hardware.camera.flash" android:required="false" />

</manifest>
```

### Step 6: Configure Rust-Based Packages Gradle

**File:** `react-native-zcam1-verify/android/build.gradle`

```groovy
buildscript {
    ext.kotlin_version = '1.9.22'
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        classpath 'com.android.tools.build:gradle:8.2.2'
        classpath "org.jetbrains.kotlin:kotlin-gradle-plugin:$kotlin_version"
    }
}

apply plugin: 'com.android.library'
apply plugin: 'kotlin-android'

def safeExtGet(prop, fallback) {
    rootProject.ext.has(prop) ? rootProject.ext.get(prop) : fallback
}

android {
    namespace 'com.zcam1sdk.verify'
    compileSdkVersion safeExtGet('compileSdkVersion', 34)

    defaultConfig {
        minSdkVersion safeExtGet('minSdkVersion', 24)
        targetSdkVersion safeExtGet('targetSdkVersion', 34)

        // Enable NDK for native libraries
        ndk {
            abiFilters 'arm64-v8a', 'armeabi-v7a', 'x86_64'
        }
    }

    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = '17'
    }

    sourceSets {
        main {
            java.srcDirs = ['src/main/java']
            // JNI libraries built by ubrn
            jniLibs.srcDirs = ['src/main/jniLibs']
        }
    }

    lintOptions {
        abortOnError false
    }
}

repositories {
    google()
    mavenCentral()
}

dependencies {
    implementation "com.facebook.react:react-android"
    implementation "org.jetbrains.kotlin:kotlin-stdlib:$kotlin_version"

    // JNA for uniffi
    implementation "net.java.dev.jna:jna:5.13.0@aar"
}
```

### Step 7: Create Build Scripts

**File:** `scripts/build-android.sh`

```bash
#!/bin/bash
set -e

# Build Android native libraries for all packages

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Check for Android NDK
if [ -z "$ANDROID_NDK_HOME" ]; then
    echo "Error: ANDROID_NDK_HOME not set"
    echo "Please set it to your Android NDK path, e.g.:"
    echo "  export ANDROID_NDK_HOME=~/Library/Android/sdk/ndk/26.1.10909125"
    exit 1
fi

# Add NDK to PATH
export PATH="$ANDROID_NDK_HOME/toolchains/llvm/prebuilt/darwin-x86_64/bin:$PATH"

echo "Building Rust crates for Android..."

cd "$ROOT_DIR/crates"

# Build with cargo-ndk if available, otherwise use raw cargo
if command -v cargo-ndk &> /dev/null; then
    echo "Using cargo-ndk..."
    cargo ndk \
        -t arm64-v8a \
        -t armeabi-v7a \
        -t x86_64 \
        build --release
else
    echo "Using raw cargo (ensure linkers are configured)..."
    cargo build --release --target aarch64-linux-android
    cargo build --release --target armv7-linux-androideabi
    cargo build --release --target x86_64-linux-android
fi

echo "Running ubrn for each package..."

# react-native-zcam1-verify
cd "$ROOT_DIR/packages/react-native-zcam1-verify"
npx ubrn build android

# react-native-zcam1-c2pa
cd "$ROOT_DIR/packages/react-native-zcam1-c2pa"
npx ubrn build android

# react-native-zcam1-prove
cd "$ROOT_DIR/packages/react-native-zcam1-prove"
npx ubrn build android

echo "Android build complete!"
```

**File:** `scripts/build-all.sh`

```bash
#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Building iOS..."
"$SCRIPT_DIR/build-ios.sh"

echo "Building Android..."
"$SCRIPT_DIR/build-android.sh"

echo "All platforms built successfully!"
```

### Step 8: Update Package.json Scripts

**File:** `package.json` (root)

```json
{
  "scripts": {
    "build": "npm run build:ios && npm run build:android",
    "build:ios": "./scripts/build-ios.sh",
    "build:android": "./scripts/build-android.sh",
    "build:rust": "cd crates && cargo build --release",
    "build:rust:android": "cd crates && cargo ndk -t arm64-v8a -t armeabi-v7a -t x86_64 build --release",
    "clean": "npm run clean:ios && npm run clean:android",
    "clean:ios": "cd packages/react-native-zcam1-capture && rm -rf ios/build",
    "clean:android": "cd packages/react-native-zcam1-capture && rm -rf android/build",
    "test": "npm run test:rust && npm run test:js",
    "test:rust": "cd crates && cargo test",
    "test:js": "jest"
  }
}
```

### Step 9: Configure CI/CD

**File:** `.github/workflows/android.yml`

```yaml
name: Android Build

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build-android:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Set up JDK
        uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'temurin'

      - name: Setup Android SDK
        uses: android-actions/setup-android@v3

      - name: Install Rust
        uses: dtolnay/rust-action@stable
        with:
          targets: aarch64-linux-android,armv7-linux-androideabi,x86_64-linux-android

      - name: Install cargo-ndk
        run: cargo install cargo-ndk

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build Rust for Android
        run: npm run build:rust:android
        env:
          ANDROID_NDK_HOME: ${{ steps.setup-ndk.outputs.ndk-path }}

      - name: Build Android packages
        run: npm run build:android
        env:
          ANDROID_NDK_HOME: ${{ steps.setup-ndk.outputs.ndk-path }}

      - name: Run tests
        run: npm run test:rust

  test-android-emulator:
    runs-on: ubuntu-latest
    needs: build-android

    steps:
      - uses: actions/checkout@v4

      - name: Enable KVM
        run: |
          echo 'KERNEL=="kvm", GROUP="kvm", MODE="0666", OPTIONS+="static_node=kvm"' | sudo tee /etc/udev/rules.d/99-kvm4all.rules
          sudo udevadm control --reload-rules
          sudo udevadm trigger --name-match=kvm

      - name: AVD cache
        uses: actions/cache@v4
        id: avd-cache
        with:
          path: |
            ~/.android/avd/*
            ~/.android/adb*
          key: avd-api-30

      - name: Create AVD and run tests
        uses: reactivecircus/android-emulator-runner@v2
        with:
          api-level: 30
          target: google_apis
          arch: x86_64
          profile: Nexus 6
          script: |
            npm run test:android:e2e
```

### Step 10: Configure Example App

**File:** `example/android/app/build.gradle`

```groovy
apply plugin: 'com.android.application'
apply plugin: 'kotlin-android'

android {
    namespace 'com.zcam1example'
    compileSdkVersion 34

    defaultConfig {
        applicationId "com.zcam1example"
        minSdkVersion 24
        targetSdkVersion 34
        versionCode 1
        versionName "1.0.0"

        // Enable hardware attestation testing
        testInstrumentationRunner "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        debug {
            // Enable debugging for attestation testing
            debuggable true
        }
        release {
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }

    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = '17'
    }
}

dependencies {
    implementation project(':react-native-zcam1-capture')
    implementation project(':react-native-zcam1-verify')
    implementation project(':react-native-zcam1-c2pa')
    implementation project(':react-native-zcam1-prove')

    // React Native
    implementation "com.facebook.react:react-android"
    implementation "com.facebook.react:hermes-android"

    // Testing
    androidTestImplementation 'androidx.test.ext:junit:1.1.5'
    androidTestImplementation 'androidx.test.espresso:espresso-core:3.5.1'
}
```

**File:** `example/android/settings.gradle`

```groovy
rootProject.name = 'Zcam1Example'

include ':app'

// Include local packages
include ':react-native-zcam1-capture'
project(':react-native-zcam1-capture').projectDir = new File(rootProject.projectDir, '../../packages/react-native-zcam1-capture/android')

include ':react-native-zcam1-verify'
project(':react-native-zcam1-verify').projectDir = new File(rootProject.projectDir, '../../packages/react-native-zcam1-verify/android')

include ':react-native-zcam1-c2pa'
project(':react-native-zcam1-c2pa').projectDir = new File(rootProject.projectDir, '../../packages/react-native-zcam1-c2pa/android')

include ':react-native-zcam1-prove'
project(':react-native-zcam1-prove').projectDir = new File(rootProject.projectDir, '../../packages/react-native-zcam1-prove/android')

// React Native packages
apply from: file("../node_modules/@react-native-community/cli-platform-android/native_modules.gradle")
applyNativeModulesSettingsGradle(settings)
```

---

## Environment Setup

### macOS Development

```bash
# Install Android Studio (includes SDK)
brew install --cask android-studio

# Set environment variables (add to ~/.zshrc or ~/.bashrc)
export ANDROID_HOME="$HOME/Library/Android/sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export ANDROID_NDK_HOME="$ANDROID_HOME/ndk/26.1.10909125"
export PATH="$PATH:$ANDROID_HOME/emulator"
export PATH="$PATH:$ANDROID_HOME/platform-tools"
export PATH="$PATH:$ANDROID_NDK_HOME/toolchains/llvm/prebuilt/darwin-x86_64/bin"

# Install Rust targets
rustup target add aarch64-linux-android armv7-linux-androideabi x86_64-linux-android

# Install cargo-ndk
cargo install cargo-ndk
```

### Linux Development

```bash
# Install Android SDK
sudo apt-get install android-sdk

# Or use sdkmanager
sdkmanager "platforms;android-34" "ndk;26.1.10909125" "build-tools;34.0.0"

# Set environment variables
export ANDROID_HOME="/opt/android-sdk"
export ANDROID_NDK_HOME="$ANDROID_HOME/ndk/26.1.10909125"
export PATH="$PATH:$ANDROID_NDK_HOME/toolchains/llvm/prebuilt/linux-x86_64/bin"
```

---

## Troubleshooting

### Common Issues

**1. NDK linker not found:**
```
error: linker `aarch64-linux-android21-clang` not found
```
Solution: Ensure `$ANDROID_NDK_HOME/toolchains/llvm/prebuilt/*/bin` is in PATH.

**2. JNI library not found at runtime:**
```
java.lang.UnsatisfiedLinkError: dlopen failed
```
Solution: Verify jniLibs directory structure:
```
android/src/main/jniLibs/
├── arm64-v8a/
│   └── libzcam1_verify.so
├── armeabi-v7a/
│   └── libzcam1_verify.so
└── x86_64/
    └── libzcam1_verify.so
```

**3. Min SDK version conflict:**
```
Manifest merger failed: uses-sdk:minSdkVersion 21 cannot be smaller than 24
```
Solution: Set minSdkVersion to 24 in all modules (required for Key Attestation).

---

## Files Summary

| File | Purpose |
|------|---------|
| `crates/.cargo/config.toml` | Rust cross-compilation config |
| `crates/Cargo.toml` | Workspace with Android crate |
| `*/ubrn.config.yaml` | uniffi Android targets |
| `*/android/build.gradle` | Gradle module config |
| `scripts/build-android.sh` | Build automation |
| `.github/workflows/android.yml` | CI/CD pipeline |

---

## Deliverables

### Files to Create/Modify

| Deliverable | File Path | Type |
|-------------|-----------|------|
| Cargo config | `crates/.cargo/config.toml` | Create |
| Workspace manifest | `crates/Cargo.toml` | Modify |
| Verify ubrn config | `react-native-zcam1-verify/ubrn.config.yaml` | Modify |
| C2PA ubrn config | `react-native-zcam1-c2pa/ubrn.config.yaml` | Modify |
| Prove ubrn config | `react-native-zcam1-prove/ubrn.config.yaml` | Modify |
| Capture Gradle | `react-native-zcam1-capture/android/build.gradle` | Modify |
| Verify Gradle | `react-native-zcam1-verify/android/build.gradle` | Create |
| Manifest | `*/android/src/main/AndroidManifest.xml` | Create |
| Build script | `scripts/build-android.sh` | Create |
| Build all script | `scripts/build-all.sh` | Modify |
| Root package.json | `package.json` | Modify |
| CI workflow | `.github/workflows/android.yml` | Create |
| Example app Gradle | `example/android/app/build.gradle` | Modify |
| Example settings | `example/android/settings.gradle` | Modify |

---

## Interface Definitions

### Build Scripts

```bash
# scripts/build-android.sh
# Input: None (uses environment variables)
# Output: JNI libraries in */android/src/main/jniLibs/
# Environment:
#   ANDROID_NDK_HOME (required)
#   CARGO_BUILD_TARGET (optional, defaults to all)

# scripts/build-all.sh
# Input: None
# Output: iOS frameworks + Android JNI libraries
```

### Package.json Scripts

```json
{
  "scripts": {
    "build": "npm run build:ios && npm run build:android",
    "build:ios": "./scripts/build-ios.sh",
    "build:android": "./scripts/build-android.sh",
    "build:rust": "cd crates && cargo build --release",
    "build:rust:android": "cd crates && cargo ndk -t arm64-v8a -t armeabi-v7a -t x86_64 build --release",
    "clean": "npm run clean:ios && npm run clean:android",
    "clean:android": "find packages -name 'jniLibs' -type d -exec rm -rf {} +",
    "test": "npm run test:rust && npm run test:js",
    "test:rust": "cd crates && cargo test",
    "test:js": "jest"
  }
}
```

### ubrn.config.yaml Schema

```yaml
name: string                    # Module name
rust:
  manifestPath: string          # Path to Cargo.toml
  crate: string                 # Crate name
ios:
  frameworkName: string
  targets: string[]             # ["aarch64-apple-ios", ...]
android:
  jniLibs: string               # Output directory
  targets: string[]             # ["aarch64-linux-android", ...]
  minSdkVersion: number         # 24 minimum
  package: string               # Kotlin package name
  release: boolean              # Optimization
uniffi:
  config: string                # Path to uniffi.toml
```

---

## Testing Plan

### Build Tests

| Test | Description |
|------|-------------|
| `cargo build` succeeds | All Rust crates compile |
| `cargo ndk` succeeds | Cross-compilation works |
| JNI libs generated | Files exist in jniLibs directories |
| Correct architectures | arm64-v8a, armeabi-v7a, x86_64 present |
| `./gradlew assembleDebug` | Android modules compile |
| Example app builds | Full app compilation succeeds |

### CI Tests

| Test | Description |
|------|-------------|
| Ubuntu runner works | CI builds on GitHub Actions |
| NDK setup correct | Proper NDK version installed |
| Artifacts uploaded | JNI libs saved as artifacts |
| Emulator tests run | AVD starts and runs tests |

### Manual Verification

| Step | Verification |
|------|--------------|
| Clone fresh repo | Build from scratch works |
| Run `npm run build` | Both platforms build |
| Run `npm run build:android` | Android-only builds |
| Check JNI directory | Libraries present with correct size |
| Run example on device | App launches without JNI errors |

---

## Completion Criteria

### Must Have (Required for task completion)

- [ ] **Rust cross-compilation works**
  - `cargo ndk` builds all targets
  - Output libraries in correct directories
  - No linking errors

- [ ] **ubrn config updated**
  - All three packages have Android targets
  - Generated Kotlin code compiles
  - JNI libraries copied correctly

- [ ] **Gradle configuration works**
  - All modules compile with `./gradlew build`
  - Dependencies resolve
  - minSdkVersion = 24 everywhere

- [ ] **Build scripts work**
  - `scripts/build-android.sh` runs without errors
  - Correct output directory structure
  - Environment variable handling

- [ ] **Example app builds**
  - `npx react-native run-android` works
  - No missing dependency errors
  - App launches on emulator

- [ ] **CI pipeline works**
  - GitHub Actions workflow passes
  - Builds on ubuntu-latest
  - Artifacts generated

- [ ] **Documentation**
  - Environment setup instructions
  - Troubleshooting guide

### Should Have (Expected but not blocking)

- [ ] **Caching in CI**
  - Cargo cache
  - Gradle cache
  - Faster builds

- [ ] **Emulator tests in CI**
  - AVD spins up
  - Basic smoke test passes

### Nice to Have (Not required)

- [ ] **Release workflow**
  - Automated versioning
  - NPM publishing

- [ ] **ARM macOS support**
  - Build on M1/M2 Macs

---

## Verification Commands

```bash
# Verify Rust targets installed
rustup target list --installed | grep android

# Verify NDK setup
echo $ANDROID_NDK_HOME
ls $ANDROID_NDK_HOME/toolchains/llvm/prebuilt/*/bin/aarch64-linux-android*-clang

# Build Rust for Android
cd crates
cargo ndk -t arm64-v8a build --release

# Verify JNI libs
find . -name "*.so" -path "*/jniLibs/*"

# Build Android
cd react-native-zcam1-capture/android
./gradlew assembleDebug

# Build example app
cd example/android
./gradlew assembleDebug

# Run on device/emulator
npx react-native run-android
```

---

## Environment Requirements

### Required Tools

| Tool | Version | Purpose |
|------|---------|---------|
| Rust | 1.75+ | Compilation |
| cargo-ndk | 3.0+ | Android cross-compilation |
| Android SDK | 34 | Android development |
| Android NDK | 26.x | Native compilation |
| Node.js | 20+ | JavaScript tooling |
| Java JDK | 17 | Gradle |

### Environment Variables

```bash
# Required
export ANDROID_HOME="$HOME/Library/Android/sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export ANDROID_NDK_HOME="$ANDROID_HOME/ndk/26.1.10909125"

# PATH additions
export PATH="$PATH:$ANDROID_HOME/platform-tools"
export PATH="$PATH:$ANDROID_NDK_HOME/toolchains/llvm/prebuilt/darwin-x86_64/bin"
```

---

## Handoff to Next Tasks

### Output for Task 07 (Testing)

This task provides the build infrastructure that Task 07 uses:

```bash
# Task 07 can run:
npm run build:android           # Build all Android components
npm run test:rust               # Run Rust tests
npx react-native run-android    # Launch on emulator
npx detox build -c android.emu  # Build for Detox tests
```

### CI Infrastructure for Task 07

The GitHub Actions workflow provides:
- Android emulator runner
- Test result collection
- Coverage reporting

---

## Next Steps

After this task:
- Task 07 (Testing) uses this build system for test automation
- Developers can run `npm run build:android` to build all packages
