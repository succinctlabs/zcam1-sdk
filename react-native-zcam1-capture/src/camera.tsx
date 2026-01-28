import React from "react";
import {
  requireNativeComponent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Dirs, FileSystem, Util } from "react-native-file-access";
import {
  buildSelfSignedCertificate,
  computeHash,
  ExistingCertChain,
  formatFromPath,
  ManifestEditor,
  SelfSignedCertChain,
  type PhotoMetadataInfo,
  type VideoMetadataInfo,
} from "@succinctlabs/react-native-zcam1-c2pa";
import { type CaptureInfo, ZPhoto } from ".";
import NativeZcam1Sdk, {
  type FlashMode,
  type AspectRatio,
  type Orientation,
  type StartNativeVideoRecordingResult,
  type StopNativeVideoRecordingResult,
} from "./NativeZcam1Sdk";
import { generateAppAttestAssertion } from "./utils";
import { base64 } from "@scure/base";

export const CERT_KEY_TAG = "CERT_KEY_TAG";

/**
 * Capture format produced by the native Swift camera.
 * - "jpeg": standard compressed JPEG file
 * - "dng": RAW DNG file (original), C2PA-signed JPEG copy is still produced
 */
export type CaptureFormat = "jpeg" | "dng";

/**
 * Camera filter presets.
 * - "normal": No filter (default)
 * - "vivid": Enhanced saturation and vibrance
 * - "warm": Warmer color temperature (orange/yellow tones)
 * - "cool": Cooler color temperature (blue tones)
 */
export type CameraFilter = "normal" | "vivid" | "warm" | "cool";

export interface ZCameraProps {
  /** Which camera to use. Defaults to "back". */
  position?: "front" | "back";
  /** Whether the camera is actively running. Defaults to true. */
  isActive?: boolean;
  /** Desired capture format. Defaults to "jpeg". */
  captureFormat?: CaptureFormat;
  /**
   * Zoom factor. For back camera devices with ultra-wide lens, 1.0 = ultra-wide (0.5x user-facing),
   * 2.0 = wide-angle (1x user-facing). Use getMinZoom/getMaxZoom for valid range.
   * Defaults to 2.0 (1x user-facing) for back camera, 1.0 for front camera (to avoid digital zoom).
   */
  zoom?: number;
  /** Whether torch (flashlight) is enabled during preview. Defaults to false. */
  torch?: boolean;
  /** Exposure compensation in EV units. Defaults to 0. */
  exposure?: number;
  /** Filter preset to apply to preview and captured photos. Defaults to "normal". */
  filter?: CameraFilter;
  /** Capture information used to generate C2PA bindings for each photo. */
  captureInfo: CaptureInfo;
  /** Optional certificate chain used to sign the C2PA manifest. */
  certChain?: SelfSignedCertChain | ExistingCertChain;
  /** Optional style for the underlying native view. */
  style?: StyleProp<ViewStyle>;
}

/** Options for a single capture call. */
export interface TakePhotoOptions {
  format?: CaptureFormat;
  /** Flash mode for this capture. Defaults to "off". */
  flash?: FlashMode;
  /**
   * Whether to include depth data (if available) in the capture results.
   * - When true: depth data is embedded into the C2PA metadata.
   * - When false (default): depth data is omitted.
   */
  includeDepthData?: boolean;
  /** Aspect ratio for the captured photo. Defaults to "4:3". */
  aspectRatio?: AspectRatio;
  /** Orientation for the crop. Defaults to "auto". */
  orientation?: Orientation;
}

/** Props passed to the native Swift camera view. */
type NativeCameraViewProps = {
  style?: StyleProp<ViewStyle>;
  isActive?: boolean;
  position?: "front" | "back";
  captureFormat?: CaptureFormat;
  zoom?: number;
  torch?: boolean;
  exposure?: number;
  filter?: CameraFilter;
};

