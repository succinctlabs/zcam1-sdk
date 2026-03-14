import { base64 } from "@scure/base";

import {
  computeHash,
  extractManifest,
  type ManifestInterface,
  PhotoMetadataInfo,
  verifyBindingsFromManifest,
  verifyProofFromManifest,
  VideoMetadataInfo,
} from "./bindings";

/**
 * Capture metadata extracted from the C2PA manifest.
 * Contains device info and camera settings at capture time.
 */
export interface CaptureMetadata {
  action: string;
  when: string;
  parameters: PhotoMetadataInfo | VideoMetadataInfo;
}

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
  verifyBindings(production: boolean): boolean {
    if (this.hash === undefined) {
      this.hash = computeHash(this.path);
    }

    const bindings = this.activeManifest.bindings()!;
    const metadata = this.activeManifest.captureMetadataAction()!;

    return verifyBindingsFromManifest(bindings, metadata, this.hash, production);
  }

  /**
   * Verifies the cryptographic proof embedded in the C2PA manifest.
   * @returns True if the proof is valid, false otherwise
   */
  verifyProof(appId: string): boolean {
    const proof = this.activeManifest.proof();

    if (proof === undefined) {
      throw new Error("The proof was not found in the manifest");
    }

    const hash = new Uint8Array(this.hash ?? computeHash(this.path));

    return verifyProofFromManifest(
      base64.decode(proof.data).buffer as ArrayBuffer,
      proof.vkHash,
      hash.buffer as ArrayBuffer,
      appId,
      proof.platform,
    );
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
