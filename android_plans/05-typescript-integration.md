# Task 05: TypeScript Integration

## Overview

Update the React Native TypeScript layer in `react-native-zcam1-capture` to support Android platform with proper Platform.select logic, conditional attestation flows, and unified API surface.

**Estimated complexity:** Low-Medium

**Dependencies:**
- Task 01 (attestation integration) provides the native Kotlin methods
- Task 03 (camera) provides the camera capture functionality

---

## Background Context

### Current iOS-Only Implementation

The current TypeScript code in `react-native-zcam1-capture/src/` assumes iOS:

```typescript
// Current: iOS-only
import { generateHardwareKey, getAttestation, generateHardwareSignatureWithAssertion } from "@pagopa/io-react-native-integrity";

export async function initCapture(settings: Settings): Promise<CaptureInfo> {
  const deviceKeyId = await generateHardwareKey();
  const attestation = await getAttestation(deviceKeyId, deviceKeyId);
  // ... iOS-only flow
}
```

### Android Changes

With Android support:
1. Use `@pagopa/io-react-native-integrity` for both platforms (it supports Android)
2. Add Platform.select for different attestation flows
3. Call our custom `signWithHardwareKey` Kotlin method for Android signing
4. Include Play Integrity token in device bindings

---

## Implementation Steps

### Step 1: Update Types

**File:** `react-native-zcam1-capture/src/types.ts`

```typescript
export type Platform = "ios" | "android";

export interface Settings {
  appId: string;
  // Google Cloud Project Number for Play Integrity (Android only)
  gcpProjectNumber?: string;
  // Production mode (stricter validation)
  production?: boolean;
}

export interface CaptureInfo {
  /** Platform: "ios" or "android" */
  platform: Platform;
  /** App bundle ID (iOS) or package name (Android) */
  appId: string;
  /** Device key identifier */
  deviceKeyId: string;
  /** Content signing public key (from common) */
  contentPublicKey: string;
  /** Content key ID (hash of public key) */
  contentKeyId: string;
  /** iOS: CBOR attestation object, Android: base64 certificate chain */
  attestation: string;
  /** Android only: Play Integrity token */
  playIntegrityToken?: string;
}

export interface DeviceBindings {
  platform: Platform;
  app_id: string;
  device_key_id: string;

  // iOS fields
  attestation?: string;
  assertion?: string;

  // Android fields
  key_attestation_chain?: string;
  play_integrity_token?: string;
  signature?: string;
}

export interface PhotoCaptureResult {
  /** File path to the captured photo */
  path: string;
  /** Photo width in pixels */
  width: number;
  /** Photo height in pixels */
  height: number;
  /** Device orientation at capture (0, 90, 180, 270) */
  orientation: number;
  /** Capture timestamp (milliseconds since epoch) */
  timestamp: number;
  /** Embedded device bindings */
  deviceBindings: DeviceBindings;
}
```

### Step 2: Update NativeZcam1Sdk Spec

**File:** `react-native-zcam1-capture/src/NativeZcam1Sdk.ts`

```typescript
import type { TurboModule } from "react-native";
import { TurboModuleRegistry } from "react-native";

export interface Spec extends TurboModule {
  // Camera methods
  takeNativePhoto(options: Object): Promise<Object>;
  setZoom(zoom: number): Promise<void>;
  setFlashMode(mode: string): Promise<void>;
  focus(x: number, y: number): Promise<void>;
  getMaxZoom(): Promise<number>;

  // Android-only: Sign data with hardware-backed key
  // Key must have been created via @pagopa/io-react-native-integrity getAttestation()
  signWithHardwareKey(keyTag: string, data: string): Promise<string>;
}

export default TurboModuleRegistry.getEnforcing<Spec>("Zcam1Sdk");
```

### Step 3: Update initCapture

**File:** `react-native-zcam1-capture/src/index.tsx`

