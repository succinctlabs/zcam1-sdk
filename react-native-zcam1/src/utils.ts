import { sha256 } from "@noble/hashes/sha2.js";
import { generateHardwareSignatureWithAssertion } from "@pagopa/io-react-native-integrity";
import { base64 } from "@scure/base";
import { Platform } from "react-native";

import { signWithDeviceKey } from ".";

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
  const metadataBytes = stringToArray(normalizedMetadata);
  const clientData =
    base64.encode(new Uint8Array(dataHash)) + "|" + base64.encode(sha256(metadataBytes));

  if (Platform.OS === "android") {
    // Android: sign directly with hardware-backed ECDSA key via Android KeyStore.
    // Returns a base64-encoded DER ECDSA signature.
    return signWithDeviceKey(deviceKeyId, clientData);
  }

  // iOS: use App Attest assertion via Secure Enclave
  try {
    return await generateHardwareSignatureWithAssertion(clientData, deviceKeyId);
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string } | undefined;
    if (err?.code === "-1" || err?.message?.includes("UNSUPPORTED_SERVICE")) {
      console.warn(
        "[ZCAMs] Running in simulator - using mock attestation. This is for development only.",
      );
      // Use a mock attestation for simulator testing
      // In production, this would need to be rejected by the backend
      return `SIMULATOR_MOCK_${deviceKeyId}_${Date.now()}`;
    }
    throw error;
  }
}
