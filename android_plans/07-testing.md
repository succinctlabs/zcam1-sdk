# Task 07: Testing Strategy

## Overview

Comprehensive testing strategy for Android support including unit tests, integration tests, device testing, and end-to-end verification. This ensures parity with iOS functionality and validates the attestation chain.

**Estimated complexity:** Medium

**Dependencies:**
- All other tasks (01-06) should be substantially complete
- Can start unit tests earlier with mocked data

---

## Test Categories

### 1. Rust Unit Tests
- Key Attestation parsing
- Certificate chain validation
- ECDSA signature verification
- Play Integrity token parsing

### 2. Kotlin Unit Tests
- Camera service functionality
- Keystore operations
- Native module methods

### 3. TypeScript Unit Tests
- Platform detection
- Device bindings creation
- Metadata normalization

### 4. Integration Tests
- End-to-end capture flow
- Attestation verification
- Cross-platform verification

### 5. Device Tests
- Real hardware attestation
- StrongBox vs TEE
- Play Integrity verdicts

---

## Implementation Steps

### Step 1: Rust Unit Tests

**File:** `crates/android/src/tests/mod.rs`

```rust
mod key_attestation_tests;
mod certificate_tests;
mod signature_tests;
mod play_integrity_tests;
```

**File:** `crates/android/src/tests/key_attestation_tests.rs`

```rust
use crate::{
    key_attestation::{parse_key_attestation, validate_key_attestation},
    types::{KeyAttestationResult, SecurityLevel},
};

/// Test fixture: Real Key Attestation certificate chain from a Pixel 6
const PIXEL6_ATTESTATION_CHAIN: &str = include_str!("fixtures/pixel6_attestation.txt");

/// Test fixture: Real Key Attestation from older Samsung device (TEE)
const SAMSUNG_TEE_ATTESTATION: &str = include_str!("fixtures/samsung_tee_attestation.txt");

/// Test fixture: Emulator attestation (software keys)
const EMULATOR_ATTESTATION: &str = include_str!("fixtures/emulator_attestation.txt");

#[test]
fn test_parse_valid_attestation_chain() {
    let result = parse_key_attestation(PIXEL6_ATTESTATION_CHAIN);
    assert!(result.is_ok());

    let attestation = result.unwrap();
    assert!(!attestation.certificates.is_empty());
    assert!(attestation.certificates.len() >= 3); // leaf + intermediates + root
}

#[test]
fn test_validate_strongbox_attestation() {
    let attestation = parse_key_attestation(PIXEL6_ATTESTATION_CHAIN).unwrap();

    let result = validate_key_attestation(
        &attestation,
        b"test_challenge",
        "com.anonymous.zcam1",
        true, // production
    );

    assert!(result.is_ok());
    let validation = result.unwrap();
    assert_eq!(validation.security_level, SecurityLevel::StrongBox);
    assert!(validation.app_id_verified);
}

#[test]
fn test_validate_tee_attestation() {
    let attestation = parse_key_attestation(SAMSUNG_TEE_ATTESTATION).unwrap();

    let result = validate_key_attestation(
        &attestation,
        b"test_challenge",
        "com.anonymous.zcam1",
        true,
    );

    assert!(result.is_ok());
    let validation = result.unwrap();
    assert_eq!(validation.security_level, SecurityLevel::TrustedEnvironment);
}

#[test]
fn test_reject_software_attestation_in_production() {
    let attestation = parse_key_attestation(EMULATOR_ATTESTATION).unwrap();

    let result = validate_key_attestation(
        &attestation,
        b"test_challenge",
        "com.anonymous.zcam1",
        true, // production mode
    );

    assert!(result.is_err());
    // Should fail because software attestation not allowed in production
}

#[test]
fn test_accept_software_attestation_in_development() {
    let attestation = parse_key_attestation(EMULATOR_ATTESTATION).unwrap();

    let result = validate_key_attestation(
        &attestation,
        b"test_challenge",
        "com.anonymous.zcam1",
        false, // development mode
    );

    assert!(result.is_ok());
    let validation = result.unwrap();
    assert_eq!(validation.security_level, SecurityLevel::Software);
}

#[test]
fn test_challenge_mismatch() {
    let attestation = parse_key_attestation(PIXEL6_ATTESTATION_CHAIN).unwrap();

    let result = validate_key_attestation(
        &attestation,
        b"wrong_challenge",
        "com.anonymous.zcam1",
        true,
    );

    assert!(result.is_err());
    // Should fail due to challenge mismatch
}

#[test]
fn test_wrong_package_name() {
    let attestation = parse_key_attestation(PIXEL6_ATTESTATION_CHAIN).unwrap();

    let result = validate_key_attestation(
        &attestation,
        b"test_challenge",
        "com.wrong.package",
        true,
    );

    assert!(result.is_err());
    // Should fail due to package name mismatch
}
```