```typescript
import { Platform } from "react-native";
import EncryptedStorage from "react-native-encrypted-storage";
import {
  generateHardwareKey,
  getAttestation,
  isPlayServicesAvailable,
  prepareIntegrityToken,
  requestIntegrityToken,
} from "@pagopa/io-react-native-integrity";
import { sha256 } from "@noble/hashes/sha256";
import { base64 } from "@scure/base";
import {
  getContentPublicKey,
  getSecureEnclaveKeyId,
} from "@succinctlabs/react-native-zcam1-common";

import type { Settings, CaptureInfo, Platform as PlatformType } from "./types";

/**
 * Initialize the capture system.
 *
 * This function:
 * 1. Generates or retrieves a device key
 * 2. Gets device attestation (iOS: App Attest, Android: Key Attestation + Play Integrity)
 * 3. Returns capture info for use in photo capture
 *
 * @param settings - App configuration
 * @returns CaptureInfo object with attestation data
 */
export async function initCapture(settings: Settings): Promise<CaptureInfo> {
  const platform: PlatformType = Platform.OS as PlatformType;
  const storageKeyId = `deviceKeyId-${settings.appId}`;

  // Check Play Services availability on Android
  if (platform === "android") {
    const playServicesAvailable = await isPlayServicesAvailable();
    if (!playServicesAvailable) {
      throw new Error(
        "Google Play Services not available. Required for device attestation."
      );
    }
  }

  // Generate or retrieve device key
  let deviceKeyId = await EncryptedStorage.getItem(storageKeyId);

  if (deviceKeyId == null) {
    if (platform === "ios") {
      // iOS: generateHardwareKey creates a key in Secure Enclave and returns ID
      deviceKeyId = await generateHardwareKey();
    } else {
      // Android: Use a deterministic key alias
      // The key is created when getAttestation is called
      deviceKeyId = `zcam1_${settings.appId}_device_key`;
    }
    await EncryptedStorage.setItem(storageKeyId, deviceKeyId);
  }

  // Get or refresh attestation
  const attestationKey = `attestation-${deviceKeyId}`;
  let attestation = await EncryptedStorage.getItem(attestationKey);
  let playIntegrityToken: string | undefined;

  if (attestation == null) {
    if (platform === "ios") {
      // iOS: App Attest
      // challenge = deviceKeyId binds attestation to this specific key
      attestation = await getAttestation(deviceKeyId, deviceKeyId);
    } else {
      // Android: Key Attestation
      // challenge = deviceKeyId, hardwareKeyTag = deviceKeyId
      // This creates a hardware-backed key and returns certificate chain
      attestation = await getAttestation(deviceKeyId, deviceKeyId);

      // Android: Play Integrity
      // Prepare the integrity token provider
      if (!settings.gcpProjectNumber) {
        throw new Error(
          "gcpProjectNumber required for Android Play Integrity"
        );
      }
      await prepareIntegrityToken(settings.gcpProjectNumber);

      // Request token with hash binding to our device key
      // requestHash = sha256(deviceKeyId) cryptographically binds token to key
      const requestHash = base64.encode(sha256(deviceKeyId));
      playIntegrityToken = await requestIntegrityToken(requestHash);

      // Store Play Integrity token
      await EncryptedStorage.setItem(
        `playIntegrity-${deviceKeyId}`,
        playIntegrityToken
      );
    }

    // Store attestation
    await EncryptedStorage.setItem(attestationKey, attestation);
  } else if (platform === "android") {
    // Retrieve cached Play Integrity token for Android
    playIntegrityToken =
      (await EncryptedStorage.getItem(`playIntegrity-${deviceKeyId}`)) ??
      undefined;
  }

  // Get content signing key (from common package)
  const contentPublicKey = await getContentPublicKey();
  const contentKeyId = getSecureEnclaveKeyId(contentPublicKey);

  return {
    platform,
    appId: settings.appId,
    deviceKeyId,
    contentPublicKey,
    contentKeyId,
    attestation,
    playIntegrityToken,
  };
}

/**
 * Refresh Play Integrity token (Android only).
 *
 * Play Integrity tokens may expire. Call this to get a fresh token
 * if verification fails with an expired token error.
 */
export async function refreshPlayIntegrityToken(
  captureInfo: CaptureInfo,
  gcpProjectNumber: string
): Promise<string> {
  if (captureInfo.platform !== "android") {
    throw new Error("refreshPlayIntegrityToken is only available on Android");
  }

  await prepareIntegrityToken(gcpProjectNumber);
  const requestHash = base64.encode(sha256(captureInfo.deviceKeyId));
  const token = await requestIntegrityToken(requestHash);

  // Update cached token
  await EncryptedStorage.setItem(
    `playIntegrity-${captureInfo.deviceKeyId}`,
    token
  );

  return token;
}
```

