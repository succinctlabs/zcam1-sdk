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
  /** Application identifier. On iOS, formatted as `<TEAM_ID>.<BUNDLE_ID>` (e.g. `NLS5R4YCGX.com.example.myapp`). On Android, the app's package name (e.g. `com.example.myapp`). */
  appId: string;
  /** Unique identifier for the device key. */
  deviceKeyId: string;
  /** EC public key used to sign captured content. */
  contentPublicKey: ECKey;
  /** Identifier for the content key. */
  contentKeyId: Uint8Array;
  /** Device attestation blob. */
  attestation: string;
};

/**
 * Configuration settings for device initialization and backend communication.
 */
export type Settings = {
  /** iOS only. The app identifier, formatted as `<TEAM_ID>.<BUNDLE_ID>` (e.g. `NLS5R4YCGX.com.example.myapp`). Required on iOS — omitting it will throw. Ignored on Android, where the package name is derived automatically from the app bundle. */
  appId?: string;
  /** Whether to use the production backend. */
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
  const isSimulator = await isEmulator();

  if (isSimulator && settings.production) {
    throw new Error(
      "Cannot initialize capture in production mode on a simulator. " +
        "Use a real device for production captures, or set production to false for development.",
    );
  }

  const appId = getAppId(settings);
  const deviceKeyId = await getAndPersistDeviceKeyId(appId, isSimulator);
  const attestation = await getAndPersistAttestation(deviceKeyId, isSimulator);
  const contentPublicKey = await getContentPublicKey();

  if (contentPublicKey.kty !== "EC") {
    throw new Error("Only EC public keys are supported");
  }

  const contentKeyId = getSecureEnclaveKeyId(contentPublicKey);

  return {
    appId: appId!,
    deviceKeyId,
    contentPublicKey,
    contentKeyId,
    attestation,
  };
}

function getAppId(settings: Settings): string {
  switch (Platform.OS) {
    case "android":
      return getBundleId();

    case "ios":
    case "macos":
      if (settings.appId === undefined) {
        throw new Error("The appId is required on iOS");
      }
      return settings.appId;

    default:
      throw new Error(`getAppId: ${Platform.OS} not supported`);
  }
}

async function getAndPersistDeviceKeyId(appId: string, isSimulator: boolean): Promise<string> {
  let deviceKeyId = await EncryptedStorage.getItem(`deviceKeyId-${appId}`);

  if (deviceKeyId) return deviceKeyId;

  if (isSimulator) {
    console.warn(
      "[ZCAM] Running in simulator - using mock device key. This is for development only.",
    );
    return `SIMULATOR_DEVICE_KEY_${Date.now()}`;
  }

  switch (Platform.OS) {
    case "android":
      // On Android, getAttestation() creates the key AND returns the attestation
      // certificate chain in a single call. generateHardwareKey() is iOS-only.
      deviceKeyId = `ZCAM1_ANDROID_DEVICE_${appId}`;
      break;

    case "ios":
    case "macos":
      deviceKeyId = await generateHardwareKey();
      break;

    default:
      throw new Error(`getDeviceKeyId: ${Platform.OS} not supported`);
  }

  await EncryptedStorage.setItem(`deviceKeyId-${appId}`, deviceKeyId);

  return deviceKeyId;
}

async function getAndPersistAttestation(keyId: string, isSimulator: boolean): Promise<string> {
  let attestation = await EncryptedStorage.getItem(`attestation-${keyId}`);

  if (attestation) return attestation;

  if (isSimulator) {
    console.warn(
      "[ZCAM] Running in simulator - using mock attestation. This is for development only.",
    );
    return `SIMULATOR_MOCK_${keyId}_${Date.now()}`;
  }

  attestation = await getAttestation(keyId, keyId);

  await EncryptedStorage.setItem(`attestation-${keyId}`, attestation);

  return attestation;
}

/**
 * Updates device registration by performing attestation with the backend.
 * @param keyId - The hardware key identifier
 * @returns Attestation data and challenge
 */
export async function updateRegistration(keyId: string, isSimulator: boolean): Promise<string> {
  await EncryptedStorage.removeItem(`attestation-${keyId}`);

  return getAndPersistAttestation(keyId, isSimulator);
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
