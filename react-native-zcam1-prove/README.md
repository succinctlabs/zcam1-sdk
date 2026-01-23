# `react-native-zcam1-prove`

`@succinctlabs/react-native-zcam1-prove` is the React Native Proving SDK used to take an existing C2PA-signed image (typically produced by `@succinctlabs/react-native-zcam1-capture`), generate a cryptographic proof for its bindings, and embed that proof back into the C2PA manifest.

At a high level it provides:

- A `ProverProvider` + `useProver()` hook that initializes a `ProvingClient` and (optionally) polls in-flight proof requests.
- A `ProvingClient` class with:
  - `requestProof(uriOrPath): Promise<string>` → returns a `requestId`
  - `getProofStatus(requestId): Promise<ProofRequestStatus>` → poll for `FulfillmentStatus` and (when ready) proof bytes
  - `embedProof(uriOrPath, proof): Promise<string>` → writes a new file with `succinct.proof` embedded
  - `waitAndEmbedProof(uriOrPath): Promise<string>` → convenience helper that requests, polls, then embeds automatically

Embedding a proof updates the C2PA manifest by adding a `succinct.proof` assertion containing the proof bytes and a verification key hash, then re-signs the asset and writes a new file.

Note: embedding a proof rebuilds the output manifest and does **not** carry forward the original `succinct.bindings` assertion; it adds `succinct.proof` and re-signs the asset.

## Installation

```bash
npm i @succinctlabs/react-native-zcam1-prove
cd ios && pod install
```

## Proof generation requirements

Proof generation is performed by the native proving client. This package exposes a JS-friendly API (`ProvingClient`) for requesting proofs, polling status, and embedding proofs back into images.

Configuration is provided via `Settings`:

- `production: boolean` — whether to use production mode for App Attest verification on the proving side
- `privateKey?: string` — when provided, initializes a real proving client; when omitted, the SDK uses a mock proving client (development/testing only)
- `certChain?: SelfSignedCertChain | ExistingCertChain` — certificate chain used for re-signing the updated C2PA manifest:
  - If omitted, a self-signed certificate chain is generated (development/testing).
  - Provide `{ pem: string }` to use an existing PEM chain.

If the app that proves photos is also the app that captures them, you typically don’t need a separate “prove-side device init” step: capture-time keys/attestation are already embedded in the photo’s `succinct.bindings`.

## Provider setup (recommended)

Wrap your app with `ProverProvider` once (e.g. near the root). This initializes the proving client and makes it available via `useProver()`.

```/dev/null/ProverProviderSetup.tsx#L1-40
import { ProverProvider } from "@succinctlabs/react-native-zcam1-prove";

export function AppRoot() {
  return (
    <ProverProvider
      settings={{
        production: false,
        // Optional: enables a real proving client. If omitted, a mock proving client is used (dev/test only).
        // privateKey: process.env.EXPO_PUBLIC_PROVER_PRIVATE_KEY,
        // Optional: provide a real signing chain (PEM) instead of using the default self-signed chain.
        // certChain: { pem: signingCertChainPem },
      }}
    >
      {/* Your app */}
    </ProverProvider>
  );
}
```

Inside your screens/components, call `useProver()` to access `provingClient`, `isInitializing`, and `error`.

## Selecting an image and embedding a proof

You embed proofs by:
1. Requesting a proof for an existing photo (`requestProof`)
2. Polling for completion (`getProofStatus` or `useProofRequestStatus`)
3. Embedding the resulting proof into the photo (`embedProof`), producing a newly signed output file

For convenience, you can also use `waitAndEmbedProof()` to do all three steps.

### Minimal usage (one-shot)

```/dev/null/ProveEmbedUsage.tsx#L1-70
import { CameraRoll } from "@react-native-camera-roll/camera-roll";
import { launchImageLibrary } from "react-native-image-picker";
import { useProver } from "@succinctlabs/react-native-zcam1-prove";

export function PickAndProveButton() {
  const { provingClient, isInitializing } = useProver();

  const pickAndProve = async () => {
    const result = await launchImageLibrary({
      mediaType: "photo",
      selectionLimit: 1,
    });

    const asset = result.assets?.[0];
    if (!asset?.uri || !provingClient) return;

    // Requests the proof, polls until ready, and embeds it into a new signed file.
    const outputPath = await provingClient.waitAndEmbedProof(asset.uri);

    // Optionally save the newly signed image.
    await CameraRoll.saveAsset(outputPath);
  };

  // Render your UI; disable while initializing if desired.
  return null;
}
```

### Two-step usage (recommended UX)

Use `requestProof()` + `useProofRequestStatus()` to show progress, then call `embedProof()` once the proof is ready.

Notes:

- Input `uri` may be a `file://` URI; the SDK normalizes this internally.
- The input image must already contain a C2PA manifest with `succinct.bindings`; otherwise proof request/embedding will fail.

A concrete two-step flow looks like this:

```/dev/null/ProveTwoStepUsage.tsx#L1-120
import { useEffect, useState } from "react";
import { CameraRoll } from "@react-native-camera-roll/camera-roll";
import { launchImageLibrary } from "react-native-image-picker";
import {
  FulfillmentStatus,
  useProofRequestStatus,
  useProver,
} from "@succinctlabs/react-native-zcam1-prove";

export function PickProveWithProgress() {
  const { provingClient } = useProver();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  const { fulfillementStatus, proof } = useProofRequestStatus(requestId);

  const pick = async () => {
    const result = await launchImageLibrary({
      mediaType: "photo",
      selectionLimit: 1,
    });
    const asset = result.assets?.[0];
    if (!asset?.uri) return;

    setPhotoUri(asset.uri);
    setRequestId(null);
  };

  const request = async () => {
    if (!provingClient || !photoUri) return;
    const id = await provingClient.requestProof(photoUri);
    setRequestId(id);
  };

  useEffect(() => {
    if (!provingClient) return;
    if (!photoUri) return;

    // When the proof bytes are ready, embed them into a new signed output file.
    if (fulfillementStatus === FulfillmentStatus.Fulfilled && proof) {
      provingClient
        .embedProof(photoUri, proof)
        .then((outputPath) => CameraRoll.saveAsset(outputPath));
    }
  }, [provingClient, photoUri, fulfillementStatus, proof]);

  return null;
}
```