### Step 4: Update Assertion Generation

**File:** `react-native-zcam1-capture/src/utils.ts`

```typescript
import { Platform } from "react-native";
import { generateHardwareSignatureWithAssertion } from "@pagopa/io-react-native-integrity";
import { sha256 } from "@noble/hashes/sha256";
import { base64 } from "@scure/base";

import NativeZcam1Sdk from "./NativeZcam1Sdk";

/**
 * Generate an assertion (signature) over photo data.
 *
 * This function creates a cryptographic binding between:
 * - The photo content (via dataHash)
 * - The metadata (via normalizedMetadata hash)
 * - The device key (via deviceKeyId)
 *
 * @param dataHash - SHA-256 hash of the photo data
 * @param normalizedMetadata - Canonical JSON string of metadata
 * @param deviceKeyId - Device key identifier
 * @returns Base64-encoded assertion/signature
 */
export async function generateAppAttestAssertion(
  dataHash: ArrayBuffer,
  normalizedMetadata: string,
  deviceKeyId: string
): Promise<string> {
  // Create message: base64(photoHash) + "|" + base64(sha256(metadata))
  const metadataBytes = new TextEncoder().encode(normalizedMetadata);
  const metadataHash = sha256(metadataBytes);
  const message =
    base64.encode(new Uint8Array(dataHash)) + "|" + base64.encode(metadataHash);

  if (Platform.OS === "ios") {
    // iOS: Use pagopa's assertion function
    // Returns CBOR-encoded object with authenticator data and signature
    return await generateHardwareSignatureWithAssertion(message, deviceKeyId);
  } else {
    // Android: Use our Kotlin signing function
    // Returns raw ECDSA signature (base64-encoded DER format)
    return await NativeZcam1Sdk.signWithHardwareKey(deviceKeyId, message);
  }
}

/**
 * Normalize metadata for signing.
 *
 * Ensures consistent JSON serialization across platforms
 * by sorting keys and removing whitespace.
 */
export function normalizeMetadata(metadata: Record<string, unknown>): string {
  return JSON.stringify(metadata, Object.keys(metadata).sort());
}
```

### Step 5: Update Device Bindings Creation

**File:** `react-native-zcam1-capture/src/bindings.ts`

```typescript
import type { CaptureInfo, DeviceBindings, Platform } from "./types";

/**
 * Create device bindings for C2PA manifest.
 *
 * Device bindings cryptographically link the photo to:
 * - The capturing device (via attestation)
 * - The capturing app (via app ID)
 * - The specific capture event (via assertion/signature)
 *
 * @param captureInfo - Capture initialization info
 * @param assertion - Assertion/signature over photo data
 * @returns DeviceBindings object for embedding in C2PA manifest
 */
export function createDeviceBindings(
  captureInfo: CaptureInfo,
  assertion: string
): DeviceBindings {
  const baseBindings = {
    platform: captureInfo.platform,
    app_id: captureInfo.appId,
    device_key_id: captureInfo.deviceKeyId,
  };

  if (captureInfo.platform === "ios") {
    return {
      ...baseBindings,
      // iOS App Attest attestation (CBOR-encoded)
      attestation: captureInfo.attestation,
      // iOS App Attest assertion (CBOR-encoded with counter)
      assertion: assertion,
    };
  } else {
    return {
      ...baseBindings,
      // Android Key Attestation certificate chain (base64)
      key_attestation_chain: captureInfo.attestation,
      // Google Play Integrity token (encrypted JWT)
      play_integrity_token: captureInfo.playIntegrityToken,
      // ECDSA signature over message (base64)
      signature: assertion,
    };
  }
}

/**
 * Serialize device bindings for embedding in C2PA manifest.
 */
export function serializeDeviceBindings(bindings: DeviceBindings): string {
  return JSON.stringify(bindings);
}
```

### Step 6: Update Camera Component

**File:** `react-native-zcam1-capture/src/Camera.tsx`

