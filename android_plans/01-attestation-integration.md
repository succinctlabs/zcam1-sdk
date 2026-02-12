# Task 01: Android Attestation Integration

## Overview

Integrate Android device attestation using the existing `@pagopa/io-react-native-integrity` library for Key Attestation and Play Integrity, plus add a minimal Kotlin signing function to enable hardware-backed photo signatures.

**Estimated complexity:** Low-Medium (mostly TypeScript, ~15 lines of Kotlin)

**Dependencies:** None - can start immediately

**Parallel with:** 02-rust-android-crate (verification logic)

---

## Background Context

### What pagopa/io-react-native-integrity Provides

The library already provides full Android support:

```typescript
// Key Attestation - creates hardware-backed key and returns certificate chain
getAttestation(challenge: string, hardwareKeyTag: string): Promise<string>

// Play Integrity - device/app integrity verification
prepareIntegrityToken(cloudProjectNumber: string): Promise<void>
requestIntegrityToken(requestHash?: string): Promise<string>

// Utility
isPlayServicesAvailable(): Promise<boolean>
```

### What's Missing

The library does NOT provide a signing function for Android (iOS has `generateHardwareSignatureWithAssertion`). We need to add this.

### Why This Works

- Pagopa creates keys in **Android Keystore** with a user-provided alias (`hardwareKeyTag`)
- Keys are created with `PURPOSE_SIGN` permission
- Any code in the same app can access Keystore keys by alias
- We add a Kotlin function that retrieves the key and signs with it

---

## Current iOS Flow (Reference)

From `react-native-zcam1-capture/src/index.tsx`:

```typescript
// Bootstrap (one-time)
const deviceKeyId = await generateHardwareKey();
const attestation = await getAttestation(deviceKeyId, deviceKeyId);

// Per-photo
const assertion = await generateHardwareSignatureWithAssertion(message, deviceKeyId);
```

---

## Implementation Steps

### Step 1: Add Kotlin Signing Function

**File:** `react-native-zcam1-capture/android/src/main/java/com/zcam1sdk/Zcam1SdkModule.kt`

Add this method to the existing module:

```kotlin
import android.util.Base64
import java.security.KeyStore
import java.security.PrivateKey
import java.security.Signature

@ReactMethod
fun signWithHardwareKey(keyTag: String, data: String, promise: Promise) {
    try {
        val keyStore = KeyStore.getInstance("AndroidKeyStore")
        keyStore.load(null)

        if (!keyStore.containsAlias(keyTag)) {
            promise.reject("KEY_NOT_FOUND", "No key found with alias: $keyTag")
            return
        }

        val privateKey = keyStore.getKey(keyTag, null) as? PrivateKey
        if (privateKey == null) {
            promise.reject("KEY_ERROR", "Could not retrieve private key")
            return
        }

        val signature = Signature.getInstance("SHA256withECDSA")
        signature.initSign(privateKey)
        signature.update(data.toByteArray(Charsets.UTF_8))
        val signatureBytes = signature.sign()

        promise.resolve(Base64.encodeToString(signatureBytes, Base64.NO_WRAP))
    } catch (e: Exception) {
        promise.reject("SIGN_ERROR", e.message, e)
    }
}
```

### Step 2: Export in TurboModule Spec

**File:** `react-native-zcam1-capture/src/NativeZcam1Sdk.ts`

Add the method signature:

```typescript
export interface Spec extends TurboModule {
  // ... existing methods ...

  // Android-only: Sign data with hardware-backed key
  // Key must have been created via @pagopa/io-react-native-integrity getAttestation()
  signWithHardwareKey(keyTag: string, data: string): Promise<string>;
}
```

### Step 3: Update TypeScript Layer

**File:** `react-native-zcam1-capture/src/index.tsx`

Update `initCapture` to handle Android:

