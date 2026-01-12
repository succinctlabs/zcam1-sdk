import { generateHardwareSignatureWithAssertion } from "@pagopa/io-react-native-integrity";
import { base64 } from "@scure/base";

export async function generateAppAttestAssertionFromPhotoHash(
  dataHash: ArrayBuffer,
  deviceKeyId: string,
): Promise<string> {
  let assertion: string;
  try {
    assertion = await generateHardwareSignatureWithAssertion(
      base64.encode(new Uint8Array(dataHash)),
      deviceKeyId,
    );
  } catch (error: any) {
    if (
      error?.code === "-1" ||
      error?.message?.includes("UNSUPPORTED_SERVICE")
    ) {
      console.warn(
        "[ZCAMs] Running in simulator - using mock attestation. This is for development only.",
      );
      // Use a mock attestation for simulator testing
      // In production, this would need to be rejected by the backend
      assertion = `SIMULATOR_MOCK_${deviceKeyId}_${Date.now()}`;
    } else {
      throw error;
    }
  }

  return assertion;
}
