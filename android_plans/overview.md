# Android Support for ZCAM1 SDK

## Overview

Add full Android support to the ZCAM1 SDK with device attestation comparable to iOS. Android requires **two** attestation mechanisms working together:
- **Android Key Attestation**: Hardware-backed keys proving cryptographic operations happen in secure hardware (cryptographic/hardware truth)
- **Google Play Integrity API**: Device/app integrity verification (runtime app & device integrity truth)

Together these provide equivalent guarantees to Apple's App Attest.

**Key insight**: This is not a weakening of the security model - it makes Android's trust boundaries *explicit* instead of *implicit*. Apple gives you one opaque object with multiple guarantees; Android gives you multiple objects with explicit guarantees. We compose them correctly.

---

## Security Model Validation

### Guarantee Equivalence

| iOS App Attest | Android Composition | Notes |
|----------------|--------------------| ------|
| Key in Secure Enclave | Key in TEE/StrongBox | StrongBox ≥ Secure Enclave; TEE ≈ |
| Key bound to app identity | `attestationApplicationId` | Slightly weaker (OEM variance), mitigated by Play Integrity |
| Nonce binds key to server | `attestationChallenge` | Clean analogue |
| App integrity (implicit) | Play Integrity verdict | Explicit instead of implicit - actually better for audits |
| Device not jailbroken | `MEETS_DEVICE_INTEGRITY` | Different semantics, similar intent |
| Assertion signs data | Keystore ECDSA | Identical |
| Single artifact | Two artifacts | Composition vs unification |

### Offline Verification Capability

| Artifact | Offline Verifiable? | Who Verifies | Notes |
|----------|---------------------|--------------|-------|
| Key Attestation cert chain | Yes | Anyone | Standard X.509 chain to Google root |
| Photo signature | Yes | Anyone | ECDSA verification |
| Play Integrity token (self-managed keys) | Yes | Anyone with keys | JWT decryption + signature check |
| Play Integrity token (Google-managed) | No | Google servers | Requires API call |

**Important clarification**: With self-managed keys (downloaded from Play Console), Play Integrity tokens ARE offline-verifiable. The token is a standard JWT (JWE wrapping JWS with ES256). You can decrypt and verify locally.

What you can't do offline: get *fresh* verdicts. The token represents a point-in-time snapshot of device state at issuance - but this is identical to iOS App Attest, which also only proves the device was genuine at attestation time.

### Precise Security Claims

Use precise wording in documentation:
- "Meets Google's device integrity requirements at capture time"
- NOT "Device is not rooted" (too absolute)

`MEETS_DEVICE_INTEGRITY` is a policy verdict, not a proof of absence of all compromise.

### Replay Protection

Replay protection comes from binding into the signed message:
- `photoHash` - unique per photo
- `deviceKeyId` - unique per device
- `timestamp` - prevents old signature reuse

The signature itself IS the replay protection. Counters are not strictly necessary since we sign the photo hash directly (unlike iOS App Attest which uses counters because assertions can be for arbitrary data).

---

## Detailed Flow Comparison: iOS vs Android

### iOS App Attest Flow (Current Implementation)

**Bootstrap (one-time registration):**
```
1. generateHardwareKey() -> creates key in Secure Enclave, returns keyId
2. getAttestation(keyId, challenge) -> returns CBOR-encoded attestation object:
   {
     fmt: "apple-appattest",
     attStmt: { x5c: [leaf_cert, ...intermediate_certs] },
     authData: base64(rp_id_hash + flags + counter + aaguid + ...)
   }
```

**Per-photo assertion:**
```
1. message = base64(photoHash) + "|" + base64(sha256(metadata))
2. generateHardwareSignatureWithAssertion(message, keyId) -> ECDSA signature
```

**Verification (in Rust crates/ios/src/attestation.rs):**
```
1. Validate cert chain to Apple root CA
2. clientDataHash = SHA256(challenge)
3. expectedNonce = SHA256(authData + clientDataHash)
4. Extract nonce from cert extension (OID 1.2.840.113635.100.8.2)
5. Verify nonce matches expectedNonce (binds key to challenge)
6. Extract publicKey from cert, verify SHA256(publicKey) == keyId
7. Verify SHA256(appId) == authData.rpIdHash
8. Verify counter == 0 (for attestation)
9. Verify aaguid == "appattest" (production) or "appattestdevelop" (dev)
```

### Android Equivalent Flow

