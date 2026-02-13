import { Platform } from "react-native";
import {
  generateHardwareKey,
  getAttestation,
  isPlayServicesAvailable,
} from "@pagopa/io-react-native-integrity";
import {
  sign as cryptoSign,
  getPublicKeyFixed,
  isKeyStrongboxBacked,
} from "@pagopa/io-react-native-crypto";
import {
  type ECKey,
  getContentPublicKey,
  getSecureEnclaveKeyId,
} from "@succinctlabs/react-native-zcam1-common";
import EncryptedStorage from "react-native-encrypted-storage";

// c2pa and camera are lazy-loaded to avoid crashing on platforms where
// their native modules aren't available yet (e.g., Android before M4/M5).
export function buildSelfSignedCertificate(...args: any[]) {
  const c2pa = require("@succinctlabs/react-native-zcam1-c2pa");
  return c2pa.buildSelfSignedCertificate(...args);
}
export function SelfSignedCertChain(...args: any[]) {
  const c2pa = require("@succinctlabs/react-native-zcam1-c2pa");
  return new c2pa.SelfSignedCertChain(...args);
}

/**
 * Camera component for capturing photos with secure enclave integration.
 * Lazy-loaded to avoid native module errors on platforms without camera support.
 */
export type {
  CameraFilmStyle,
  FilmStyleEffect,
  FilmStyleRecipe,
  HighlightShadowConfig,
  MonochromeConfig,
  WhiteBalanceConfig,
} from "./camera";
export function getZCamera() {
  const camera = require("./camera");
  return camera.ZCamera;
}

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
  const contentPublicKey = await getContentPublicKey();

  if (contentPublicKey.kty !== "EC") {
    throw "Only EC public keys are supported";
  }

  const contentKeyId = getSecureEnclaveKeyId(contentPublicKey);

  let deviceKeyId = await EncryptedStorage.getItem(`deviceKeyId-${settings.appId}`);
  let attestation = deviceKeyId
    ? await EncryptedStorage.getItem(`attestation-${deviceKeyId}`)
    : null;

  if (deviceKeyId == null || attestation == null) {
    if (Platform.OS === "android") {
      // On Android, getAttestation() creates the key AND returns the attestation
      // certificate chain in a single call. generateHardwareKey() is iOS-only.
      const keyAlias = `zcam1-device-${settings.appId}`;
      try {
        attestation = await getAttestation(keyAlias, keyAlias);
      } catch (error: unknown) {
        const err = error as { code?: string; message?: string } | undefined;
        if (err?.code === "KEY_ALREADY_EXISTS") {
          // Key was created before but attestation wasn't stored — can't re-attest.
          // Use a placeholder; the key itself is still usable for signing.
          attestation = await EncryptedStorage.getItem(`attestation-${keyAlias}`) ?? "KEY_PREVIOUSLY_CREATED";
        } else {
          throw error;
        }
      }
      deviceKeyId = keyAlias;
    } else {
      // iOS: generate key first, then attest separately
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
      }
      attestation = await updateRegistration(deviceKeyId!, settings);
    }

    await EncryptedStorage.setItem(`deviceKeyId-${settings.appId}`, deviceKeyId!);
    await EncryptedStorage.setItem(`attestation-${deviceKeyId}`, attestation!);
  }

  if (deviceKeyId == null) {
    throw "failed to generate a device key";
  }

  return {
    appId: settings.appId,
    deviceKeyId,
    contentPublicKey,
    contentKeyId,
    attestation: attestation!,
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

/**
 * Sign a message with the device hardware key.
 * Uses SHA256withECDSA on Android (Android KeyStore) or SecureEnclave on iOS.
 * @param deviceKeyId - The key alias/tag from initCapture().deviceKeyId
 * @param message - The UTF-8 string message to sign
 * @returns Base64-encoded ECDSA signature
 */
export async function signWithDeviceKey(
  deviceKeyId: string,
  message: string,
): Promise<string> {
  return cryptoSign(message, deviceKeyId);
}

/**
 * Get the public key for a device key in JWK format.
 * @param deviceKeyId - The key alias/tag from initCapture().deviceKeyId
 * @returns The public key as an ECKey (JWK format with x, y coordinates)
 */
export async function getDevicePublicKey(
  deviceKeyId: string,
): Promise<ECKey> {
  const key = await getPublicKeyFixed(deviceKeyId);
  if (key.kty !== "EC") {
    throw new Error("Expected EC key, got " + key.kty);
  }
  return key;
}

/**
 * Check if the device key is backed by StrongBox (highest hardware security level).
 * Only meaningful on Android. Returns false on iOS.
 * @param deviceKeyId - The key alias/tag from initCapture().deviceKeyId
 * @returns true if StrongBox-backed, false if TEE-backed or unsupported
 */
export async function isDeviceKeyStrongboxBacked(
  deviceKeyId: string,
): Promise<boolean> {
  if (Platform.OS !== "android") return false;
  return isKeyStrongboxBacked(deviceKeyId);
}

/**
 * Check if Google Play Services is available (Android only).
 * Required for Play Integrity token requests.
 * @returns true if Play Services available, false otherwise. Always false on iOS.
 */
export async function checkPlayServicesAvailable(): Promise<boolean> {
  if (Platform.OS !== "android") return false;
  return isPlayServicesAvailable();
}