```typescript
import { Platform } from "react-native";
import {
  generateHardwareKey,
  getAttestation,
  isPlayServicesAvailable,
  prepareIntegrityToken,
  requestIntegrityToken,
} from "@pagopa/io-react-native-integrity";
import { sha256 } from "@noble/hashes/sha256";
import { base64 } from "@scure/base";

// Google Cloud Project Number for Play Integrity
const GCP_PROJECT_NUMBER = "YOUR_PROJECT_NUMBER"; // TODO: Move to config

export async function initCapture(settings: Settings): Promise<CaptureInfo> {
  const storageKeyId = `deviceKeyId-${settings.appId}`;
  let deviceKeyId = await EncryptedStorage.getItem(storageKeyId);

  if (Platform.OS === "android") {
    // Check Play Services availability
    const playServicesAvailable = await isPlayServicesAvailable();
    if (!playServicesAvailable) {
      throw new Error("Google Play Services not available");
    }
  }

  // Generate or retrieve device key
  if (deviceKeyId == null) {
    if (Platform.OS === "ios") {
      deviceKeyId = await generateHardwareKey();
    } else {
      // Android: use a deterministic key alias
      // The key is created when getAttestation is called
      deviceKeyId = `zcam1_${settings.appId}_device_key`;
    }
    await EncryptedStorage.setItem(storageKeyId, deviceKeyId);
  }

  // Get or refresh attestation
  let attestation = await EncryptedStorage.getItem(`attestation-${deviceKeyId}`);
  let playIntegrityToken: string | undefined;

  if (attestation == null) {
    if (Platform.OS === "ios") {
      attestation = await getAttestation(deviceKeyId, deviceKeyId);
    } else {
      // Android: Get Key Attestation
      // challenge = deviceKeyId (binds attestation to this key)
      // hardwareKeyTag = deviceKeyId (alias for the key in Keystore)
      attestation = await getAttestation(deviceKeyId, deviceKeyId);

      // Android: Get Play Integrity token
      await prepareIntegrityToken(GCP_PROJECT_NUMBER);
      // requestHash = sha256(deviceKeyId) binds token to our key
      const requestHash = base64.encode(sha256(deviceKeyId));
      playIntegrityToken = await requestIntegrityToken(requestHash);
    }

    await EncryptedStorage.setItem(`attestation-${deviceKeyId}`, attestation);
    if (playIntegrityToken) {
      await EncryptedStorage.setItem(`playIntegrity-${deviceKeyId}`, playIntegrityToken);
    }
  } else if (Platform.OS === "android") {
    // Retrieve cached Play Integrity token
    playIntegrityToken = await EncryptedStorage.getItem(`playIntegrity-${deviceKeyId}`) ?? undefined;
  }

  // Get content signing key (from @succinctlabs/react-native-zcam1-common)
  const contentPublicKey = await getContentPublicKey();
  const contentKeyId = getSecureEnclaveKeyId(contentPublicKey);

  return {
    platform: Platform.OS,
    appId: settings.appId,
    deviceKeyId,
    contentPublicKey,
    contentKeyId,
    attestation,
    playIntegrityToken, // Android only, undefined on iOS
  };
}
```

### Step 4: Update Assertion Generation

**File:** `react-native-zcam1-capture/src/utils.ts`

Update `generateAppAttestAssertion` for Android:

```typescript
import { Platform } from "react-native";
import { generateHardwareSignatureWithAssertion } from "@pagopa/io-react-native-integrity";
import NativeZcam1Sdk from "./NativeZcam1Sdk";
import { sha256 } from "@noble/hashes/sha256";
import { base64 } from "@scure/base";

export async function generateAppAttestAssertion(
  dataHash: ArrayBuffer,
  normalizedMetadata: string,
  deviceKeyId: string,
): Promise<string> {
  // Message format: base64(photoHash) + "|" + base64(sha256(metadata))
  const metadataBytes = new TextEncoder().encode(normalizedMetadata);
  const metadataHash = sha256(metadataBytes);
  const message = base64.encode(new Uint8Array(dataHash)) + "|" + base64.encode(metadataHash);

  if (Platform.OS === "ios") {
    // iOS: Use pagopa's assertion function (includes counter, authenticator data)
    return await generateHardwareSignatureWithAssertion(message, deviceKeyId);
  } else {
    // Android: Use our Kotlin signing function
    // Returns raw ECDSA signature (no authenticator data wrapper)
    return await NativeZcam1Sdk.signWithHardwareKey(deviceKeyId, message);
  }
}
```

### Step 5: Update CaptureInfo Type

**File:** `react-native-zcam1-capture/src/types.ts`