**Bootstrap (one-time registration):**
```kotlin
// 1. Generate key with attestation in Android Keystore
val keyPairGenerator = KeyPairGenerator.getInstance(
    KeyProperties.KEY_ALGORITHM_EC, "AndroidKeyStore"
)
keyPairGenerator.initialize(
    KeyGenParameterSpec.Builder("zcam1_device_key", PURPOSE_SIGN)
        .setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1"))
        .setDigests(KeyProperties.DIGEST_SHA256)
        .setAttestationChallenge(challenge.toByteArray())  // Binds to challenge!
        .build()
)
val keyPair = keyPairGenerator.generateKeyPair()

// 2. Get attestation certificate chain
val keyStore = KeyStore.getInstance("AndroidKeyStore")
keyStore.load(null)
val certChain = keyStore.getCertificateChain("zcam1_device_key")
// certChain[0] = leaf with key attestation extension
// certChain[n] = roots to Google attestation CA

// 3. Get Play Integrity token
val integrityManager = IntegrityManagerFactory.create(context)
val integrityTokenResponse = integrityManager
    .requestIntegrityToken(IntegrityTokenRequest.builder()
        .setNonce(Base64.encodeToString(SHA256(deviceKeyId), NO_WRAP))
        .build())
    .await()
val integrityToken = integrityTokenResponse.token()
```

**What's in the Key Attestation certificate extension (OID 1.3.6.1.4.1.11129.2.1.17):**
```asn1
KeyDescription ::= SEQUENCE {
  attestationVersion         INTEGER,           -- e.g., 400 (KeyMint 4.0)
  attestationSecurityLevel   SecurityLevel,     -- TEE(1) or StrongBox(2)
  keyMintVersion             INTEGER,
  keyMintSecurityLevel       SecurityLevel,
  attestationChallenge       OCTET STRING,      -- The challenge we sent!
  uniqueId                   OCTET STRING,
  softwareEnforced           AuthorizationList, -- App package name here
  hardwareEnforced           AuthorizationList  -- Key properties here
}

AuthorizationList contains:
  - purpose: [SIGN]
  - algorithm: EC
  - keySize: 256
  - ecCurve: P256
  - origin: GENERATED (proves key was created, not imported)
  - attestationApplicationId: {
      packageName: "com.anonymous.zcam1",
      signatureDigests: [sha256_of_signing_cert]
    }
  - rootOfTrust: { verifiedBootKey, deviceLocked, verifiedBootState }
```

**What's in the Play Integrity token (after decryption):**
```json
{
  "requestDetails": {
    "requestPackageName": "com.anonymous.zcam1",
    "requestHash": "base64(SHA256(deviceKeyId))",
    "timestampMillis": "1675655009345"
  },
  "appIntegrity": {
    "appRecognitionVerdict": "PLAY_RECOGNIZED",
    "packageName": "com.anonymous.zcam1",
    "certificateSha256Digest": ["abc123..."],
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

**Per-photo assertion:**
```kotlin
// Sign with the hardware-backed key
val signature = Signature.getInstance("SHA256withECDSA")
signature.initSign(keyStore.getKey("zcam1_device_key", null) as PrivateKey)
val message = "${Base64.encodeToString(photoHash)}|${Base64.encodeToString(SHA256(metadata))}"
signature.update(message.toByteArray())
val signatureBytes = signature.sign()
```

**Android Verification (in Rust crates/android/):**
```
1. Validate cert chain to Google attestation root CA
2. Parse KeyDescription extension (OID 1.3.6.1.4.1.11129.2.1.17)
3. Verify attestationChallenge == expected challenge
4. Verify attestationSecurityLevel == TEE or StrongBox (not Software)
5. Verify packageName in softwareEnforced matches expected app
6. Extract publicKey from leaf certificate
7. Decrypt Play Integrity token (using self-managed keys)
8. Verify requestHash binds token to our deviceKeyId
9. Verify deviceRecognitionVerdict contains MEETS_DEVICE_INTEGRITY
10. Verify appRecognitionVerdict == PLAY_RECOGNIZED
```

### Cryptographic Binding: How It All Links Together

The security comes from cryptographic binding at each step:

**iOS:**
```
challenge = deviceKeyId
nonce = SHA256(authData + SHA256(challenge))
cert_extension contains nonce -> binds cert to specific challenge/key
assertion signs (photoHash | metadataHash) with key from cert
```

**Android:**
```
1. Key Attestation:
   attestationChallenge = deviceKeyId (embedded in cert at creation)
   -> Cert is cryptographically bound to challenge
   -> Cannot reuse attestation for different key

