# ZCAM1 Verify SDK — Integration Guide for AI Assistants

This document is optimized for LLMs and AI coding assistants helping developers integrate `@succinctlabs/zcam1-verify`.

## Package Info

- **npm:** `@succinctlabs/zcam1-verify`
- **Peer dependency:** `neverthrow` (required)
- **Platforms:** Browser (WASM) and Node.js
- **Purpose:** Verify C2PA-signed photos/videos captured with the ZCAM1 React Native SDK
- **Docs:** https://zcamdocs.succinct.tools/

## What This SDK Does

Verifies that photos/videos were authentically captured on a real iOS device using the ZCAM1 camera SDK. It checks:
1. **C2PA manifest integrity** — the file hasn't been tampered with
2. **Apple App Attest bindings** — the capture device is genuine (for `succinct.bindings`)
3. **Zero-knowledge proofs** — cryptographic proof of authentic capture (for `succinct.proof`)

## Important: Error Handling with neverthrow

Most methods return `ResultAsync<T, Error>` from the `neverthrow` library, NOT regular Promises. You must handle them with `.isOk()` / `.isErr()`:

```typescript
// CORRECT:
const result = await file.verifyProof(appId);
if (result.isOk()) {
  console.log("Valid:", result.value);
} else {
  console.error("Error:", result.error.message);
}

// WRONG — will not work:
const isValid = await file.verifyProof(appId); // isValid is a Result, not boolean
```

Exception: `authenticityStatus()` and `dataHash()` return regular Promises.

## Browser Integration

### Setup

```typescript
// Requires top-level await support (ESM modules, Vite, Next.js app router, etc.)
import { VerifiableFile, AuthenticityStatus } from "@succinctlabs/zcam1-verify";
```

The package initializes WASM modules at import time using top-level `await`. Ensure your bundler supports this (Vite, webpack 5+ with experiments.topLevelAwait, etc.).

### Complete Browser Example

```typescript
import { VerifiableFile, AuthenticityStatus } from "@succinctlabs/zcam1-verify";

async function verifyUploadedFile(file: File): Promise<{
  status: string;
  metadata?: any;
}> {
  const verifiable = new VerifiableFile(file);
  const status = await verifiable.authenticityStatus();

  switch (status) {
    case AuthenticityStatus.Proof: {
      const result = await verifiable.verifyProof("TEAM_ID.com.example.app");
      if (result.isOk() && result.value) {
        const metadata = await verifiable.captureMetadata();
        return {
          status: "authentic",
          metadata: metadata.isOk() ? metadata.value : undefined,
        };
      }
      return { status: "invalid_proof" };
    }

    case AuthenticityStatus.Bindings: {
      const result = await verifiable.verifyBindings(false); // false = development
      if (result.isOk() && result.value) {
        return { status: "authentic_bindings" };
      }
      return { status: "invalid_bindings" };
    }

    case AuthenticityStatus.InvalidManifest:
      return { status: "invalid_manifest" };

    case AuthenticityStatus.NoManifest:
      return { status: "no_manifest" };
  }
}
```

### React File Upload Example

```tsx
import { VerifiableFile, AuthenticityStatus } from "@succinctlabs/zcam1-verify";

function VerifyUpload() {
  const [result, setResult] = useState<string>();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const verifiable = new VerifiableFile(file);
    const status = await verifiable.authenticityStatus();
    setResult(`Status: ${AuthenticityStatus[status]}`);

    if (status === AuthenticityStatus.Proof) {
      const proofResult = await verifiable.verifyProof("TEAM_ID.com.example.app");
      setResult(proofResult.isOk() ? "Verified!" : `Failed: ${proofResult.error.message}`);
    }
  };

  return (
    <div>
      <input type="file" accept="image/*,video/*" onChange={handleFile} />
      {result && <p>{result}</p>}
    </div>
  );
}
```

## Node.js Integration

### Setup

```typescript
// Import from the /node subpath
import { VerifiableBuffer, AuthenticityStatus } from "@succinctlabs/zcam1-verify/node";
import { readFileSync } from "fs";
```

### Complete Node.js Example

