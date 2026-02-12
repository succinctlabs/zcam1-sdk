import {
  generateHardwareKey,
  getAttestation,
  isPlayServicesAvailable,
  prepareIntegrityToken,
  requestIntegrityToken,
} from "@pagopa/io-react-native-integrity";
import { getContentPublicKey, getSecureEnclaveKeyId } from "@succinctlabs/react-native-zcam1-common";
import { Platform } from "react-native";
import EncryptedStorage from "react-native-encrypted-storage";

import type { AttestationPlatform, CaptureInfo, Settings } from "./types";

export {
  buildSelfSignedCertificate,
  SelfSignedCertChain,
} from "@succinctlabs/react-native-zcam1-c2pa";

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

import NativeZcam1Sdk from "./NativeZcam1Sdk";

/**
 * Present a native full-screen preview for any file using iOS QLPreviewController.
 * Supports images, videos, PDFs, and other common file types with native playback controls.
 * @param filePath Absolute filesystem path to the file.
 */
export async function previewFile(filePath: string): Promise<void> {
  return NativeZcam1Sdk.previewFile(filePath);
}

/**
 * Flash mode for photo capture.
 */
export {
  type AspectRatio,
  type DeviceOrientation,
  type FlashMode,
  type Orientation,
} from "./NativeZcam1Sdk";

/**
 * Native video recording results.
 */
export type {
  StartNativeVideoRecordingResult,
  StopNativeVideoRecordingResult,
} from "./NativeZcam1Sdk";

/**
 * Re-export types from types.ts for external consumers.
 */
export type {
  AndroidDeviceBindings,
  AttestationPlatform,
  CaptureInfo,
  DeviceBindings,
  IOSDeviceBindings,
  Settings,
} from "./types";
export { isAndroidBindings, isIOSBindings } from "./types";

/**
 * Device bindings helpers for creating platform-specific attestation structures.
 */
export {
  createAndroidBindings,
  createDeviceBindings,
  createIOSBindings,
  getBindingsPlatform,
  serializeBindings,
} from "./bindings";

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
 * Supports both iOS (App Attest) and Android (Key Attestation + Play Integrity).
 * @param settings - Configuration settings for initialization
 * @returns Device information including keys, certificate chain, and attestation
 */
export async function initCapture(settings: Settings): Promise<CaptureInfo> {
  const platform: AttestationPlatform = Platform.OS as AttestationPlatform;

  const contentPublicKey = await getContentPublicKey();

  if (contentPublicKey.kty !== "EC") {
    throw new Error("Only EC public keys are supported");
  }

  const contentKeyId = getSecureEnclaveKeyId(contentPublicKey);

  let deviceKeyId = await EncryptedStorage.getItem(`deviceKeyId-${settings.appId}`);
  let attestation = deviceKeyId
    ? await EncryptedStorage.getItem(`attestation-${deviceKeyId}`)
    : null;
  let playIntegrityToken: string | undefined;

  if (platform === "android") {
    // Android: Key Attestation + optional Play Integrity
    const playServicesAvailable = await isPlayServicesAvailable();
    if (!playServicesAvailable) {
      throw new Error("Google Play Services unavailable");
    }

    // Use deterministic key alias for Android (pagopa creates key on getAttestation)
    if (deviceKeyId == null) {
      deviceKeyId = `zcam1_${settings.appId}_device_key`;
      await EncryptedStorage.setItem(`deviceKeyId-${settings.appId}`, deviceKeyId);
    }

    // Get Key Attestation certificate chain
    if (attestation == null) {
      attestation = await getAttestation(deviceKeyId, deviceKeyId);
      await EncryptedStorage.setItem(`attestation-${deviceKeyId}`, attestation);
    }

    // Optionally get Play Integrity token (requires GCP project number)
    if (settings.gcpProjectNumber) {
      try {
        await prepareIntegrityToken(settings.gcpProjectNumber);
        // Generate a simple challenge hash for the integrity token
        const challenge = `${settings.appId}_${Date.now()}`;
        playIntegrityToken = await requestIntegrityToken(challenge);
      } catch (error: unknown) {
        console.warn("[ZCAM] Play Integrity unavailable, continuing with Key Attestation only:", error);
        // Continue without Play Integrity - Key Attestation is still valid
      }
    }
  } else {
    // iOS: App Attest
    if (deviceKeyId == null) {
      try {
        deviceKeyId = await generateHardwareKey();
      } catch (error: unknown) {
        const err = error as { code?: string; message?: string } | undefined;
        if (err?.code === "-1" || err?.message?.includes("UNSUPPORTED_SERVICE")) {
          console.warn(
            "[ZCAM] Running in simulator - using mock device key. This is for development only.",
          );
          deviceKeyId = `SIMULATOR_DEVICE_KEY_${Date.now()}`;
        } else {
          throw error;
        }
      }
      await EncryptedStorage.setItem(`deviceKeyId-${settings.appId}`, deviceKeyId);
    }

    if (attestation == null) {
      attestation = await updateRegistration(deviceKeyId, settings);
    }
  }

  if (deviceKeyId == null) {
    throw new Error("Failed to generate a device key");
  }

  if (attestation == null) {
    throw new Error("Failed to obtain attestation");
  }

  return {
    appId: settings.appId,
    deviceKeyId,
    contentPublicKey,
    contentKeyId,
    platform,
    attestation,
    playIntegrityToken,
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
