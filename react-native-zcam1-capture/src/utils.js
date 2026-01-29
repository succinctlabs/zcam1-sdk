import { generateHardwareSignatureWithAssertion } from "@pagopa/io-react-native-integrity";
import { base64 } from "@scure/base";
import { sha256 } from "@noble/hashes/sha2.js";
function stringToArray(s) {
    return new TextEncoder().encode(s);
}
export async function generateAppAttestAssertion(dataHash, normalizedMetadata, deviceKeyId) {
    let assertion;
    const metadataBytes = stringToArray(normalizedMetadata);
    try {
        assertion = await generateHardwareSignatureWithAssertion(base64.encode(new Uint8Array(dataHash)) +
            "|" +
            base64.encode(sha256(metadataBytes)), deviceKeyId);
    }
    catch (error) {
        if (error?.code === "-1" ||
            error?.message?.includes("UNSUPPORTED_SERVICE")) {
            console.warn("[ZCAMs] Running in simulator - using mock attestation. This is for development only.");
            // Use a mock attestation for simulator testing
            // In production, this would need to be rejected by the backend
            assertion = `SIMULATOR_MOCK_${deviceKeyId}_${Date.now()}`;
        }
        else {
            throw error;
        }
    }
    return assertion;
}
