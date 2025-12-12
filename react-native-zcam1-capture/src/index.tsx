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
  let certChainPem: string;

  // Check if we're in simulator mode by checking stored device key.
  const storedDeviceKeyId = await EncryptedStorage.getItem("deviceKeyId");
  const isSimulatorMode = storedDeviceKeyId?.startsWith("SIMULATOR_DEVICE_KEY_");

  if (isSimulatorMode) {
    console.warn(
      "[ZCAM] Simulator mode detected - using static test key and certificate for C2PA signing. This is for development only."
    );

    // Use the simulator test key ID (SHA1 of the test public key).
    contentKeyId = new Uint8Array([
      0x3e, 0xa8, 0x98, 0xc9, 0x39, 0x9f, 0x09, 0x10, 0xfe, 0xf2, 0xa6, 0x06, 0x6c, 0x20, 0x14, 0x6d,
      0xa6, 0x6d, 0x7f, 0x1b
    ]);

    // Use the matching test certificate chain (leaf + root CA).
    certChainPem = `-----BEGIN CERTIFICATE-----
MIIBqjCCAVCgAwIBAgIUPkCafHrb7oQtOzHKROCtLJ7Ik48wCgYIKoZIzj0EAwIw
IjEgMB4GA1UEAwwXWkNBTTEgU2ltdWxhdG9yIFJvb3QgQ0EwHhcNMjUxMjEyMjA1
MTU2WhcNMjYxMjEyMjA1MTU2WjAfMR0wGwYDVQQDDBRaQ0FNMSBTaW11bGF0b3Ig
TGVhZjBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABBmmOwk4xDsuQp52DVq9Qmae
EdfIBOU2oqohdxF2ojcqS14w4rvT3CMJEKkdnORiGEJ8wauL9hGB3k3BhZGLPgej
ZzBlMA4GA1UdDwEB/wQEAwIHgDATBgNVHSUEDDAKBggrBgEFBQcDCDAdBgNVHQ4E
FgQUPqiYyTmfCRD+8qYGbCAUbaZtfxswHwYDVR0jBBgwFoAU30/EycXtmh8VBbys
U1raHhESoJEwCgYIKoZIzj0EAwIDSAAwRQIhAPUlsEabVDS/mK4Rebonotz0s+Qz
69b1kaVXFSC1LRlkAiBEmoX+jTznSpvwusxwZhDDysRTkckZ2WQMIqOncO96Pg==
-----END CERTIFICATE-----
-----BEGIN CERTIFICATE-----
MIIBmTCCAT+gAwIBAgIUPKK7uM20VeV7ZpO6wuOYHKf5tUAwCgYIKoZIzj0EAwIw
IjEgMB4GA1UEAwwXWkNBTTEgU2ltdWxhdG9yIFJvb3QgQ0EwHhcNMjUxMjEyMjA1
MTU2WhcNMzUxMjEwMjA1MTU2WjAiMSAwHgYDVQQDDBdaQ0FNMSBTaW11bGF0b3Ig
Um9vdCBDQTBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABBjmrwPOV3a2VHkRLYHK
0xDFeyk+vH7WmGLleHLmiJP3WxVBf6P6a3sFEVFIgK8knYUFdhJ2eSd0VG5dj8w6
EjejUzBRMB0GA1UdDgQWBBTfT8TJxe2aHxUFvKxTWtoeERKgkTAfBgNVHSMEGDAW
gBTfT8TJxe2aHxUFvKxTWtoeERKgkTAPBgNVHRMBAf8EBTADAQH/MAoGCCqGSM49
BAMCA0gAMEUCIQCPwjZKBQ07WgMsmf+GO5dOHv/87JeHIkVi5XsAlRO/zAIgSiGx
Q4CT45+VKCq/wxQ2WBeI//3t5KzKi3FoTrcRCKo=
-----END CERTIFICATE-----`;
  } else {
    // Real device: use Secure Enclave key.
    const contentPublicKey = await getContentPublicKey();

    if (contentPublicKey.kty !== "EC") {
      throw "Only EC public keys are supported";
    }

    contentKeyId = getSecureEnclaveKeyId(contentPublicKey);

    // Get certificate chain from backend.
    try {
      certChainPem = await getCertChain(
        contentPublicKey,
        settings.backendUrl,
      );
    } catch (error: any) {
      throw new Error(`Failed to get certificate chain from backend: ${error?.message || error}`);
    }
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
