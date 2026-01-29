import { jsx as _jsx } from "react/jsx-runtime";
import React from "react";
import codegenNativeComponent from "react-native/Libraries/Utilities/codegenNativeComponent";
import { Dirs, Util } from "react-native-file-access";
import { buildSelfSignedCertificate, computeHash, ExistingCertChain, formatFromPath, ManifestEditor, SelfSignedCertChain, } from "@succinctlabs/react-native-zcam1-c2pa";
import { ZPhoto } from ".";
import NativeZcam1Sdk, {} from "./NativeZcam1Sdk";
import { generateAppAttestAssertion } from "./utils";
import { base64 } from "@scure/base";
export const CERT_KEY_TAG = "CERT_KEY_TAG";
/**
 * Native Swift-backed camera preview view.
 * Uses codegenNativeComponent with interfaceOnly to enable Fabric interop
 * for the legacy RCTViewManager-based implementation.
 */
const Zcam1CameraView = codegenNativeComponent("Zcam1CameraView", {
    interfaceOnly: true,
    paperComponentName: "Zcam1CameraView",
});
/**
 * React wrapper around the native Swift camera.
 *
 * Responsibilities:
 * - Render native camera preview (AVFoundation in Swift).
 * - Trigger native capture (JPEG / DNG) via the TurboModule `Zcam1Sdk`.
 * - Run C2PA signing on the captured image and return a `ZPhoto`.
 *
 * Exposed API remains compatible with the previous VisionCamera-based
 * implementation: `cameraRef.current?.takePhoto()`.
 */