```typescript
import React, { useRef, useCallback, useImperativeHandle, forwardRef } from "react";
import { Platform, requireNativeComponent, ViewStyle } from "react-native";
import { sha256 } from "@noble/hashes/sha256";
import { readFile } from "react-native-fs";
import { base64 } from "@scure/base";

import type { CaptureInfo, PhotoCaptureResult, DeviceBindings } from "./types";
import { generateAppAttestAssertion, normalizeMetadata } from "./utils";
import { createDeviceBindings } from "./bindings";
import NativeZcam1Sdk from "./NativeZcam1Sdk";

interface CameraProps {
  style?: ViewStyle;
  captureInfo: CaptureInfo;
  cameraType?: "back" | "front";
  flashMode?: "off" | "on" | "auto";
  zoom?: number;
  onError?: (error: Error) => void;
}

export interface CameraRef {
  takePhoto: () => Promise<PhotoCaptureResult>;
  setZoom: (zoom: number) => Promise<void>;
  setFlashMode: (mode: "off" | "on" | "auto") => Promise<void>;
  focus: (x: number, y: number) => Promise<void>;
}

const NativeCameraView = requireNativeComponent<{
  style?: ViewStyle;
  cameraType?: string;
  flashMode?: string;
  zoom?: number;
}>("Zcam1CameraView");

export const Camera = forwardRef<CameraRef, CameraProps>(
  ({ style, captureInfo, cameraType = "back", flashMode = "off", zoom = 1, onError }, ref) => {
    const nativeRef = useRef(null);

    const takePhoto = useCallback(async (): Promise<PhotoCaptureResult> => {
      try {
        // Take native photo
        const result = await NativeZcam1Sdk.takeNativePhoto({
          cameraType,
          flashMode,
        });

        const { path, width, height, orientation, timestamp } = result as {
          path: string;
          width: number;
          height: number;
          orientation: number;
          timestamp: number;
        };

        // Read photo data and compute hash
        const photoData = await readFile(path, "base64");
        const photoBytes = base64.decode(photoData);
        const photoHash = sha256(photoBytes);

        // Create normalized metadata
        const metadata = {
          width,
          height,
          orientation,
          timestamp,
          platform: captureInfo.platform,
          appId: captureInfo.appId,
        };
        const normalizedMetadata = normalizeMetadata(metadata);

        // Generate assertion/signature
        const assertion = await generateAppAttestAssertion(
          photoHash.buffer,
          normalizedMetadata,
          captureInfo.deviceKeyId
        );

        // Create device bindings
        const deviceBindings = createDeviceBindings(captureInfo, assertion);

        return {
          path,
          width,
          height,
          orientation,
          timestamp,
          deviceBindings,
        };
      } catch (error) {
        onError?.(error as Error);
        throw error;
      }
    }, [captureInfo, cameraType, flashMode, onError]);

    const setZoomValue = useCallback(async (value: number) => {
      await NativeZcam1Sdk.setZoom(value);
    }, []);

    const setFlashModeValue = useCallback(async (mode: "off" | "on" | "auto") => {
      await NativeZcam1Sdk.setFlashMode(mode);
    }, []);

    const focusPoint = useCallback(async (x: number, y: number) => {
      await NativeZcam1Sdk.focus(x, y);
    }, []);

    useImperativeHandle(ref, () => ({
      takePhoto,
      setZoom: setZoomValue,
      setFlashMode: setFlashModeValue,
      focus: focusPoint,
    }));

    return (
      <NativeCameraView
        ref={nativeRef}
        style={style}
        cameraType={cameraType}
        flashMode={flashMode}
        zoom={zoom}
      />
    );
  }
);

Camera.displayName = "Zcam1Camera";
```

### Step 7: Update Package Exports

**File:** `react-native-zcam1-capture/src/index.tsx`

```typescript
// Core initialization
export { initCapture, refreshPlayIntegrityToken } from "./init";

// Camera component
export { Camera } from "./Camera";
export type { CameraRef } from "./Camera";

// Types
export type {
  Settings,
  CaptureInfo,
  DeviceBindings,
  PhotoCaptureResult,
  Platform,
} from "./types";

// Utilities
export { generateAppAttestAssertion, normalizeMetadata } from "./utils";
export { createDeviceBindings, serializeDeviceBindings } from "./bindings";
```

---

## Error Handling

### Platform-Specific Errors

