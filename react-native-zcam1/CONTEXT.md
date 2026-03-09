# ZCAM1 React Native SDK — Integration Guide for AI Assistants

This document is optimized for LLMs and AI coding assistants helping developers integrate `@succinctlabs/react-native-zcam1`.

## Package Info

- **npm:** `@succinctlabs/react-native-zcam1`
- **Proving sub-export:** `@succinctlabs/react-native-zcam1/proving`
- **Platform:** iOS only (Android coming soon)
- **Requirements:** React Native 0.81+, React 19+, iOS 16+, New Architecture enabled
- **Physical device required** for App Attest (simulator uses mock attestations in dev)
- **Docs:** https://zcamdocs.succinct.tools/

## What This SDK Does

ZCAM1 captures photos/videos and embeds cryptographic provenance data using the C2PA standard. Each captured file contains:
1. A C2PA manifest with device metadata, camera settings, and Apple App Attest bindings (`succinct.bindings`)
2. Optionally, a zero-knowledge proof (`succinct.proof`) that proves the photo was taken on a genuine iOS device without revealing device identity

## Core Concepts

- **`appId`**: Always `TEAM_ID.BUNDLE_ID` format (e.g., `NLS5R4YCGX.com.example.app`). This is critical — wrong format causes "RP ID mismatch" errors.
- **`CaptureInfo`**: Device registration data returned by `initCapture()`. Must be obtained before using `ZCamera`.
- **`ZPhoto`**: Result of `takePhoto()` — has `.originalPath` (raw) and `.path` (C2PA-signed).
- **`production` flag**: Controls whether real or development App Attest is used. Use `false` for development.

## Integration Patterns

### Pattern 1: Capture Only (Most Common)

```tsx
import { useEffect, useRef, useState } from "react";
import { Button, View } from "react-native";
import { initCapture, ZCamera, CaptureInfo } from "@succinctlabs/react-native-zcam1";

export function CaptureScreen() {
  const camera = useRef<ZCamera>(null);
  const [captureInfo, setCaptureInfo] = useState<CaptureInfo>();

  useEffect(() => {
    initCapture({
      appId: process.env.EXPO_PUBLIC_APP_ID!, // TEAM_ID.BUNDLE_ID
      production: false,
    }).then(setCaptureInfo);
  }, []);

  const handleCapture = async () => {
    const photo = await camera.current?.takePhoto();
    if (photo) {
      // photo contains 2 fields:
      // path: C2PA-signed JPEG with succinct.bindings
      //   this is a temporary path: the photo must be saved, either to the app
      //   private document directory or the camera roll.
      //  originalPath: raw capture before signing
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

### Pattern 2: Capture + Prove

Wrap app with `ProverProvider`, then use `provingClient.waitAndEmbedProof()`:

```tsx
import { ProverProvider, useProver } from "@succinctlabs/react-native-zcam1/proving";

// In app root:
<ProverProvider settings={{ production: false, privateKey: "YOUR_SP1_KEY" }}>
  <App />
</ProverProvider>

// In component:
function ProveButton({ photoPath }: { photoPath: string }) {
  const { provingClient } = useProver();

  const handleProve = async () => {
    if (!provingClient) return;
    const provenPath = await provingClient.waitAndEmbedProof(photoPath);
    // provenPath = new JPEG with succinct.proof replacing succinct.bindings
  };

  return <Button title="Prove" onPress={handleProve} />;
}
```

**Environment variables for proving:**
- `SP1_PRIVATE_KEY` — Succinct prover network key (get from https://network.succinct.xyz/)

### Pattern 3: Verify Photos On-Device

```tsx
import { VerifiableFile } from "@succinctlabs/react-native-zcam1";

const file = new VerifiableFile(photoUri);

// For photos with succinct.bindings (pre-proof):
const bindingsValid = file.verifyBindings(false); // false = development

// For photos with succinct.proof (post-proof):
const proofValid = file.verifyProof("TEAM_ID.BUNDLE_ID");

// Get capture metadata:
const metadata = file.captureMetadata();
// metadata?.when = capture timestamp
// metadata?.parameters = PhotoMetadataInfo or VideoMetadataInfo
```

### Pattern 4: Image Picker with Authenticity Badges

```tsx
import { ZImagePicker, privateDirectory, AuthenticityStatus } from "@succinctlabs/react-native-zcam1";

<ZImagePicker
  source={{ path: privateDirectory() }}
  renderBadge={(uri, status) => {
    if (status === AuthenticityStatus.Proof) return <Text>Proven</Text>;
    if (status === AuthenticityStatus.Bindings) return <Text>Signed</Text>;
    return null;
  }}
  onSelect={(uri) => console.log("Selected:", uri)}
/>
```

### Pattern 5: Video Capture

```tsx
const camera = useRef<ZCamera>(null);

// Start recording
await camera.current?.startVideoRecording("back", { maxDurationSeconds: 30 });

