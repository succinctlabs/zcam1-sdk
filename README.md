# ZCAM1 Monorepo

This repository hosts the ZCAM1 authenticity stack, combining a Rust backend, iOS components, and multiple React Native packages for capture, proof generation, and verification.

## Top‑Level Layout

```
zcam1-sdk/
├─ backend/                     # Rust HTTP server and orchestration layer
├─ crates/                      # Shared Rust crates used across the workspace
│  ├─ common/                   # Core ZCAM1 primitives (proving, certificate logic, etc.)
│  ├─ ios/                      # iOS-specific Rust logic (certificate & C2PA helpers, proving)
│  └─ c2pa-utils/               # Rust utilities & FFI surface for C2PA integration
├─ programs/
│  └─ authenticity-ios/         # Rust program for iOS authenticity / proving flows
├─ react-native-zcam1-capture/  # React Native Capture SDK (recording + secure storage)
├─ react-native-zcam1-prove/    # React Native Proving SDK (proof generation client)
├─ react-native-zcam1-verify/   # React Native Verify SDK (proof & C2PA verification)
├─ react-native-zcam1-c2pa/     # React Native bridge over the C2PA Rust layer
├─ zcam1-common/                # TypeScript/JS low‑level utilities shared across RN SDKs
├─ examples/                    # Expo example apps demonstrating SDK usage
│  ├─ capture/                  # Example using `react-native-zcam1-capture`
│  ├─ prove/                    # Example using `react-native-zcam1-prove`
│  └─ verify/                   # Example using `react-native-zcam1-verify`
```
