import { base64 } from "@scure/base";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import {
  extractManifest,
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
  parameters: {
    device_make?: string;
    device_model?: string;
    software_version?: string;
    x_resolution?: number;
    y_resolution?: number;
    orientation?: string;
    iso?: string[];
    exposure_time?: number;
    depth_of_field?: number;
    focal_length?: number;
  };
}

export const APPLE_ROOT_CERT =
  "MIICITCCAaegAwIBAgIQC/O+DvHN0uD7jG5yH2IXmDAKBggqhkjOPQQDAzBSMSYwJAYDVQQDDB1BcHBsZSBBcHAgQXR0ZXN0YXRpb24gUm9vdCBDQTETMBEGA1UECgwKQXBwbGUgSW5jLjETMBEGA1UECAwKQ2FsaWZvcm5pYTAeFw0yMDAzMTgxODMyNTNaFw00NTAzMTUwMDAwMDBaMFIxJjAkBgNVBAMMHUFwcGxlIEFwcCBBdHRlc3RhdGlvbiBSb290IENBMRMwEQYDVQQKDApBcHBsZSBJbmMuMRMwEQYDVQQIDApDYWxpZm9ybmlhMHYwEAYHKoZIzj0CAQYFK4EEACIDYgAERTHhmLW07ATaFQIEVwTtT4dyctdhNbJhFs/Ii2FdCgAHGbpphY3+d8qjuDngIN3WVhQUBHAoMeQ/cLiP1sOUtgjqK9auYen1mMEvRq9Sk3Jm5X8U62H+xTD3FE9TgS41o0IwQDAPBgNVHRMBAf8EBTADAQH/MB0GA1UdDgQWBBSskRBTM72+aEH/pwyp5frq5eWKoTAOBgNVHQ8BAf8EBAMCAQYwCgYIKoZIzj0EAwMDaAAwZQIwQgFGnByvsiVbpTKwSga0kP0e8EeDS4+sQmTvb7vn53O5+FRXgeLhpJ06ysC5PrOyAjEAp5U4xDgEgllF7En3VcE3iexZZtKeYnpqtijVoyFraWVIyd/dganmrduC1bmTBGwD";

/**
 * Represents a file with a C2PA manifest that can be verified for authenticity.
 */
export class VerifiableFile {
  path: string;
  activeManifest: ManifestInterface;

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
    const photoHash = base64.decode(this.activeManifest.hash()!);
    return verifyBindingsFromManifest(
      this.activeManifest.bindings()!,
      photoHash.buffer as ArrayBuffer,
      appAttestProduction,
    );
  }

  /**
   * Verifies the cryptographic proof embedded in the C2PA manifest.
   * @returns True if the proof is valid, false otherwise
   */
  verifyProof(): boolean {
    return verifyProofFromManifest(this.activeManifest);
  }

  /**
   * Returns the file's content hash as recorded in the active C2PA manifest.
   * @returns The manifest data hash (base64-encoded string)
   */
  dataHash(): string | undefined {
    return this.activeManifest.hash();
  }

  /**
   * Returns the capture metadata from the C2PA manifest.
   * Contains device info and camera settings recorded at capture time.
   * @returns The capture metadata, or null if not present
   */
  captureMetadata(): CaptureMetadata | null {
    const actionJson = this.activeManifest.action("succinct.capture");
    if (!actionJson) return null;
    return JSON.parse(actionJson) as CaptureMetadata;
  }
}

function verifyProofFromManifest(activeManifest: ManifestInterface): boolean {
  let proof = activeManifest.proof();

  if (proof === undefined) {
    throw new Error("The proof was not found in the manifest");
  }

  let dataHashB64 = activeManifest.hash()!;
  const dataHash = base64.decode(dataHashB64);
  const appleRootCert = utf8ToBytes(APPLE_ROOT_CERT);

  let publicInputs = new Uint8Array(dataHash.length + appleRootCert.length);
  publicInputs.set(dataHash);
  publicInputs.set(appleRootCert, dataHash.length);

  return verifyGroth16(
    base64.decode(proof.data).buffer as ArrayBuffer,
    publicInputs.buffer,
    proof.vkHash,
  );
}