```typescript
export interface CaptureInfo {
  platform: "ios" | "android";
  appId: string;
  deviceKeyId: string;
  contentPublicKey: string;
  contentKeyId: string;
  attestation: string;
  playIntegrityToken?: string; // Android only
}
```

### Step 6: Update Device Bindings for C2PA Manifest

**File:** `react-native-zcam1-capture/src/camera.tsx` (or wherever bindings are embedded)

Update the bindings structure to include Android-specific fields:

```typescript
function createDeviceBindings(
  captureInfo: CaptureInfo,
  assertion: string,
): DeviceBindings {
  const baseBindings = {
    platform: captureInfo.platform,
    app_id: captureInfo.appId,
    device_key_id: captureInfo.deviceKeyId,
  };

  if (captureInfo.platform === "ios") {
    return {
      ...baseBindings,
      attestation: captureInfo.attestation,
      assertion: assertion,
    };
  } else {
    return {
      ...baseBindings,
      // Android Key Attestation (base64 encoded certificate chain)
      key_attestation_chain: captureInfo.attestation,
      // Play Integrity token (encrypted JWT)
      play_integrity_token: captureInfo.playIntegrityToken,
      // ECDSA signature over photo hash + metadata
      signature: assertion,
    };
  }
}
```

---

## Attestation Data Formats

### iOS Attestation (from pagopa)

CBOR-encoded object:
```
{
  fmt: "apple-appattest",
  attStmt: { x5c: [leaf_cert, ...intermediate_certs] },
  authData: base64(rp_id_hash + flags + counter + aaguid + credential_id + public_key)
}
```

### Android Key Attestation (from pagopa)

Base64-encoded string of comma-separated Base64 certificates:
```
base64("base64(cert1),base64(cert2),base64(cert3)")
```

To decode in the verifier:
```rust
let outer = base64_decode(attestation);
let inner = String::from_utf8(outer)?;
let certs: Vec<&str> = inner.split(',').collect();
// certs[0] = leaf certificate (contains KeyDescription extension)
// certs[n-1] = root certificate (Google attestation CA)
```

### Android Play Integrity Token

Encrypted JWT (JWE wrapping JWS):
- With self-managed keys: decrypt locally
- With Google-managed keys: send to Google for decryption

Decrypted payload:
```json
{
  "requestDetails": {
    "requestPackageName": "com.anonymous.zcam1",
    "requestHash": "base64(sha256(deviceKeyId))",
    "timestampMillis": "1675655009345"
  },
  "appIntegrity": {
    "appRecognitionVerdict": "PLAY_RECOGNIZED",
    "packageName": "com.anonymous.zcam1",
    "certificateSha256Digest": ["..."],
    "versionCode": "42"
  },
  "deviceIntegrity": {
    "deviceRecognitionVerdict": ["MEETS_DEVICE_INTEGRITY"]
  },
  "accountDetails": {
    "appLicensingVerdict": "LICENSED"
  }
}
```

### iOS Assertion (from pagopa)

CBOR-encoded object with authenticator data and signature:
```
{
  authenticatorData: base64(rp_id_hash + flags + counter),
  signature: base64(ecdsa_signature)
}
```

### Android Signature (from our Kotlin function)

Raw ECDSA signature, Base64-encoded:
```
base64(der_encoded_ecdsa_signature)
```

DER format: SEQUENCE { INTEGER r, INTEGER s }

---

## Cryptographic Binding Summary

### How the three artifacts link together:

