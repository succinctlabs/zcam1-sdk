import { verify_groth16 } from "sp1-wasm-verifier";

export function verify(proof, publicInputs, vkHash) {
  return verify_groth16(proof, publicInputs, vkHash);
}
