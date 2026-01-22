import { base64 } from "@scure/base";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import {
  computeHash,
  extractManifest,
  PhotoMetadataInfo,
  type ManifestInterface,
} from "@succinctlabs/react-native-zcam1-c2pa";
import { verifyGroth16, verifyBindingsFromManifest } from "./verifier";

/**
 * Capture metadata extracted from the C2PA manifest.
 * Contains device info and camera settings at capture time.
 */
export interface CaptureMetadata {
  action: string;
  when: string;
  parameters: PhotoMetadataInfo;
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
   * Verifies the manifest's bindings (e.g., App Attest).
   */
  verifyBindings(appAttestProduction: boolean): boolean {
    if (this.hash === undefined) {
      this.hash = computeHash(this.path);
    }

    return verifyBindingsFromManifest(
      this.activeManifest.bindings()!,
      this.hash,
      appAttestProduction,
    );
  }

  /**
   * Verifies the cryptographic proof embedded in the C2PA manifest.
   * @returns True if the proof is valid, false otherwise
   */
  verifyProof(): boolean {
    return verifyProofFromManifest(this.activeManifest, this.path);
  }

  /**
   * Returns the file's content hash as recorded in the active C2PA manifest.
   * @returns The manifest data hash (base64-encoded string)
   */
  dataHash(): string | undefined {
    if (this.hash === undefined) {
      this.hash = computeHash(this.path);
    }

    return base64.encode(new Uint8Array(this.hash));
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
): boolean {
  let proof = activeManifest.proof();

  if (proof === undefined) {
    throw new Error("The proof was not found in the manifest");
  }

  const hash = new Uint8Array(computeHash(path));
  const appleRootCert = utf8ToBytes(APPLE_ROOT_CERT);

  let publicInputs = new Uint8Array(hash.length + appleRootCert.length);
  publicInputs.set(hash);
  publicInputs.set(appleRootCert, hash.length);

  return verifyGroth16(
    base64.decode(proof.data).buffer as ArrayBuffer,
    publicInputs.buffer,
    proof.vkHash,
  );
}
