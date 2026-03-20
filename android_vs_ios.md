## Android Verification: Architecture & Code Review Guide

### Design Goal

Add cryptographic device attestation + signature verification for Android, mirroring what already exists for iOS. When a user captures a photo:

1. **Capture time**: The device generates a hardware-backed key, gets an attestation chain from Google, signs the photo+metadata with that key
2. **Verify time**: A verifier validates the attestation chain roots to Google, checks the ECDSA signature against the attested public key

### Architecture: iOS vs Android Side-by-Side

| Concern | iOS (`crates/ios/`) | Android (`crates/android/`) |
|---|---|---|
| **Root of trust** | Apple App Attestation Root CA | Google Hardware Root CAs (RSA + EC) |
| **Attestation format** | CBOR-encoded `apple-appattest` blob | pagopa format: `base64(base64(cert1),base64(cert2),...)` |
| **Key attestation** | App Attest — challenge in auth data, validated via CBOR structure | X.509 Key Attestation — challenge in `KeyDescription` ASN.1 extension (OID `1.3.6.1.4.1.11129.2.1.17`) |
| **Assertion (signing)** | App Attest assertion with authenticator data + counter | Standard ECDSA P-256 `SHA256withECDSA` signature |
| **Public key extraction** | From attestation CBOR `x5c` cert chain | From leaf cert's `SubjectPublicKeyInfo` |
| **Security level check** | Production vs sandbox environment | `SecurityLevel` enum: Software / TEE / StrongBox |
| **Package/app check** | `app_id` in attestation (team ID + bundle ID) | `attestationApplicationId` in `AuthorizationList` (tag 709) |

### Layer Diagram

```
+-----------------------------------------------------+
|  examples/android-test/app/index.tsx                |  Test app UI
|  (captures, signs with real ECDSA, verifies)        |
+------------------------+----------------------------+
                         | imports
+------------------------v----------------------------+
|  react-native-zcam1-verify/src/index.tsx            |  TS public API
|  VerifiableFile.verifyBindings(prod, packageName?)  |
|  Platform.OS dispatch -> iOS fn or Android fn       |
+------------------------+----------------------------+
                         | calls via uniffi
+------------------------v----------------------------+
|  crates/verify-bindings/src/lib.rs                  |  FFI bridge
|  #[cfg(feature = "apple-verify")]                   |
|    verify_bindings_from_manifest()  -> zcam1_ios    |
|  #[cfg(feature = "android-verify")]                 |
|    verify_android_bindings_from_manifest() -> below |
+------------------------+----------------------------+
                         |
+------------------------v----------------------------+
|  crates/android/                                     |  Pure Rust
|  +-- key_attestation.rs  (orchestrator)             |
|  +-- certificate.rs      (chain decode + validate)  |
|  +-- extension.rs        (ASN.1 KeyDescription)     |
|  +-- signature.rs        (ECDSA P-256 verify)       |
|  +-- constants.rs        (Google root CA PEMs)      |
|  +-- types.rs            (KeyDescription, etc.)     |
|  +-- error.rs            (typed errors)             |
+-----------------------------------------------------+
```

### How to Review

#### 1. Start with `crates/android/` -- the core Rust crate

**Read order**: `error.rs` -> `types.rs` -> `constants.rs` -> `certificate.rs` -> `extension.rs` -> `signature.rs` -> `key_attestation.rs` -> `lib.rs`

**Key questions to ask:**

- **`certificate.rs`** -- Does `decode_certificate_chain()` correctly handle the pagopa double-base64 format? Does `validate_certificate_chain()` verify every link in the chain, including the root's self-signature? Does `matches_google_root()` compare by subject (not by raw bytes) -- is that sufficient?

- **`extension.rs`** -- This is the most complex file. It hand-parses the ASN.1 `KeyDescription` structure. Verify: Does it handle all 8 fields of the `KeyDescription` SEQUENCE in order? Does `parse_authorization_list()` correctly handle EXPLICIT context-specific tags with long-form tag encoding (tag 709 requires multi-byte)? Does `parse_tag_709_application_id()` correctly unwrap the double nesting (OCTET STRING wrapping a SEQUENCE)?

- **`signature.rs`** -- Android uses `SHA256withECDSA` which hashes internally. The `p256` crate's `verify()` also hashes internally. Confirm: we pass raw message bytes (not pre-hashed). The DER-encoded signature from Android Keystore is decoded with `Signature::from_der()`.

- **`key_attestation.rs`** -- This is the orchestrator. Review the 9-step validation: decode chain -> validate chain -> get leaf -> parse extension -> check challenge -> check security levels -> check package name -> extract public key -> compute key ID. The `production` flag controls whether Software security level is acceptable.

