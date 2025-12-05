import { base64 } from "@scure/base";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import {
  extractManifest,
  ManifestInterface,
  verifyHash,
} from "react-native-zcam1-c2pa";
import installer from "./NativeZcam1Verify";

const APPLE_ROOT_CERT =
  "MIICITCCAaegAwIBAgIQC/O+DvHN0uD7jG5yH2IXmDAKBggqhkjOPQQDAzBSMSYwJAYDVQQDDB1BcHBsZSBBcHAgQXR0ZXN0YXRpb24gUm9vdCBDQTETMBEGA1UECgwKQXBwbGUgSW5jLjETMBEGA1UECAwKQ2FsaWZvcm5pYTAeFw0yMDAzMTgxODMyNTNaFw00NTAzMTUwMDAwMDBaMFIxJjAkBgNVBAMMHUFwcGxlIEFwcCBBdHRlc3RhdGlvbiBSb290IENBMRMwEQYDVQQKDApBcHBsZSBJbmMuMRMwEQYDVQQIDApDYWxpZm9ybmlhMHYwEAYHKoZIzj0CAQYFK4EEACIDYgAERTHhmLW07ATaFQIEVwTtT4dyctdhNbJhFs/Ii2FdCgAHGbpphY3+d8qjuDngIN3WVhQUBHAoMeQ/cLiP1sOUtgjqK9auYen1mMEvRq9Sk3Jm5X8U62H+xTD3FE9TgS41o0IwQDAPBgNVHRMBAf8EBTADAQH/MB0GA1UdDgQWBBSskRBTM72+aEH/pwyp5frq5eWKoTAOBgNVHQ8BAf8EBAMCAQYwCgYIKoZIzj0EAwMDaAAwZQIwQgFGnByvsiVbpTKwSga0kP0e8EeDS4+sQmTvb7vn53O5+FRXgeLhpJ06ysC5PrOyAjEAp5U4xDgEgllF7En3VcE3iexZZtKeYnpqtijVoyFraWVIyd/dganmrduC1bmTBGwD";

// Register the rust crate with Hermes
// - the boolean flag ensures this loads exactly once, even if the JS
//   code is reloaded (e.g. during development with metro).
let rustInstalled = false;
if (!rustInstalled) {
  installer.installRustCrate();
  rustInstalled = true;
}

// Export the generated bindings to the app.
export * from "./generated/sp1_uniffi_verifier";

// Now import the bindings so we can:
// - intialize them
// - export them as namespaced objects as the default export.
import * as sp1_uniffi_verifier from "./generated/sp1_uniffi_verifier";

// Initialize the generated bindings: mostly checksums, but also callbacks.
// - the boolean flag ensures this loads exactly once, even if the JS code
//   is reloaded (e.g. during development with metro).
let initialized = false;
if (!initialized) {
  sp1_uniffi_verifier.default.initialize();
  initialized = true;
}

export class VerifiableFile {
  path: string;
  activeManifest: ManifestInterface;

  constructor(path: string) {
    const store = extractManifest(path);

    this.path = path;
    this.activeManifest = store.activeManifest();
  }

  verifyHash(): boolean {
    return verifyHash(this.path, this.activeManifest.dataHash());
  }

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

  return sp1_uniffi_verifier.verifyGroth16(
    base64.decode(proof.data),
    publicInputs,
    proof.vkHash,
  );
}