**File:** `crates/android/src/tests/certificate_tests.rs`

```rust
use crate::certificate::{validate_certificate_chain, extract_key_description};

const GOOGLE_ROOT_CERT: &str = include_str!("fixtures/google_root.pem");
const VALID_CHAIN: &str = include_str!("fixtures/valid_chain.txt");
const INVALID_CHAIN: &str = include_str!("fixtures/invalid_chain.txt");

#[test]
fn test_valid_certificate_chain() {
    let result = validate_certificate_chain(VALID_CHAIN, GOOGLE_ROOT_CERT);
    assert!(result.is_ok());
}

#[test]
fn test_invalid_certificate_chain() {
    let result = validate_certificate_chain(INVALID_CHAIN, GOOGLE_ROOT_CERT);
    assert!(result.is_err());
}

#[test]
fn test_extract_key_description() {
    let chain = parse_certificate_chain(VALID_CHAIN).unwrap();
    let leaf = &chain[0];

    let key_desc = extract_key_description(leaf);
    assert!(key_desc.is_ok());

    let desc = key_desc.unwrap();
    assert!(desc.attestation_version >= 3);
    assert!(!desc.attestation_challenge.is_empty());
}

#[test]
fn test_key_description_fields() {
    let chain = parse_certificate_chain(VALID_CHAIN).unwrap();
    let key_desc = extract_key_description(&chain[0]).unwrap();

    // Verify required fields
    assert!(key_desc.purpose.contains(&Purpose::Sign));
    assert_eq!(key_desc.algorithm, Algorithm::EC);
    assert_eq!(key_desc.key_size, 256);
    assert_eq!(key_desc.ec_curve, EcCurve::P256);
    assert_eq!(key_desc.origin, KeyOrigin::Generated);
}
```

**File:** `crates/android/src/tests/signature_tests.rs`

```rust
use crate::assertion::verify_signature;
use p256::ecdsa::{SigningKey, signature::Signer};
use rand_core::OsRng;

#[test]
fn test_verify_valid_signature() {
    // Generate a test key pair
    let signing_key = SigningKey::random(&mut OsRng);
    let verifying_key = signing_key.verifying_key();

    let message = "test_photo_hash|test_metadata_hash";
    let signature = signing_key.sign(message.as_bytes());

    let result = verify_signature(
        &base64::encode(signature.to_der()),
        "test_metadata",
        &sha256(b"test_photo"),
        &verifying_key.to_encoded_point(false).as_bytes(),
    );

    assert!(result.is_ok());
}

#[test]
fn test_verify_invalid_signature() {
    let signing_key = SigningKey::random(&mut OsRng);
    let wrong_key = SigningKey::random(&mut OsRng);
    let verifying_key = wrong_key.verifying_key();

    let message = "test_photo_hash|test_metadata_hash";
    let signature = signing_key.sign(message.as_bytes());

    let result = verify_signature(
        &base64::encode(signature.to_der()),
        "test_metadata",
        &sha256(b"test_photo"),
        &verifying_key.to_encoded_point(false).as_bytes(),
    );

    assert!(result.is_err());
}

#[test]
fn test_verify_tampered_message() {
    let signing_key = SigningKey::random(&mut OsRng);
    let verifying_key = signing_key.verifying_key();

    let message = "original_message";
    let signature = signing_key.sign(message.as_bytes());

    // Try to verify with different message
    let result = verify_signature(
        &base64::encode(signature.to_der()),
        "tampered_metadata",
        &sha256(b"tampered_photo"),
        &verifying_key.to_encoded_point(false).as_bytes(),
    );

    assert!(result.is_err());
}
```

### Step 2: Create Test Fixtures

**Directory structure:**
```
crates/android/src/tests/fixtures/
├── pixel6_attestation.txt       # Real Pixel 6 StrongBox attestation
├── samsung_tee_attestation.txt  # Real Samsung TEE attestation
├── emulator_attestation.txt     # Android emulator software attestation
├── valid_chain.txt              # Valid certificate chain
├── invalid_chain.txt            # Invalid certificate chain
├── google_root.pem              # Google attestation root CA
├── play_integrity_token.txt     # Sample Play Integrity token
└── play_integrity_keys.json     # Test decryption keys
```

**To capture real attestation data:**

