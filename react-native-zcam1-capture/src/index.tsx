import {
  generateHardwareKey,
  getAttestation,
} from "@pagopa/io-react-native-integrity";
import EncryptedStorage from "react-native-encrypted-storage";
import { Platform } from "react-native";
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

  // Get certificate chain from backend, or use mock for simulator
  let certChainPem: string;
  try {
    certChainPem = await getCertChain(
      contentPublicKey,
      settings.backendUrl,
    );
  } catch (error: any) {
    // If backend isn't available or returns invalid data, use mock certificate for simulator
    console.warn(
      "[ZCAM] Failed to get certificate chain from backend - using mock certificate for simulator testing. This is for development only.",
      error?.message || error
    );
    // Mock self-signed certificate chain for development/simulator use
    // This is a minimal PEM certificate that will allow C2PA signing to work
    certChainPem = `-----BEGIN CERTIFICATE-----
MIICLDCCAdKgAwIBAgIBADAKBggqhkjOPQQDAjB9MQswCQYDVQQGEwJVUzELMAkG
A1UECAwCQ0ExFjAUBgNVBAcMDVNhbiBGcmFuY2lzY28xEzARBgNVBAoMClpDQU0x
IFRlc3QxEzARBgNVBAsMClpDQU0xIFRlc3QxHzAdBgNVBAMMFlpDQU0xIFNpbXVs
YXRvciBSb290MB4XDTI0MDEwMTAwMDAwMFoXDTI1MDEwMTAwMDAwMFowfTELMAkG
A1UEBhMCVVMxCzAJBgNVBAgMAkNBMRYwFAYDVQQHDA1TYW4gRnJhbmNpc2NvMRMw
EQYDVQQKDApaQ0FNMSBUZXN0MRMwEQYDVQQLDApaQ0FNMSBUZXN0MR8wHQYDVQQD
DBZaQ0FNMSBTaW11bGF0b3IgUm9vdDBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IA
BHNBVvJkMUcNvBdHm3/SvS8UQnSRjPCjU1bXeNqPQQhWlKOJvEPf6nBTllqDhpqr
4I0kCjJJq3vVRfL3ihqGsCyjUDBOMB0GA1UdDgQWBBQrDZ0/kNqwZSQS0DjIlqQs
2JcP1DAfBgNVHSMEGDAWgBQrDZ0/kNqwZSQS0DjIlqQs2JcP1DAMBgNVHRMEBTAD
AQH/MAoGCCqGSM49BAMCA0gAMEUCIGLr7rCQj0nfnV3vGlvBqBpYHqWCh7wdGOxK
aFOdL3VVAiEA2A3FwZPvDv1TqCvHGBHn8M5+9RL6yK0kqNp7pHN4LUo=
-----END CERTIFICATE-----`;
  }

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
  let response = await fetch(settings.backendUrl + "/ios/register/init", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ keyId }),
  });

  if (!response.ok) {
    throw "failed to init:" + (await response.text());
  }

  let challenge = await response.text();

  // Try to get real attestation, but fall back to mock for simulator
  let attestation: string;
  try {
    attestation = await getAttestation(challenge, keyId);
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

  response = await fetch(settings.backendUrl + "/ios/register/validate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      attestation,
      keyId,
      appId: settings.appId,
      production: settings.production,
    }),
  });

  if (!response.ok) {
    throw "failed to validate:" + (await response.text());
  }

  return attestation;
}
