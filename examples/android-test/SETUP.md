# Android Test App Setup

Minimal example app for iteratively testing Android support in the zcam1-sdk.

## Prerequisites

- Node.js 20+
- Android SDK with NDK 27.1.12297006
- Android emulator or physical device
- `yalc` installed globally: `npm i -g yalc`
- `just` command runner

## Initial Setup

From the **repo root** (`zcam1-sdk/`):

```bash
# 1. Publish all local packages to yalc and link them
just add-yalc

# 2. Install dependencies
cd examples/android-test
npm install

# 3. Generate native Android project
npx expo prebuild --platform android

# 4. Build and run
npx expo run:android
```

Or use the just shortcut from the repo root:

```bash
just run-android-test
```

## Updating After Local Changes

When you modify a local package (e.g., `react-native-zcam1-capture`):

```bash
# From the package directory
cd react-native-zcam1-capture
yalc publish --push

# Then rebuild the android-test app
cd examples/android-test
npx expo prebuild --platform android --clean
npx expo run:android
```

Or use the package-specific just recipe:

```bash
cd react-native-zcam1-capture
just add-yalc-to-android-test
```

## Cleaning Up

To remove yalc overrides and go back to npm registry versions:

```bash
# From repo root
just remove-yalc

# Then reinstall from registry
cd examples/android-test
npm install
```

## Troubleshooting

**Build fails with codegen errors:** Run `npx expo prebuild --platform android --clean` to regenerate native code.

**Native module not found:** Make sure you ran `just add-yalc` and `npm install` in this directory.

**Stale package:** Run `yalc publish --push` from the modified package directory to refresh.
