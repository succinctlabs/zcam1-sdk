import { verify_groth16 } from "sp1-wasm-verifier";

export function verifyProofFromStore(store, publicInputs, vkHash) {
  const activeManifest = store.manifests[store.active_manifest];
  let proof = activeManifest?.assertion_store["succinct.proof"];
  let dataHash = activeManifest?.assertion_store["c2pa.hash.data"]?.hash;

  if (dataHash === undefined) {
    throw new Error("The data hash was not found in the C2PA manifest");
  }

  if (proof === undefined) {
    throw new Error("The proof was not found in the C2PA manifest");
  }

  return verify_groth16(proof, publicInputs, vkHash);
}
