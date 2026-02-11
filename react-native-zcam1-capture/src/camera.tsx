import {
  buildSelfSignedCertificate,
  computeHash,
  DepthData,
  ExistingCertChain,
  formatFromPath,
  ManifestEditor,
  type PhotoMetadataInfo,
  SelfSignedCertChain,
  type VideoMetadataInfo,
} from "@succinctlabs/react-native-zcam1-c2pa";
import JailMonkey from "jail-monkey";
import React from "react";
import { requireNativeComponent, type StyleProp, type ViewStyle } from "react-native";
import { Dirs, Util } from "react-native-file-access";

import { type CaptureInfo, ZPhoto } from ".";
import NativeZcam1Sdk, {
  type AspectRatio,
  type DeviceOrientation,
  type FlashMode,
  type Orientation,
  type StartNativeVideoRecordingResult,
  type StopNativeVideoRecordingResult,
} from "./NativeZcam1Sdk";
import { generateAppAttestAssertion } from "./utils";

export const CERT_KEY_TAG = "CERT_KEY_TAG";

/**
 * Capture format produced by the native Swift camera.
 * - "jpeg": standard compressed JPEG file
 * - "dng": RAW DNG file (original), C2PA-signed JPEG copy is still produced
 */
export type CaptureFormat = "jpeg" | "dng";

/**
 * Camera film style presets.
 * - "normal": No film style (default)
 * - "mellow": Negative Film Gold style - warm, saturated, lifted shadows
 * - "nostalgic": Kodak Portra 400 style - warm amber, faded, bright
 * - "bw": Contrasty B&W with warm tint
 */
export type CameraFilmStyle = "normal" | "mellow" | "nostalgic" | "bw";

// ─────────────────────────────────────────────────────────────────────────────
// Custom Film Style Recipe Types
// ─────────────────────────────────────────────────────────────────────────────

/** White balance adjustment configuration. */
export type WhiteBalanceConfig = {
  /** Color temperature in Kelvin (e.g., 5500 for daylight, 6500 for cloudy). */
  temperature: number;
  /** Tint adjustment (-100 to 100, green to magenta). Defaults to 0. */
  tint?: number;
};

/** Highlight and shadow adjustment configuration. */
export type HighlightShadowConfig = {
  /** Highlight adjustment (0 = no change, negative = reduce, positive = boost). */
  highlights: number;
  /** Shadow adjustment (0 = no change, positive = lift shadows). */
  shadows: number;
};

/** Monochrome (black & white) film style configuration. */
export type MonochromeConfig = {
  /** Intensity of the monochrome effect (0 = none, 1 = full B&W). */
  intensity: number;
  /** Optional tint color for the monochrome effect. */
  color?: { r: number; g: number; b: number };
};

/**
 * Individual film style effect that can be combined into a recipe.
 * Effects are applied in the order they appear in the recipe array.
 */
export type FilmStyleEffect =
  | { type: "whiteBalance"; config: WhiteBalanceConfig }
  | { type: "saturation"; value: number }
  | { type: "contrast"; value: number }
  | { type: "brightness"; value: number }
  | { type: "hue"; value: number }
  | { type: "vibrance"; value: number }
  | { type: "highlightShadow"; config: HighlightShadowConfig }
  | { type: "monochrome"; config: MonochromeConfig };

/**
 * A film style recipe is an ordered array of film style effects.
 * Effects are applied sequentially to produce the final look.
 */
export type FilmStyleRecipe = FilmStyleEffect[];

/**
 * Default film style recipes for built-in presets.
 */
