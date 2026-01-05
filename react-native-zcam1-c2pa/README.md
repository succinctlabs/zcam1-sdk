# `react-native-zcam1-c2pa`

`@succinctlabs/react-native-zcam1-c2pa` is the React Native C2PA utility SDK used by the ZCAM1 stack to inspect and validate C2PA manifests, and to work with certificate-chain utilities needed by higher-level signing/verification flows.

At a high level it provides:

- C2PA verification helpers for an asset at a local file `path` (e.g. `authenticityStatus`, `extractManifest`).
- Hash utilities (`computeHash`, `verifyHash`) used for binding and integrity checks.
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
- `computeHash(path, exclusions): ArrayBuffer` (throws `C2paError`)
- `verifyHash(path, dataHash): boolean` (throws `C2paError`)
- Types like `AuthenticityStatus`, `C2paError`, `DataHash`, `ManifestStore`, `Manifest`

`AuthenticityStatus` is an enum with the following values:

- `Unknown`
- `NoManifest`
- `InvalidManifest`
- `Bindings`
- `Proof`

### Certificate utilities

- `buildSelfSignedCertificate(leafJwk, certChainParams?): string` (throws `CertsError`)

This is primarily useful in development/testing contexts where you need a PEM chain without involving a backend PKI.

## Minimal verification usage

The following example checks an asset’s authenticity status and (when present) extracts the active manifest and reads its `dataHash`.

```ts
import {
  authenticityStatus,
  extractManifest,
  AuthenticityStatus,
  uniffiInitAsync,
} from "@succinctlabs/react-native-zcam1-c2pa";

const verifyAsset = async (path: string) => {
  // For web builds this may perform async initialization; on native it is a no-op.
  await uniffiInitAsync();

  const status = await authenticityStatus(path);

  switch (status) {
    case AuthenticityStatus.NoManifest:
      return { ok: false, status, reason: "No C2PA manifest found" };

    case AuthenticityStatus.InvalidManifest:
      return { ok: false, status, reason: "Manifest present but invalid" };

    case AuthenticityStatus.Unknown:
      return { ok: false, status, reason: "Unable to determine authenticity" };

    case AuthenticityStatus.Bindings:
    case AuthenticityStatus.Proof: {
      // Extract and inspect the active manifest
      const store = extractManifest(path);
      const manifest = store.activeManifest(); // throws on error / missing active manifest

      const dataHash = manifest.dataHash();

      return {
        ok: true,
        status,
        dataHash, // { name, alg, hash, exclusions }
        bindings: manifest.bindings(), // may be undefined
        proof: manifest.proof(), // may be undefined
      };
    }
  }
};
```
