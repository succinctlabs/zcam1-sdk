# `react-native-zcam1-verify`

`react-native-zcam1-verify` is the React Native Verify SDK used to check that a C2PA-signed image with an embedded proof is authentic. It verifies both:

- The file’s content hash, as recorded in the C2PA manifest.
- The zero-knowledge proof bound to that hash and a pinned Apple attestation root.

At a high level it provides:

- A `VerifiableFile` class that:
  - Extracts the C2PA manifest from a given file path or URI.
  - Exposes `verifyHash()` to confirm the file’s contents match the manifest’s data hash.
  - Exposes `verifyProof()` to validate the embedded proof against the file’s hash and a fixed Apple root certificate.

## Installation

```bash
npm i react-native-zcam1-verify
cd ios && pod install
```

## Basic usage

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
