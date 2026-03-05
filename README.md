# ZCAM1 Monorepo

This repository hosts the ZCAM1 authenticity stack, combining iOS components, a React Native SDK, and browser-based verification tools for capture, proof generation, and verification.

**Platform:** iOS (Android coming soon) | **Docs:** [zcamdocs.succinct.tools](https://zcam-sdk.succinct.xyz/)

## Top‑Level Layout

* crates: Shared Rust crates used across the workspace
  * common: Core ZCAM1 primitives (proving, certificate logic, etc.)
  * ios: iOS-specific Rust logic (certificate & C2PA helpers, proving)
  * c2pa-utils: Rust utilities & FFI surface for C2PA integration
  * certs-utils: Certificate utilities (X.509, P-256, cryptographic operations)
  * proving-utils: SP1 zero-knowledge proof generation utilities
  * proving-bindings: Native bindings for the proving layer
  * verify-utils: Rust verifier for ZCAM1 proofs and picture hashes
  * bindings: Unified native bindings (cdylib/staticlib) for external languages
  * wasm-bindings: WASM bindings for browser environments
* programs
  * authenticity-ios: Rust program for iOS authenticity / proving flows
* [react-native-zcam1]: React Native SDK (capture, proving, and verification)
* [zcam1-verify]: Browser verification SDK (`@succinctlabs/zcam1-verify`)
* web-verifier: Web app UI built on top of `zcam1-verify`
* examples: Expo example apps demonstrating SDK usage
  * capture: Example using capture functionality
  * prove: Example using proof generation
  * verify: Example using verification
  * e2e: Full end-to-end example

[react-native-zcam1]: ./react-native-zcam1/README.md
[zcam1-verify]: ./zcam1-verify/README.md

## Prerequisites

When installing the React Native packages with `npm i`, Rust bindings are built. You need to have Rust installed, with the iOS targets installed via `rustup`:

```bash
rustup target add aarch64-apple-ios aarch64-apple-ios-sim
```

You'll also need the Metal Toolchain:

```bash
xcodebuild -downloadComponent MetalToolchain
```

> [!CAUTION]
> The UniFFI bindings are built when the React Native library is installed with `npm install`. It's expected to take a lot of time.

## Running the examples

The examples live under the `examples` folder in this repo. To run the examples on a device, complete the following steps:

1. Install Xcode
2. If you don't have an Apple developer account, you can [create a personal team].
3. Go to an example folder (for instance `cd examples/e2e`)
4. Copy the `.env.example` file to `.env`
5. Set `EXPO_PUBLIC_APP_ID` to something like `<YOUR_TEAM_ID>.<YOUR_BUNDLE_ID>`
   To retrieve your Team ID, refer to the note below
6. Update the `bundleIdentifier` field in the `app.json` file with the bundle ID from step 5
7. run `npm i`
8. run `just run-e2e-example`
9. If you test on a real device, it will likely fail; You need to trust the developer on your device:
   Open the iOS device settings -> General -> Device Management -> Click Trust for the app

> [!NOTE]
> To retrieve your Team ID, complete the following steps:
> 1. Open Keychain access on your Mac
> 2. Locate a certificate named "Apple Development" and open it
> 3. The Team ID is the field "Organizational unit" under "Subject name" section

[create a personal team]: https://stackoverflow.com/questions/4952820/test-ios-app-on-device-without-apple-developer-program-or-jailbreak/66484365#66484365

## Local development

We use [Yalc] to iterate on the local React Native/TypeScript packages in this monorepo (especially when running the apps in `examples/*`) without publishing to npm. The `react-native-zcam1` folder ships `just` recipes that publish the package to Yalc and add it to the example apps (for instance `add-yalc-to-e2e`). When you make changes to the library, run `yalc publish --push` in the library folder to refresh what the example app consumes. To go back to the registry versions, remove Yalc overrides with `just remove-yalc` and reinstall dependencies.

[Yalc]: https://github.com/wclr/yalc

### Troubleshooting

#### Uniffi cache issue

If you encounter one of the following errors:

```
[Error: FFI function uniffi_zcam1_c2pa_utils_checksum_method_manifest_action has a checksum mismatch; this may signify previously undetected incompatible Uniffi versions]
[TypeError: (0, nativeModule.default)().ubrn(...)method_manifesteditor_add_action is not a function (it is undefined)]
```

They are likely caused by a cache issue. You can run the following command to clean the cache: `just clean`.

#### RP ID mismatch

If you encounter the following error: "RP ID mismatch", the root cause is probably an incorrect `appId` parameter in `initCapture()`.

The `appId` is expected to be of the form `<YOUR_TEAM_ID>.<YOUR_BUNDLE_ID>`.

## `react-native-zcam1`

`react-native-zcam1` (`@succinctlabs/react-native-zcam1`) is the consolidated React Native SDK covering capture, proof generation, and verification in a single package.

### Capture

The capture functionality is used to acquire photos on-device and produce C2PA-signed assets bound to hardware-backed integrity signals.

At a high level it provides:

- A `ZCamera` React component that renders a native iOS camera preview and exposes a `takePhoto()` method.
- A device registration / attestation flow via `initDevice()` and `updateRegistration()`.
- A `ZPhoto` object representing both the original capture and the C2PA-signed output.

The Expo example app in `examples/capture` shows a complete usage flow.

### Proving

The proving functionality takes an existing C2PA-signed image (typically produced by the capture flow), generates a cryptographic proof for its bindings, and embeds that proof back into the C2PA manifest.

At a high level it provides:

- A `initDevice()` helper to obtain the secure enclave content key ID and certificate chain from your backend.
- An `embedProof()` function that:
  - Reads the existing C2PA manifest from an image.
  - Uses the manifest's bindings and data hash to generate a proof via your backend.
  - Rewrites the manifest to:
    - Add a `succinct.proof` assertion containing the proof and verification key hash.
    - Remove the original `succinct.bindings` assertion.
  - Re-signs the image and writes a new JPEG with the updated manifest.

### Verification

The verification functionality checks that a C2PA-signed image with an embedded proof is authentic. It verifies both:

- The file's content hash, as recorded in the C2PA manifest.
- The zero-knowledge proof bound to that hash and a pinned Apple attestation root.

## `zcam1-verify`

`zcam1-verify` (`@succinctlabs/zcam1-verify`) is the browser verification SDK. It provides the same proof and C2PA verification capabilities as the React Native SDK but targeting web environments via WASM.

The `web-verifier` app in this repo is a reference UI built on top of this SDK.
