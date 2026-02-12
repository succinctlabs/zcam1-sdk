import { sha256 } from "@noble/hashes/sha2.js";
import { generateHardwareSignatureWithAssertion } from "@pagopa/io-react-native-integrity";
import { base64 } from "@scure/base";
import { Platform } from "react-native";

import NativeZcam1Sdk from "./NativeZcam1Sdk";

function stringToArray(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

/**
 * Generates an assertion/signature over data for device attestation.
 *
 * On iOS: Uses App Attest to generate a CBOR-encoded assertion object.
 * On Android: Uses the hardware-backed key to sign with SHA256withECDSA.
 *
 * @param dataHash - Hash of the data to attest
 * @param normalizedMetadata - Metadata to include in the assertion
 * @param deviceKeyId - The device key identifier/alias
 * @returns Base64-encoded assertion (iOS) or signature (Android)
 */
export async function generateAppAttestAssertion(
  dataHash: ArrayBuffer,
  normalizedMetadata: string,
  deviceKeyId: string,
): Promise<string> {
  const metadataBytes = stringToArray(normalizedMetadata);
  const message = base64.encode(new Uint8Array(dataHash)) + "|" + base64.encode(sha256(metadataBytes));

  if (Platform.OS === "android") {
    // Android: Sign with hardware-backed key using SHA256withECDSA
    return await NativeZcam1Sdk.signWithHardwareKey(deviceKeyId, message);
  }

  // iOS: Use App Attest assertion
  let assertion: string;
  try {
    assertion = await generateHardwareSignatureWithAssertion(message, deviceKeyId);
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string } | undefined;
    if (err?.code === "-1" || err?.message?.includes("UNSUPPORTED_SERVICE")) {
      console.warn(
        "[ZCAM] Running in simulator - using mock attestation. This is for development only.",
      );
      assertion = `SIMULATOR_MOCK_${deviceKeyId}_${Date.now()}`;
    } else {
      throw error;
    }
  }

  return assertion;
}
