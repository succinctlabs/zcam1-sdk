import {
  computeHash,
  formatFromPath,
  ManifestEditor,
} from "@succinctlabs/react-native-zcam1-c2pa";
import { Dirs, Util } from "react-native-file-access";
import { generateAppAttestAssertionFromPhotoHash } from "./utils";
import type { CaptureInfo, MetadataInfo } from "./types";

/**
 * Embeds C2PA bindings and capture metadata into a photo, producing a new signed file.
 */
export async function embedBindings(
  originalPath: string,
  when: string,
  metadata: MetadataInfo,
  captureInfo: CaptureInfo,
  certChainPem: string,
) {
  originalPath = originalPath.replace("file://", "");
  const dataHash = computeHash(originalPath, []);
  const format = formatFromPath(originalPath);
  const ext = Util.extname(originalPath);

  if (format === undefined) {
    throw new Error(`Unsupported file format: ${originalPath}`);
  }

  const destinationPath =
    Dirs.CacheDir +
    `/zcam-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;

  const assertion = await generateAppAttestAssertionFromPhotoHash(
    dataHash,
    captureInfo.deviceKeyId,
  );

  const manifestEditor = new ManifestEditor(
    originalPath,
    captureInfo.contentKeyId.buffer as ArrayBuffer,
    certChainPem,
  );

  // Add the "capture" action to the manifest.
  manifestEditor.addAction(
    JSON.stringify({
      action: "succinct.capture",
      when,
      parameters: metadata,
    }),
  );

  // Add an assertion containing all data needed to later generate a proof.
  manifestEditor.addAssertion(
    "succinct.bindings",
    JSON.stringify({
      app_id: captureInfo.appId,
      device_key_id: captureInfo.deviceKeyId,
      attestation: captureInfo.attestation,
      assertion,
    }),
  );

  console.log("Dest", destinationPath);

  // Sign the captured image with C2PA, producing a new signed file.
  await manifestEditor.embedManifestToFile(destinationPath, format);

  return destinationPath;
}