```typescript
// error-codes.ts
export const ErrorCodes = {
  // Common
  CAMERA_NOT_READY: "CAMERA_NOT_READY",
  CAPTURE_FAILED: "CAPTURE_FAILED",

  // iOS
  IOS_ATTESTATION_FAILED: "IOS_ATTESTATION_FAILED",
  IOS_ASSERTION_FAILED: "IOS_ASSERTION_FAILED",

  // Android
  PLAY_SERVICES_UNAVAILABLE: "PLAY_SERVICES_UNAVAILABLE",
  KEY_ATTESTATION_FAILED: "KEY_ATTESTATION_FAILED",
  PLAY_INTEGRITY_FAILED: "PLAY_INTEGRITY_FAILED",
  KEY_NOT_FOUND: "KEY_NOT_FOUND",
  SIGN_ERROR: "SIGN_ERROR",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export class Zcam1Error extends Error {
  code: ErrorCode;
  platform: "ios" | "android";

  constructor(code: ErrorCode, message: string, platform: "ios" | "android") {
    super(message);
    this.code = code;
    this.platform = platform;
    this.name = "Zcam1Error";
  }
}
```

### Error Recovery

```typescript
// In Camera.tsx or init.ts
async function handleAttestationError(
  error: Error,
  captureInfo: CaptureInfo,
  settings: Settings
): Promise<CaptureInfo> {
  if (captureInfo.platform === "android") {
    // Try refreshing Play Integrity token
    if (error.message.includes("PLAY_INTEGRITY")) {
      const newToken = await refreshPlayIntegrityToken(
        captureInfo,
        settings.gcpProjectNumber!
      );
      return { ...captureInfo, playIntegrityToken: newToken };
    }

    // Key might have been deleted, re-initialize
    if (error.message.includes("KEY_NOT_FOUND")) {
      // Clear cached data
      await EncryptedStorage.removeItem(`deviceKeyId-${settings.appId}`);
      await EncryptedStorage.removeItem(`attestation-${captureInfo.deviceKeyId}`);
      await EncryptedStorage.removeItem(`playIntegrity-${captureInfo.deviceKeyId}`);

      // Re-initialize
      return await initCapture(settings);
    }
  }

  throw error;
}
```

---

## Testing

### Unit Tests

```typescript
// __tests__/utils.test.ts
import { normalizeMetadata } from "../src/utils";

describe("normalizeMetadata", () => {
  it("sorts keys alphabetically", () => {
    const input = { z: 1, a: 2, m: 3 };
    const result = normalizeMetadata(input);
    expect(result).toBe('{"a":2,"m":3,"z":1}');
  });

  it("handles nested objects", () => {
    const input = { b: { z: 1, a: 2 }, a: 1 };
    const result = normalizeMetadata(input);
    // Note: only top-level keys are sorted
    expect(result).toBe('{"a":1,"b":{"z":1,"a":2}}');
  });
});
```

```typescript
// __tests__/bindings.test.ts
import { createDeviceBindings } from "../src/bindings";

describe("createDeviceBindings", () => {
  it("creates iOS bindings with attestation and assertion", () => {
    const captureInfo = {
      platform: "ios" as const,
      appId: "com.test.app",
      deviceKeyId: "abc123",
      contentPublicKey: "...",
      contentKeyId: "...",
      attestation: "ios-attestation",
    };

    const bindings = createDeviceBindings(captureInfo, "ios-assertion");

    expect(bindings.platform).toBe("ios");
    expect(bindings.attestation).toBe("ios-attestation");
    expect(bindings.assertion).toBe("ios-assertion");
    expect(bindings.key_attestation_chain).toBeUndefined();
  });

  it("creates Android bindings with key attestation and signature", () => {
    const captureInfo = {
      platform: "android" as const,
      appId: "com.test.app",
      deviceKeyId: "abc123",
      contentPublicKey: "...",
      contentKeyId: "...",
      attestation: "android-cert-chain",
      playIntegrityToken: "play-token",
    };

    const bindings = createDeviceBindings(captureInfo, "android-signature");

    expect(bindings.platform).toBe("android");
    expect(bindings.key_attestation_chain).toBe("android-cert-chain");
    expect(bindings.play_integrity_token).toBe("play-token");
    expect(bindings.signature).toBe("android-signature");
    expect(bindings.attestation).toBeUndefined();
  });
});
```

---

## Files Summary

| File | Purpose |
|------|---------|
| `src/types.ts` | Type definitions for both platforms |
| `src/NativeZcam1Sdk.ts` | TurboModule spec with Android methods |
| `src/index.tsx` | Main exports and initCapture |
| `src/utils.ts` | Platform-aware assertion generation |
| `src/bindings.ts` | Device bindings creation |
| `src/Camera.tsx` | Camera component with capture flow |
| `src/error-codes.ts` | Error handling utilities |

