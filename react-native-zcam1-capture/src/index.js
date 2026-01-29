import { generateHardwareKey, getAttestation, } from "@pagopa/io-react-native-integrity";
import EncryptedStorage from "react-native-encrypted-storage";
import { getContentPublicKey, getSecureEnclaveKeyId, } from "@succinctlabs/react-native-zcam1-common";
export { buildSelfSignedCertificate, SelfSignedCertChain, } from "@succinctlabs/react-native-zcam1-c2pa";
/**
 * Camera component for capturing photos with secure enclave integration.
 */
export { ZCamera } from "./camera";
import NativeZcam1Sdk from "./NativeZcam1Sdk";
/**
 * Present a native full-screen preview for any file using iOS QLPreviewController.
 * Supports images, videos, PDFs, and other common file types with native playback controls.
 * @param filePath Absolute filesystem path to the file.
 */
export async function previewFile(filePath) {
    return NativeZcam1Sdk.previewFile(filePath);
}
/**
 * Flash mode for photo capture.
 */
export {} from "./NativeZcam1Sdk";
/**
 * Represents a captured photo with its original and processed file paths.
 */
export class ZPhoto {
    originalPath;
    path;
    constructor(originalPath, path) {
        this.originalPath = originalPath;
        this.path = path;
    }
}
/**
 * Initializes the device by generating keys, obtaining certificate chain, and registering with the backend.
 * @param settings - Configuration settings for initialization
 * @returns Device information including keys, certificate chain, and attestation
 */
export async function initCapture(settings) {
    let deviceKeyId;
    let contentKeyId;
    const contentPublicKey = await getContentPublicKey();
    if (contentPublicKey.kty !== "EC") {
        throw "Only EC public keys are supported";
    }
    contentKeyId = getSecureEnclaveKeyId(contentPublicKey);
    if (deviceKeyId === undefined) {
        // Try to generate hardware key, but fall back to mock for simulator
        try {
            deviceKeyId = await generateHardwareKey();
        }
        catch (error) {
            // If running in simulator, hardware key generation is not supported
            if (error?.code === "-1" ||
                error?.message?.includes("UNSUPPORTED_SERVICE")) {
                console.warn("[ZCAM] Running in simulator - using mock device key. This is for development only.");
                // Generate a mock device key for simulator testing
                deviceKeyId = `SIMULATOR_DEVICE_KEY_${Date.now()}`;
            }
            else {
                throw error;
            }
        }
        EncryptedStorage.setItem("deviceKeyId", deviceKeyId);
    }
    if (deviceKeyId === undefined) {
        throw "failed to generate a device key";
    }
    const attestation = await updateRegistration(deviceKeyId, settings);
    return {
        appId: settings.appId,
        deviceKeyId,
        contentPublicKey,
        contentKeyId,
        attestation,
    };
}
/**
 * Updates device registration by performing attestation with the backend.
 * @param keyId - The hardware key identifier
 * @param settings - Configuration settings for registration
 * @returns Attestation data and challenge
 */
export async function updateRegistration(keyId, settings) {
    // Try to get real attestation, but fall back to mock for simulator
    let attestation;
    try {
        attestation = await getAttestation(keyId, keyId);
    }
    catch (error) {
        // If running in simulator, App Attest is not supported
        if (error?.code === "-1" ||
            error?.message?.includes("UNSUPPORTED_SERVICE")) {
            console.warn("[ZCAM] Running in simulator - using mock attestation. This is for development only.");
            // Use a mock attestation for simulator testing
            // In production, this would need to be rejected by the backend
            attestation = `SIMULATOR_MOCK_${keyId}_${Date.now()}`;
        }
        else {
            throw error;
        }
    }
    return attestation;
}
