# `react-native-zcam1-c2pa`

`@succinctlabs/react-native-zcam1-c2pa` is the React Native C2PA utility SDK used by the ZCAM1 stack to inspect and validate C2PA manifests, and to work with certificate-chain utilities needed by higher-level signing/verification flows.

At a high level it provides:

- C2PA verification helpers for an asset at a local file `path` (e.g. `authenticityStatus`, `extractManifest`).
- Hash utility (`computeHash`) used for binding and integrity checks (SHA-256 over the asset with any embedded C2PA manifest store removed).
- Certificate-chain helper(s) (currently `buildSelfSignedCertificate(...)`) useful for development/testing and tooling.

This package is typically consumed by higher-level SDKs in this repo. Most apps should depend on those directly unless you’re building custom verification or tooling.

## Installation

```bash
npm i @succinctlabs/react-native-zcam1-c2pa
cd ios && pod install
```

## API overview

### C2PA utilities

Commonly used exports include:

- `authenticityStatus(path): Promise<AuthenticityStatus>`
- `extractManifest(path): ManifestStore` (throws `C2paError`)
- `computeHash(path): ArrayBuffer` (throws `C2paError`) — raw SHA-256 bytes (with any embedded C2PA manifest store removed before hashing)
- Types like `AuthenticityStatus`, `C2paError`, `ManifestStore`, `Manifest`

`AuthenticityStatus` is an enum with the following values:

- `Unknown`
- `NoManifest`
- `InvalidManifest`
- `Bindings`
- `Proof`

### Certificate utilities

- `buildSelfSignedCertificate(leafJwk, certChainParams?): string` (throws `CertsError`)

This is primarily useful in development/testing contexts where you need a PEM chain without involving a backend PKI.
