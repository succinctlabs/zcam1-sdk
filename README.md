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

## Prerequisites

To build the iOS UniFFI-based C2PA bindings used by `react-native-zcam1-c2pa`, you only need the Rust toolchain with the iOS targets installed via `rustup`:

```/dev/null/ios-rust-targets.sh#L1-3
rustup target add aarch64-apple-ios aarch64-apple-ios-sim
```

> [!CAUTION]
> The UniFFI binidings are built when the React Native libraries are installed with `npm install`. It's expected to takes a lot of time.


## `react-native-zcam1-capture`

`react-native-zcam1-capture` is the React Native Capture SDK used to acquire photos on-device and produce C2PA-signed assets bound to hardware-backed integrity signals.

At a high level it provides:

- A `ZCamera` React component that renders a native iOS camera preview and exposes a `takePhoto()` method.
- A device registration / attestation flow via `initDevice()` and `updateRegistration()`.
- A `ZPhoto` object representing both the original capture and the C2PA-signed output.

The Expo example app in `examples/capture` shows a complete usage flow.

### Installation (React Native / Expo)

Add the capture SDK and its dependencies to your app:

- Add the package: `react-native-zcam1-capture`

Then run CocoaPods installation for iOS:

- From your app root: `cd ios && pod install`

Make sure your iOS project is configured for the camera (e.g. `NSCameraUsageDescription` in `Info.plist`).

### Backend requirements

The capture SDK expects a backend that can:

- Provide a certificate chain for the device content key.
- Handle device registration and attestation.

In particular, the `initDevice()` / `updateRegistration()` flow invokes the following HTTP endpoints on `backendUrl`:

- `POST {backendUrl}/ios/register/init` with body `{ keyId }`  
  Returns a string `challenge` used for attestation.
- `POST {backendUrl}/ios/register/validate` with body:
  - `attestation`: attestation blob from `@pagopa/io-react-native-integrity`
  - `keyId`: hardware key identifier
  - `appId`: your application identifier (from `Settings.appId`)
  - `production`: boolean flag indicating whether this is a production registration

Your backend is responsible for validating the attestation, binding it to the device, and issuing/providing the certificate chain used for C2PA signing.

### Device initialization

Before rendering `ZCamera` you must initialize the device and obtain a `DeviceInfo` object. This is typically done once on app startup.

The recommended flow (as used in `examples/capture/app/index.tsx`) is:

1. Derive your `Settings` from configuration (e.g. Expo env vars):

   - `appId` – e.g. from `process.env.EXPO_PUBLIC_APP_ID`
   - `backendUrl` – e.g. from `process.env.EXPO_PUBLIC_BACKEND_URL`
   - `production` – `false` for development / staging, `true` for production

2. Call `initDevice(settings)` once and store the result in React state:

   - On success you receive a `DeviceInfo` containing:
     - The hardware-backed `deviceKeyId`.
     - The secure enclave `contentKeyId`.
     - The certificate chain (`certChainPem`).
     - A fresh `attestation` structure used later when embedding C2PA manifests.

3. Pass both `deviceInfo` and `settings` into the `ZCamera` component.

In pseudocode (mirroring the example app):

- Maintain `const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | undefined>()`.
- Build `const settings = useMemo(() => ({ appId, backendUrl, production: false }), [appId])`.
- In a `useEffect`, call `const info = await initDevice(settings); setDeviceInfo(info);`.

Only render `ZCamera` once `deviceInfo` is available.

### Handling the `ZCamera` component

To use `ZCamera`, create a ref to the component, define an async `capture` handler that calls `takePhoto()`, and render the camera inside your layout. The `takePhoto()` call returns a `ZPhoto` whose `path` points to the C2PA-signed asset you can then persist or upload.

