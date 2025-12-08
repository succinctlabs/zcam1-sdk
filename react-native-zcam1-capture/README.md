# `react-native-zcam1-capture`

`react-native-zcam1-capture` is the React Native Capture SDK used to acquire photos on-device and produce C2PA-signed assets bound to hardware-backed integrity signals.

At a high level it provides:

- A `ZCamera` React component that renders a native iOS camera preview and exposes a `takePhoto()` method.
- A device registration / attestation flow via `initDevice()` and `updateRegistration()`.
- A `ZPhoto` object representing both the original capture and the C2PA-signed output.

The Expo example app in `examples/capture` shows a complete usage flow.

## Installation

```bash
npm i react-native-zcam1-capture
cd ios && pod install
```

## Backend requirements

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

## Device initialization

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

## Handling the `ZCamera` component

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