```kotlin
// Test helper in example app
class AttestationCaptureHelper {
    fun captureAttestationFixture(alias: String, challenge: ByteArray): String {
        val keyStore = KeyStore.getInstance("AndroidKeyStore")
        keyStore.load(null)

        // Generate key with attestation
        val keyPairGenerator = KeyPairGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_EC, "AndroidKeyStore"
        )
        keyPairGenerator.initialize(
            KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_SIGN)
                .setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1"))
                .setDigests(KeyProperties.DIGEST_SHA256)
                .setAttestationChallenge(challenge)
                .build()
        )
        keyPairGenerator.generateKeyPair()

        // Get certificate chain
        val chain = keyStore.getCertificateChain(alias)
        val chainBase64 = chain.joinToString(",") {
            Base64.encodeToString(it.encoded, Base64.NO_WRAP)
        }

        // Save to file for test fixtures
        File(context.filesDir, "attestation_fixture.txt").writeText(chainBase64)

        return chainBase64
    }
}
```

### Step 3: Kotlin Unit Tests

**File:** `react-native-zcam1-capture/android/src/test/java/com/zcam1sdk/KeystoreSigningTest.kt`

```kotlin
package com.zcam1sdk

import android.util.Base64
import org.junit.Test
import org.junit.Assert.*
import org.mockito.Mockito.*
import java.security.KeyStore
import java.security.Signature

class KeystoreSigningTest {

    @Test
    fun `test signature format is DER encoded`() {
        // Mock keystore with test key
        val mockKeyStore = mock(KeyStore::class.java)
        val mockPrivateKey = TestUtils.generateTestKeyPair().private

        `when`(mockKeyStore.containsAlias("test_key")).thenReturn(true)
        `when`(mockKeyStore.getKey("test_key", null)).thenReturn(mockPrivateKey)

        val data = "test_data"
        val signature = Signature.getInstance("SHA256withECDSA")
        signature.initSign(mockPrivateKey)
        signature.update(data.toByteArray(Charsets.UTF_8))
        val signatureBytes = signature.sign()

        // Verify DER format (starts with 0x30 SEQUENCE tag)
        assertEquals(0x30.toByte(), signatureBytes[0])

        // Verify base64 encoding is correct
        val base64Sig = Base64.encodeToString(signatureBytes, Base64.NO_WRAP)
        assertTrue(base64Sig.isNotEmpty())
        assertFalse(base64Sig.contains("\n"))
    }

    @Test
    fun `test signature is deterministic for same key and data`() {
        // Note: ECDSA signatures are NOT deterministic by default
        // This test verifies that different signatures still verify correctly
        val keyPair = TestUtils.generateTestKeyPair()

        val data = "test_data"
        val sig1 = sign(keyPair.private, data)
        val sig2 = sign(keyPair.private, data)

        // Signatures will be different
        assertNotEquals(sig1, sig2)

        // But both should verify
        assertTrue(verify(keyPair.public, data, sig1))
        assertTrue(verify(keyPair.public, data, sig2))
    }
}
```

**File:** `react-native-zcam1-capture/android/src/test/java/com/zcam1sdk/camera/CameraServiceTest.kt`

```kotlin
package com.zcam1sdk.camera

import org.junit.Test
import org.junit.Assert.*

class CameraServiceTest {

    @Test
    fun `test orientation calculation from accelerometer`() {
        val service = Zcam1CameraService(mockContext)

        // Test portrait (device upright)
        assertEquals(0, service.calculateOrientation(0f, 9.8f))

        // Test landscape left (rotated 90 degrees clockwise)
        assertEquals(90, service.calculateOrientation(9.8f, 0f))

        // Test landscape right (rotated 90 degrees counter-clockwise)
        assertEquals(270, service.calculateOrientation(-9.8f, 0f))

        // Test upside down
        assertEquals(180, service.calculateOrientation(0f, -9.8f))
    }

    @Test
    fun `test flash mode mapping`() {
        val service = Zcam1CameraService(mockContext)

        service.setFlashMode("on")
        assertEquals(ImageCapture.FLASH_MODE_ON, service.getFlashMode())

        service.setFlashMode("off")
        assertEquals(ImageCapture.FLASH_MODE_OFF, service.getFlashMode())

        service.setFlashMode("auto")
        assertEquals(ImageCapture.FLASH_MODE_AUTO, service.getFlashMode())

        // Default to off for unknown values
        service.setFlashMode("invalid")
        assertEquals(ImageCapture.FLASH_MODE_OFF, service.getFlashMode())
    }

    @Test
    fun `test zoom clamping`() {
        val service = Zcam1CameraService(mockContext)
        service.maxZoom = 10f

        // Normal zoom
        service.setZoom(5f)
        assertEquals(5f, service.getCurrentZoom())

        // Clamp to max
        service.setZoom(15f)
        assertEquals(10f, service.getCurrentZoom())

        // Clamp to min (1.0)
        service.setZoom(0.5f)
        assertEquals(1f, service.getCurrentZoom())
    }
}
```