```
1. Key Attestation:
   - challenge = deviceKeyId
   - Certificate contains: attestationChallenge = deviceKeyId
   - Certificate contains: public key

2. Play Integrity Token:
   - requestHash = sha256(deviceKeyId)
   - Verifier checks: requestHash == sha256(deviceKeyId)

3. Photo Signature:
   - Signed with private key from step 1
   - Verifier checks: signature valid for public key from step 1

All three are bound to the same deviceKeyId:
  attestation.challenge == deviceKeyId ✓
  playIntegrity.requestHash == sha256(deviceKeyId) ✓
  signature verifies with publicKey from attestation ✓
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `react-native-zcam1-capture/android/src/main/java/com/zcam1sdk/Zcam1SdkModule.kt` | Add `signWithHardwareKey()` method |
| `react-native-zcam1-capture/src/NativeZcam1Sdk.ts` | Add method signature to TurboModule spec |
| `react-native-zcam1-capture/src/index.tsx` | Update `initCapture()` with Platform.select logic |
| `react-native-zcam1-capture/src/utils.ts` | Update `generateAppAttestAssertion()` |
| `react-native-zcam1-capture/src/types.ts` | Add `playIntegrityToken` to `CaptureInfo` |
| `react-native-zcam1-capture/src/camera.tsx` | Update device bindings structure |
| `react-native-zcam1-capture/package.json` | Ensure `@pagopa/io-react-native-integrity` is listed |

---

## Configuration Required

### Google Cloud Project Number

The Play Integrity API requires a Google Cloud project number. This should be:
1. Stored in app configuration (not hardcoded)
2. Obtained from Google Play Console → Setup → App Integrity
3. Format: numeric string like `"123456789012"`

### Play Console Setup

1. Go to Google Play Console
2. Select your app
3. Navigate to: Release → Setup → App Integrity
4. Enable Play Integrity API
5. Note your Google Cloud project number
6. (Optional) Enable self-managed response encryption keys for offline verification

---

## Testing Checklist

- [ ] `isPlayServicesAvailable()` returns true on real device
- [ ] `getAttestation()` returns valid certificate chain
- [ ] Certificate chain validates to Google root CA
- [ ] `prepareIntegrityToken()` succeeds with valid project number
- [ ] `requestIntegrityToken()` returns encrypted token
- [ ] `signWithHardwareKey()` returns valid ECDSA signature
- [ ] Signature verifies with public key from attestation certificate
- [ ] Full flow works: init → capture → embed bindings → verify
- [ ] Emulator fallback works (software keys, mock tokens)

---

## Error Handling

```typescript
// Key not found (attestation not done yet)
catch (e) {
  if (e.code === "KEY_NOT_FOUND") {
    // Re-run attestation
    await initCapture(settings);
  }
}

// Play Services not available
catch (e) {
  if (e.code === "PLAY_SERVICES_UNAVAILABLE") {
    // Show user message to install/update Play Services
  }
}

// Hardware attestation not supported (emulator or old device)
catch (e) {
  if (e.code === "ATTESTATION_UNSUPPORTED") {
    // Fall back to software keys with warning
  }
}
```

---

## Deliverables

### Files to Create/Modify

| Deliverable | File Path | Type |
|-------------|-----------|------|
| Kotlin signing function | `react-native-zcam1-capture/android/src/main/java/com/zcam1sdk/Zcam1SdkModule.kt` | Modify |
| TurboModule spec | `react-native-zcam1-capture/src/NativeZcam1Sdk.ts` | Modify |
| Init capture logic | `react-native-zcam1-capture/src/index.tsx` | Modify |
| Assertion generation | `react-native-zcam1-capture/src/utils.ts` | Modify |
| Type definitions | `react-native-zcam1-capture/src/types.ts` | Modify |
| Device bindings | `react-native-zcam1-capture/src/bindings.ts` | Create |
| Unit tests (Kotlin) | `react-native-zcam1-capture/android/src/test/java/com/zcam1sdk/SigningTest.kt` | Create |
| Unit tests (TS) | `react-native-zcam1-capture/__tests__/attestation.test.ts` | Create |

---

## Interface Definitions

### Kotlin Native Module Interface

```kotlin
// Zcam1SdkModule.kt - Method to add
interface Zcam1SdkModuleInterface {
    /**
     * Sign data with a hardware-backed key from Android Keystore.
     *
     * @param keyTag The alias of the key in Android Keystore (created by pagopa getAttestation)
     * @param data The string data to sign (will be UTF-8 encoded)
     * @param promise React Native promise for async result
     *
     * @returns Base64-encoded DER-format ECDSA signature
     * @throws KEY_NOT_FOUND if no key exists with the given alias
     * @throws KEY_ERROR if the key cannot be used for signing
     * @throws SIGN_ERROR for other signing failures
     */
    fun signWithHardwareKey(keyTag: String, data: String, promise: Promise)
}
```

### TypeScript Interface

```typescript
// NativeZcam1Sdk.ts
export interface Spec extends TurboModule {
  /**
   * Sign data with hardware-backed key (Android only).
   * @param keyTag - Key alias in Android Keystore
   * @param data - String to sign
   * @returns Base64-encoded ECDSA signature
   */
  signWithHardwareKey(keyTag: string, data: string): Promise<string>;
}