**Tests**: The crate has 24 tests. `extension.rs` tests build synthetic ASN.1 `KeyDescription` blobs to test parsing. `signature.rs` tests generate ephemeral P-256 keys to test sign/verify. `key_attestation.rs` tests use real Google root certs to verify chain validation logic. `certificate.rs` tests verify the Google root PEMs parse correctly.

```bash
cd crates/android && cargo test
```

#### 2. Feature flag plumbing in `crates/verify-bindings/`

**`Cargo.toml` diff**: `zcam1-ios` moved from required to `optional = true`, gated behind `apple-verify` feature. `zcam1-android` added as `optional = true`, gated behind `android-verify`. Default feature is `apple-verify` (iOS builds use defaults, Android builds pass `--no-default-features --features android-verify`).

**`error.rs` diff**: `VerifyError` enum gains `#[cfg]`-gated variants -- `AppAttest` only exists in Apple builds, `AndroidAttestation` only in Android builds. Added `Internal` variant as a fallback.

**`lib.rs` diff**: `verify_bindings_from_manifest()` gains `#[cfg(feature = "apple-verify")]` gate. New `verify_android_bindings_from_manifest()` added with `#[cfg(feature = "android-verify")]`. Both share the same `DeviceBindings` struct and the same client data format (`base64(photoHash)|base64(sha256(metadata))`).

**Key review point**: The Android function takes an extra `expected_package_name` param that iOS doesn't need (iOS uses team ID + bundle ID from the attestation itself). Both functions have the same mock bypass: `if bindings.attestation.starts_with("SIMULATOR_MOCK_")` for emulator testing.

#### 3. TypeScript platform dispatch in `react-native-zcam1-verify/src/index.tsx`

The `VerifiableFile.verifyBindings()` method changed signature from `(appAttestProduction: boolean)` to `(production: boolean, packageName?: string)`. On Android, `packageName` is required; on iOS, it's ignored.

The dispatch uses `(verifier as any)` casts because uniffi generates different exported functions per platform -- iOS builds have `verifyBindingsFromManifest`, Android builds have `verifyAndroidBindingsFromManifest`. Both go through the same `verifier.tsx` barrel export.

**Key review point**: The `as any` cast is intentional -- uniffi generates platform-specific bindings, so the TS types don't overlap. Runtime existence checks (`if (!fn)`) provide clear errors if something is misconfigured.

#### 4. Build system (`ubrn.config.yaml` + `fix-cpp-adapter.sh`)

`ubrn.config.yaml` added the `android` section with 3 targets (arm64-v8a, armeabi-v7a, x86_64) and the critical `cargoExtras: --no-default-features --features android-verify`.

The `fix-cpp-adapter.sh` script patches `cpp-adapter.cpp` after `ubrn build android --and-generate` because RN 0.80+ changed `CallInvokerHolder` access to require `fbjni::cthis()`. The fix adds `#include <fbjni/fbjni.h>`, the `jni` namespace alias, and `->cthis()` before `->getCallInvoker()`. It's idempotent (checks for `cthis()` before applying).

#### 5. Test app changes (`examples/android-test/app/index.tsx`)

The capture flow now has real signing (steps 4-8):
- Computes `photoHash = SHA-256(fileContent)` via `computeHash()`
- Computes `metadataHash = SHA-256(normalizedMetadata)` via `@noble/hashes`
- Creates `clientData = base64(photoHash)|base64(metadataHash)`
- Signs with hardware key: `signWithDeviceKey(keyId, clientData)` -> base64 DER ECDSA signature
- Embeds everything in C2PA manifest

The verify flow replaced lightweight `authenticityStatus()` (just checks manifest shape) with `VerifiableFile.verifyBindings(false, APP_ID)` which does full cryptographic verification.

### Key Implementation Decisions

1. **Pure Rust, no platform deps**: `crates/android/` compiles anywhere -- no JNI, no Android SDK. This means the same verification code works on servers, CI, other platforms.

2. **Feature flags over conditional compilation**: Instead of `#[cfg(target_os)]`, we use Cargo features (`apple-verify` / `android-verify`). This is deliberate -- you might want to verify Android attestations on an iOS device or a server.

3. **pagopa format compatibility**: The cert chain format (`base64(base64(cert1),base64(cert2),...)`) comes from the `@pagopa/io-react-native-integrity` library used on the capture side. The Rust decoder handles Android's `Base64.DEFAULT` which injects newlines every 76 chars.

4. **Same client data format**: Both iOS and Android use the identical `base64(photoHash)|base64(sha256(metadata))` format for the signed message. This makes the verification protocol platform-agnostic at the data layer.

5. **`SIMULATOR_MOCK_` bypass**: Both platforms skip real verification when the attestation starts with `SIMULATOR_MOCK_` -- this is the emulator path where no real hardware key exists.
