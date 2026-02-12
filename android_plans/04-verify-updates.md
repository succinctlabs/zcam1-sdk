# Task 04: Verify Crate Updates

## Overview

Update the Rust verification crates to support Android device bindings alongside existing iOS support. This requires platform detection and routing to the appropriate verification logic.

**Estimated complexity:** Medium

**Dependencies:**
- Task 02 (Rust Android crate) should be complete or at least have defined interfaces

---

## Background Context

### Current Verification Flow

The existing verification flow in `crates/verify-bindings/` and `crates/verify-utils/` handles iOS attestation:

1. Parse C2PA manifest from photo
2. Extract device bindings assertion (`com.zcam1.device-bindings`)
3. Validate iOS attestation (certificate chain, nonce, app ID)
4. Verify assertion signature against photo hash
5. Return verification result

### What Changes for Android

The verification logic needs to:
1. Detect platform from device bindings (`"platform": "ios"` vs `"platform": "android"`)
2. Route to iOS or Android verification logic
3. For Android: validate Key Attestation + Play Integrity + signature

---

## Implementation Steps

### Step 1: Update DeviceBindings Type

**File:** `crates/verify-utils/src/types.rs`

Update the `DeviceBindings` struct to support both platforms:

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceBindings {
    /// Platform identifier: "ios" or "android"
    pub platform: String,

    /// App bundle ID (iOS) or package name (Android)
    pub app_id: String,

    /// Device key identifier
    pub device_key_id: String,

    // iOS-specific fields
    /// iOS App Attest attestation (CBOR-encoded)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub attestation: Option<String>,

    /// iOS App Attest assertion (CBOR-encoded signature)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub assertion: Option<String>,

    // Android-specific fields
    /// Android Key Attestation certificate chain (base64-encoded)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub key_attestation_chain: Option<String>,

    /// Google Play Integrity token (encrypted JWT)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub play_integrity_token: Option<String>,

    /// Android ECDSA signature (base64-encoded)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub signature: Option<String>,
}

impl DeviceBindings {
    pub fn is_ios(&self) -> bool {
        self.platform == "ios"
    }

    pub fn is_android(&self) -> bool {
        self.platform == "android"
    }
}
```

### Step 2: Create Platform Verification Router

**File:** `crates/verify-utils/src/verify.rs`

```rust
use crate::error::VerifyError;
use crate::types::DeviceBindings;

#[cfg(feature = "ios")]
use zcam1_ios as ios;

#[cfg(feature = "android")]
use zcam1_android as android;

/// Verify device bindings from a C2PA manifest
pub fn verify_device_bindings(
    bindings: &DeviceBindings,
    normalized_metadata: &str,
    photo_hash: &[u8],
    production: bool,
) -> Result<VerificationResult, VerifyError> {
    match bindings.platform.as_str() {
        "ios" => verify_ios_bindings(bindings, normalized_metadata, photo_hash, production),
        "android" => verify_android_bindings(bindings, normalized_metadata, photo_hash, production),
        _ => Err(VerifyError::UnsupportedPlatform(bindings.platform.clone())),
    }
}

#[cfg(feature = "ios")]
fn verify_ios_bindings(
    bindings: &DeviceBindings,
    normalized_metadata: &str,
    photo_hash: &[u8],
    production: bool,
) -> Result<VerificationResult, VerifyError> {
    let attestation = bindings.attestation.as_ref()
        .ok_or(VerifyError::MissingField("attestation"))?;
    let assertion = bindings.assertion.as_ref()
        .ok_or(VerifyError::MissingField("assertion"))?;

    // Parse attestation object
    let attestation_obj = ios::parse_attestation(attestation)?;

    // Validate attestation (cert chain, nonce, app ID)
    let public_key = ios::validate_attestation(
        attestation_obj,
        bindings.device_key_id.clone(),
        hex::decode(&bindings.device_key_id).map_err(|_| VerifyError::InvalidKeyId)?,
        bindings.app_id.clone(),
        production,
        false, // leaf_cert_only
    )?;

    // Verify assertion signature
    ios::verify_assertion(
        assertion,
        normalized_metadata,
        photo_hash,
        &public_key,
    )?;

    Ok(VerificationResult {
        platform: "ios".to_string(),
        valid: true,
        security_level: "secure_enclave".to_string(),
        app_id_verified: true,
        device_integrity_verified: true,
    })
}

