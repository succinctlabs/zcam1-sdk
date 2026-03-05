import { generateHardwareKey, getAttestation } from "@pagopa/io-react-native-integrity";
import EncryptedStorage from "react-native-encrypted-storage";

import { type ECKey, getContentPublicKey, getSecureEnclaveKeyId } from "./common";
export { buildSelfSignedCertificate, SelfSignedCertChain } from "./bindings";

/**
 * Camera component for capturing photos with secure enclave integration.
 */
export {
  type CameraFilmStyle,
  type FilmStyleEffect,
  type FilmStyleRecipe,
  type HighlightShadowConfig,
  type MonochromeConfig,
  type WhiteBalanceConfig,
  ZCamera,
} from "./camera";

import NativeZcam1Capture from "./NativeZcam1Capture";

/**
 * Present a native full-screen preview for any file using iOS QLPreviewController.
 * Supports images, videos, PDFs, and other common file types with native playback controls.
 * @param filePath Absolute filesystem path to the file.
 */
export async function previewFile(filePath: string): Promise<void> {
  return NativeZcam1Capture.previewFile(filePath);
}

/**
 * Flash mode for photo capture.
 */
export {
  type AspectRatio,
  type DeviceOrientation,
  type FlashMode,
  type Orientation,
} from "./NativeZcam1Capture";

/**
 * Native video recording results.
 */
export type {
  StartNativeVideoRecordingResult,
  StopNativeVideoRecordingResult,
} from "./NativeZcam1Capture";

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
  let deviceKeyId = await EncryptedStorage.getItem(`deviceKeyId-${settings.appId}`);

  const contentPublicKey = await getContentPublicKey();

  if (contentPublicKey.kty !== "EC") {
    throw new Error("Only EC public keys are supported");
  }

  const contentKeyId = getSecureEnclaveKeyId(contentPublicKey);

  if (deviceKeyId == null) {
    // Try to generate hardware key, but fall back to mock for simulator
    try {
      deviceKeyId = await generateHardwareKey();
    } catch (error: unknown) {
      // If running in simulator, hardware key generation is not supported
      const err = error as { code?: string; message?: string } | undefined;
      if (err?.code === "-1" || err?.message?.includes("UNSUPPORTED_SERVICE")) {
        console.warn(
          "[ZCAM] Running in simulator - using mock device key. This is for development only.",
        );
        // Generate a mock device key for simulator testing
        deviceKeyId = `SIMULATOR_DEVICE_KEY_${Date.now()}`;
      } else {
        throw error;
      }
    }
    await EncryptedStorage.setItem(`deviceKeyId-${settings.appId}`, deviceKeyId);
  }

  if (deviceKeyId == null) {
    throw new Error("Failed to generate a device key");
  }

  let attestation = await EncryptedStorage.getItem(`attestation-${deviceKeyId}`);

  if (attestation == null) {
    attestation = await updateRegistration(deviceKeyId, settings);
  }

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
export async function updateRegistration(keyId: string, _settings: Settings): Promise<string> {
  // Try to get real attestation, but fall back to mock for simulator
  let attestation: string;
  try {
    attestation = await getAttestation(keyId, keyId);
  } catch (error: unknown) {
    // If running in simulator, App Attest is not supported
    const err = error as { code?: string; message?: string } | undefined;
    if (err?.code === "-1" || err?.message?.includes("UNSUPPORTED_SERVICE")) {
      console.warn(
        "[ZCAM] Running in simulator - using mock attestation. This is for development only.",
      );
      // Use a mock attestation for simulator testing
      // In production, this would need to be rejected by the backend
      return `SIMULATOR_MOCK_${keyId}_${Date.now()}`;
    } else {
      throw error;
    }
  }

  await EncryptedStorage.setItem(`attestation-${keyId}`, attestation);

  return attestation;
}