### Step 4: TypeScript Unit Tests

**File:** `react-native-zcam1-capture/__tests__/bindings.test.ts`

```typescript
import { createDeviceBindings, serializeDeviceBindings } from "../src/bindings";
import type { CaptureInfo } from "../src/types";

describe("createDeviceBindings", () => {
  const baseInfo = {
    appId: "com.test.app",
    deviceKeyId: "test_key_123",
    contentPublicKey: "pk_content",
    contentKeyId: "ck_content",
  };

  it("creates iOS bindings with correct fields", () => {
    const captureInfo: CaptureInfo = {
      ...baseInfo,
      platform: "ios",
      attestation: "ios_attestation_data",
    };

    const bindings = createDeviceBindings(captureInfo, "ios_assertion_data");

    expect(bindings.platform).toBe("ios");
    expect(bindings.app_id).toBe("com.test.app");
    expect(bindings.device_key_id).toBe("test_key_123");
    expect(bindings.attestation).toBe("ios_attestation_data");
    expect(bindings.assertion).toBe("ios_assertion_data");

    // Android fields should be undefined
    expect(bindings.key_attestation_chain).toBeUndefined();
    expect(bindings.play_integrity_token).toBeUndefined();
    expect(bindings.signature).toBeUndefined();
  });

  it("creates Android bindings with correct fields", () => {
    const captureInfo: CaptureInfo = {
      ...baseInfo,
      platform: "android",
      attestation: "android_cert_chain",
      playIntegrityToken: "play_token_123",
    };

    const bindings = createDeviceBindings(captureInfo, "android_signature");

    expect(bindings.platform).toBe("android");
    expect(bindings.app_id).toBe("com.test.app");
    expect(bindings.device_key_id).toBe("test_key_123");
    expect(bindings.key_attestation_chain).toBe("android_cert_chain");
    expect(bindings.play_integrity_token).toBe("play_token_123");
    expect(bindings.signature).toBe("android_signature");

    // iOS fields should be undefined
    expect(bindings.attestation).toBeUndefined();
    expect(bindings.assertion).toBeUndefined();
  });

  it("serializes bindings to valid JSON", () => {
    const captureInfo: CaptureInfo = {
      ...baseInfo,
      platform: "android",
      attestation: "cert_chain",
      playIntegrityToken: "token",
    };

    const bindings = createDeviceBindings(captureInfo, "sig");
    const json = serializeDeviceBindings(bindings);

    expect(() => JSON.parse(json)).not.toThrow();

    const parsed = JSON.parse(json);
    expect(parsed.platform).toBe("android");
  });
});

describe("normalizeMetadata", () => {
  it("sorts keys alphabetically", () => {
    const input = { z: 1, a: 2, m: 3 };
    const result = normalizeMetadata(input);
    expect(result).toBe('{"a":2,"m":3,"z":1}');
  });

  it("produces consistent output", () => {
    const input1 = { b: 1, a: 2 };
    const input2 = { a: 2, b: 1 };

    expect(normalizeMetadata(input1)).toBe(normalizeMetadata(input2));
  });

  it("handles special characters", () => {
    const input = { key: "value with 'quotes' and \"double\"" };
    const result = normalizeMetadata(input);

    // Should not throw and should be valid JSON
    expect(() => JSON.parse(result)).not.toThrow();
  });
});
```

**File:** `react-native-zcam1-capture/__tests__/init.test.ts`

