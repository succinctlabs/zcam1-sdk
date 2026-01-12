import {
  generateHardwareKey,
  getAttestation,
} from "@pagopa/io-react-native-integrity";
import EncryptedStorage from "react-native-encrypted-storage";
import {
  getContentPublicKey,
  getSecureEnclaveKeyId,
  type ECKey,
} from "@succinctlabs/react-native-zcam1-common";
import {
  computeHash,
  formatFromPath,
  ManifestEditor,
} from "@succinctlabs/react-native-zcam1-c2pa";
import { Dirs, Util } from "react-native-file-access";
import { generateAppAttestAssertionFromPhotoHash } from "./utils";

export {
  buildSelfSignedCertificate,
  SelfSignedCertChain,
} from "@succinctlabs/react-native-zcam1-c2pa";

/**
 * Camera component for capturing photos with secure enclave integration.
 */
export { ZCamera } from "./camera";

/**
 * Device registration information including keys, certificate chain, and attestation.
 */
export type CaptureInfo = {
  appId: string;
  deviceKeyId: string;
  contentPublicKey: ECKey;
  contentKeyId: Uint8Array;
  attestation: string;
};

export type MetadataInfo = {
  device_make: string;
  device_model: string;
  software_version: string;
};

/**
 * Configuration settings for device initialization and backend communication.
 */
export type Settings = {
  appId: string;
  production: boolean;
};

/**
 * Represents a captured photo with its original and processed file paths.
 */
export class ZPhoto {
  originalPath: string;
  path: string;

  constructor(originalPath: string, path: string) {
    this.originalPath = originalPath;
    this.path = path;
  }
}

/**
 * Initializes the device by generating keys, obtaining certificate chain, and registering with the backend.
 * @param settings - Configuration settings for initialization
 * @returns Device information including keys, certificate chain, and attestation
 */
export async function initCapture(settings: Settings): Promise<CaptureInfo> {
  let deviceKeyId: string | undefined;
  let contentKeyId: Uint8Array | undefined;
  const contentPublicKey = await getContentPublicKey();

  if (contentPublicKey.kty !== "EC") {
    throw "Only EC public keys are supported";
  }

  contentKeyId = getSecureEnclaveKeyId(contentPublicKey);

  if (deviceKeyId === undefined) {
    // Try to generate hardware key, but fall back to mock for simulator
    try {
      deviceKeyId = await generateHardwareKey();
    } catch (error: any) {
      // If running in simulator, hardware key generation is not supported
      if (
        error?.code === "-1" ||
        error?.message?.includes("UNSUPPORTED_SERVICE")
      ) {
        console.warn(
          "[ZCAM] Running in simulator - using mock device key. This is for development only.",
        );
        // Generate a mock device key for simulator testing
        deviceKeyId = `SIMULATOR_DEVICE_KEY_${Date.now()}`;
      } else {
        throw error;
      }
    }
    EncryptedStorage.setItem("deviceKeyId", deviceKeyId);
  }

  if (deviceKeyId === undefined) {
    throw "failed to generate a device key";
  }

  const attestation = await updateRegistration(deviceKeyId, settings);

  return {
    appId: settings.appId,
    deviceKeyId,
    contentPublicKey,
    contentKeyId,
    attestation,
  };
}

/**
 * Updates device registration by performing attestation with the backend.
 * @param keyId - The hardware key identifier
 * @param settings - Configuration settings for registration
 * @returns Attestation data and challenge
 */
export async function updateRegistration(
  keyId: string,
  settings: Settings,
): Promise<string> {
  // Try to get real attestation, but fall back to mock for simulator
  let attestation: string;
  try {
    attestation = await getAttestation(keyId, keyId);
  } catch (error: any) {
    // If running in simulator, App Attest is not supported
    if (
      error?.code === "-1" ||
      error?.message?.includes("UNSUPPORTED_SERVICE")
    ) {
      console.warn(
        "[ZCAM] Running in simulator - using mock attestation. This is for development only.",
      );
      // Use a mock attestation for simulator testing
      // In production, this would need to be rejected by the backend
      attestation = `SIMULATOR_MOCK_${keyId}_${Date.now()}`;
    } else {
      throw error;
    }
  }

  return attestation;
}

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

  // Add an assertion containing all data needed to later generate a  proof
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