/**
 * Native Swift-backed camera preview view.
 * You must implement a matching iOS view manager named "Zcam1CameraView".
 */
const Zcam1CameraView =
  requireNativeComponent<NativeCameraViewProps>("Zcam1CameraView");

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
export class ZCamera extends React.PureComponent<ZCameraProps> {
  /** Reference to the underlying native view (if needed later). */
  private nativeRef = React.createRef<any>();

  /** Best-effort JS-side guard; native is the source of truth. */
  private recordingInProgress: boolean = false;

  /** Captured for convenience/debugging; cleared after stop. */
  private lastVideoStartResult: StartNativeVideoRecordingResult | null = null;

  private certChainPem: string;

  constructor(props: ZCameraProps) {
    super(props);
    let certChainPem: string;

    if (props.certChain && "pem" in props.certChain) {
      certChainPem = props.certChain.pem;
    } else {
      console.warn("[ZCAM1] Using a self signed certificate");

      certChainPem = buildSelfSignedCertificate(
        props.captureInfo.contentPublicKey,
        props.certChain,
      );
    }

    this.certChainPem = certChainPem;
  }

  /**
   * Get the minimum supported zoom factor.
   * For virtual devices with ultra-wide, this is 1.0 (corresponds to 0.5x user-facing).
   */
  async getMinZoom(): Promise<number> {
    return NativeZcam1Sdk.getMinZoom();
  }

