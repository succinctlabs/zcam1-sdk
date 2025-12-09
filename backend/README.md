# ZCAM1 Backend Server

A Rust-based backend server that verifies iOS device attestation and generates zero-knowledge proofs for device authenticity using the SP1 proving system.

## Overview

This server provides REST API endpoints for iOS clients to:
- Register and verify device attestation using Apple's App Attest framework
- Request zero-knowledge proof generation for authenticated devices
- Retrieve verification keys and certificate chains
- Verify device authenticity without exposing sensitive attestation data

## API Endpoints

### Device Registration

#### POST `/ios/register/init`
Initialize device registration with a challenge.

**Request:**
```json
{
  "keyId": "base64-encoded-key-id"
}
```

**Response:**
```
"hex-encoded-challenge-string"
```

**Description:** Generates a random 16-byte challenge for the device to sign during attestation.

---

#### POST `/ios/register/validate`
Validate device attestation and mark as trusted.

**Request:**
```json
{
  "attestation": "base64-encoded-attestation",
  "keyId": "base64-encoded-key-id",
  "appId": "team-id.bundle-identifier",
  "production": boolean
}
```

**Response:** 
- `200 OK` if valid
- `401 Unauthorized` if key ID unknown
- `500 Internal Server Error` on validation failure

**Description:** Verifies the attestation object against the challenge and marks the device as trusted if valid.

---

### Proof Generation

#### POST `/ios/request-proof`
Request zero-knowledge proof generation for an authenticated action.

**Request:**
```json
{
  "attestation": "base64-encoded-attestation",
  "assertion": "base64-encoded-assertion",
  "keyId": "base64-encoded-key-id",
  "dataHash": "base64-encoded-hash",
  "appId": "team-id.bundle-identifier",
  "appAttestProduction": boolean
}
```

**Response:**
```
"proof-request-id"
```

**Description:** Spawns an async task to generate a ZK proof and returns a request ID for polling.

---

#### GET `/ios/proof/{id}`
Retrieve proof generation status and result.

**Response:**
- `202 Accepted` - Proof still being generated
- `200 OK` - Proof ready (returns raw proof bytes)
- `404 Not Found` - Invalid request ID

**Description:** Poll this endpoint to check if proof generation is complete.

---

### Utilities

#### GET `/ios/vk`
Get the verification key hash.

**Response:**
```
"verification-key-hash-string"
```

**Description:** Returns the hash of the verification key used for proof verification.

---

#### POST `/cert-chain`
Generate a certificate chain from a public key.

**Request:**
```json
{
  "kty": "EC",
  "crv": "P-256",
  "x": "base64-x-coordinate",
  "y": "base64-y-coordinate"
}
```

**Response:**
```
"certificate-chain-string"
```

**Description:** Generates a certificate chain for the provided public key with issuer "ZCAM1" and subject "Succinct".