const DEFAULT_FILM_STYLE_RECIPES: Record<CameraFilmStyle, FilmStyleRecipe> = {
  normal: [],
  // Mellow: Negative Film Gold - warm amber/magenta, saturated, lifted shadows.
  mellow: [
    { type: "whiteBalance", config: { temperature: 6900, tint: 40 } },
    { type: "saturation", value: 1.4 },
    { type: "contrast", value: 0.8 },
    { type: "brightness", value: -0.1 },
    { type: "highlightShadow", config: { highlights: 0, shadows: 0.4 } },
  ],
  // Nostalgic: Kodak Portra 400 - warm amber, faded, lifted shadows, bright.
  nostalgic: [
    { type: "whiteBalance", config: { temperature: 7000, tint: 0 } },
    { type: "saturation", value: 1.1 },
    { type: "contrast", value: 0.7 },
    { type: "brightness", value: 0.15 },
    { type: "highlightShadow", config: { highlights: -0.4, shadows: 0.5 } },
  ],
  // B&W: Contrasty black and white with subtle warm tint.
  bw: [
    { type: "monochrome", config: { intensity: 1.0, color: { r: 0.6, g: 0.55, b: 0.5 } } },
    { type: "contrast", value: 1.2 },
    { type: "brightness", value: -0.1 },
  ],
};

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
  /** Film style preset to apply to preview and captured photos. Defaults to "normal". */
  filmStyle?: CameraFilmStyle;
  /**
   * Override built-in film style presets with custom recipes.
   * When a preset name is used with `filmStyle` prop and an override exists,
   * the custom recipe is applied instead of the built-in preset.
   */
  filmStyleOverrides?: Partial<Record<CameraFilmStyle, FilmStyleRecipe>>;
  /**
   * Define additional custom film styles referenced by name.
   * Use with `filmStyle` prop by casting the custom name: `filmStyle={"myStyle" as CameraFilmStyle}`.
   */
  customFilmStyles?: Record<string, FilmStyleRecipe>;
  /**
   * Enable depth data capture at session level.
   * When true, depth data can be captured but zoom may be restricted on dual-camera devices.
   * When false (default), full zoom range is available.
   * Use isDepthSupported() and hasDepthZoomLimitations() to check device capabilities.
   * @default false
   */
  depthEnabled?: boolean;
  /**
   * Callback fired when the device physical orientation changes.
   * Uses accelerometer data to detect orientation even when iOS orientation lock is enabled.
   * @param orientation The new physical orientation of the device.
   */
  onOrientationChange?: (orientation: DeviceOrientation) => void;
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
  filmStyle?: CameraFilmStyle;
  filmStyleOverrides?: Record<string, FilmStyleEffect[]>;
  customFilmStyles?: Record<string, FilmStyleEffect[]>;
  depthEnabled?: boolean;
  onOrientationChange?: (event: { nativeEvent: { orientation: string } }) => void;
};

/**
 * Native Swift-backed camera preview view.
 * You must implement a matching iOS view manager named "Zcam1CameraView".
 */