```typescript
import { Platform } from "react-native";
import { initCapture } from "../src/index";

// Mock React Native Platform
jest.mock("react-native", () => ({
  Platform: { OS: "android" },
}));

// Mock pagopa library
jest.mock("@pagopa/io-react-native-integrity", () => ({
  isPlayServicesAvailable: jest.fn().mockResolvedValue(true),
  getAttestation: jest.fn().mockResolvedValue("mock_attestation"),
  prepareIntegrityToken: jest.fn().mockResolvedValue(undefined),
  requestIntegrityToken: jest.fn().mockResolvedValue("mock_play_token"),
}));

// Mock encrypted storage
jest.mock("react-native-encrypted-storage", () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

describe("initCapture on Android", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("checks Play Services availability", async () => {
    const { isPlayServicesAvailable } = require("@pagopa/io-react-native-integrity");

    await initCapture({ appId: "com.test", gcpProjectNumber: "123" });

    expect(isPlayServicesAvailable).toHaveBeenCalled();
  });

  it("throws if Play Services unavailable", async () => {
    const { isPlayServicesAvailable } = require("@pagopa/io-react-native-integrity");
    isPlayServicesAvailable.mockResolvedValueOnce(false);

    await expect(
      initCapture({ appId: "com.test", gcpProjectNumber: "123" })
    ).rejects.toThrow("Google Play Services not available");
  });

  it("generates deterministic key alias", async () => {
    const EncryptedStorage = require("react-native-encrypted-storage");

    await initCapture({ appId: "com.myapp", gcpProjectNumber: "123" });

    // Should store with app-specific alias
    expect(EncryptedStorage.setItem).toHaveBeenCalledWith(
      "deviceKeyId-com.myapp",
      expect.stringContaining("zcam1_com.myapp_device_key")
    );
  });

  it("requests Play Integrity token with hash binding", async () => {
    const { requestIntegrityToken } = require("@pagopa/io-react-native-integrity");

    await initCapture({ appId: "com.test", gcpProjectNumber: "123456" });

    // Should pass base64(sha256(deviceKeyId)) as requestHash
    expect(requestIntegrityToken).toHaveBeenCalledWith(expect.any(String));
  });

  it("requires gcpProjectNumber on Android", async () => {
    await expect(initCapture({ appId: "com.test" })).rejects.toThrow(
      "gcpProjectNumber required"
    );
  });

  it("returns correct CaptureInfo structure", async () => {
    const result = await initCapture({
      appId: "com.test",
      gcpProjectNumber: "123",
    });

    expect(result.platform).toBe("android");
    expect(result.appId).toBe("com.test");
    expect(result.deviceKeyId).toBeDefined();
    expect(result.attestation).toBe("mock_attestation");
    expect(result.playIntegrityToken).toBe("mock_play_token");
  });
});
```

### Step 5: Integration Tests

**File:** `e2e/android/capture-flow.test.ts`

```typescript
import { device, element, by, expect } from "detox";

describe("Android Capture Flow", () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it("should initialize capture system", async () => {
    // Tap init button
    await element(by.id("init-capture-btn")).tap();

    // Wait for initialization
    await waitFor(element(by.id("init-status")))
      .toHaveText("Initialized")
      .withTimeout(10000);

    // Verify attestation was obtained
    await expect(element(by.id("attestation-status"))).toHaveText("Valid");
    await expect(element(by.id("play-integrity-status"))).toHaveText("Valid");
  });

  it("should capture photo with device bindings", async () => {
    // Initialize first
    await element(by.id("init-capture-btn")).tap();
    await waitFor(element(by.id("init-status")))
      .toHaveText("Initialized")
      .withTimeout(10000);

    // Open camera
    await element(by.id("open-camera-btn")).tap();

    // Wait for camera preview
    await waitFor(element(by.id("camera-preview")))
      .toBeVisible()
      .withTimeout(5000);

    // Capture photo
    await element(by.id("capture-btn")).tap();

    // Wait for capture complete
    await waitFor(element(by.id("capture-result")))
      .toBeVisible()
      .withTimeout(10000);

    // Verify device bindings present
    await expect(element(by.id("bindings-platform"))).toHaveText("android");
    await expect(element(by.id("bindings-signature"))).not.toHaveText("");
  });

  it("should verify captured photo", async () => {
    // After capture, verify the photo
    await element(by.id("verify-btn")).tap();

    await waitFor(element(by.id("verify-result")))
      .toHaveText("Verified")
      .withTimeout(15000);

    // Check verification details
    await expect(element(by.id("verify-security-level"))).toHaveText(
      expect.stringMatching(/strongbox|tee/i)
    );
  });
});

describe("Android Error Handling", () => {
  it("should handle Play Services unavailable", async () => {
    // This test requires mocking at native level
    // or running on a device without Play Services
  });

  it("should handle key not found", async () => {
    // Clear app data between runs
    await device.clearKeychain();

    // Try to sign without initialization
    await element(by.id("sign-only-btn")).tap();

    await expect(element(by.id("error-message"))).toHaveText(
      expect.stringContaining("KEY_NOT_FOUND")
    );
  });
});
```

### Step 6: Device Test Matrix

**Devices to test on:**

| Device | Android Version | Security Level | Notes |
|--------|-----------------|----------------|-------|
| Pixel 6+ | 12+ | StrongBox | Best case, Titan M2 |
| Pixel 4/5 | 10-11 | StrongBox | Titan M |
| Samsung S21+ | 11+ | StrongBox | Knox |
| Samsung A series | 10+ | TEE | Mid-range |
| OnePlus | 10+ | TEE | Common device |
| Xiaomi | 10+ | TEE | Large market share |
| Emulator | Any | Software | Development only |