  /**
   * Get the maximum supported zoom factor (capped at 15x for UX).
   */
  async getMaxZoom(): Promise<number> {
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
  async getSwitchOverZoomFactors(): Promise<number[]> {
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
  async hasUltraWideCamera(): Promise<boolean> {
    return NativeZcam1Sdk.hasUltraWideCamera();
  }

  /**
   * Focus at a point in the preview. Also adjusts exposure point if supported.
   * @param x Normalized x coordinate (0-1, left to right)
   * @param y Normalized y coordinate (0-1, top to bottom)
   */
  focusAtPoint(x: number, y: number): void {
    NativeZcam1Sdk.focusAtPoint(x, y);
  }

  /**
   * Set zoom with smooth animation. Recommended for pinch-to-zoom gestures.
   * Uses native AVFoundation ramp for smooth transitions across lens switchover boundaries.
   * This method bypasses React re-renders for lowest latency during continuous gestures.
   * @param factor Device zoom factor (use getMinZoom/getMaxZoom for valid range)
   */
  setZoomAnimated(factor: number): void {
    NativeZcam1Sdk.setZoomAnimated(factor);
  }

  /**
   * Get diagnostic info about the current camera device for debugging.
   * Returns device type, supported zoom range, switching behavior, and more.
   * Useful for debugging zoom issues on different device configurations.
   */
  async getDeviceDiagnostics(): Promise<{
    deviceType: string;
    minZoom: number;
    maxZoom: number;
    currentZoom: number;
    switchOverFactors: number[];
    switchingBehavior: number;
    isVirtualDevice: boolean;
  }> {
    return NativeZcam1Sdk.getDeviceDiagnostics();
  }

  /**
   * Start recording a native video to a temporary `.mov` file.
   *
   * Promise resolves once the native recorder reports it has started.
   */
  async startVideoRecording(
    position: "front" | "back" = this.props.position || "back",
  ): Promise<StartNativeVideoRecordingResult> {
    if (this.recordingInProgress) {
      throw new Error(
        "Video recording is already in progress. Call stopVideoRecording() first.",
      );
    }

    this.recordingInProgress = true;
    this.lastVideoStartResult = null;

    try {
      const result = await NativeZcam1Sdk.startNativeVideoRecording(position);
      this.lastVideoStartResult = result;
      return result;
    } catch (e) {
      // Roll back local state if native failed to start.
      this.recordingInProgress = false;
      this.lastVideoStartResult = null;
      throw e;
    }
  }

  /**
   * Stop the current native video recording and return the finalized file path + metadata.
   */
  async stopVideoRecording(): Promise<StopNativeVideoRecordingResult> {
    if (!this.recordingInProgress) {
      throw new Error(
        "No video recording is in progress. Call startVideoRecording() first.",
      );
    }

    try {
      const result = await NativeZcam1Sdk.stopNativeVideoRecording();
      const when = new Date().toISOString().replace("T", " ").split(".")[0]!;

      // Get actual file size if native didn't provide it.
      let fileSizeBytes = result.fileSizeBytes;
      if (fileSizeBytes === undefined || fileSizeBytes === 0) {
        try {
          const filePath = result.filePath.replace("file://", "");
          const stat = await FileSystem.stat(filePath);
          fileSizeBytes = stat.size;
        } catch (e) {
          console.warn("[ZCAM] Could not get file size:", e);
          fileSizeBytes = 1; // Use 1 as minimum to avoid Rust panic.
        }
      }

      // Provide fallback values for required metadata fields that native may not return.
      // This ensures C2PA bindings can be created even if native metadata is incomplete.
      // Note: Optional fields are only included if they have values (uniffi doesn't handle null/undefined well).
      // Note: Numeric fields that are u32 in Rust must be integers (Math.round/Math.floor).
      const metadata: Record<string, unknown> = {
        deviceMake: result.deviceMake ?? "Apple",
        deviceModel: result.deviceModel ?? "iPhone",
        softwareVersion: result.softwareVersion ?? "iOS",
        format: result.format,
        hasAudio: result.hasAudio,
        durationSeconds: Math.ceil(result.durationSeconds), // u32 requires integer
        fileSizeBytes: fileSizeBytes,
        width: result.width ?? 1920,
        height: result.height ?? 1080,
        rotationDegrees: result.rotationDegrees ?? 0,
        frameRate: Math.round(result.frameRate ?? 30), // u32 requires integer
      };

      // Only add optional fields if they have actual values.
      if (result.videoCodec !== undefined && result.videoCodec !== null) {
        metadata.videoCodec = result.videoCodec;
      }
      if (result.audioCodec !== undefined && result.audioCodec !== null) {
        metadata.audioCodec = result.audioCodec;
      }
      if (result.audioSampleRate !== undefined && result.audioSampleRate !== null) {
        metadata.audioSampleRate = Math.round(result.audioSampleRate); // u32 requires integer
      }
      if (result.audioChannels !== undefined && result.audioChannels !== null) {
        metadata.audioChannels = Math.round(result.audioChannels); // u32 requires integer
      }

      console.log("[ZCAM] Video metadata for C2PA:", JSON.stringify(metadata, null, 2));

      // Attempt C2PA signing for video. If it fails (e.g., Rust panic in c2pa library),
      // fall back to returning the original video file without C2PA metadata.
      try {
        result.filePath = await embedBindings(
          result.filePath,
          when,
          metadata,
          this.props.captureInfo,
          this.certChainPem,
        );
      } catch (c2paError) {
        console.warn("[ZCAM] C2PA signing failed for video, returning unsigned video:", c2paError);
        // Keep original filePath - video is saved but without C2PA metadata.
      }

      return result;
    } finally {
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
  async takePhoto(options: TakePhotoOptions = {}): Promise<ZPhoto> {
    const format: CaptureFormat =
      options.format ?? this.props.captureFormat ?? "jpeg";
    const flash: FlashMode = options.flash ?? "off";
    const includeDepthData: boolean = options.includeDepthData ?? false;
    const aspectRatio: AspectRatio = options.aspectRatio ?? "4:3";
    const orientation: Orientation = options.orientation ?? "auto";

    const result = await NativeZcam1Sdk.takeNativePhoto(
      format,
      this.props.position || "back",
      flash,
      includeDepthData,
      aspectRatio,
      orientation,
      false, // skipPostProcessing - default to false for normal operation
    );

    if (!result || !result.filePath) {
      throw new Error(
        "Native camera capture did not return a valid file path.",
      );
    }

    const originalPath = result.filePath;
    const metadata = (result.metadata as any) ?? {};

    const exif = metadata["{Exif}"] ?? {};
    const tiff = metadata["{TIFF}"] ?? {};

    const when =
      tiff.DateTime || new Date().toISOString().replace("T", " ").split(".")[0];
    const deviceMake = tiff.Make || "Apple";
    const deviceModel = tiff.Model || "Unknown";
    const softwareVersion = tiff.Software || "Unknown";

    const destinationPath = await embedBindings(
      originalPath,
      when,
      {
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
        depthData: result.depthData as any,
      },
      this.props.captureInfo,
      this.certChainPem,
    );

    return new ZPhoto(originalPath, destinationPath);
  }

  /* Render the native Swift camera preview view. */
  public render(): React.ReactNode {
    const {
      isActive = true,
      position = "back",
      captureFormat,
      // Default to 2.0 (1x user-facing) for back camera on devices with ultra-wide.
      // On single-camera devices, 2.0 will be clamped to device's max (usually 1.0).
      // For front camera, default to 1.0 to avoid digital zoom (front cameras are single-lens).
      zoom = position === "front" ? 1.0 : 2.0,
      torch = false,
      exposure = 0,
      filter = "normal",
      style,
    } = this.props;

    return (
      <Zcam1CameraView
        ref={this.nativeRef}
        style={[{ flex: 1 }, style]}
        isActive={isActive}
        position={position}
        captureFormat={captureFormat}
        zoom={zoom}
        torch={torch}
        exposure={exposure}
        filter={filter}
      />
    );
  }
}

/**
 * Embeds C2PA bindings and capture metadata into a photo, producing a new signed file.
 */
async function embedBindings(
  originalPath: string,
  when: string,
  metadata: PhotoMetadataInfo | VideoMetadataInfo,
  captureInfo: CaptureInfo,
  certChainPem: string,
): Promise<string> {
  originalPath = originalPath.replace("file://", "");
  const dataHash = computeHash(originalPath);
  const format = formatFromPath(originalPath);
  const ext = Util.extname(originalPath);

  if (format === undefined) {
    throw new Error(`Unsupported file format: ${originalPath}`);
  }

  const destinationPath =
    Dirs.CacheDir +
    `/zcam-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;

  const manifestEditor = new ManifestEditor(
    originalPath,
    captureInfo.contentKeyId.buffer as ArrayBuffer,
    certChainPem,
  );

  // Add the "capture" action to the manifest.
  let normalizedMetadata = undefined;
  if (format.indexOf("video") < 0) {
    normalizedMetadata = manifestEditor.addPhotoMetadataAction(
      metadata as PhotoMetadataInfo,
      when,
    );
  } else {
    // Use the C2PA format (e.g., "video/quicktime") instead of native format ("mov").
    const videoMetadata = { ...metadata, format } as VideoMetadataInfo;
    console.log("[ZCAM] Video metadata with C2PA format:", JSON.stringify(videoMetadata, null, 2));
    normalizedMetadata = manifestEditor.addVideoMetadataAction(
      videoMetadata,
      when,
    );
  }

  const assertion = await generateAppAttestAssertion(
    dataHash,
    normalizedMetadata,
    captureInfo.deviceKeyId,
  );

  // Add an assertion containing all data needed to later generate a  proof
  manifestEditor.addAssertion(
    "succinct.bindings",
    JSON.stringify({
      app_id: captureInfo.appId,
      device_key_id: captureInfo.deviceKeyId,
      attestation: captureInfo.attestation,
      assertion,
    }),
  );

  // Sign the captured image with C2PA, producing a new signed file.
  await manifestEditor.embedManifestToFile(destinationPath, format);

  return destinationPath;
}
