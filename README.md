# ZCAM1 Monorepo

This repository hosts the ZCAM1 authenticity stack, combining a Rust backend, iOS components, and multiple React Native packages for capture, proof generation, and verification.

## Top‑Level Layout

* [backend]: Rust HTTP server and orchestration layer
* crates: Shared Rust crates used across the workspace
  * common: Core ZCAM1 primitives (proving, certificate logic, etc.)
  * ios: iOS-specific Rust logic (certificate & C2PA helpers, proving)
  * c2pa-utils: Rust utilities & FFI surface for C2PA integration
  * verifier: Rust verifier for ZCAM1 proofs and picture hashes
* programs
    * authenticity-ios: Rust program for iOS authenticity / proving flows
* [react-native-zcam1-capture]: React Native Capture SDK (recording + secure storage)
* [react-native-zcam1-prove]: React Native Proving SDK (proof generation client)
* [react-native-zcam1-verify]: React Native Verify SDK (proof & C2PA verification)
* [react-native-zcam1-picker]: React Native image picker component
* react-native-zcam1-c2pa: React Native bridge over the C2PA Rust layer
* zcam1-common: TypeScript/JS low‑level utilities shared across RN SDKs
* examples: Expo example apps demonstrating SDK usage
  * capture: Example using `react-native-zcam1-capture`
  * prove: Example using `react-native-zcam1-prove`
  * verify: Example using `react-native-zcam1-verify`
  * e2e: E2E example

[backend]: ./backend/README.md
[react-native-zcam1-capture]: ./react-native-zcam1-capture/README.md
[react-native-zcam1-prove]: ./react-native-zcam1-prove/README.md
[react-native-zcam1-verify]: ./react-native-zcam1-verify/README.md
[react-native-zcam1-picker]: ./react-native-zcam1-picker/README.md

## Prerequisites

When installing the React Native packages with `npm i`, Rust bindings are built. You need to have Rust installed, with the iOS targets installed via `rustup`:

```bash
rustup target add aarch64-apple-ios aarch64-apple-ios-sim
```

> [!CAUTION]
> The UniFFI binidings are built when the React Native libraries are installed with `npm install`. It's expected to takes a lot of time.


## Running the examples

The examples lives under the `examples` folder in this repo. to run the examples on a device, complete the following steps:

1. install Xcode
2. If you don't have a developper account, you can [create a personal team].
3. Go to an example folder (for instance `cd examples/e2e`)
4. Copy the `.env.example` file to `.env`
5. Set `EXPO_PUBLIC_APP_ID` to something like `<YOUR_TEAM_ID>.<YOUR_BUNDLE_ID>`
6. Update the `bundleIdentifier` field in the `app.json` file with the bundle ID from step 3
7. run `npx expo prebuild && npx expo run:ios --device`
8. It will lilely fail; You need to trust the developper on your device:
   Open the iOS device settings -> General -> Device Management -> Click Trust for the app

[create a personal team]: https://stackoverflow.com/questions/4952820/test-ios-app-on-device-without-apple-developer-program-or-jailbreak/66484365#66484365

## `react-native-zcam1-capture`

`react-native-zcam1-capture` is the React Native Capture SDK used to acquire photos on-device and produce C2PA-signed assets bound to hardware-backed integrity signals.

At a high level it provides:

- A `ZCamera` React component that renders a native iOS camera preview and exposes a `takePhoto()` method.
- A device registration / attestation flow via `initDevice()` and `updateRegistration()`.
- A `ZPhoto` object representing both the original capture and the C2PA-signed output.

The Expo example app in `examples/capture` shows a complete usage flow.

## `react-native-zcam1-prove`

`react-native-zcam1-prove` is the React Native Proving SDK used to take an existing C2PA-signed image (typically produced by `react-native-zcam1-capture`), generate a cryptographic proof for its bindings, and embed that proof back into the C2PA manifest.

At a high level it provides:

- A `initDevice()` helper to obtain the secure enclave content key ID and certificate chain from your backend.
- An `embedProof()` function that:
  - Reads the existing C2PA manifest from an image.
  - Uses the manifest’s bindings and data hash to generate a proof via your backend.
  - Rewrites the manifest to:
    - Add a `succinct.proof` assertion containing the proof and verification key hash.
    - Remove the original `succinct.bindings` assertion.
  - Re-signs the image and writes a new JPEG with the updated manifest.

## `react-native-zcam1-verify`

`react-native-zcam1-verify` is the React Native Verify SDK used to check that a C2PA-signed image with an embedded proof is authentic. It verifies both:

- The file’s content hash, as recorded in the C2PA manifest.
- The zero-knowledge proof bound to that hash and a pinned Apple attestation root.
