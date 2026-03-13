import {
  getPublicKeyFixed,
  isKeyStrongboxBacked,
  sign as cryptoSign,
} from "@pagopa/io-react-native-crypto";
import {
  generateHardwareKey,
  getAttestation,
  isPlayServicesAvailable,
} from "@pagopa/io-react-native-integrity";
import Geolocation from "@react-native-community/geolocation";
import { PermissionsAndroid, Platform } from "react-native";
import { getBundleId, isEmulator } from "react-native-device-info";
import EncryptedStorage from "react-native-encrypted-storage";

import { type ECKey, getContentPublicKey, getSecureEnclaveKeyId } from "./common";
export { buildSelfSignedCertificate, SelfSignedCertChain } from "./bindings";

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
  const contentPublicKey = await getContentPublicKey();
  const isSimulator = await isEmulator();
  let appId = settings.appId;

  if (contentPublicKey.kty !== "EC") {
    throw new Error("Only EC public keys are supported");
  }

  const contentKeyId = getSecureEnclaveKeyId(contentPublicKey);

  let deviceKeyId = await EncryptedStorage.getItem(`deviceKeyId-${settings.appId}`);
  let attestation = deviceKeyId
    ? await EncryptedStorage.getItem(`attestation-${deviceKeyId}`)
    : null;

  if (deviceKeyId == null || attestation == null) {
    switch (Platform.OS) {
      case "android":
        // On Android, the appId is the package name.
        appId = getBundleId();

        // On Android, getAttestation() creates the key AND returns the attestation
        // certificate chain in a single call. generateHardwareKey() is iOS-only.
        deviceKeyId = `ZCAM1_ANDROID_DEVICE_${appId}`;

        if (isSimulator) {
          // Emulator or device without Play Integrity support — use mock attestation.
          console.warn(
            "[ZCAM] Play Integrity not available - using mock attestation. This is for development only.",
          );
          attestation = `SIMULATOR_MOCK_${deviceKeyId}_${Date.now()}`;
        } else {
          attestation = await getAttestation(deviceKeyId, deviceKeyId);
        }
        break;

      case "ios":
      case "macos":
        // iOS: generate key first, then attest separately
        if (deviceKeyId == null) {
          if (isSimulator) {
            console.warn(
              "[ZCAM] Running in simulator - using mock device key. This is for development only.",
            );
            deviceKeyId = `SIMULATOR_DEVICE_KEY_${Date.now()}`;
          } else {
            deviceKeyId = await generateHardwareKey();
          }
        }
        attestation = await updateRegistration(deviceKeyId!, settings);
        break;

      default:
        throw new Error(`initCapture: ${Platform.OS} not supported`);
    }

    await EncryptedStorage.setItem(`deviceKeyId-${settings.appId}`, deviceKeyId!);
    await EncryptedStorage.setItem(`attestation-${deviceKeyId}`, attestation!);
  }

  if (deviceKeyId == null) {
    throw new Error("Failed to generate a device key");
  }

  return {
    appId,
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
  const isSimulator = await isEmulator();

  if (isSimulator) {
    console.warn(
      "[ZCAM] Running in simulator - using mock attestation. This is for development only.",
    );
    return `SIMULATOR_MOCK_${keyId}_${Date.now()}`;
  }

  const attestation = await getAttestation(keyId, keyId);
  await EncryptedStorage.setItem(`attestation-${keyId}`, attestation);

  return attestation;
}

/**
 * Requests camera (and microphone) permissions on Android.
 * No-op on iOS — the system prompts automatically when the camera is accessed.
 */
export async function requestCameraPermission(): Promise<void> {
  if (Platform.OS !== "android") return;
  await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.CAMERA,
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
  ]);
}

/**
 * Requests location permission from the user.
 * This function triggers the native location authorization prompt on the device.
 * @throws {string} Error message if permission request fails
 */
export function requestLocationPermission() {
  Geolocation.requestAuthorization(
    () => {},
    (error) => {
      throw error.message;
    },
  );
}

/**
 * Sign a message with the device hardware key.
 * Uses SHA256withECDSA on Android (Android KeyStore) or SecureEnclave on iOS.
 * @param deviceKeyId - The key alias/tag from initCapture().deviceKeyId
 * @param message - The UTF-8 string message to sign
 * @returns Base64-encoded ECDSA signature
 */
export async function signWithDeviceKey(deviceKeyId: string, message: string): Promise<string> {
  return cryptoSign(message, deviceKeyId);
}

/**
 * Get the public key for a device key in JWK format.
 * @param deviceKeyId - The key alias/tag from initCapture().deviceKeyId
 * @returns The public key as an ECKey (JWK format with x, y coordinates)
 */
export async function getDevicePublicKey(deviceKeyId: string): Promise<ECKey> {
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
export async function isDeviceKeyStrongboxBacked(deviceKeyId: string): Promise<boolean> {
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
