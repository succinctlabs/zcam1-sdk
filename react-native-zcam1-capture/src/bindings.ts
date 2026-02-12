import type {
  AndroidDeviceBindings,
  AttestationPlatform,
  CaptureInfo,
  DeviceBindings,
  IOSDeviceBindings,
} from "./types";

/**
 * Creates platform-specific device bindings from capture info and assertion/signature.
 *
 * @param captureInfo - Device capture information from initCapture()
 * @param assertion - The assertion (iOS) or signature (Android) from generateAppAttestAssertion()
 * @returns Platform-specific device bindings object
 */
export function createDeviceBindings(captureInfo: CaptureInfo, assertion: string): DeviceBindings {
  if (captureInfo.platform === "ios") {
    return createIOSBindings(captureInfo.attestation, assertion);
  } else {
    return createAndroidBindings(
      captureInfo.attestation,
      assertion,
      captureInfo.playIntegrityToken,
    );
  }
}

/**
 * Creates iOS-specific device bindings.
 *
 * @param attestation - App Attest attestation object (CBOR-encoded, base64)
 * @param assertion - App Attest assertion (CBOR-encoded, base64)
 * @returns iOS device bindings
 */
export function createIOSBindings(attestation: string, assertion: string): IOSDeviceBindings {
  return {
    platform: "ios",
    attestation,
    assertion,
  };
}

/**
 * Creates Android-specific device bindings.
 *
 * @param keyAttestationChain - Key attestation certificate chain (PEM-encoded)
 * @param signature - ECDSA signature (DER-encoded, base64)
 * @param playIntegrityToken - Optional Play Integrity token
 * @returns Android device bindings
 */
export function createAndroidBindings(
  keyAttestationChain: string,
  signature: string,
  playIntegrityToken?: string,
): AndroidDeviceBindings {
  return {
    platform: "android",
    keyAttestationChain,
    signature,
    playIntegrityToken,
  };
}

/**
 * Serializes device bindings to JSON for transmission to a backend.
 *
 * @param bindings - Platform-specific device bindings
 * @returns JSON string representation of the bindings
 */
export function serializeBindings(bindings: DeviceBindings): string {
  return JSON.stringify(bindings);
}

/**
 * Gets the platform from device bindings.
 *
 * @param bindings - Device bindings object
 * @returns The platform ("ios" or "android")
 */
export function getBindingsPlatform(bindings: DeviceBindings): AttestationPlatform {
  return bindings.platform;
}
