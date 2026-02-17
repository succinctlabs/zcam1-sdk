import { utf8ToBytes } from "@noble/hashes/utils.js";
import { base64 } from "@scure/base";
import { Platform } from "react-native";
import {
  computeHash,
  extractManifest,
  type ManifestInterface,
  PhotoMetadataInfo,
  VideoMetadataInfo,
} from "@succinctlabs/react-native-zcam1-c2pa";

// Import all exports from verifier — available functions depend on build platform.
// Apple builds have: verifyBindingsFromManifest, verifyGroth16
// Android builds have: verifyAndroidBindingsFromManifest, verifyGroth16
import * as verifier from "./verifier";

/**
 * Capture metadata extracted from the C2PA manifest.
 * Contains device info and camera settings at capture time.
 */
export interface CaptureMetadata {
  action: string;
  when: string;
  parameters: PhotoMetadataInfo | VideoMetadataInfo;
}

export const APPLE_ROOT_CERT =
  "MIICITCCAaegAwIBAgIQC/O+DvHN0uD7jG5yH2IXmDAKBggqhkjOPQQDAzBSMSYwJAYDVQQDDB1BcHBsZSBBcHAgQXR0ZXN0YXRpb24gUm9vdCBDQTETMBEGA1UECgwKQXBwbGUgSW5jLjETMBEGA1UECAwKQ2FsaWZvcm5pYTAeFw0yMDAzMTgxODMyNTNaFw00NTAzMTUwMDAwMDBaMFIxJjAkBgNVBAMMHUFwcGxlIEFwcCBBdHRlc3RhdGlvbiBSb290IENBMRMwEQYDVQQKDApBcHBsZSBJbmMuMRMwEQYDVQQIDApDYWxpZm9ybmlhMHYwEAYHKoZIzj0CAQYFK4EEACIDYgAERTHhmLW07ATaFQIEVwTtT4dyctdhNbJhFs/Ii2FdCgAHGbpphY3+d8qjuDngIN3WVhQUBHAoMeQ/cLiP1sOUtgjqK9auYen1mMEvRq9Sk3Jm5X8U62H+xTD3FE9TgS41o0IwQDAPBgNVHRMBAf8EBTADAQH/MB0GA1UdDgQWBBSskRBTM72+aEH/pwyp5frq5eWKoTAOBgNVHQ8BAf8EBAMCAQYwCgYIKoZIzj0EAwMDaAAwZQIwQgFGnByvsiVbpTKwSga0kP0e8EeDS4+sQmTvb7vn53O5+FRXgeLhpJ06ysC5PrOyAjEAp5U4xDgEgllF7En3VcE3iexZZtKeYnpqtijVoyFraWVIyd/dganmrduC1bmTBGwD";

/**
 * Represents a file with a C2PA manifest that can be verified for authenticity.
 */
export class VerifiableFile {
  path: string;
  activeManifest: ManifestInterface;
  hash: ArrayBuffer | undefined;

  /**
   * Creates a VerifiableFile instance by extracting the C2PA manifest from the file.
   * @param path - Path to the file to verify
   */
  constructor(path: string) {
    const store = extractManifest(path);

    this.path = path;
    this.activeManifest = store.activeManifest();
  }

  /**
   * Verifies the manifest's bindings.
   * On iOS: validates Apple App Attest attestation + assertion.
   * On Android: validates Android Key Attestation chain + ECDSA signature.
   */
  verifyBindings(production: boolean, packageName?: string): boolean {
    if (this.hash === undefined) {
      this.hash = computeHash(this.path);
    }

    const bindings = this.activeManifest.bindings()!;
    const metadata = this.activeManifest.captureMetadataAction()!;

    if (Platform.OS === "android") {
      const fn = (verifier as any).verifyAndroidBindingsFromManifest;
      if (!fn) {
        throw new Error("Android verify bindings not available");
      }
      if (!packageName) {
        throw new Error("packageName is required for Android verification");
      }
      return fn(bindings, metadata, this.hash, packageName, production);
    }

    const fn = (verifier as any).verifyBindingsFromManifest;
    if (!fn) {
      throw new Error("Apple verify bindings not available");
    }
    return fn(bindings, metadata, this.hash, production);
  }

  /**
   * Verifies the cryptographic proof embedded in the C2PA manifest.
   * @returns True if the proof is valid, false otherwise
   */
  verifyProof(appId: string): boolean {
    return verifyProofFromManifest(this.activeManifest, this.path, appId);
  }

  /**
   * Returns the file's content hash as recorded in the active C2PA manifest.
   * @returns The manifest data hash (base64-encoded string)
   */
  dataHash(): string | undefined {
    if (this.hash === undefined) {
      this.hash = computeHash(this.path);
    }

    return base64.encode(new Uint8Array(this.hash!));
  }

  /**
   * Returns the capture metadata from the C2PA manifest.
   * Contains device info and camera settings recorded at capture time.
   * @returns The capture metadata, or null if not present
   */
  captureMetadata(): CaptureMetadata | null {
    const actionJson = this.activeManifest.captureMetadataAction();
    if (!actionJson) return null;
    return JSON.parse(actionJson) as CaptureMetadata;
  }
}

function verifyProofFromManifest(
  activeManifest: ManifestInterface,
  path: string,
  appId: string,
): boolean {
  const proof = activeManifest.proof();

  if (proof === undefined) {
    throw new Error("The proof was not found in the manifest");
  }

  const verifyGroth16 = (verifier as any).verifyGroth16;
  if (!verifyGroth16) {
    throw new Error("Groth16 verifier not available on this platform");
  }

  const hash = new Uint8Array(computeHash(path));
  const appIdBytes = utf8ToBytes(appId);
  const appleRootCert = utf8ToBytes(APPLE_ROOT_CERT);

  const publicInputs = new Uint8Array(hash.length + appIdBytes.length + appleRootCert.length);
  publicInputs.set(hash);
  publicInputs.set(appIdBytes, hash.length);
  publicInputs.set(appleRootCert, hash.length + appIdBytes.length);

  return verifyGroth16(
    base64.decode(proof.data).buffer as ArrayBuffer,
    publicInputs.buffer,
    proof.vkHash,
  );
}
