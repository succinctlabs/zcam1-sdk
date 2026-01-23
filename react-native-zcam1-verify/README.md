# `react-native-zcam1-verify`

`@succinctlabs/react-native-zcam1-verify` is the React Native Verify SDK used to verify that a C2PA-signed image is authentic.

At a high level it provides:

- A `VerifiableFile` class that:
  - Extracts the C2PA manifest from a given file path or URI.
  - Exposes `verifyBindings(appAttestProduction: boolean)` to validate `succinct.bindings` (App Attest) against the current file hash and capture metadata.
  - Exposes `verifyProof(appId: string)` to validate `succinct.proof` against the current file hash, your app identifier, and a pinned Apple attestation root certificate.
  - Exposes helpers like `dataHash()` (base64 of the computed file hash) and `captureMetadata()`.

Note: the SDK does not currently expose a `verifyHash()` method. Integrity is checked implicitly because `verifyBindings(...)` / `verifyProof(...)` recompute the file hash and verify the cryptographic binding to that hash (tampering should cause these checks to fail).

Also note: `verifyProof(appId)` will throw if the file does not contain a `succinct.proof` assertion, and `verifyBindings(appAttestProduction)` can throw if required bindings/metadata are missing. Use presence checks (via the parsed manifest) and/or `try/catch` if you’re verifying arbitrary user-selected images.

## Installation

```bash
npm i @succinctlabs/react-native-zcam1-verify
cd ios && pod install
```

## Basic usage

A typical usage pattern is:

1. Let the user pick a photo (for example, using `react-native-image-picker`).
2. Construct `new VerifiableFile(uriOrPath)` from the selected asset.
3. If you expect a proof (`succinct.proof`), call `verifyProof(appId)`.
4. If you expect bindings only (`succinct.bindings`), call `verifyBindings(appAttestProduction)`.

```/dev/null/VerifyUsage.tsx#L1-110
const pickAndVerify = async () => {
  const result = await launchImageLibrary({
    mediaType: "photo",
    selectionLimit: 1,
  });

  const asset = result.assets?.[0];
  if (!asset || !asset.uri) return;

  const file = new VerifiableFile(asset.uri);

  // Your app identifier (Team ID + Bundle ID), e.g. "NLS5R4YCGX.com.example.app"
  const appId = process.env.EXPO_PUBLIC_APP_ID!;

  // If you're verifying photos captured in development mode, pass false.
  const appAttestProduction = false;

  // Optional: computed hash (base64) and capture metadata (if present)
  const dataHash = file.dataHash();
  const captureMetadata = file.captureMetadata();

  // Proof verification (only if succinct.proof exists)
  let proofValid: boolean | undefined = undefined;
  if (file.activeManifest.proof() !== undefined) {
    try {
      proofValid = file.verifyProof(appId);
    } catch (e) {
      console.warn("verifyProof failed", e);
    }
  }

  // Bindings verification (only if succinct.bindings exists)
  let bindingsValid: boolean | undefined = undefined;
  if (file.activeManifest.bindings() !== undefined) {
    try {
      bindingsValid = file.verifyBindings(appAttestProduction);
    } catch (e) {
      console.warn("verifyBindings failed", e);
    }
  }

  console.log("Proof valid:", proofValid);
  console.log("Bindings valid:", bindingsValid);
  console.log("Data hash (base64):", dataHash);
  console.log("Capture metadata:", captureMetadata);
};
```

You can then surface these results in your UI (for example, by showing a “verified” badge when verification succeeds for the mode you expect: proof or bindings).