2. Play Integrity:
   requestHash = SHA256(deviceKeyId)
   -> Token is cryptographically bound to key
   -> Cannot reuse token for different device/key

3. Photo signature:
   signature = ECDSA(privateKey, photoHash | metadataHash)
   -> privateKey is in TEE/StrongBox (from Key Attestation)
   -> Cannot forge without hardware access
```

**Verification binds everything:**
```
attestation.attestationChallenge == deviceKeyId
playIntegrityToken.requestHash == SHA256(deviceKeyId)
signature verifies with publicKey from attestation cert
-> All three are cryptographically linked to the same device key
```

---

## Why Both Attestation APIs Are Needed

| Aspect | Android Key Attestation | Play Integrity API |
|--------|------------------------|-------------------|
| **Purpose** | Proves keys are hardware-backed (TEE/StrongBox) | Proves device/app integrity |
| **What it verifies** | Cryptographic key origin and properties | Device not rooted, app is genuine, Play Services present |
| **Certificate chain** | Roots to Google's hardware attestation CA | Returns signed JWT (decrypt with self-managed keys) |
| **Offline capable** | Yes | Yes (with self-managed keys) |
| **Security level** | Hardware-backed, strongest | Policy-based verdict |

**Key Attestation alone** proves keys are secure but doesn't prove the app isn't tampered with.
**Play Integrity alone** proves device/app integrity but doesn't provide cryptographic binding.
**Together** they provide the same guarantees as iOS App Attest.

### Why not just Key Attestation?

Key Attestation's `attestationApplicationId` field varies by OEM and may be missing on some devices. Play Integrity's `PLAY_RECOGNIZED` verdict provides a consistent, reliable app identity check across all devices.

### Why not just Play Integrity?

Play Integrity doesn't give you a hardware-backed signing key. You need Key Attestation to prove that:
1. The signing key was generated in secure hardware
2. The key cannot be extracted
3. Signatures can only be made on this specific device

---

## Android vs iOS Limitations

| Feature | iOS | Android |
|---------|-----|---------|
| Single attestation API | Yes (App Attest) | No (Key Attestation + Play Integrity) |
| Hardware consistency | Secure Enclave on all devices | Varies: StrongBox > TEE > Software |
| Offline verification | Fully supported | Fully supported (with self-managed keys) |
| Counter management | Automatic (system-managed) | Not needed (sign photo hash directly) |
| Minimum version | iOS 14+ | API 24+ (Android 7.0) |
| Google Play required | No | Yes (for Play Integrity) |
| Emulator support | Mock fallback | Software keys only |
| App identity reliability | Consistent (rpIdHash) | Varies by OEM (mitigated by Play Integrity) |

### Play Integrity Self-Managed Keys Setup

To enable offline verification of Play Integrity tokens:

1. **Google Play Console** -> Release -> Setup -> App Integrity -> Response encryption
2. Choose "Manage and download my response encryption keys"
3. Download decryption key (AES) and verification key (EC public key)
4. Token format: Nested JWT (JWE of JWS, using ES256)
5. Decrypt and verify locally without calling Google

**Requirements**:
- Paid Google Developer Account
- App registered in Google Play Console
- Manual key rotation management (prepare for Feb 2026 root cert rotation)

### What "Offline" Really Means

Both iOS and Android attestations represent **point-in-time snapshots**:
- iOS App Attest proves the device was genuine at attestation time
- Android Key Attestation + Play Integrity prove the same

Neither platform guarantees the device hasn't been compromised *after* attestation. This is a fundamental property of attestation systems, not a limitation.

---

## Implementation Deliverables

See the following task breakdowns:
- [01-rust-android-crate.md](./01-rust-android-crate.md) - Rust attestation validation
- [02-kotlin-attestation.md](./02-kotlin-attestation.md) - Native key generation + Play Integrity
- [03-kotlin-camera.md](./03-kotlin-camera.md) - Camera2/CameraX implementation
- [04-verify-updates.md](./04-verify-updates.md) - Platform detection in verification
- [05-typescript-integration.md](./05-typescript-integration.md) - React Native layer
- [06-build-system.md](./06-build-system.md) - uniffi config, gradle, Cargo targets
- [07-testing.md](./07-testing.md) - Unit, integration, device matrix