---

## Dependencies

Ensure these are in `package.json`:

```json
{
  "dependencies": {
    "@pagopa/io-react-native-integrity": "^1.0.0",
    "@noble/hashes": "^1.3.0",
    "@scure/base": "^1.1.0",
    "react-native-encrypted-storage": "^4.0.0",
    "react-native-fs": "^2.20.0"
  },
  "peerDependencies": {
    "react": "*",
    "react-native": "*"
  }
}
```

---

## Deliverables

### Files to Create/Modify

| Deliverable | File Path | Type |
|-------------|-----------|------|
| Type definitions | `src/types.ts` | Modify |
| TurboModule spec | `src/NativeZcam1Sdk.ts` | Modify |
| Init capture logic | `src/index.tsx` | Modify |
| Assertion generation | `src/utils.ts` | Modify |
| Device bindings | `src/bindings.ts` | Create |
| Camera component | `src/Camera.tsx` | Modify |
| Error codes | `src/error-codes.ts` | Create |
| Package exports | `src/index.tsx` | Modify |
| Unit tests | `__tests__/bindings.test.ts` | Create |
| Unit tests | `__tests__/init.test.ts` | Create |
| Unit tests | `__tests__/utils.test.ts` | Create |

---

## Interface Definitions

### Exported Types

```typescript
export type Platform = "ios" | "android";

export interface Settings {
  appId: string;
  gcpProjectNumber?: string;  // Android only
  production?: boolean;
}

export interface CaptureInfo {
  platform: Platform;
  appId: string;
  deviceKeyId: string;
  contentPublicKey: string;
  contentKeyId: string;
  attestation: string;
  playIntegrityToken?: string;  // Android only
}

export interface DeviceBindings {
  platform: Platform;
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

export interface PhotoCaptureResult {
  path: string;
  width: number;
  height: number;
  orientation: number;
  timestamp: number;
  deviceBindings: DeviceBindings;
}
```

### Exported Functions

```typescript
// Initialization
export async function initCapture(settings: Settings): Promise<CaptureInfo>;
export async function refreshPlayIntegrityToken(
  captureInfo: CaptureInfo,
  gcpProjectNumber: string
): Promise<string>;

// Assertion/Signing
export async function generateAppAttestAssertion(
  dataHash: ArrayBuffer,
  normalizedMetadata: string,
  deviceKeyId: string
): Promise<string>;

// Device Bindings
export function createDeviceBindings(
  captureInfo: CaptureInfo,
  assertion: string
): DeviceBindings;
export function serializeDeviceBindings(bindings: DeviceBindings): string;

// Utilities
export function normalizeMetadata(metadata: Record<string, unknown>): string;
```

### Camera Component

```typescript
export interface CameraProps {
  style?: ViewStyle;
  captureInfo: CaptureInfo;
  cameraType?: "back" | "front";
  flashMode?: "off" | "on" | "auto";
  zoom?: number;
  onError?: (error: Error) => void;
}

export interface CameraRef {
  takePhoto: () => Promise<PhotoCaptureResult>;
  setZoom: (zoom: number) => Promise<void>;
  setFlashMode: (mode: "off" | "on" | "auto") => Promise<void>;
  focus: (x: number, y: number) => Promise<void>;
}

export const Camera: ForwardRefExoticComponent<CameraProps & RefAttributes<CameraRef>>;
```

---

## Testing Plan

### Unit Tests

| Test File | Tests |
|-----------|-------|
| `bindings.test.ts` | `createDeviceBindings` creates correct iOS structure |
| | `createDeviceBindings` creates correct Android structure |
| | `serializeDeviceBindings` produces valid JSON |
| | iOS bindings have attestation/assertion |
| | Android bindings have chain/token/signature |
| `init.test.ts` | Checks Play Services on Android |
| | Throws if Play Services unavailable |
| | Generates deterministic key alias |
| | Calls pagopa functions with correct params |
| | Stores/retrieves cached values |
| | Returns correct CaptureInfo structure |
| | Requires gcpProjectNumber on Android |
| `utils.test.ts` | `normalizeMetadata` sorts keys |
| | `normalizeMetadata` is deterministic |
| | `generateAppAttestAssertion` formats message correctly |
| | Uses signWithHardwareKey on Android |
| | Uses generateHardwareSignatureWithAssertion on iOS |