```/dev/null/ZCameraUsage.tsx#L1-40
const camera = useRef<ZCamera>(null);

const capture = async () => {
  const photo = await camera.current?.takePhoto();
  if (!photo) return;

  // Persist or upload the signed asset at photo.path
};

return (
  <SafeAreaView style={{ flex: 1 }}>
    <View style={{ flex: 1 }}>
      <ZCamera ref={camera} deviceInfo={deviceInfo} settings={settings} />
    </View>
    <Button title="Capture" onPress={capture} />
  </SafeAreaView>
);
```

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

### Device initialization

Before you can embed proofs, you must initialize the device and obtain a `DeviceInfo`:

- Build a `settings` object that includes:
  - `backendUrl` (for example from an environment variable like `EXPO_PUBLIC_BACKEND_URL`).
  - `production` (typically `false` for development, `true` for production).
- Call `initDevice(settings)` once (e.g. on app startup) and store the result in React state.

A typical flow in React:

```/dev/null/ProveInitUsage.tsx#L1-40
const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | undefined>(undefined);

const settings = useMemo(
  () => ({
    backendUrl: process.env.EXPO_PUBLIC_BACKEND_URL!,
    production: false,
  }),
  [],
);

useEffect(() => {
  async function fetchDevice() {
    const info = await initDevice(settings);
    setDeviceInfo(info);
  }

  fetchDevice();
}, [settings]);
```

Only call `embedProof()` once `deviceInfo` is available.

### Selecting an image and embedding a proof

`embedProof()` takes the path or URI of an existing image, the `DeviceInfo`, and the same `settings` used at initialization. The flow is:

1. Let the user pick an existing photo (e.g. using `react-native-image-picker`).
2. Take the selected asset’s URI or file path and pass it to `embedProof(...)`.
3. Receive a new `destinationPath` for the JPEG with the updated C2PA manifest.
4. Persist or save this new asset (for example with `@react-native-camera-roll/camera-roll`).

Minimal usage:

```/dev/null/ProveEmbedUsage.tsx#L1-60
const pickAndProve = async () => {
  const result = await launchImageLibrary({
    mediaType: "photo",
    selectionLimit: 1,
  });

  const asset = result.assets?.[0];
  if (!asset || !asset.uri || !deviceInfo) return;

  // Embed the proof into the C2PA manifest of the selected image.
  const outputPath = await embedProof(asset.uri, deviceInfo, settings);

  // Optionally save the newly signed image.
  await CameraRoll.saveAsset(outputPath);
};
```

Here:

- `asset.uri` may be a `file://` URI; `embedProof()` normalizes this internally.
- The input image must already contain a C2PA manifest with a `succinct.bindings` assertion; otherwise `embedProof()` will throw an error indicating no device bindings were found.

## `react-native-zcam1-verify`

`react-native-zcam1-verify` is the React Native Verify SDK used to check that a C2PA-signed image with an embedded proof is authentic. It verifies both:

- The file’s content hash, as recorded in the C2PA manifest.
- The zero-knowledge proof bound to that hash and a pinned Apple attestation root.

At a high level it provides:

- A `VerifiableFile` class that:
  - Extracts the C2PA manifest from a given file path or URI.
  - Exposes `verifyHash()` to confirm the file’s contents match the manifest’s data hash.
  - Exposes `verifyProof()` to validate the embedded proof against the file’s hash and a fixed Apple root certificate.

### Basic usage

A typical usage pattern is:

1. Let the user pick a photo (for example, using `react-native-image-picker`).
2. Construct `new VerifiableFile(uriOrPath)` from the selected asset.
3. Call `verifyHash()` and `verifyProof()` and act on the returned booleans.

```/dev/null/VerifyUsage.tsx#L1-40
const pickAndVerify = async () => {
  const result = await launchImageLibrary({
    mediaType: "photo",
    selectionLimit: 1,
  });

  const asset = result.assets?.[0];
  if (!asset || !asset.uri) return;

  const file = new VerifiableFile(asset.uri);

  const isHashValid = file.verifyHash();
  const isProofValid = file.verifyProof();

  console.log("Is hash valid:", isHashValid);
  console.log("Is proof valid:", isProofValid);
};
```

You can then surface these results in your UI (for example, by showing a “verified” badge when both checks succeed).
