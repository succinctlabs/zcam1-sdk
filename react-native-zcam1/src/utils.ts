import { sha256 } from "@noble/hashes/sha2.js";
import { generateHardwareSignatureWithAssertion } from "@pagopa/io-react-native-integrity";
import { base64 } from "@scure/base";

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
  production: boolean,
): Promise<string> {
  let assertion: string;

  const metadataBytes = stringToArray(normalizedMetadata);

  try {
    assertion = await generateHardwareSignatureWithAssertion(
      base64.encode(new Uint8Array(dataHash)) + "|" + base64.encode(sha256(metadataBytes)),
      deviceKeyId,
    );
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string } | undefined;
    if (err?.code === "-1" || err?.message?.includes("UNSUPPORTED_SERVICE")) {
      if (production) {
        throw new Error(
          "ZCAM: Simulator is not supported in production mode. Set production: false for development.",
        );
      }
      console.warn(
        "[ZCAM] Running in simulator - using mock assertion. This is for development only.",
      );
      assertion = `SIMULATOR_MOCK_${deviceKeyId}_${Date.now()}`;
    } else {
      throw error;
    }
  }

  return assertion;
}