### Integration Tests

| Test | Description |
|------|-------------|
| `android_init_flow` | Initialize capture on Android |
| `android_capture_flow` | Take photo with device bindings |
| `ios_init_flow` | Initialize capture on iOS (regression) |
| `ios_capture_flow` | Take photo on iOS (regression) |
| `platform_switching` | Verify correct platform detected |

### Mock Strategy

```typescript
// Mock pagopa library
jest.mock("@pagopa/io-react-native-integrity", () => ({
  isPlayServicesAvailable: jest.fn().mockResolvedValue(true),
  getAttestation: jest.fn().mockResolvedValue("mock_attestation"),
  prepareIntegrityToken: jest.fn().mockResolvedValue(undefined),
  requestIntegrityToken: jest.fn().mockResolvedValue("mock_token"),
  generateHardwareSignatureWithAssertion: jest.fn().mockResolvedValue("mock_assertion"),
}));

// Mock native module
jest.mock("./NativeZcam1Sdk", () => ({
  default: {
    signWithHardwareKey: jest.fn().mockResolvedValue("mock_signature"),
    takeNativePhoto: jest.fn().mockResolvedValue({
      path: "/tmp/photo.jpg",
      width: 4032,
      height: 3024,
      orientation: 0,
      timestamp: Date.now(),
    }),
  },
}));
```

---

## Completion Criteria

### Must Have (Required for task completion)

- [ ] **Types updated for both platforms**
  - `CaptureInfo` includes `playIntegrityToken`
  - `DeviceBindings` includes all iOS and Android fields
  - TypeScript compiles without errors

- [ ] **`initCapture` works on Android**
  - Checks Play Services availability
  - Generates deterministic key alias
  - Calls pagopa `getAttestation`
  - Calls pagopa `prepareIntegrityToken` and `requestIntegrityToken`
  - Stores values in encrypted storage
  - Returns complete `CaptureInfo`

- [ ] **`generateAppAttestAssertion` works on Android**
  - Formats message as `base64(hash)|base64(hash)`
  - Calls `signWithHardwareKey` native method
  - Returns base64 signature

- [ ] **`createDeviceBindings` works**
  - Creates iOS structure with attestation/assertion
  - Creates Android structure with chain/token/signature
  - Platform field set correctly

- [ ] **Camera component works**
  - Takes photo via native module
  - Computes photo hash
  - Generates assertion
  - Creates device bindings
  - Returns complete `PhotoCaptureResult`

- [ ] **All unit tests pass**
  - bindings.test.ts: 100%
  - init.test.ts: 100%
  - utils.test.ts: 100%

- [ ] **TypeScript compiles**
  - No type errors
  - Strict mode enabled

### Should Have (Expected but not blocking)

- [ ] **Error handling complete**
  - Error codes defined in `error-codes.ts`
  - `Zcam1Error` class with code and platform
  - Recovery strategies documented

- [ ] **iOS regression tests pass**
  - Existing iOS functionality unchanged
  - iOS-specific tests still pass

- [ ] **Documentation**
  - JSDoc on all exported functions
  - Usage examples in comments

### Nice to Have (Not required)

- [ ] **`refreshPlayIntegrityToken` implemented**
- [ ] **Retry logic for transient failures**
- [ ] **Telemetry hooks**

---

## Verification Commands

```bash
# Type check
cd react-native-zcam1-capture
npm run typecheck

# Run unit tests
npm test

# Run specific test file
npm test -- bindings.test.ts

# Run with coverage
npm test -- --coverage

# Build TypeScript
npm run build

# Lint
npm run lint
```

---

## Handoff to Next Tasks

### Output for Task 06 (Build System)

This task requires these build outputs:
- TypeScript compiles to `lib/` directory
- Type definitions generated (`.d.ts` files)
- Package exports configured in `package.json`

### Output for Task 07 (Testing)

This task provides the TypeScript API that integration tests exercise:

```typescript
// Integration test can call:
const captureInfo = await initCapture({ appId: "com.test", gcpProjectNumber: "123" });
const photo = await cameraRef.current.takePhoto();
expect(photo.deviceBindings.platform).toBe("android");
```

---

## Next Steps

After this task:
- Task 06 (Build system) configures Android build
- Task 07 (Testing) adds integration tests
