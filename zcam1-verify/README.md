# @succinctlabs/zcam1-verify

Browser-based verification SDK for ZCAM1-authenticated media files. This package enables client-side verification of C2PA-signed images and videos that contain either Apple App Attestation bindings or zero-knowledge proofs of authenticity.


## Installation

```bash
npm install @succinctlabs/zcam1-verify
```

## API Reference

### `VerifiableFile`

The main class for verifying ZCAM1-authenticated media files.

#### Constructor

```typescript
new VerifiableFile(file: File)
```

Creates a new verifiable file instance.

**Parameters:**
- `file` - The `File` object to verify (typically an image or video with C2PA metadata)

#### Methods

##### `authenticityStatus(): Promise<AuthenticityStatus>`

Determines the authenticity status of the file based on its C2PA manifest.

**Returns:** A promise that resolves to one of:
- `AuthenticityStatus.Bindings` - File contains Apple App Attestation bindings
- `AuthenticityStatus.Proof` - File contains a zero-knowledge proof
- `AuthenticityStatus.InvalidManifest` - Manifest exists but lacks required assertions
- `AuthenticityStatus.NoManifest` - No C2PA manifest found

**Example:**
```typescript
const status = await verifiable.authenticityStatus();
switch (status) {
  case AuthenticityStatus.Bindings:
    console.log('File has bindings assertion');
    break;
  case AuthenticityStatus.Proof:
    console.log('File has proof assertion');
    break;
  case AuthenticityStatus.InvalidManifest:
    console.log('File has C2PA manifest but no ZCAM1 assertions');
    break;
  case AuthenticityStatus.NoManifest:
    console.log('File has no C2PA manifest');
    break;
}
```

##### `verifyBindings(production: boolean): Promise<boolean>`

Verifies the Apple App Attestation bindings in a C2PA manifest by validating the attestation and assertion against the photo hash and capture metadata.

**Parameters:**
- `production` - Set to `true` for production Apple App Attestation GUID, `false` for development

**Returns:** A promise that resolves to `true` if the bindings are valid

**Throws:** Error if verification fails

**Example:**
```typescript
try {
  const isValid = await verifiable.verifyBindings(false); // development mode
  console.log('Bindings verified:', isValid);
} catch (error) {
  console.error('Verification failed:', error.message);
}
```

##### `verifyProof(appId: string): Promise<boolean>`

Verifies the zero-knowledge proof assertion in a C2PA manifest using Groth16 verification.

**Parameters:**
- `appId` - The application identifier (format: `TEAM_ID.BUNDLE_ID`)

**Returns:** A promise that resolves to `true` if the proof is valid, `false` otherwise

**Example:**
```typescript
const appId = 'NLS5R4YCGX.com.example.myapp';
const isValid = await verifiable.verifyProof(appId);
console.log('Proof verified:', isValid);
```

##### `captureMetadata(): Promise<CaptureMetadata>`

Extracts the capture metadata from the C2PA manifest, including timestamp and capture parameters.

**Returns:** A promise that resolves to capture metadata containing:
- `when` - ISO 8601 timestamp of when the photo/video was captured
- `parameters` - Either `PhotoMetadataInfo` or `VideoMetadataInfo` with device and capture details

**Example:**
```typescript
const metadata = await verifiable.captureMetadata();
console.log('Captured:', metadata.when);
console.log('Device:', metadata.parameters.deviceMake);
console.log('Model:', metadata.parameters.deviceModel);

// Photo-specific metadata
if ('focalLength' in metadata.parameters) {
  console.log('Focal length:', metadata.parameters.focalLength);
  console.log('ISO:', metadata.parameters.iso);
}

// Video-specific metadata
if ('frameRate' in metadata.parameters) {
  console.log('Frame rate:', metadata.parameters.frameRate);
  console.log('Duration:', metadata.parameters.duration);
}
```

##### `dataHash(): Promise<string>`

Returns the file's content hash as recorded in the active C2PA manifest.

**Returns:** A promise that resolves to the manifest data hash (base64-encoded string)

**Example:**
```typescript
const hash = await verifiable.dataHash();
console.log('Content hash:', hash);
```

## License

MIT

## Links

- [GitHub Repository](https://github.com/succinctlabs/zcam1-sdk)
- [Report Issues](https://github.com/succinctlabs/zcam1-sdk/issues)
