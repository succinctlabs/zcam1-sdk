import {
  generateHardwareKey,
  getAttestation,
} from "@pagopa/io-react-native-integrity";
import EncryptedStorage from "react-native-encrypted-storage";
import {
  getContentPublicKey,
  getSecureEnclaveKeyId,
} from "@succinctlabs/react-native-zcam1-common";

export {
  buildSelfSignedCertificate,
  SelfSignedCertChain,
} from "@succinctlabs/react-native-zcam1-c2pa";

// Re-export types from types.ts (no cycle because types.ts doesn't import from here)
export {
  type CaptureInfo,
  type MetadataInfo,
  type Settings,
  ZPhoto,
} from "./types";

// Re-export embedBindings from embed.ts (no cycle because embed.ts doesn't import from here)
export { embedBindings } from "./embed";

// Export camera component (no cycle because camera.tsx imports from types.ts and embed.ts, not here)
export { ZCamera } from "./camera";

// Export flash mode type
export { type FlashMode } from "./NativeZcam1Sdk";

// Import types for use in this file
import type { CaptureInfo, Settings } from "./types";

/**
 * Initializes the device by generating keys, obtaining certificate chain, and registering with the backend.
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
    try {
      deviceKeyId = await generateHardwareKey();
    } catch (error: any) {
      if (
        error?.code === "-1" ||
        error?.message?.includes("UNSUPPORTED_SERVICE")
      ) {
        console.warn(
          "[ZCAM] Running in simulator - using mock device key. This is for development only.",
        );
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
 */
export async function updateRegistration(
  keyId: string,
  settings: Settings,
): Promise<string> {
  let attestation: string;
  try {
    attestation = await getAttestation(keyId, keyId);
  } catch (error: any) {
    if (
      error?.code === "-1" ||
      error?.message?.includes("UNSUPPORTED_SERVICE")
    ) {
      console.warn(
        "[ZCAM] Running in simulator - using mock attestation. This is for development only.",
      );
      attestation = `SIMULATOR_MOCK_${keyId}_${Date.now()}`;
    } else {
      throw error;
    }
  }

  return attestation;
}
