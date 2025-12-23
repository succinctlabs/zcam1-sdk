import {
  generateHardwareKey,
  getAttestation,
} from "@pagopa/io-react-native-integrity";
import EncryptedStorage from "react-native-encrypted-storage";
import { buildSelfSignedCertificate } from "react-native-zcam1-c2pa";
import {
  getCertChain,
  getContentPublicKey,
  getSecureEnclaveKeyId,
} from "zcam1-common";

/**
 * Camera component for capturing photos with secure enclave integration.
 */
export { ZCamera } from "./camera";

/**
 * Device registration information including keys, certificate chain, and attestation.
 */
export type DeviceInfo = {
  deviceKeyId: string;
  contentKeyId: Uint8Array;
  certChainPem: string;
  attestation: string;
};

/**
 * Configuration settings for device initialization and backend communication.
 */
export type Settings = {
  backendUrl: string;
  appId: string;
  rootCertSubject?: string;
  intermediateCertSubject?: string;
  leafSubject?: string;
  leafOrganization?: string;
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
export async function initDevice(settings: Settings): Promise<DeviceInfo> {
  let deviceKeyId: string | undefined;
  let contentKeyId: Uint8Array | undefined;

  const contentPublicKey = await getContentPublicKey();

  if (contentPublicKey.kty !== "EC") {
    throw "Only EC public keys are supported";
  }

  contentKeyId = getSecureEnclaveKeyId(contentPublicKey);

  const certChainPem = buildSelfSignedCertificate(
    settings.rootCertSubject ?? "ZCAM1 Root Cert",
    settings.intermediateCertSubject ?? "ZCAM1 Intermediate Cert",
    settings.leafSubject ?? "ZCAM1 Leaf Cert",
    settings.leafOrganization ?? "Succinct",
    contentPublicKey,
  );

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

  return { deviceKeyId, contentKeyId, certChainPem, attestation };
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