**Test script for device matrix:**

```bash
#!/bin/bash
# scripts/test-device-matrix.sh

DEVICES=(
    "Pixel_6_API_33"
    "Pixel_4_API_30"
    "Samsung_Galaxy_S21_API_31"
    "Medium_Phone_API_30"
)

for device in "${DEVICES[@]}"; do
    echo "Testing on $device..."

    # Start emulator or connect device
    adb -s "$device" shell am start -n com.zcam1example/.MainActivity

    # Run tests
    npx detox test -c android.emu."$device" --headless

    # Collect results
    adb -s "$device" pull /sdcard/test_results.json "./results/$device.json"
done

# Generate summary report
node scripts/generate-device-report.js
```

### Step 7: Cross-Platform Verification Tests

**File:** `e2e/cross-platform/verify-android-on-ios.test.ts`

```typescript
describe("Cross-Platform Verification", () => {
  it("should verify Android photo on iOS verifier", async () => {
    // This test requires:
    // 1. Photo captured on Android device
    // 2. Transferred to iOS device or simulator
    // 3. Verified using iOS verifier

    // Load Android-captured photo fixture
    const androidPhoto = await loadFixture("android_captured_photo.jpg");
    const androidBindings = await loadFixture("android_bindings.json");

    // Verify on iOS
    const result = await verifyPhoto(androidPhoto, androidBindings);

    expect(result.valid).toBe(true);
    expect(result.platform).toBe("android");
    expect(result.security_level).toBe("strongbox");
  });

  it("should verify iOS photo on Android verifier", async () => {
    const iosPhoto = await loadFixture("ios_captured_photo.jpg");
    const iosBindings = await loadFixture("ios_bindings.json");

    const result = await verifyPhoto(iosPhoto, iosBindings);

    expect(result.valid).toBe(true);
    expect(result.platform).toBe("ios");
    expect(result.security_level).toBe("secure_enclave");
  });

  it("should verify Android photo on web verifier", async () => {
    const androidPhoto = await loadFixture("android_captured_photo.jpg");

    // Upload to web verifier
    const response = await fetch("https://verify.zcam1.example/api/verify", {
      method: "POST",
      body: androidPhoto,
    });

    const result = await response.json();
    expect(result.valid).toBe(true);
    expect(result.platform).toBe("android");
  });
});
```

### Step 8: CI Configuration

**File:** `.github/workflows/test.yml`

```yaml
name: Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  rust-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-action@stable
      - name: Run Rust tests
        run: cd crates && cargo test --all-features

  typescript-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm ci
      - run: npm test

  android-unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          java-version: "17"
          distribution: "temurin"
      - name: Run Android unit tests
        run: |
          cd packages/react-native-zcam1-capture/android
          ./gradlew test

  android-integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Enable KVM
        run: |
          echo 'KERNEL=="kvm", GROUP="kvm", MODE="0666"' | sudo tee /etc/udev/rules.d/99-kvm4all.rules
          sudo udevadm control --reload-rules
          sudo udevadm trigger --name-match=kvm

      - uses: reactivecircus/android-emulator-runner@v2
        with:
          api-level: 30
          target: google_apis
          arch: x86_64
          script: |
            npm ci
            npx detox build -c android.emu.debug
            npx detox test -c android.emu.debug --headless

  ios-tests:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm ci
      - run: cd example/ios && pod install
      - run: npx detox build -c ios.sim.debug
      - run: npx detox test -c ios.sim.debug --headless
```

---

## Test Fixtures Management

### Capturing Fixtures from Real Devices

```kotlin
// Add to example app for capturing test fixtures
class FixtureCapture {
    fun captureAllFixtures() {
        val fixtures = mutableMapOf<String, String>()

        // Key Attestation
        val alias = "fixture_key_${System.currentTimeMillis()}"
        val challenge = "test_challenge".toByteArray()
        fixtures["key_attestation"] = captureKeyAttestation(alias, challenge)

        // Play Integrity
        fixtures["play_integrity"] = capturePlayIntegrityToken()

        // Device info
        fixtures["device_info"] = captureDeviceInfo()

        // Write to file
        val json = JSONObject(fixtures).toString(2)
        File(context.filesDir, "test_fixtures.json").writeText(json)
    }

    private fun captureDeviceInfo(): String {
        return JSONObject().apply {
            put("manufacturer", Build.MANUFACTURER)
            put("model", Build.MODEL)
            put("sdk", Build.VERSION.SDK_INT)
            put("security_patch", Build.VERSION.SECURITY_PATCH)
        }.toString()
    }
}
```

### Fixture Directory Structure

