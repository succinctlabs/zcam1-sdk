import { verify_groth16 } from "sp1-wasm-verifier";
import { base64 } from "@scure/base";
import { utf8ToBytes } from "@noble/hashes/utils.js";

const APPLE_ROOT_CERT =
  "MIICITCCAaegAwIBAgIQC/O+DvHN0uD7jG5yH2IXmDAKBggqhkjOPQQDAzBSMSYwJAYDVQQDDB1BcHBsZSBBcHAgQXR0ZXN0YXRpb24gUm9vdCBDQTETMBEGA1UECgwKQXBwbGUgSW5jLjETMBEGA1UECAwKQ2FsaWZvcm5pYTAeFw0yMDAzMTgxODMyNTNaFw00NTAzMTUwMDAwMDBaMFIxJjAkBgNVBAMMHUFwcGxlIEFwcCBBdHRlc3RhdGlvbiBSb290IENBMRMwEQYDVQQKDApBcHBsZSBJbmMuMRMwEQYDVQQIDApDYWxpZm9ybmlhMHYwEAYHKoZIzj0CAQYFK4EEACIDYgAERTHhmLW07ATaFQIEVwTtT4dyctdhNbJhFs/Ii2FdCgAHGbpphY3+d8qjuDngIN3WVhQUBHAoMeQ/cLiP1sOUtgjqK9auYen1mMEvRq9Sk3Jm5X8U62H+xTD3FE9TgS41o0IwQDAPBgNVHRMBAf8EBTADAQH/MB0GA1UdDgQWBBSskRBTM72+aEH/pwyp5frq5eWKoTAOBgNVHQ8BAf8EBAMCAQYwCgYIKoZIzj0EAwMDaAAwZQIwQgFGnByvsiVbpTKwSga0kP0e8EeDS4+sQmTvb7vn53O5+FRXgeLhpJ06ysC5PrOyAjEAp5U4xDgEgllF7En3VcE3iexZZtKeYnpqtijVoyFraWVIyd/dganmrduC1bmTBGwD";

export function verifyProofFromStore(store, publicInputs, vkHash) {
  const activeManifest = store.manifests[store.active_manifest];
  let proof = activeManifest?.assertion_store["succinct.proof"];
  let dataHashB64 = activeManifest?.assertion_store["c2pa.hash.data"]?.hash;

  if (dataHashB64 === undefined) {
    throw new Error("The data hash was not found in the C2PA manifest");
  }

  if (proof === undefined) {
    throw new Error("The proof was not found in the C2PA manifest");
  }

  const dataHash = base64.decode(dataHashB64);
  const appleRootCert = utf8ToBytes(APPLE_ROOT_CERT);

  let publicInputs = new Uint8Array(dataHash.length + appleRootCert.length);
  mergedArray.set(dataHash);
  mergedArray.set(appleRootCert, dataHash.length);

  return verify_groth16(proof, publicInputs, vkHash);
}