// Stop recording — returns C2PA-signed video
const result = await camera.current?.stopVideoRecording();
// result.filePath = signed .mov file
```

## Key Exports (Main)

| Export | Type | Purpose |
|--------|------|---------|
| `initCapture(settings)` | Function | Initialize device keys + attestation. Call once at app start. |
| `ZCamera` | Component (class) | Native camera preview. Use ref to call `takePhoto()`. |
| `ZPhoto` | Class | Capture result with `.path` (signed) and `.originalPath` (raw). |
| `VerifiableFile` | Class | Verify C2PA manifests on-device. |
| `ZImagePicker` | Component | Image grid with authenticity badges. |
| `privateDirectory()` | Function | Returns app's private document directory path. |
| `previewFile(path)` | Function | Native full-screen file preview (QLPreviewController). |
| `AuthenticityStatus` | Enum | `Bindings`, `Proof`, `InvalidManifest`, `NoManifest`, `Unknown` |

## Key Exports (Proving — `@succinctlabs/react-native-zcam1/proving`)

| Export | Type | Purpose |
|--------|------|---------|
| `ProverProvider` | Component | React context provider for proving. Wrap app root. |
| `useProver()` | Hook | Access `provingClient`, `isInitializing`, `error`. |
| `ProvingClient` | Class | `requestProof()`, `embedProof()`, `waitAndEmbedProof()`. |
| `useProofRequestStatus(id)` | Hook | Poll proof status for a specific request. |
| `FulfillmentStatus` | Enum | `Fulfilled`, `Unfulfillable`, `UnspecifiedFulfillmentStatus` |

## ZCamera Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `captureInfo` | `CaptureInfo` | Required | From `initCapture()` |
| `position` | `"front" \| "back"` | `"back"` | Camera selection |
| `isActive` | `boolean` | `true` | Whether camera is running |
| `zoom` | `number` | `2.0` (back) / `1.0` (front) | Zoom factor |
| `torch` | `boolean` | `false` | Flashlight during preview |
| `exposure` | `number` | `0` | EV compensation |
| `filmStyle` | `CameraFilmStyle` | `"normal"` | `"normal"`, `"mellow"`, `"nostalgic"`, `"bw"` |
| `depthEnabled` | `boolean` | `false` | Enable depth data capture |
| `certChain` | `SelfSignedCertChain \| ExistingCertChain` | Auto-generated | Custom certificate chain |
| `onOrientationChange` | `(orientation) => void` | — | Device orientation callback |

## ZCamera Methods (via ref)

| Method | Returns | Description |
|--------|---------|-------------|
| `takePhoto(options?)` | `Promise<ZPhoto>` | Capture + C2PA sign |
| `startVideoRecording(position?, options?)` | `Promise<StartNativeVideoRecordingResult>` | Begin recording |
| `stopVideoRecording()` | `Promise<StopNativeVideoRecordingResult>` | Stop + C2PA sign |
| `getMinZoom()` | `Promise<number>` | Min zoom factor |
| `getMaxZoom()` | `Promise<number>` | Max zoom factor |
| `getSwitchOverZoomFactors()` | `Promise<number[]>` | Lens switch points |
| `hasUltraWideCamera()` | `Promise<boolean>` | Ultra-wide available? |
| `getExposureRange()` | `Promise<{min, max}>` | EV range |
| `focusAtPoint(x, y)` | `void` | Tap-to-focus (0-1 coords) |
| `setZoomAnimated(factor)` | `void` | Smooth zoom (for gestures) |
| `isDepthSupported()` | `Promise<boolean>` | Depth capture available? |

## Required App Configuration

### Expo (app.json / app.config.ts)

```json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "com.example.myapp",
      "infoPlist": {
        "NSCameraUsageDescription": "Camera access is required to capture photos",
        "NSPhotoLibraryUsageDescription": "Photo library access is required to save photos"
      }
    },
    "plugins": [
      ["@succinctlabs/react-native-zcam1/app.plugin.js", { "enableProving": true }]
    ]
  }
}
```

### Environment Variables (.env)

```
EXPO_PUBLIC_APP_ID=TEAM_ID.com.example.myapp
```

## Common Mistakes

1. **Wrong `appId` format** — Must be `TEAM_ID.BUNDLE_ID`. Find your Team ID in Keychain Access under "Apple Development" certificate → "Organizational unit".

2. **Forgetting `initCapture()` before `ZCamera`** — `ZCamera` requires `captureInfo` prop. Call `initCapture()` in a `useEffect` and render `ZCamera` only after it resolves.

3. **Using `verifyProof()` on photos with only bindings** — Photos straight from capture have `succinct.bindings`. Only after proving do they get `succinct.proof`. Use `verifyBindings()` for un-proven photos.

4. **Not running `pod install`** — After `npm install`, run `cd ios && pod install`. After enabling proving, run `pod install` again.

5. **Simulator limitations** — App Attest doesn't work on simulator. The SDK generates mock attestations in dev, but these will fail real verification. Always test on a physical device.

6. **Missing Rust toolchain** — `npm install` compiles Rust to native code. You need `rustup` with iOS targets installed.

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `FFI function ... checksum mismatch` | Stale uniffi cache | `npm run clean` in package dir, then reinstall |
| `method_manifesteditor_... is not a function` | Same cache issue | Same fix as above |
| `RP ID mismatch` | Wrong `appId` in `initCapture()` | Use `TEAM_ID.BUNDLE_ID` format |
| `UNSUPPORTED_SERVICE` error | Running on simulator | Expected — SDK uses mock attestations on simulator |
| Build fails with Rust errors | Missing iOS targets | `rustup target add aarch64-apple-ios aarch64-apple-ios-sim` |
| Pod install fails | Missing Metal Toolchain | `xcodebuild -downloadComponent MetalToolchain` |