```
crates/android/src/tests/fixtures/
├── README.md                       # How to capture new fixtures
├── pixel6/
│   ├── key_attestation.txt
│   ├── device_info.json
│   └── play_integrity.txt
├── samsung_s21/
│   ├── key_attestation.txt
│   └── device_info.json
├── emulator/
│   ├── key_attestation.txt
│   └── device_info.json
└── invalid/
    ├── expired_chain.txt
    ├── wrong_package.txt
    └── tampered_signature.txt
```

---

## Files Summary

| File | Purpose |
|------|---------|
| `crates/android/src/tests/*.rs` | Rust unit tests |
| `crates/android/src/tests/fixtures/` | Test attestation data |
| `*/android/src/test/java/` | Kotlin unit tests |
| `*/__tests__/*.test.ts` | TypeScript unit tests |
| `e2e/android/*.test.ts` | Detox integration tests |
| `.github/workflows/test.yml` | CI test configuration |

---

## Testing Checklist

### Unit Tests
- [ ] Rust: Key Attestation parsing
- [ ] Rust: Certificate chain validation
- [ ] Rust: ECDSA signature verification
- [ ] Rust: Play Integrity token parsing
- [ ] Kotlin: Keystore signing
- [ ] Kotlin: Camera orientation
- [ ] TypeScript: Device bindings creation
- [ ] TypeScript: Metadata normalization
- [ ] TypeScript: Platform detection

### Integration Tests
- [ ] Full capture flow on emulator
- [ ] Full capture flow on real device
- [ ] Cross-platform verification
- [ ] Error recovery flows

### Device Tests
- [ ] StrongBox attestation (Pixel 6+)
- [ ] TEE attestation (older devices)
- [ ] Software fallback (emulator)
- [ ] Play Integrity on different devices

### CI/CD
- [ ] All tests pass in CI
- [ ] Coverage reports generated
- [ ] Device matrix automated

---

## Deliverables

### Files to Create

| Deliverable | File Path | Type |
|-------------|-----------|------|
| Rust unit tests | `crates/android/src/tests/*.rs` | Create |
| Rust test fixtures | `crates/android/tests/fixtures/*.txt` | Create |
| Kotlin unit tests | `*/android/src/test/java/com/zcam1sdk/*.kt` | Create |
| TypeScript unit tests | `*/__tests__/*.test.ts` | Create |
| Detox config | `example/.detoxrc.js` | Create |
| E2E tests | `example/e2e/*.test.ts` | Create |
| CI test workflow | `.github/workflows/test.yml` | Create |
| Fixture capture app | `example/src/FixtureCapture.tsx` | Create |
| Test utilities | `example/src/testUtils.ts` | Create |

---

## Interface Definitions

### Test Fixture Format

```typescript
// fixtures/android_attestation.json
interface AndroidAttestationFixture {
  device: {
    manufacturer: string;
    model: string;
    sdk_version: number;
    security_patch: string;
  };
  challenge: string;
  key_attestation_chain: string;  // base64 encoded
  play_integrity_token: string;   // encrypted JWT
  signature: string;              // base64 DER signature
  message: string;                // signed message
  public_key: string;             // hex encoded
  security_level: "strongbox" | "tee" | "software";
  captured_at: string;            // ISO date
}
```

### Detox Test Helpers

```typescript
// testUtils.ts
export async function initializeCapture(): Promise<void>;
export async function takePhoto(): Promise<PhotoResult>;
export async function verifyPhoto(path: string): Promise<VerificationResult>;
export async function captureFixture(): Promise<AndroidAttestationFixture>;
```

### Test Reporter Interface

```typescript
interface TestReport {
  platform: "android";
  device: string;
  tests_passed: number;
  tests_failed: number;
  coverage: number;
  fixtures_captured: string[];
  duration_ms: number;
}
```

---

## Testing Plan

### Test Execution Order

1. **Rust unit tests** (can run independently)
2. **Kotlin unit tests** (can run independently)
3. **TypeScript unit tests** (can run independently)
4. **Build verification** (depends on all units passing)
5. **Emulator integration tests** (depends on build)
6. **Device integration tests** (manual, for fixtures)
7. **Cross-platform verification** (final validation)

### Fixture Capture Process

