# ZCAM1 Web Verifier

A web application for verifying the authenticity of photos and videos captured with the ZCAM1 SDK. It extracts and validates C2PA (Coalition for Content Provenance and Authenticity) metadata to confirm that media files originate from real Apple devices using cryptographic proofs and attestations.

## Features

- **File upload** — drag-and-drop or browse for photos/videos, or load bundled sample files
- **C2PA metadata extraction** — parses the embedded C2PA manifest to surface capture metadata (device info, camera settings, EXIF data, video codec details)
- **Bindings verification** — validates Apple App Attest signatures to confirm the asset was signed with a hardware-attested key
- **Zero-knowledge proof verification** — verifies SP1 proofs that attest to the asset's authenticity without revealing the underlying attestation data
- **Integrity checks** — computes and compares SHA-256 asset hashes, detects jailbreak and location-spoofing indicators

## Tech Stack

React 19, TypeScript, Vite, Tailwind CSS, and the [`@succinctlabs/zcam1-verify`](https://www.npmjs.com/package/@succinctlabs/zcam1-verify) library.

## Getting Started

```bash
npm install
npm run dev
```