```typescript
import { VerifiableBuffer, AuthenticityStatus } from "@succinctlabs/zcam1-verify/node";
import { readFileSync } from "fs";

async function verifyFile(filePath: string, mimeType: string) {
  const buffer = readFileSync(filePath);
  const file = new VerifiableBuffer(buffer, mimeType);

  const status = await file.authenticityStatus();
  console.log("Status:", AuthenticityStatus[status]);

  if (status === AuthenticityStatus.Proof) {
    const result = await file.verifyProof("TEAM_ID.com.example.app");
    if (result.isOk()) {
      console.log("Proof valid:", result.value);

      const metadata = await file.captureMetadata();
      if (metadata.isOk()) {
        console.log("Captured at:", metadata.value.when);
        console.log("Device:", metadata.value.parameters.deviceMake);
      }
    } else {
      console.error("Proof invalid:", result.error.message);
    }
  }
}

await verifyFile("photo.jpg", "image/jpeg");
```

## API Reference

### VerifiableFile (Browser)

| Method | Returns | Description |
|--------|---------|-------------|
| `new VerifiableFile(file: File)` | — | Constructor. Pass a browser File object. |
| `authenticityStatus()` | `Promise<AuthenticityStatus>` | Check what type of verification is available |
| `verifyBindings(production)` | `ResultAsync<boolean, Error>` | Verify Apple App Attest bindings |
| `verifyProof(appId)` | `ResultAsync<boolean, Error>` | Verify ZK proof |
| `captureMetadata()` | `ResultAsync<CaptureMetadata, Error>` | Extract capture timestamp + device info |
| `dataHash()` | `Promise<Uint8Array>` | Get file content hash |
| `c2paReader()` | `ResultAsync<Reader, Error>` | Access underlying C2PA reader |
| `bindings()` | `ResultAsync<Record<string, any>, Error>` | Raw bindings assertion data |
| `proof()` | `ResultAsync<Record<string, any>, Error>` | Raw proof assertion data |

### VerifiableBuffer (Node.js)

| Method | Returns | Description |
|--------|---------|-------------|
| `new VerifiableBuffer(buffer: Buffer, mimeType: string)` | — | Constructor. Pass file buffer + MIME type. |
| `authenticityStatus()` | `Promise<AuthenticityStatus>` | Same as VerifiableFile |
| `verifyBindings(production)` | `ResultAsync<boolean, Error>` | Same as VerifiableFile |
| `verifyProof(appId)` | `ResultAsync<boolean, Error>` | Same as VerifiableFile |
| `captureMetadata()` | `ResultAsync<CaptureMetadata, Error>` | Same as VerifiableFile |
| `dataHash()` | `Promise<Uint8Array>` | Same as VerifiableFile |

### AuthenticityStatus Enum

```typescript
AuthenticityStatus.Bindings       // Has Apple App Attest bindings (pre-proof)
AuthenticityStatus.Proof          // Has ZK proof (post-proof)
AuthenticityStatus.InvalidManifest // C2PA manifest exists but missing ZCAM1 assertions
AuthenticityStatus.NoManifest     // No C2PA manifest found
```

### CaptureMetadata Type

```typescript
interface CaptureMetadata {
  when: string; // ISO 8601 timestamp
  parameters: PhotoMetadataInfo | VideoMetadataInfo;
}

// Check which type:
if ("focalLength" in metadata.parameters) {
  // PhotoMetadataInfo — has focalLength, iso, exposureTime, depthOfField
} else if ("frameRate" in metadata.parameters) {
  // VideoMetadataInfo — has frameRate, durationSeconds, videoCodec
}

// Common fields on both:
// deviceMake, deviceModel, softwareVersion, authenticityData
```

## Common Mistakes

1. **Treating ResultAsync as Promise** — `verifyBindings()`, `verifyProof()`, and `captureMetadata()` return `ResultAsync`, not `Promise`. Use `.isOk()` to check success, `.value` to get the result, `.error` to get the error.

2. **Missing `neverthrow` dependency** — Install it: `npm install neverthrow`

3. **Wrong import path for Node.js** — Use `@succinctlabs/zcam1-verify/node` (not just `@succinctlabs/zcam1-verify`) for Node.js. The default export is browser-only.

4. **Missing top-level await support** — The browser package uses `await` at module scope for WASM initialization. Your bundler must support this.

5. **Wrong `appId` for `verifyProof()`** — Must match the `appId` used during capture. Format: `TEAM_ID.BUNDLE_ID`.

6. **Using `verifyProof()` on binding-only photos** — Photos from capture have `succinct.bindings`. Only after proving do they get `succinct.proof`. Check `authenticityStatus()` first.

7. **MIME type for Node.js** — `VerifiableBuffer` requires the correct MIME type. Common values: `"image/jpeg"`, `"image/png"`, `"video/quicktime"` (.mov).

## Supported File Types

- JPEG images (`image/jpeg`)
- PNG images (`image/png`)
- QuickTime videos (`video/quicktime` / `.mov`)
- MP4 videos (`video/mp4`)