export class ZCamera extends React.PureComponent {
    /** Reference to the underlying native view (if needed later). */
    nativeRef = React.createRef();
    /** Best-effort JS-side guard; native is the source of truth. */
    recordingInProgress = false;
    /** Captured for convenience/debugging; cleared after stop. */
    lastVideoStartResult = null;
    certChainPem;
    constructor(props) {
        super(props);
        let certChainPem;
        if (props.certChain && "pem" in props.certChain) {
            certChainPem = props.certChain.pem;
        }
        else {
            console.warn("[ZCAM1] Using a self signed certificate");
            certChainPem = buildSelfSignedCertificate(props.captureInfo.contentPublicKey, props.certChain);
        }
        this.certChainPem = certChainPem;
    }
    /**
     * Get the minimum supported zoom factor.
     * For virtual devices with ultra-wide, this is 1.0 (corresponds to 0.5x user-facing).
     */
    async getMinZoom() {
        return NativeZcam1Sdk.getMinZoom();
    }
    /**
     * Get the maximum supported zoom factor (capped at 15x for UX).
     */
    async getMaxZoom() {
        return NativeZcam1Sdk.getMaxZoom();
    }
    /**
     * Get the zoom factors where the device switches between physical lenses.
     * Returns empty array for single-camera devices.
     * For triple camera: typically [2.0, 6.0] meaning:
     * - Below 2.0: ultra-wide lens (0.5x-1x user-facing)
     * - At 2.0: switches FROM ultra-wide TO wide lens (1x user-facing)
     * - At 6.0: switches FROM wide TO telephoto lens (3x user-facing)
     */
    async getSwitchOverZoomFactors() {
        return NativeZcam1Sdk.getSwitchOverZoomFactors();
    }
    /**
     * Check if the current device has an ultra-wide camera.
     * This is true for builtInTripleCamera and builtInDualWideCamera (iPhone 11+, Pro models).
     * This is false for builtInDualCamera (Wide + Telephoto, e.g., iPhone X/XS) and single-lens devices.
     *
     * Use this to correctly interpret zoom factors:
     * - If hasUltraWide: minZoom (1.0) = 0.5x user-facing, switchOverFactors[0] (2.0) = 1x user-facing
     * - If !hasUltraWide: minZoom (1.0) = 1x user-facing, switchOverFactors[0] (2.0) = 2x user-facing (telephoto)
     */
    async hasUltraWideCamera() {
        return NativeZcam1Sdk.hasUltraWideCamera();
    }
    /**
     * Focus at a point in the preview. Also adjusts exposure point if supported.
     * @param x Normalized x coordinate (0-1, left to right)
     * @param y Normalized y coordinate (0-1, top to bottom)
     */
    focusAtPoint(x, y) {
        NativeZcam1Sdk.focusAtPoint(x, y);
    }
    /**
     * Set zoom with smooth animation. Recommended for pinch-to-zoom gestures.
     * Uses native AVFoundation ramp for smooth transitions across lens switchover boundaries.
     * This method bypasses React re-renders for lowest latency during continuous gestures.
     * @param factor Device zoom factor (use getMinZoom/getMaxZoom for valid range)
     */
    setZoomAnimated(factor) {
        NativeZcam1Sdk.setZoomAnimated(factor);
    }
    /**
     * Get diagnostic info about the current camera device for debugging.
     * Returns device type, supported zoom range, switching behavior, and more.
     * Useful for debugging zoom issues on different device configurations.
     */
    async getDeviceDiagnostics() {
        return NativeZcam1Sdk.getDeviceDiagnostics();
    }
    /**
     * Start recording a native video to a temporary `.mov` file.
     *
     * Promise resolves once the native recorder reports it has started.
     */
    async startVideoRecording(position = this.props.position || "back") {
        if (this.recordingInProgress) {
            throw new Error("Video recording is already in progress. Call stopVideoRecording() first.");
        }
        this.recordingInProgress = true;
        this.lastVideoStartResult = null;
        try {
            const result = await NativeZcam1Sdk.startNativeVideoRecording(position);
            this.lastVideoStartResult = result;
            return result;
        }
        catch (e) {
            // Roll back local state if native failed to start.
            this.recordingInProgress = false;
            this.lastVideoStartResult = null;
            throw e;
        }
    }
    /**
     * Stop the current native video recording and return the finalized file path + metadata.
     */
    async stopVideoRecording() {
        if (!this.recordingInProgress) {
            throw new Error("No video recording is in progress. Call startVideoRecording() first.");
        }
        try {
            const result = await NativeZcam1Sdk.stopNativeVideoRecording();
            const when = new Date().toISOString().replace("T", " ").split(".")[0];
            result.filePath = await embedBindings(result.filePath, when, {
                deviceMake: result.deviceMake,
                deviceModel: result.deviceModel,
                softwareVersion: result.softwareVersion,
                format: result.format,
                hasAudio: result.hasAudio,
                durationSeconds: result.durationSeconds,
                fileSizeBytes: result.fileSizeBytes,
                width: result.width,
                height: result.height,
                rotationDegrees: result.rotationDegrees,
                frameRate: result.frameRate,
                videoCodec: result.videoCodec,
                audioCodec: result.audioCodec,
                audioSampleRate: result.audioSampleRate,
                audioChannels: result.audioChannels,
            }, this.props.captureInfo, this.certChainPem);
            return result;
        }
        finally {
            // Always clear local state regardless of native outcome.
            this.recordingInProgress = false;
            this.lastVideoStartResult = null;
        }
    }
    /**
     * Capture a photo using the native Swift camera and return a signed `ZPhoto`.
     *
     * The native side is expected to expose a `capturePhoto` method on the
     * `Zcam1Sdk` TurboModule with signature:
     *
     *   capturePhoto(options: {
     *     position?: "front" | "back";
     *     format?: "jpeg" | "dng";
     *   }): Promise<{ path: string; metadata?: any }>
     */
    async takePhoto(options = {}) {
        const format = options.format ?? this.props.captureFormat ?? "jpeg";
        const flash = options.flash ?? "off";
        const includeDepthData = options.includeDepthData ?? false;
        const aspectRatio = options.aspectRatio ?? "4:3";
        const orientation = options.orientation ?? "auto";
        const result = await NativeZcam1Sdk.takeNativePhoto(format, this.props.position || "back", flash, includeDepthData, aspectRatio, orientation, false);
        if (!result || !result.filePath) {
            throw new Error("Native camera capture did not return a valid file path.");
        }
        const originalPath = result.filePath;
        const metadata = result.metadata ?? {};
        const exif = metadata["{Exif}"] ?? {};
        const tiff = metadata["{TIFF}"] ?? {};
        const when = tiff.DateTime || new Date().toISOString().replace("T", " ").split(".")[0];
        const deviceMake = tiff.Make || "Apple";
        const deviceModel = tiff.Model || "Unknown";
        const softwareVersion = tiff.Software || "Unknown";
        const destinationPath = await embedBindings(originalPath, when, {
            deviceMake: deviceMake,
            deviceModel: deviceModel,
            softwareVersion: softwareVersion,
            xResolution: exif.PixelXDimension,
            yResolution: exif.PixelYDimension,
            orientation: metadata.Orientation,
            iso: exif.ISOSpeedRatings?.toString(),
            exposureTime: exif.ExposureTime,
            depthOfField: exif.FNumber,
            focalLength: exif.FocalLength,
            depthData: result.depthData,
        }, this.props.captureInfo, this.certChainPem);
        return new ZPhoto(originalPath, destinationPath);
    }
    /* Render the native Swift camera preview view. */
    render() {
        const { isActive = true, position = "back", captureFormat, 
        // Default to 2.0 (1x user-facing) for back camera on devices with ultra-wide.
        // On single-camera devices, 2.0 will be clamped to device's max (usually 1.0).
        // For front camera, default to 1.0 to avoid digital zoom (front cameras are single-lens).
        zoom = position === "front" ? 1.0 : 2.0, torch = false, exposure = 0, filter = "normal", style, } = this.props;
        return (_jsx(Zcam1CameraView, { ref: this.nativeRef, style: [{ flex: 1 }, style], isActive: isActive, position: position, captureFormat: captureFormat, zoom: zoom, torch: torch, exposure: exposure, filter: filter }));
    }
}
/**
 * Embeds C2PA bindings and capture metadata into a photo, producing a new signed file.
 */
async function embedBindings(originalPath, when, metadata, captureInfo, certChainPem) {
    originalPath = originalPath.replace("file://", "");
    const dataHash = computeHash(originalPath);
    const format = formatFromPath(originalPath);
    const ext = Util.extname(originalPath);
    if (format === undefined) {
        throw new Error(`Unsupported file format: ${originalPath}`);
    }
    const destinationPath = Dirs.CacheDir +
        `/zcam-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
    const manifestEditor = new ManifestEditor(originalPath, captureInfo.contentKeyId.buffer, certChainPem);
    // Add the "capture" action to the manifest.
    let normalizedMetadata = undefined;
    if (format.indexOf("video") < 0) {
        normalizedMetadata = manifestEditor.addPhotoMetadataAction(metadata, when);
    }
    else {
        console.log("Metadata", metadata);
        normalizedMetadata = manifestEditor.addVideoMetadataAction(metadata, when);
    }
    const assertion = await generateAppAttestAssertion(dataHash, normalizedMetadata, captureInfo.deviceKeyId);
    // Add an assertion containing all data needed to later generate a  proof
    manifestEditor.addAssertion("succinct.bindings", JSON.stringify({
        app_id: captureInfo.appId,
        device_key_id: captureInfo.deviceKeyId,
        attestation: captureInfo.attestation,
        assertion,
    }));
    // Sign the captured image with C2PA, producing a new signed file.
    await manifestEditor.embedManifestToFile(destinationPath, format);
    return destinationPath;
}
