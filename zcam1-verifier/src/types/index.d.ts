import type { ManifestStore } from "@contentauth/c2pa-types";

export declare function verifyProofFromStore(
  store: any,
  publicInputs: Uint8Array,
  vkHash: string,
): boolean;
