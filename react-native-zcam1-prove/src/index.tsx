import { extractManifest, ManifestEditor } from "react-native-zcam1-c2pa";
import { generateProof, getVkHash } from "./proving";
import { base64 } from "@scure/base";
import {
  getCertChain,
  getContentPublicKey,
  getSecureEnclaveKeyId,
} from "zcam1-common";
import { Util } from "react-native-file-access";

/**
 * Configuration settings for backend communication.
 */
export type Settings = {
  backendUrl: string;
  production: boolean;
};

/**
 * Device information including content key identifier and certificate chain.
 */
export type DeviceInfo = {
  contentKeyId: Uint8Array;
  certChainPem: string;
};

/**
 * Initializes the device by obtaining the content public key and certificate chain.
 * @param settings - Configuration settings for initialization
 * @returns Device information including content key ID and certificate chain
 */
export async function initDevice(settings: Settings): Promise<DeviceInfo> {
  let contentKeyId: Uint8Array | undefined;

  const contentPublicKey = await getContentPublicKey();

  if (contentPublicKey.kty !== "EC") {
    throw "Only EC public keys are supported";
  }

  contentKeyId = getSecureEnclaveKeyId(contentPublicKey);

  const certChainPem = await getCertChain(
    contentPublicKey,
    settings.backendUrl,
  );

  return { contentKeyId, certChainPem };
}

/**
 * Embeds a cryptographic proof into an image file by modifying its C2PA manifest.
 * @param originalPath - Path to the original image file
 * @param deviceInfo - Device information for signing
 * @param settings - Configuration settings for proof generation
 * @returns Path to the new file with embedded proof
 */
export async function embedProof(
  originalPath: string,
  deviceInfo: DeviceInfo,
  settings: Settings,
): Promise<string> {
  const store = extractManifest(originalPath);
  const activeManifest = store.activeManifest();
  const dataHash = activeManifest.dataHash();
  const bindings = activeManifest.bindings();

  originalPath = originalPath.replace("file://", "");

  if (bindings === undefined) {
    throw new Error("No device bindings found in the C2PA manifest");
  }

  const manifestEditor = ManifestEditor.fromFileAndManifest(
    originalPath,
    store,
  );

  const proof = await generateProof(bindings, dataHash.hash, settings);
  let vkHash = await getVkHash(settings);

  manifestEditor.addAssertion(
    "succinct.proof",
    JSON.stringify({
      data: base64.encode(proof),
      vk_hash: vkHash,
    }),
  );
  manifestEditor.removeAssertion("succinct.bindings");

  const destinationPath =
    Util.dirname(originalPath) +
    `/tmp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`;

  await manifestEditor.embedManifestToFile(
    destinationPath,
    base64.decode(dataHash.hash),
    "image/jpeg",
    deviceInfo.contentKeyId,
    deviceInfo.certChainPem,
  );

  return destinationPath;
}
