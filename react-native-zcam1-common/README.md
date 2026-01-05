# `react-native-zcam1-common`

`@succinctlabs/react-native-zcam1-common` provides low-level primitives used by the ZCAM1 React Native SDKs.

At a high level it provides:

- A stable content key lookup / generation helper (`getContentPublicKey()`), backed by the device secure hardware via `@pagopa/io-react-native-crypto`.
- A deterministic identifier derivation (`getSecureEnclaveKeyId(...)`) for EC public keys (used as a key id / handle in higher-level flows).

This package is typically consumed by higher-level packages (e.g. the capture SDK). Most apps should depend on those directly unless you’re building custom integrations.

## Installation

```bash
npm i @succinctlabs/react-native-zcam1-common
cd ios && pod install
```