const Zcam1CameraView = requireNativeComponent<NativeCameraViewProps>("Zcam1CameraView");

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
   * Resolve the current film style info for embedding in capture metadata.
   * Returns null for "normal" with no overrides (no filter applied).
   */
  private resolveFilmStyleInfo():
    | {
        name: string;
        source: string;
        recipe: string;
      }
    | undefined {
    const { filmStyle = "normal", filmStyleOverrides, customFilmStyles } = this.props;

    // Determine the source of the active film style.
    const isOverride = filmStyleOverrides?.[filmStyle] !== undefined;
    const isCustom = customFilmStyles?.[filmStyle] !== undefined;
    const source = isOverride ? "override" : isCustom ? "custom" : "builtin";

    // Resolve the actual recipe that was applied.
    const recipe =
      filmStyleOverrides?.[filmStyle] ??
      customFilmStyles?.[filmStyle] ??
      DEFAULT_FILM_STYLE_RECIPES[filmStyle] ??
      [];

    // Skip embedding for unmodified "normal" (no effects applied).
    if (filmStyle === "normal" && source === "builtin") {
      return undefined;
    }

    return {
      name: filmStyle,
      source,
      recipe: JSON.stringify(recipe),
    };
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
   * Get the supported exposure compensation range in EV units.
   * Returns the device's min and max exposure target bias values.
   * Use this to configure slider bounds for exposure UI controls.
   */
  async getExposureRange(): Promise<{ min: number; max: number }> {
    return NativeZcam1Sdk.getExposureRange();
  }

  /**
   * Reset exposure compensation to neutral (0 EV).
   * Convenience method equivalent to setting the exposure prop to 0.
   */
  resetExposure(): void {
    NativeZcam1Sdk.resetExposure();
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
    currentExposureBias: number;
    minExposureBias: number;
    maxExposureBias: number;
    currentISO: number;
    exposureDuration: number;
  }> {
    return NativeZcam1Sdk.getDeviceDiagnostics();
  }

  /**
   * Check if the current camera device supports depth data capture.
   * Returns true for dual/triple rear cameras and TrueDepth front camera.
   * Returns false for single rear cameras (iPhone SE, 16e, Air).
   */
  async isDepthSupported(): Promise<boolean> {
    return NativeZcam1Sdk.isDepthSupported();
  }

  /**
   * Check if enabling depth would restrict zoom on this device.
   * Returns true if zoom is limited to discrete levels (min == max in all ranges).
   * This typically happens on dual-camera devices (iPhone 12-16 base).
   * Returns false for triple-camera devices (Pro) and TrueDepth front cameras.
   */
  async hasDepthZoomLimitations(): Promise<boolean> {
    return NativeZcam1Sdk.hasDepthZoomLimitations();
  }

  /**
   * Get zoom ranges supported when depth data delivery is enabled.
   * Returns array of [min, max] pairs. If min == max, it's a discrete level.
   * Empty array means no depth support or no zoom restrictions.
   *
   * Example for dual-camera iPhone: [[2.0, 2.0], [4.0, 4.0]] (discrete 1x and 2x only)
   * Example for triple-camera iPhone: [[1.0, 6.0]] (continuous zoom supported)
   */
  async getDepthSupportedZoomRanges(): Promise<number[][]> {
    return NativeZcam1Sdk.getDepthSupportedZoomRanges();
  }

  /**
   * Start recording a native video to a temporary `.mov` file.
   *
   * Promise resolves once the native recorder reports it has started.
   *
   * @param position Which camera to record from.
   * @param options Optional recording configuration.
   * @param options.maxDurationSeconds Maximum recording duration in seconds.
   *   The native layer will automatically stop the recording when this limit is
   *   reached. Pass 0 or omit for unlimited recording.
   */
  async startVideoRecording(
    position: "front" | "back" = this.props.position || "back",
    options?: { maxDurationSeconds?: number },
  ): Promise<StartNativeVideoRecordingResult> {
    if (this.recordingInProgress) {
      throw new Error("Video recording is already in progress. Call stopVideoRecording() first.");
    }

    this.recordingInProgress = true;
    this.lastVideoStartResult = null;

    try {
      const result = await NativeZcam1Sdk.startNativeVideoRecording(
        position,
        options?.maxDurationSeconds ?? 0,
      );
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
      throw new Error("No video recording is in progress. Call startVideoRecording() first.");
    }

    try {
      const result = await NativeZcam1Sdk.stopNativeVideoRecording();
      const when = new Date().toISOString().replace("T", " ").split(".")[0]!;
      const isJailBroken = JailMonkey.isJailBroken();
      const isLocationSpoofingAvailable = JailMonkey.canMockLocation();

      result.filePath = await embedBindings(
        result.filePath,
        when,
        {
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
          authenticityData: {
            isJailBroken,
            isLocationSpoofingAvailable,
          },
          filmStyle: this.resolveFilmStyleInfo(),
        },
        this.props.captureInfo,
        this.certChainPem,
      );

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
    const format: CaptureFormat = options.format ?? this.props.captureFormat ?? "jpeg";
    const flash: FlashMode = options.flash ?? "off";
    const includeDepthData: boolean = options.includeDepthData ?? false;
    const aspectRatio: AspectRatio = options.aspectRatio ?? "4:3";
    const orientation: Orientation = options.orientation ?? "auto";

    console.log("[ZCamera] takePhoto: calling native with includeDepthData =", includeDepthData);

    const result = await NativeZcam1Sdk.takeNativePhoto(
      format,
      this.props.position || "back",
      flash,
      includeDepthData,
      aspectRatio,
      orientation,
      false, // skipPostProcessing - default to false for normal operation
    );

    console.log("[ZCamera] takePhoto: native result:", {
      filePath: result?.filePath ? "present" : "missing",
      format: result?.format,
      hasMetadata: !!result?.metadata,
      hasDepthData: !!result?.depthData,
      depthDataKeys: result?.depthData ? Object.keys(result.depthData) : null,
    });

    if (!result || !result.filePath) {
      throw new Error("Native camera capture did not return a valid file path.");
    }

    const originalPath = result.filePath;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const metadata = (result.metadata as any) ?? {};

    const exif = metadata["{Exif}"] ?? {};
    const tiff = metadata["{TIFF}"] ?? {};

    const when = tiff.DateTime || new Date().toISOString().replace("T", " ").split(".")[0];
    const deviceMake = tiff.Make || "Apple";
    const deviceModel = tiff.Model || "Unknown";
    const softwareVersion = tiff.Software || "Unknown";
    const isJailBroken = JailMonkey.isJailBroken();
    const isLocationSpoofingAvailable = JailMonkey.canMockLocation();

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
        authenticityData: {
          isJailBroken,
          isLocationSpoofingAvailable,
        },
        depthData: result.depthData as DepthData | undefined,
        filmStyle: this.resolveFilmStyleInfo(),
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
      filmStyle = "normal",
      filmStyleOverrides,
      customFilmStyles,
      depthEnabled = false,
      onOrientationChange,
      style,
    } = this.props;

    // Merge default recipes with user overrides (user overrides take precedence).
    const mergedFilmStyleOverrides = {
      ...DEFAULT_FILM_STYLE_RECIPES,
      ...filmStyleOverrides,
    };

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
        filmStyle={filmStyle}
        filmStyleOverrides={mergedFilmStyleOverrides}
        customFilmStyles={customFilmStyles}
        depthEnabled={depthEnabled}
        onOrientationChange={
          onOrientationChange
            ? (event) => onOrientationChange(event.nativeEvent.orientation as DeviceOrientation)
            : undefined
        }
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
    Dirs.CacheDir + `/zcam-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;

  const manifestEditor = new ManifestEditor(
    originalPath,
    captureInfo.contentKeyId.buffer as ArrayBuffer,
    certChainPem,
  );

  // Add the "capture" action to the manifest.
  let normalizedMetadata = undefined;
  if (format.indexOf("video") < 0) {
    normalizedMetadata = manifestEditor.addPhotoMetadataAction(metadata as PhotoMetadataInfo, when);
  } else {
    console.log("Metadata", metadata);
    normalizedMetadata = manifestEditor.addVideoMetadataAction(metadata as VideoMetadataInfo, when);
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