// types.ts
export interface CaptureInfo {
  platform: "ios" | "android";
  appId: string;
  deviceKeyId: string;
  contentPublicKey: string;
  contentKeyId: string;
  attestation: string;
  playIntegrityToken?: string; // Android only
}

export interface DeviceBindings {
  platform: "ios" | "android";
  app_id: string;
  device_key_id: string;
  // iOS
  attestation?: string;
  assertion?: string;
  // Android
  key_attestation_chain?: string;
  play_integrity_token?: string;
  signature?: string;
}
```

### Function Signatures

```typescript
// index.tsx
export async function initCapture(settings: Settings): Promise<CaptureInfo>;

// utils.ts
export async function generateAppAttestAssertion(
  dataHash: ArrayBuffer,
  normalizedMetadata: string,
  deviceKeyId: string
): Promise<string>;

// bindings.ts
export function createDeviceBindings(
  captureInfo: CaptureInfo,
  assertion: string
): DeviceBindings;
```

---

## Testing Plan

### Unit Tests

#### Kotlin Unit Tests (`SigningTest.kt`)

```kotlin
class SigningTest {
    @Test
    fun `signWithHardwareKey returns base64 encoded signature`()

    @Test
    fun `signWithHardwareKey rejects with KEY_NOT_FOUND for missing key`()

    @Test
    fun `signWithHardwareKey produces valid DER-encoded ECDSA signature`()

    @Test
    fun `signWithHardwareKey signature is non-deterministic but verifiable`()

    @Test
    fun `signWithHardwareKey handles UTF-8 data correctly`()

    @Test
    fun `signWithHardwareKey handles empty string data`()

    @Test
    fun `signWithHardwareKey handles special characters in data`()
}
```

#### TypeScript Unit Tests (`attestation.test.ts`)

```typescript
describe("initCapture", () => {
  it("checks Play Services availability on Android");
  it("throws if Play Services unavailable");
  it("generates deterministic key alias from appId");
  it("calls getAttestation with correct parameters");
  it("calls prepareIntegrityToken with GCP project number");
  it("calls requestIntegrityToken with sha256(deviceKeyId)");
  it("stores attestation and playIntegrityToken");
  it("retrieves cached values on subsequent calls");
  it("returns correct CaptureInfo structure");
});

describe("generateAppAttestAssertion", () => {
  it("formats message as base64(photoHash)|base64(sha256(metadata))");
  it("calls signWithHardwareKey on Android");
  it("calls generateHardwareSignatureWithAssertion on iOS");
});