```kotlin
// Run on real device to capture fixtures
class FixtureCaptureActivity : AppCompatActivity() {
    fun captureFixtures() {
        // 1. Generate attested key
        val keyAlias = "fixture_key_${System.currentTimeMillis()}"
        val challenge = "test_challenge_123"

        // 2. Get attestation
        val attestation = generateAttestedKey(keyAlias, challenge)

        // 3. Get Play Integrity
        val playToken = requestPlayIntegrityToken(challenge)

        // 4. Create and sign test message
        val message = "test_photo_hash|test_metadata_hash"
        val signature = signWithKey(keyAlias, message)

        // 5. Extract public key
        val publicKey = extractPublicKey(keyAlias)

        // 6. Determine security level
        val securityLevel = getSecurityLevel(attestation)

        // 7. Save fixture
        saveFixture(AndroidAttestationFixture(
            device = getDeviceInfo(),
            challenge = challenge,
            key_attestation_chain = attestation,
            play_integrity_token = playToken,
            signature = signature,
            message = message,
            public_key = publicKey,
            security_level = securityLevel,
            captured_at = Instant.now().toString()
        ))
    }
}
```

---

## Completion Criteria

### Must Have (Required for task completion)

- [ ] **Rust tests pass**
  - All unit tests in `crates/android/` pass
  - At least 20 tests
  - Coverage > 80% for new code

- [ ] **Kotlin tests pass**
  - All unit tests in Android modules pass
  - Camera service tests
  - Signing tests

- [ ] **TypeScript tests pass**
  - All unit tests in `__tests__/` pass
  - Platform detection tests
  - Bindings creation tests

- [ ] **Test fixtures exist**
  - At least one StrongBox fixture (Pixel 6+)
  - At least one TEE fixture (older device)
  - Emulator fixture

- [ ] **Emulator integration passes**
  - Full capture flow on emulator
  - Bindings created correctly
  - (Software attestation acceptable)

- [ ] **CI pipeline passes**
  - All tests run in GitHub Actions
  - Coverage reports generated
  - Test results visible

- [ ] **Documentation**
  - How to run tests locally
  - How to capture new fixtures
  - Test coverage requirements

### Should Have (Expected but not blocking)

- [ ] **Device matrix tested**
  - Tested on 3+ device types
  - StrongBox and TEE both verified

- [ ] **Cross-platform verification**
  - Android photo verified on iOS
  - iOS photo verified on Android

- [ ] **Performance benchmarks**
  - Attestation time measured
  - Signature time measured

### Nice to Have (Not required)

- [ ] **Automated device farm**
  - Firebase Test Lab integration
  - Automated device matrix

- [ ] **Fuzzing tests**
  - ASN.1 parser fuzzing
  - JSON parser fuzzing

---

## Verification Commands

```bash
# Run all Rust tests
cd crates && cargo test

# Run Android Rust tests only
cargo test -p zcam1-android

# Run Kotlin tests
cd react-native-zcam1-capture/android
./gradlew test

# Run TypeScript tests
cd react-native-zcam1-capture
npm test

# Run with coverage
npm test -- --coverage

# Run Detox tests
cd example
npx detox build -c android.emu.debug
npx detox test -c android.emu.debug

# Run specific test
npx detox test -c android.emu.debug --testNamePattern "capture flow"
```

---

## Test Coverage Requirements

| Component | Minimum Coverage | Target Coverage |
|-----------|-----------------|-----------------|
| `crates/android/` | 80% | 90% |
| `crates/verify-utils/` | 80% | 90% |
| `react-native-zcam1-capture/src/` | 70% | 85% |
| Integration (E2E) | 5 scenarios | 10 scenarios |

---

## Device Test Matrix

| Device | Android | Security | Priority | Status |
|--------|---------|----------|----------|--------|
| Pixel 6 Pro | 14 | StrongBox | P0 | ⬜ |
| Pixel 4a | 13 | StrongBox | P1 | ⬜ |
| Samsung S22 | 13 | StrongBox | P1 | ⬜ |
| Samsung A53 | 13 | TEE | P2 | ⬜ |
| OnePlus 9 | 12 | TEE | P2 | ⬜ |
| Xiaomi 12 | 12 | TEE | P3 | ⬜ |
| Emulator x86_64 | 34 | Software | P0 | ⬜ |

---

## Handoff

### Fixture Storage

Test fixtures should be committed to:
```
crates/android/tests/fixtures/
├── pixel6_strongbox.json
├── pixel4_tee.json
├── samsung_tee.json
├── emulator_software.json
└── README.md  # How to capture new fixtures
```

### CI Artifacts

Test runs produce:
- Coverage reports (HTML)
- Test results (JUnit XML)
- Captured fixtures (JSON)
- Performance benchmarks (JSON)

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Unit test pass rate | 100% |
| Integration test pass rate | 100% |
| Code coverage (Rust) | > 80% |
| Code coverage (TS) | > 70% |
| Devices tested | ≥ 3 |
| Fixtures captured | ≥ 3 |
| CI build time | < 30 min |
