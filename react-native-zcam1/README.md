# react-native-zcam1

React Native SDK for capturing, signing, verifying, and proving media authenticity on iOS using C2PA manifests and zero-knowledge proofs.

**Platform:** iOS (Android coming soon)

**Full API Reference:** [zcamdocs.succinct.tools](https://zcamdocs.succinct.tools/)

## What It Does

ZCAM1 turns any iOS app into a provenance-aware camera. Photos and videos captured through the SDK are:

1. **Signed at capture time** with a [C2PA](https://c2pa.org/) manifest containing device metadata, camera settings, and Apple App Attest bindings
2. **Optionally proven** via zero-knowledge proofs (Groth16 via SP1) that cryptographically guarantee the photo was taken on a genuine iOS device — without revealing the device identity
3. **Verifiable** by anyone — on-device, in the browser, or on a server — using the companion `@succinctlabs/zcam1-verify` package

## Features

- **Authenticated capture** — Camera component backed by AVFoundation with Secure Enclave key management and App Attest device binding
- **C2PA signing** — Industry-standard content provenance manifests embedded at capture time
- **Verification** — Verify C2PA manifests and App Attest bindings on-device
- **Zero-knowledge proofs** — Optional proving module to cryptographically guarantee authenticity (Groth16 via SP1)
- **Image picker** — Gallery and private folder browser with authenticity badges
- **Film styles** — Built-in and customizable GPU-accelerated filters (mellow, nostalgic, B&W)
- **Video capture** — Record videos with the same C2PA signing pipeline

## Architecture

### Packages

| Package | npm | Purpose |
|---------|-----|---------|
| `@succinctlabs/react-native-zcam1` | This package | React Native SDK — capture, sign, verify, pick |
| `@succinctlabs/react-native-zcam1/proving` | Sub-export | Optional proving module — ZK proof generation |
| `@succinctlabs/zcam1-verify` | Separate package | Browser + Node.js verification SDK |

### How It Works

```
┌─────────────────────────────────────────────────────────┐
│                    React Native App                      │
│                                                          │
│  initCapture() ─► ZCamera ─► takePhoto() ─► ZPhoto     │
│       │                           │                      │
│       │                     C2PA manifest with           │
│       │                   succinct.bindings               │
│       │                           │                      │
│       │              ┌────────────┴──────────┐           │
│       │              │  (optional) Prove     │           │
│       │              │  ProverProvider       │           │
│       │              │  waitAndEmbedProof()  │           │
│       │              │        │              │           │
│       │              │  C2PA manifest with   │           │
│       │              │  succinct.proof       │           │
│       │              └───────────────────────┘           │
│       │                                                  │
│  VerifiableFile ─► verifyBindings() / verifyProof()     │
└─────────────────────────────────────────────────────────┘
```

### Rust + Native Bindings

The cryptographic core is written in Rust and compiled to native code via [uniffi-bindgen-react-native](https://github.com/nicolo-ribaudo/uniffi-bindgen-react-native). The Rust crates handle:

- **C2PA manifest creation and parsing** (`c2pa-utils`) — built on the [c2pa-rs](https://github.com/contentauth/c2pa-rs) library
- **Certificate generation** (`certs-utils`) — X.509/P-256 certificate chain building
- **Proof verification** (`verify-utils`) — SP1 Groth16 proof verification
- **Proof generation** (`proving-utils`) — SP1 proof requests to the Succinct prover network

Native iOS integration uses:
- **Secure Enclave** for content signing keys (via `@pagopa/io-react-native-crypto`)
- **App Attest** for device binding (via `@pagopa/io-react-native-integrity`)
- **AVFoundation** for camera capture (custom Swift TurboModule)

## Installation

```sh
npm install @succinctlabs/react-native-zcam1
```

### Prerequisites

- iOS 16+
- React Native 0.81+ with New Architecture enabled
- React 19+
- Rust toolchain with iOS targets:
  ```sh
  rustup target add aarch64-apple-ios aarch64-apple-ios-sim
  ```
- Xcode with Metal Toolchain:
  ```sh
  xcodebuild -downloadComponent MetalToolchain
  ```

> **Note:** Rust bindings are compiled during `npm install`. This is expected to take several minutes on the first install.

### iOS setup

```sh
cd ios && pod install
```

### Enabling the proving module

The proving module is optional and ships as a separate native framework. To enable it:

**Option 1 — Podfile.properties.json:**
```json
{
  "zcam1EnableProving": true
}
```

**Option 2 — Environment variable:**
```sh
ZCAM1_ENABLE_PROVING=1 pod install
```

**Option 3 — Expo config plugin:**
```ts
// app.config.ts
export default {
  plugins: [
    ["@succinctlabs/react-native-zcam1/app.plugin.js", { enableProving: true }]
  ]
};
```

## Quick Start

```tsx
import { useEffect, useRef, useState } from "react";
import { Button, View } from "react-native";
import { initCapture, ZCamera, CaptureInfo } from "@succinctlabs/react-native-zcam1";

export function CaptureScreen() {
  const camera = useRef<ZCamera>(null);
  const [captureInfo, setCaptureInfo] = useState<CaptureInfo>();

  useEffect(() => {
    initCapture({
      appId: "YOUR_TEAM_ID.your.bundle.id",
      production: false,
    }).then(setCaptureInfo);
  }, []);

  const handleCapture = async () => {
    const photo = await camera.current?.takePhoto();
    if (photo) {
      // photo.path contains a C2PA-signed JPEG with succinct.bindings
      console.log("Signed photo at:", photo.path);
    }
  };

  if (!captureInfo) return null;

  return (
    <View style={{ flex: 1 }}>
      <ZCamera ref={camera} captureInfo={captureInfo} style={{ flex: 1 }} />
      <Button title="Capture" onPress={handleCapture} />
    </View>
  );
}
```

See the [Quickstart Guide](https://zcamdocs.succinct.tools/getting-started/quickstart) for a complete capture → prove → verify flow.

## Troubleshooting

### Uniffi cache error

If you see `FFI function ... has a checksum mismatch` or `method_manifesteditor_... is not a function`, clean the cache:

```sh
cd react-native-zcam1 && npm run clean
# Then reinstall and rebuild
```

### RP ID mismatch

If you see "RP ID mismatch", the `appId` passed to `initCapture()` is incorrect. It must be `TEAM_ID.BUNDLE_ID` — for example, `NLS5R4YCGX.com.example.myapp`.

To find your Team ID: open Keychain Access → find "Apple Development" certificate → the Team ID is the "Organizational unit" under "Subject name".

## Requirements

- iOS 16+
- React Native 0.81+
- React 19+
- New Architecture enabled
- Physical device required for App Attest (simulator uses mock attestations for development)

## License

MIT
