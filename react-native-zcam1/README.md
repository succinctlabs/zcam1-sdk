# `react-native-zcam1`

React Native SDK for capturing, signing, verifying, and proving media authenticity on iOS using C2PA manifests and zero-knowledge proofs.

## Features

- **Authenticated capture** — Camera component backed by AVFoundation with Secure Enclave key management and App Attest device binding
- **C2PA signing** — Industry-standard content provenance manifests embedded at capture time
- **Verification** — Verify C2PA manifests and App Attest bindings
- **Zero-knowledge proofs** — Optional proving module to cryptographically guarantee authenticity (Groth16 via SP1)
- **Image picker** — Gallery and private folder browser with authenticity badges
- **Film styles** — Built-in and customizable GPU-accelerated filters

## Installation

```sh
npm install @succinctlabs/react-native-zcam1
```

### iOS setup

```sh
 pod install
```

#### Enabling the proving module

The proving module is optional and ships as a separate native framework. To enable it, set the following in your `Podfile.properties.json`:

```json
{
  "zcam1EnableProving": true
}
```

Or set the environment variable before running `pod install`:

```sh
ZCAM1_ENABLE_PROVING=1 pod install
```

If you are using Expo, add the config plugin to your `app.config.ts`:

```ts
export default {
  plugins: [
    ["@succinctlabs/react-native-zcam1/app.plugin.js", { enableProving: true }]
  ]
};
```

## Requirements

- iOS 16+
- React Native 0.81+
- React 19+
- New Architecture enabled

## License

MIT
