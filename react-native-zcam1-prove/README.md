# `react-native-zcam1-prove`

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

## Installation

```bash
npm i react-native-zcam1-prove
cd ios && pod install
```

## Backend requirements

The proving SDK expects a backend that can:

- Provide a certificate chain for the device content key.
- Generate cryptographic proofs for device bindings.

In particular, the `initDevice()` / `embedProof()` flow invokes the following HTTP endpoints on `backendUrl`:

- `POST {backendUrl}/ios/request-proof` with body:
  - `attestation`: attestation blob from the C2PA manifest
  - `assertion`: assertion blob from the bindings
  - `keyId`: device key identifier
  - `dataHash`: base64-encoded hash of the image data
  - `appId`: application identifier
  - `challenge`: base64-encoded challenge
  - `appAttestProduction`: boolean flag indicating production mode  
  Returns a plain text `requestId` for polling.
  
- `GET {backendUrl}/ios/proof/{requestId}`  
  Returns `202 Accepted` while processing, `200 OK` with binary proof data when ready.
  
- `GET {backendUrl}/ios/vk`  
  Returns the verification key hash as plain text.

Your backend is responsible for validating device bindings, generating ZK proofs, and providing the verification key hash used in the C2PA proof assertion.

## Device initialization

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

## Selecting an image and embedding a proof

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