#[cfg(feature = "android")]
fn verify_android_bindings(
    bindings: &DeviceBindings,
    normalized_metadata: &str,
    photo_hash: &[u8],
    production: bool,
) -> Result<VerificationResult, VerifyError> {
    let key_attestation_chain = bindings.key_attestation_chain.as_ref()
        .ok_or(VerifyError::MissingField("key_attestation_chain"))?;
    let signature = bindings.signature.as_ref()
        .ok_or(VerifyError::MissingField("signature"))?;

    // Parse and validate Key Attestation certificate chain
    let key_attestation = android::parse_key_attestation(key_attestation_chain)?;

    let attestation_result = android::validate_key_attestation(
        &key_attestation,
        bindings.device_key_id.as_bytes(),
        &bindings.app_id,
        production,
    )?;

    // Verify signature
    android::verify_signature(
        signature,
        normalized_metadata,
        photo_hash,
        &attestation_result.public_key,
    )?;

    // Optionally verify Play Integrity token
    let play_integrity_verified = if let Some(token) = &bindings.play_integrity_token {
        // Note: Play Integrity verification requires decryption keys
        // If keys are available, verify offline
        // Otherwise, mark as "not verified" but don't fail
        android::verify_play_integrity_token(
            token,
            &bindings.device_key_id,
            &bindings.app_id,
        ).unwrap_or(false)
    } else {
        false
    };

    Ok(VerificationResult {
        platform: "android".to_string(),
        valid: true,
        security_level: attestation_result.security_level.to_string(),
        app_id_verified: attestation_result.app_id_verified,
        device_integrity_verified: play_integrity_verified,
    })
}

#[cfg(not(feature = "ios"))]
fn verify_ios_bindings(
    _bindings: &DeviceBindings,
    _normalized_metadata: &str,
    _photo_hash: &[u8],
    _production: bool,
) -> Result<VerificationResult, VerifyError> {
    Err(VerifyError::PlatformNotSupported("ios"))
}

#[cfg(not(feature = "android"))]
fn verify_android_bindings(
    _bindings: &DeviceBindings,
    _normalized_metadata: &str,
    _photo_hash: &[u8],
    _production: bool,
) -> Result<VerificationResult, VerifyError> {
    Err(VerifyError::PlatformNotSupported("android"))
}
```

### Step 3: Update Verification Result

**File:** `crates/verify-utils/src/types.rs`

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VerificationResult {
    /// Platform that was verified
    pub platform: String,

    /// Overall verification passed
    pub valid: bool,

    /// Security level of the key
    /// iOS: "secure_enclave"
    /// Android: "strongbox", "tee", or "software"
    pub security_level: String,

    /// App identity was verified
    pub app_id_verified: bool,

    /// Device integrity was verified
    /// iOS: implicit in attestation
    /// Android: from Play Integrity token
    pub device_integrity_verified: bool,
}
```

### Step 4: Update Error Types

**File:** `crates/verify-utils/src/error.rs`

```rust
use thiserror::Error;

#[derive(Debug, Error)]
pub enum VerifyError {
    #[error("Unsupported platform: {0}")]
    UnsupportedPlatform(String),

    #[error("Platform {0} support not compiled in")]
    PlatformNotSupported(&'static str),

    #[error("Missing required field: {0}")]
    MissingField(&'static str),

    #[error("Invalid device key ID")]
    InvalidKeyId,

    // iOS errors
    #[error("iOS attestation error: {0}")]
    IosAttestation(#[from] zcam1_ios::Error),

    // Android errors
    #[error("Android attestation error: {0}")]
    AndroidAttestation(#[from] zcam1_android::Error),

    #[error("Signature verification failed")]
    SignatureVerificationFailed,

    #[error("Certificate chain validation failed")]
    CertificateChainInvalid,
}
```

### Step 5: Update Cargo.toml

**File:** `crates/verify-utils/Cargo.toml`

