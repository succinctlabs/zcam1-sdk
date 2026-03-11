import { sha256 } from "@noble/hashes/sha2.js";
import { generateHardwareSignatureWithAssertion } from "@pagopa/io-react-native-integrity";
import { base64 } from "@scure/base";
import { Platform } from "react-native";

import { signWithDeviceKey } from "./capture";
import { isEmulator } from "react-native-device-info";

/**
 * Strips the "file://" protocol prefix from a path if present.
 */
export function stripFileProtocol(path: string): string {
  return path.startsWith("file://") ? path.slice(7) : path;
}

function stringToArray(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

export async function generateAppAttestAssertion(
  dataHash: ArrayBuffer,
  normalizedMetadata: string,
  deviceKeyId: string,
): Promise<string> {
  if (await isEmulator()) {
    console.warn(
      "[ZCAM] Running in simulator - using mock assertion. This is for development only.",
    );

    return `SIMULATOR_MOCK_ASSERTION_${deviceKeyId}_${Date.now()}`;
  }

  const metadataBytes = stringToArray(normalizedMetadata);
  const clientData =
    base64.encode(new Uint8Array(dataHash)) + "|" + base64.encode(sha256(metadataBytes));

  switch (Platform.OS) {
    case "android":
      // Android: sign directly with hardware-backed ECDSA key via Android KeyStore.
      // Returns a base64-encoded DER ECDSA signature.
      return await signWithDeviceKey(deviceKeyId, clientData);

    case "ios":
    case "macos":
      // iOS: use App Attest assertion via Secure Enclave
      return await generateHardwareSignatureWithAssertion(clientData, deviceKeyId);

    default:
      throw new Error(`${Platform.OS} not supported for assertion`);
  }
}
