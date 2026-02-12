import type { ECKey } from "@succinctlabs/react-native-zcam1-common";

/**
 * Supported platforms for attestation.
 */
export type AttestationPlatform = "ios" | "android";

/**
 * Configuration settings for device initialization and backend communication.
 */
export type Settings = {
  appId: string;
  production: boolean;
  /**
   * GCP project number for Play Integrity (Android only).
   * Required for full Android attestation flow.
   * If not provided on Android, Play Integrity token will be skipped.
   */
  gcpProjectNumber?: string;
};

/**
 * Device registration information including keys, certificate chain, and attestation.
 */
export type CaptureInfo = {
  appId: string;
  deviceKeyId: string;
  contentPublicKey: ECKey;
  contentKeyId: Uint8Array;
  /**
   * Platform where the device was registered.
   */
  platform: AttestationPlatform;
  /**
   * iOS: App Attest attestation object (CBOR-encoded)
   * Android: Key attestation certificate chain (PEM-encoded, newline-joined)
   */
  attestation: string;
  /**
   * Play Integrity token (Android only).
   * Only present when gcpProjectNumber was provided in Settings.
   */
  playIntegrityToken?: string;
};

/**
 * iOS-specific device binding fields.
 */
export type IOSDeviceBindings = {
  platform: "ios";
  /**
   * App Attest attestation object (CBOR-encoded, base64).
   */
  attestation: string;
  /**
   * App Attest assertion (CBOR-encoded, base64).
   */
  assertion: string;
};

/**
 * Android-specific device binding fields.
 */
export type AndroidDeviceBindings = {
  platform: "android";
  /**
   * Key attestation certificate chain (PEM-encoded certificates joined by newlines).
   */
  keyAttestationChain: string;
  /**
   * ECDSA signature over the data (SHA256withECDSA, DER-encoded, base64).
   */
  signature: string;
  /**
   * Play Integrity token (if available).
   */
  playIntegrityToken?: string;
};

/**
 * Device bindings union type for platform-specific attestation data.
 */
export type DeviceBindings = IOSDeviceBindings | AndroidDeviceBindings;

/**
 * Helper to check if bindings are iOS-specific.
 */
export function isIOSBindings(bindings: DeviceBindings): bindings is IOSDeviceBindings {
  return bindings.platform === "ios";
}

/**
 * Helper to check if bindings are Android-specific.
 */
export function isAndroidBindings(bindings: DeviceBindings): bindings is AndroidDeviceBindings {
  return bindings.platform === "android";
}