```toml
[package]
name = "zcam1-verify-utils"
version = "0.1.0"
edition = "2021"

[features]
default = ["ios", "android"]
ios = ["zcam1-ios"]
android = ["zcam1-android"]

[dependencies]
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
thiserror = "1.0"
hex = "0.4"
base64ct = { version = "1.6", features = ["alloc"] }

# Platform-specific crates
zcam1-ios = { path = "../ios", optional = true }
zcam1-android = { path = "../android", optional = true }
```

### Step 6: Update UniFFI Bindings

**File:** `crates/verify-bindings/src/lib.rs`

```rust
use zcam1_verify_utils::{
    verify::verify_device_bindings,
    types::{DeviceBindings, VerificationResult},
    error::VerifyError,
};

uniffi::setup_scaffolding!();

/// Verify device bindings extracted from a C2PA manifest
///
/// This function:
/// 1. Detects the platform (iOS or Android) from the bindings
/// 2. Validates platform-specific attestation
/// 3. Verifies the signature over the photo hash and metadata
///
/// # Arguments
/// * `bindings_json` - JSON-serialized DeviceBindings
/// * `normalized_metadata` - Canonical metadata string that was signed
/// * `photo_hash` - SHA-256 hash of the photo data
/// * `production` - Whether to validate for production (strict) or development
///
/// # Returns
/// * `Ok(VerificationResultJson)` - JSON-serialized result on success
/// * `Err(String)` - Error message on failure
#[uniffi::export]
pub fn verify_bindings_from_manifest(
    bindings_json: String,
    normalized_metadata: String,
    photo_hash: Vec<u8>,
    production: bool,
) -> Result<String, String> {
    let bindings: DeviceBindings = serde_json::from_str(&bindings_json)
        .map_err(|e| format!("Failed to parse bindings: {}", e))?;

    let result = verify_device_bindings(
        &bindings,
        &normalized_metadata,
        &photo_hash,
        production,
    ).map_err(|e| format!("Verification failed: {}", e))?;

    serde_json::to_string(&result)
        .map_err(|e| format!("Failed to serialize result: {}", e))
}

/// Get the platform from device bindings without full verification
#[uniffi::export]
pub fn get_bindings_platform(bindings_json: String) -> Result<String, String> {
    let bindings: DeviceBindings = serde_json::from_str(&bindings_json)
        .map_err(|e| format!("Failed to parse bindings: {}", e))?;

    Ok(bindings.platform)
}

/// Check if a platform is supported by this build
#[uniffi::export]
pub fn is_platform_supported(platform: String) -> bool {
    match platform.as_str() {
        #[cfg(feature = "ios")]
        "ios" => true,
        #[cfg(feature = "android")]
        "android" => true,
        _ => false,
    }
}
```

### Step 7: Update UniFFI Config

**File:** `crates/verify-bindings/uniffi.toml`

```toml
[bindings.kotlin]
package_name = "com.zcam1sdk.verify"
cdylib_name = "zcam1_verify"

[bindings.swift]
module_name = "Zcam1Verify"
```

---

## Integration Points

### With Task 02 (Rust Android Crate)

The verify-utils crate imports from `crates/android/`:

```rust
use zcam1_android::{
    parse_key_attestation,
    validate_key_attestation,
    verify_signature,
    verify_play_integrity_token,
    KeyAttestationResult,
    Error,
};
```

### With Existing iOS Crate

The verify-utils crate imports from `crates/ios/`:

```rust
use zcam1_ios::{
    parse_attestation,
    validate_attestation,
    verify_assertion,
    Error,
};
```

---

## Files Summary

| File | Purpose |
|------|---------|
| `crates/verify-utils/src/types.rs` | DeviceBindings struct with platform fields |
| `crates/verify-utils/src/verify.rs` | Platform detection and routing |
| `crates/verify-utils/src/error.rs` | Error types for both platforms |
| `crates/verify-utils/Cargo.toml` | Feature flags for platform support |
| `crates/verify-bindings/src/lib.rs` | UniFFI exports |
| `crates/verify-bindings/uniffi.toml` | UniFFI configuration |

---

## Testing

