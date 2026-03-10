# @succinctlabs/zcam1-verify

Browser and Node.js verification SDK for ZCAM1-authenticated media files. This package enables client-side verification of C2PA-signed images and videos that contain either Apple App Attestation bindings or zero-knowledge proofs of authenticity.

## Installation

```bash
npm install @succinctlabs/zcam1-verify neverthrow
```

> **Note:** `neverthrow` is a peer dependency. Methods like `verifyBindings()` and `verifyProof()` return `ResultAsync<T, Error>` which you handle with `.isOk()` / `.isErr()`.

## Browser Usage

The browser entry point uses WASM and requires top-level `await` support:

```typescript
import { VerifiableFile, AuthenticityStatus } from "@succinctlabs/zcam1-verify";

// VerifiableFile works with browser File objects
const input = document.querySelector<HTMLInputElement>("#file-input");
const file = new VerifiableFile(input.files[0]);

// Check what type of verification is available
const status = await file.authenticityStatus();

if (status === AuthenticityStatus.Proof) {
  const result = await file.verifyProof("TEAM_ID.com.example.app");
  if (result.isOk()) {
    console.log("Proof valid:", result.value);
  } else {
    console.error("Verification failed:", result.error.message);
  }
}
```

## Node.js Usage

The Node.js entry point provides `VerifiableBuffer` for working with file buffers:

```typescript
import { VerifiableBuffer, AuthenticityStatus } from "@succinctlabs/zcam1-verify/node";
import { readFileSync } from "fs";

const buffer = readFileSync("photo.jpg");
const file = new VerifiableBuffer(buffer, "image/jpeg");

const status = await file.authenticityStatus();
console.log("Status:", status);

if (status === AuthenticityStatus.Bindings) {
  const result = await file.verifyBindings(false); // false = development
  if (result.isOk()) {
    console.log("Bindings valid:", result.value);
  }
}
```

## API Reference

### `VerifiableFile` (Browser)

The main class for verifying ZCAM1-authenticated media files in the browser.

#### Constructor

```typescript
new VerifiableFile(file: File)
```

**Parameters:**
- `file` - A browser `File` object (typically an image or video with C2PA metadata)

#### Methods

##### `authenticityStatus(): Promise<AuthenticityStatus>`

Determines the authenticity status of the file based on its C2PA manifest.

**Returns:** A promise resolving to one of:
- `AuthenticityStatus.Bindings` - File contains Apple App Attestation bindings
- `AuthenticityStatus.Proof` - File contains a zero-knowledge proof
- `AuthenticityStatus.InvalidManifest` - Manifest exists but lacks required assertions
- `AuthenticityStatus.NoManifest` - No C2PA manifest found

##### `verifyBindings(production: boolean): ResultAsync<boolean, Error>`

Verifies the Apple App Attestation bindings by validating the attestation and assertion against the photo hash and capture metadata.

**Parameters:**
- `production` - `true` for production Apple App Attestation, `false` for development

**Returns:** `ResultAsync<boolean, Error>` — use `.isOk()` to check success

##### `verifyProof(appId: string): ResultAsync<boolean, Error>`

Verifies the zero-knowledge proof assertion using Groth16 verification.

**Parameters:**
- `appId` - The application identifier (format: `TEAM_ID.BUNDLE_ID`)

**Returns:** `ResultAsync<boolean, Error>` — use `.isOk()` to check success

##### `captureMetadata(): ResultAsync<CaptureMetadata, Error>`

Extracts capture metadata from the C2PA manifest.

**Returns:** `ResultAsync<CaptureMetadata, Error>` containing:
- `when` - ISO 8601 timestamp of capture
- `parameters` - Either `PhotoMetadataInfo` or `VideoMetadataInfo` with device and capture details

```typescript
const result = await file.captureMetadata();
if (result.isOk()) {
  console.log("Captured:", result.value.when);
  console.log("Device:", result.value.parameters.deviceMake);
}
```

##### `dataHash(): Promise<Uint8Array>`

Computes the file's content hash (SHA-256 over the file without C2PA manifest).

**Returns:** `Promise<Uint8Array>`

##### `c2paReader(): ResultAsync<Reader, Error>`

Returns the underlying C2PA Reader for advanced use cases.

---

### `VerifiableBuffer` (Node.js)

The Node.js equivalent of `VerifiableFile`, working with `Buffer` instead of `File`.

#### Constructor

```typescript
new VerifiableBuffer(buffer: Buffer, mimeType: string)
```

**Parameters:**
- `buffer` - The file data as a Node.js `Buffer`
- `mimeType` - MIME type of the file (e.g., `"image/jpeg"`, `"video/quicktime"`)

#### Methods

All methods are identical to `VerifiableFile`:
- `authenticityStatus(): Promise<AuthenticityStatus>`
- `verifyBindings(production: boolean): ResultAsync<boolean, Error>`
- `verifyProof(appId: string): ResultAsync<boolean, Error>`
- `captureMetadata(): ResultAsync<CaptureMetadata, Error>`
- `dataHash(): Promise<Uint8Array>`

---

### `AuthenticityStatus` (Enum)

```typescript
enum AuthenticityStatus {
  Bindings,       // Has Apple App Attestation bindings
  Proof,          // Has zero-knowledge proof
  InvalidManifest, // C2PA manifest exists but missing ZCAM1 assertions
  NoManifest,     // No C2PA manifest found
}
```

### `CaptureMetadata` (Type)

```typescript
interface CaptureMetadata {
  when: string; // ISO 8601 timestamp
  parameters: PhotoMetadataInfo | VideoMetadataInfo;
}
```

## Verification Flow

1. Call `authenticityStatus()` to determine what type of verification is available
2. For `AuthenticityStatus.Bindings`: call `verifyBindings(production)`
3. For `AuthenticityStatus.Proof`: call `verifyProof(appId)`
4. Both methods internally verify the file's content hash against the C2PA manifest

## License

MIT

## Links

- [GitHub Repository](https://github.com/succinctlabs/zcam1-sdk)
- [Report Issues](https://github.com/succinctlabs/zcam1-sdk/issues)
