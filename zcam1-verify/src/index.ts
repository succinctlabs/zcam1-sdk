import { createC2pa, ManifestStore } from "@contentauth/c2pa-web";

import wasmSrc from "@contentauth/c2pa-web/resources/c2pa.wasm?url";

const c2pa = await createC2pa({ wasmSrc });

export async function extractManifest(
  file: File,
): Promise<ManifestStore | undefined> {
  const reader = await c2pa.reader.fromBlob(file.type, file);

  return await reader?.manifestStore();
}