### Unit Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_platform_detection_ios() {
        let bindings = DeviceBindings {
            platform: "ios".to_string(),
            app_id: "com.anonymous.zcam1".to_string(),
            device_key_id: "abc123".to_string(),
            attestation: Some("...".to_string()),
            assertion: Some("...".to_string()),
            key_attestation_chain: None,
            play_integrity_token: None,
            signature: None,
        };

        assert!(bindings.is_ios());
        assert!(!bindings.is_android());
    }

    #[test]
    fn test_platform_detection_android() {
        let bindings = DeviceBindings {
            platform: "android".to_string(),
            app_id: "com.anonymous.zcam1".to_string(),
            device_key_id: "abc123".to_string(),
            attestation: None,
            assertion: None,
            key_attestation_chain: Some("...".to_string()),
            play_integrity_token: Some("...".to_string()),
            signature: Some("...".to_string()),
        };

        assert!(!bindings.is_ios());
        assert!(bindings.is_android());
    }

    #[test]
    fn test_unsupported_platform() {
        let bindings = DeviceBindings {
            platform: "windows".to_string(),
            ..Default::default()
        };

        let result = verify_device_bindings(&bindings, "", &[], true);
        assert!(matches!(result, Err(VerifyError::UnsupportedPlatform(_))));
    }
}
```

### Integration Tests

Test with captured attestation data from real devices (see Task 07 for fixtures).

---

## Deliverables

### Files to Modify/Create

| Deliverable | File Path | Type |
|-------------|-----------|------|
| Device bindings type | `crates/verify-utils/src/types.rs` | Modify |
| Verification router | `crates/verify-utils/src/verify.rs` | Create |
| Error types | `crates/verify-utils/src/error.rs` | Modify |
| Cargo dependencies | `crates/verify-utils/Cargo.toml` | Modify |
| UniFFI exports | `crates/verify-bindings/src/lib.rs` | Modify |
| UniFFI config | `crates/verify-bindings/uniffi.toml` | Modify |
| Unit tests | `crates/verify-utils/src/tests/*.rs` | Create |

---

## Interface Definitions

### Public Functions (UniFFI exports)

```rust
/// Verify device bindings extracted from a C2PA manifest
#[uniffi::export]
pub fn verify_bindings_from_manifest(
    bindings_json: String,
    normalized_metadata: String,
    photo_hash: Vec<u8>,
    production: bool,
) -> Result<String, String>;

/// Get the platform from device bindings without full verification
#[uniffi::export]
pub fn get_bindings_platform(bindings_json: String) -> Result<String, String>;

/// Check if a platform is supported by this build
#[uniffi::export]
pub fn is_platform_supported(platform: String) -> bool;
```

### Internal Functions

```rust
/// Main verification entry point
pub fn verify_device_bindings(
    bindings: &DeviceBindings,
    normalized_metadata: &str,
    photo_hash: &[u8],
    production: bool,
) -> Result<VerificationResult, VerifyError>;

/// iOS-specific verification
fn verify_ios_bindings(
    bindings: &DeviceBindings,
    normalized_metadata: &str,
    photo_hash: &[u8],
    production: bool,
) -> Result<VerificationResult, VerifyError>;

/// Android-specific verification
fn verify_android_bindings(
    bindings: &DeviceBindings,
    normalized_metadata: &str,
    photo_hash: &[u8],
    production: bool,
) -> Result<VerificationResult, VerifyError>;
```

### Data Structures

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceBindings {
    pub platform: String,           // "ios" or "android"
    pub app_id: String,
    pub device_key_id: String,
    // iOS
    pub attestation: Option<String>,
    pub assertion: Option<String>,
    // Android
    pub key_attestation_chain: Option<String>,
    pub play_integrity_token: Option<String>,
    pub signature: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationResult {
    pub platform: String,
    pub valid: bool,
    pub security_level: String,     // "secure_enclave", "strongbox", "tee", "software"
    pub app_id_verified: bool,
    pub device_integrity_verified: bool,
}
```

---

## Testing Plan

### Unit Tests

| Test | File | Purpose |
|------|------|---------|
| `test_platform_detection_ios` | `verify.rs` | Detect iOS from bindings |
| `test_platform_detection_android` | `verify.rs` | Detect Android from bindings |
| `test_unsupported_platform` | `verify.rs` | Error for unknown platform |
| `test_missing_ios_fields` | `verify.rs` | Error when attestation/assertion missing |
| `test_missing_android_fields` | `verify.rs` | Error when chain/signature missing |
| `test_ios_verification_integration` | `verify.rs` | Full iOS verification |
| `test_android_verification_integration` | `verify.rs` | Full Android verification |
| `test_bindings_serialization` | `types.rs` | JSON round-trip |
| `test_result_serialization` | `types.rs` | VerificationResult to JSON |

### Integration Tests

| Test | Description |
|------|-------------|
| `test_verify_real_ios_bindings` | Verify with captured iOS attestation |
| `test_verify_real_android_bindings` | Verify with captured Android attestation |
| `test_cross_platform_consistency` | Same photo verified on both platforms |
| `test_production_mode_enforcement` | Reject software keys in production |

### Test Fixtures Required

| Fixture | Source | Purpose |
|---------|--------|---------|
| `ios_bindings.json` | iOS device capture | Real iOS device bindings |
| `android_bindings_strongbox.json` | Pixel 6+ | StrongBox attestation |
| `android_bindings_tee.json` | Older device | TEE attestation |
| `android_bindings_emulator.json` | Emulator | Software key bindings |
| `invalid_bindings.json` | Generated | Missing required fields |

---

## Completion Criteria

### Must Have (Required for task completion)

- [ ] **DeviceBindings type updated**
  - Supports both iOS and Android fields
  - `is_ios()` and `is_android()` helpers work
  - Serializes/deserializes correctly

- [ ] **Platform router works**
  - Detects platform from bindings
  - Routes to correct verification function
  - Returns UnsupportedPlatform error for unknown

- [ ] **iOS verification still works**
  - Existing iOS tests pass
  - No regression in iOS verification

- [ ] **Android verification works**
  - Calls zcam1-android crate correctly
  - Extracts public key from attestation
  - Verifies signature correctly

- [ ] **VerificationResult complete**
  - Contains all required fields
  - Security level accurate for each platform
  - Serializes to JSON correctly

- [ ] **UniFFI exports work**
  - `verify_bindings_from_manifest()` callable from TS
  - Error messages propagate correctly
  - JSON serialization works

- [ ] **Feature flags work**
  - Can compile with only iOS support
  - Can compile with only Android support
  - Default includes both

- [ ] **All tests pass**
  - Unit tests: 100%
  - Integration tests with fixtures

### Should Have (Expected but not blocking)

- [ ] **Play Integrity verification**
  - Validates token when keys available
  - Graceful degradation when not available

- [ ] **Documentation**
  - All public functions documented
  - Example usage in comments

### Nice to Have (Not required)

- [ ] **Performance benchmarks**
- [ ] **Detailed verification report** (step-by-step results)

---

## Verification Commands

```bash
# Build with both platforms
cd crates/verify-utils
cargo build --all-features

# Build iOS only
cargo build --features ios --no-default-features

# Build Android only
cargo build --features android --no-default-features

# Run tests
cargo test

# Run specific verification tests
cargo test verify_

# Build UniFFI bindings
cd ../verify-bindings
cargo build
```

---

## Handoff to Next Tasks

### Output for Task 05 (TypeScript)

This task provides UniFFI exports that Task 05 uses:

```typescript
// From generated TypeScript bindings
import { verifyBindingsFromManifest, getBindingsPlatform } from 'zcam1-verify';

const resultJson = await verifyBindingsFromManifest(
  JSON.stringify(deviceBindings),
  normalizedMetadata,
  photoHash,
  true // production
);
const result: VerificationResult = JSON.parse(resultJson);
```

### Output for Task 07 (Testing)

This task defines the fixture format that Task 07 must provide:

```json
// android_bindings.json format
{
  "platform": "android",
  "app_id": "com.anonymous.zcam1",
  "device_key_id": "zcam1_...",
  "key_attestation_chain": "base64...",
  "play_integrity_token": "eyJ...",
  "signature": "MEUC..."
}
```

---

## Next Steps

After this task:
- Task 05 (TypeScript integration) uses these bindings
- Task 07 (Testing) creates fixtures for both platforms
