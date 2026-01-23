# `react-native-zcam1-capture`

`react-native-zcam1-capture` is the React Native Capture SDK used to acquire photos on-device and produce C2PA-signed assets bound to hardware-backed integrity signals.

At a high level it provides:

- A `ZCamera` React component that renders a native iOS camera preview and exposes a `takePhoto()` method.
- A device key + attestation initialization flow via `initCapture()` and `updateRegistration()`.
- A `ZPhoto` object representing both the original capture and the C2PA-signed output.

The Expo example app in `examples/capture` shows a complete usage flow.

## Installation

```bash
npm i react-native-zcam1-capture
cd ios && pod install
```

## Certificates and attestation

This SDK performs device key generation + App Attest attestation locally via `@pagopa/io-react-native-integrity`.

For C2PA signing certificates:

- By default, `ZCamera` will generate a self-signed certificate chain (intended for development/testing).
- If you have a real certificate chain (e.g. issued by your own PKI/backend), pass it via the `certChain` prop as an `ExistingCertChain` (`{ pem: string }`).

On simulators, App Attest is unavailable and the SDK falls back to mock values for development.

## Device initialization

Before rendering `ZCamera` you must initialize the device and obtain a `CaptureInfo` object. This is typically done once on app startup.

The recommended flow (as used in `examples/capture/app/index.tsx`) is:

1. Derive your `Settings` from configuration (e.g. Expo env vars):

   - `appId` – e.g. from `process.env.EXPO_PUBLIC_APP_ID`
   - `production` – `false` for development / staging, `true` for production

2. Call `initCapture(settings)` once and store the result in React state:

   - On success you receive a `CaptureInfo` containing:
     - The hardware-backed `deviceKeyId`.
     - The secure enclave `contentKeyId` and `contentPublicKey`.
     - A fresh `attestation` string used later when embedding C2PA manifests.

3. Pass `captureInfo` into the `ZCamera` component.

In pseudocode (mirroring the example app):

- Maintain `const [captureInfo, setCaptureInfo] = useState<CaptureInfo | undefined>()`.
- Build `const settings = useMemo(() => ({ appId, production: false }), [appId])`.
- In a `useEffect`, call `const info = await initCapture(settings); setCaptureInfo(info);`.

Only render `ZCamera` once `captureInfo` is available.

## Handling the `ZCamera` component

To use `ZCamera`, create a ref to the component, define an async `capture` handler that calls `takePhoto(options)`, and render the camera inside your layout. The `takePhoto()` call returns a `ZPhoto` whose `path` points to the C2PA-signed asset you can then persist or upload.

Notes:

- `certChain` is optional. If omitted, the SDK generates a self-signed certificate chain (intended for development/testing).
- `takePhoto()` supports options like:
  - `format`: `"jpeg"` (default) or `"dng"`
  - `flash`: a `FlashMode` value (e.g. `"off"`)
  - `includeDepthData`: `boolean` (default `false`) to include depth info (when available) in embedded capture metadata

```/dev/null/ZCameraUsage.tsx#L1-60
const camera = useRef<ZCamera>(null);

const capture = async () => {
  const photo = await camera.current?.takePhoto({
    format: "jpeg",
    flash: "off",
    includeDepthData: false,
  });

  // Persist or upload the signed asset at photo.path
};

return (
  <SafeAreaView style={{ flex: 1 }}>
    <View style={{ flex: 1 }}>
      <ZCamera
        ref={camera}
        captureInfo={captureInfo}
        // Optional: provide a real signing chain (PEM) instead of using the default self-signed chain.
        // certChain={{ pem: signingCertChainPem }}
      />
    </View>
    <Button title="Capture" onPress={capture} />
  </SafeAreaView>
);
```
