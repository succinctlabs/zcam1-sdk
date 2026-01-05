import { base64 } from "@scure/base";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import {
  extractManifest,
  type ManifestInterface,
  verifyHash,
} from "@succinctlabs/react-native-zcam1-c2pa";
import { verifyGroth16 } from "./verifier";

const APPLE_ROOT_CERT =
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
   * Verifies that the file's content hash matches the hash in the C2PA manifest.
   * @returns True if the hash is valid, false otherwise
   */
  verifyHash(): boolean {
    return verifyHash(this.path, this.activeManifest.dataHash());
  }

  /**
   * Verifies the cryptographic proof embedded in the C2PA manifest.
   * @returns True if the proof is valid, false otherwise
   */
  verifyProof(): boolean {
    return verifyProofFromManifest(this.activeManifest);
  }
}

function verifyProofFromManifest(activeManifest: ManifestInterface): boolean {
  let proof = activeManifest.proof();

  if (proof === undefined) {
    throw new Error("The proof was not found in the manifest");
  }

  let dataHashB64 = activeManifest.dataHash().hash;
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