describe("createDeviceBindings", () => {
  it("creates iOS bindings with attestation and assertion");
  it("creates Android bindings with key_attestation_chain and signature");
  it("includes play_integrity_token for Android");
});
```

### Integration Tests

```typescript
describe("Android Attestation Flow", () => {
  it("completes full init -> sign -> verify flow on emulator");
  it("completes full flow on real device with TEE");
  it("completes full flow on real device with StrongBox");
  it("handles key regeneration after app reinstall");
  it("handles Play Integrity token expiration");
});
```

### Manual Testing Checklist

| Test Case | Emulator | Real Device (TEE) | Real Device (StrongBox) |
|-----------|----------|-------------------|-------------------------|
| `isPlayServicesAvailable()` returns true | ⬜ | ⬜ | ⬜ |
| `getAttestation()` returns certificate chain | ⬜ | ⬜ | ⬜ |
| Certificate chain has 3+ certificates | ⬜ | ⬜ | ⬜ |
| `prepareIntegrityToken()` succeeds | ⬜ | ⬜ | ⬜ |
| `requestIntegrityToken()` returns token | ⬜ | ⬜ | ⬜ |
| `signWithHardwareKey()` returns signature | ⬜ | ⬜ | ⬜ |
| Signature is valid base64 | ⬜ | ⬜ | ⬜ |
| Full capture flow completes | ⬜ | ⬜ | ⬜ |
| Bindings contain all required fields | ⬜ | ⬜ | ⬜ |

### Test Fixtures Required

| Fixture | Source | Purpose |
|---------|--------|---------|
| `emulator_attestation.txt` | Android Emulator | Software key attestation chain |
| `pixel_tee_attestation.txt` | Pixel 4/5 | TEE attestation chain |
| `pixel_strongbox_attestation.txt` | Pixel 6+ | StrongBox attestation chain |
| `play_integrity_token.txt` | Real device | Sample encrypted JWT |

---

## Completion Criteria

### Must Have (Required for task completion)

- [ ] **Kotlin signing function implemented**
  - `signWithHardwareKey()` method added to `Zcam1SdkModule.kt`
  - Returns base64-encoded DER ECDSA signature
  - Proper error codes: `KEY_NOT_FOUND`, `KEY_ERROR`, `SIGN_ERROR`

- [ ] **TurboModule spec updated**
  - `signWithHardwareKey` method signature in `NativeZcam1Sdk.ts`
  - TypeScript types compile without errors

- [ ] **Platform-aware initCapture**
  - Detects Android platform
  - Checks Play Services availability
  - Calls pagopa `getAttestation()` with correct parameters
  - Calls pagopa `prepareIntegrityToken()` and `requestIntegrityToken()`
  - Stores and retrieves attestation/token from encrypted storage

- [ ] **Platform-aware assertion generation**
  - `generateAppAttestAssertion()` uses `signWithHardwareKey` on Android
  - Message format: `base64(photoHash)|base64(sha256(metadata))`

- [ ] **Device bindings structure**
  - Android bindings include: `key_attestation_chain`, `play_integrity_token`, `signature`
  - iOS bindings unchanged: `attestation`, `assertion`

- [ ] **Unit tests pass**
  - All Kotlin unit tests pass
  - All TypeScript unit tests pass
  - Code coverage > 80% for new code

- [ ] **Integration test passes on emulator**
  - Full init → sign → create bindings flow works
  - Bindings JSON is valid and contains expected fields

### Should Have (Expected but not blocking)

- [ ] **Integration test passes on real device**
  - Tested on at least one TEE device
  - Tested on at least one StrongBox device (Pixel 6+)

- [ ] **Error handling complete**
  - Graceful handling of Play Services unavailable
  - Graceful handling of key not found
  - Clear error messages for debugging

- [ ] **Documentation**
  - JSDoc comments on all public functions
  - KDoc comments on Kotlin methods

### Nice to Have (Not required)

- [ ] **Retry logic for transient failures**
- [ ] **Telemetry/logging for debugging**
- [ ] **Performance benchmarks**

---

## Verification Commands

```bash
# Run Kotlin unit tests
cd react-native-zcam1-capture/android
./gradlew test

# Run TypeScript unit tests
cd react-native-zcam1-capture
npm test

# Type check
npm run typecheck

# Build Android
cd example/android
./gradlew assembleDebug

# Run on emulator
npx react-native run-android

# Run integration tests
npx detox test -c android.emu.debug
```

---

## Handoff to Next Tasks

### Output for Task 02 (Rust Android Crate)

This task produces attestation data in specific formats that Task 02 must parse:

```
Key Attestation Chain Format:
  base64(base64(cert1),base64(cert2),base64(cert3))

Signature Format:
  base64(DER-encoded ECDSA signature)
  DER: SEQUENCE { INTEGER r, INTEGER s }

Play Integrity Token Format:
  JWE (encrypted JWT)
```

### Output for Task 03 (Camera)

This task provides the signing function that Task 03 uses:

```typescript
// Camera can call:
const signature = await NativeZcam1Sdk.signWithHardwareKey(deviceKeyId, message);
```

### Output for Task 05 (TypeScript Integration)

This task establishes the patterns that Task 05 extends:

- Platform detection pattern using `Platform.OS`
- `CaptureInfo` and `DeviceBindings` type structures
- Encrypted storage keys for caching

---

## Next Steps

After this task is complete:
- Task 02 (Rust verification crate) can verify the attestation artifacts
- Task 03 (Camera) can use the signing function for photo capture
- Task 05 (TypeScript integration) builds on this foundation
