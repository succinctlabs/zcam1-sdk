import { createC2pa, ManifestStore } from "@contentauth/c2pa-web";

import wasmSrc from "@contentauth/c2pa-web/resources/c2pa.wasm?url";

import { computeHashFromBuffer, uniffiInitAsync } from "./bindings";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import init, { verify_groth16 } from "@succinctlabs/sp1-wasm-verifier";
import { base64 } from "@scure/base";

const APPLE_ROOT_CERT =
  "MIICITCCAaegAwIBAgIQC/O+DvHN0uD7jG5yH2IXmDAKBggqhkjOPQQDAzBSMSYwJAYDVQQDDB1BcHBsZSBBcHAgQXR0ZXN0YXRpb24gUm9vdCBDQTETMBEGA1UECgwKQXBwbGUgSW5jLjETMBEGA1UECAwKQ2FsaWZvcm5pYTAeFw0yMDAzMTgxODMyNTNaFw00NTAzMTUwMDAwMDBaMFIxJjAkBgNVBAMMHUFwcGxlIEFwcCBBdHRlc3RhdGlvbiBSb290IENBMRMwEQYDVQQKDApBcHBsZSBJbmMuMRMwEQYDVQQIDApDYWxpZm9ybmlhMHYwEAYHKoZIzj0CAQYFK4EEACIDYgAERTHhmLW07ATaFQIEVwTtT4dyctdhNbJhFs/Ii2FdCgAHGbpphY3+d8qjuDngIN3WVhQUBHAoMeQ/cLiP1sOUtgjqK9auYen1mMEvRq9Sk3Jm5X8U62H+xTD3FE9TgS41o0IwQDAPBgNVHRMBAf8EBTADAQH/MB0GA1UdDgQWBBSskRBTM72+aEH/pwyp5frq5eWKoTAOBgNVHQ8BAf8EBAMCAQYwCgYIKoZIzj0EAwMDaAAwZQIwQgFGnByvsiVbpTKwSga0kP0e8EeDS4+sQmTvb7vn53O5+FRXgeLhpJ06ysC5PrOyAjEAp5U4xDgEgllF7En3VcE3iexZZtKeYnpqtijVoyFraWVIyd/dganmrduC1bmTBGwD";

const c2pa = await createC2pa({ wasmSrc });

await uniffiInitAsync();
await init();

export async function verifyProof(file: File, appId: string): Promise<boolean> {
  const reader = await c2pa.reader.fromBlob(file.type, file);

  if (!reader) {
    throw new Error("The provided file doesn't contain C2PA metadata");
  }

  let store = await reader.manifestStore();

  if (!store.active_manifest) {
    throw new Error("The provided file doesn't contain a C2PA manifest");
  }

  const activeManifest = store.manifests[store.active_manifest];
  let proofAssertion: any = undefined;

  console.log("ASSERTIONS");
  if (activeManifest.assertions) {
    for (const a of activeManifest.assertions) {
      console.log("label", a.label);
      if (a.label === "succinct.proof") {
        proofAssertion = a.data;
      }
    }
  }

  if (!proofAssertion) {
    throw new Error("The provided file doesn't contain a proof");
  }

  const fileBuffer = await file.arrayBuffer();
  const hash = new Uint8Array(computeHashFromBuffer(fileBuffer, file.type));
  const appIdBytes = utf8ToBytes(appId);
  const appleRootCert = utf8ToBytes(APPLE_ROOT_CERT);

  let publicInputs = new Uint8Array(
    hash.length + appIdBytes.length + appleRootCert.length,
  );
  publicInputs.set(hash);
  publicInputs.set(appIdBytes, hash.length);
  publicInputs.set(appleRootCert, hash.length + appIdBytes.length);

  return verify_groth16(
    base64.decode(proofAssertion["data"]),
    publicInputs,
    proofAssertion["vk_hash"],
  );
}
