import { TurboModuleRegistry, type TurboModule } from "react-native";

export type TakeNativePhotoFormat = "jpeg" | "dng";

export interface TakeNativePhotoOptions {
  /**
   * Desired output format. Defaults to "jpeg" if not provided.
   */
  format?: TakeNativePhotoFormat;

  /**
   * Optional quality hint for JPEG captures (0–1).
   * Ignored for DNG.
   */
  quality?: number;
}

export interface TakeNativePhotoResult {
  /**
   * Local filesystem path to the captured image file.
   * This is typically a "file://" URL or absolute path.
   */
  filePath: string;

  /**
   * The actual format of the captured file.
   */
  format: TakeNativePhotoFormat;

  /**
   * Optional metadata extracted by the native layer (EXIF, etc).
   */
  metadata?: { [key: string]: unknown } | null;

  /**
   * Depth data extracted from the captured photo (if available).
   *
   * This is only returned when the caller requested it via the `includeDepthData`
   * parameter on `takeNativePhoto(...)`, and only on devices/capture formats that
   * support depth delivery.
   */
  depthData?: { [key: string]: unknown } | null;
}

export type NativeVideoRecordingFormat = "mov";

export interface StartNativeVideoRecordingResult {
  /**
   * Indicates that recording successfully started.
   */
  status: "recording";

  /**
   * Local filesystem path to the in-progress movie file.
   */
  filePath: string;

  /**
   * Container format for the recording.
   */
  format: NativeVideoRecordingFormat;

  /**
   * Whether audio is included in this recording.
   * This depends on microphone permission and native session configuration.
   */
  hasAudio: boolean;
}

export interface StopNativeVideoRecordingResult {
  /**
   * Local filesystem path to the finalized movie file.
   */
  filePath: string;

  /**
   * Container format for the recording.
   */
  format: NativeVideoRecordingFormat;

  /**
   * Whether audio is included in this recording.
   */
  hasAudio: boolean;

  /**
   * Device make (if available).
   */
  deviceMake: string;

  /**
   * Device model (if available).
   */
  deviceModel: string;

  /**
   * Software version (if available).
   */
  softwareVersion: string;

  /**
   * Duration of the recorded clip in seconds (if available).
   */
  durationSeconds: number;

  /**
   * File size in bytes (if available).
   */
  fileSizeBytes: number;

  /**
   * Video pixel width (rotation-corrected, if available).
   */
  width: number;

  /**
   * Video pixel height (rotation-corrected, if available).
   */
  height: number;

  /**
   * Rotation in degrees derived from the video track transform (if available).
   * Common values: 0, 90, 180, 270.
   */
  rotationDegrees: number;

  /**
   * Nominal frame rate (fps, if available).
   */
  frameRate: number;

  /**
   * Video codec FourCC (e.g. "avc1", "hvc1") if available.
   */
  videoCodec?: string;

  /**
   * Audio codec FourCC (e.g. "aac ") if available.
   */
  audioCodec?: string;

  /**
   * Audio sample rate in Hz (if available).
   */
  audioSampleRate?: number;

  /**
   * Audio channel count (if available).
   */
  audioChannels?: number;
}

export type FlashMode = "off" | "on" | "auto";

export type AspectRatio = "4:3" | "16:9" | "1:1";

export type Orientation = "auto" | "portrait" | "landscape";

export interface Spec extends TurboModule {
  /**
   * Capture a photo using the native camera stack (Swift/AVFoundation)
   * without going through react-native-vision-camera.
   *
   * The native implementation is responsible for:
   * - Handling permissions
   * - Presenting a preview / capture UI as needed
   * - Writing the resulting JPEG or DNG file and returning its path
   *
   * @param includeDepthData When true, native should request depth (+ calibration)
   * data delivery for this capture (if supported). When false, native should avoid
   * enabling depth delivery and `depthData` will be omitted from the result.
   * @param skipPostProcessing When true, returns raw sensor output without cropping
   * or rotation. Useful for developers who want to handle their own post-processing.
   */
  takeNativePhoto(
    format: TakeNativePhotoFormat,
    position: "front" | "back",
    flash: FlashMode,
    includeDepthData: boolean,
    aspectRatio: AspectRatio,
    orientation: Orientation,
    skipPostProcessing: boolean,
  ): Promise<TakeNativePhotoResult>;

  /**
   * Start recording a video using the native camera stack.
   *
   * The recording is written to a temporary file and continues until
   * `stopNativeVideoRecording()` is called.
   */
  startNativeVideoRecording(
    position: "front" | "back",
  ): Promise<StartNativeVideoRecordingResult>;

  /**
   * Stop an in-progress recording and return the finalized file path + metadata.
   */
  stopNativeVideoRecording(): Promise<StopNativeVideoRecordingResult>;

  /**
   * Set zoom factor programmatically (instant, no animation).
   * For virtual devices with ultra-wide, 1.0 is ultra-wide (0.5x user-facing),
   * 2.0 is wide-angle (1x user-facing), etc.
   * @param factor Device zoom factor (use getMinZoom/getMaxZoom for valid range)
   */
  setZoom(factor: number): void;

  /**
   * Set zoom factor with smooth animation (recommended for pinch-to-zoom gestures).
   * Uses native AVFoundation ramp for smooth transitions across lens switchover boundaries.
   * @param factor Device zoom factor (use getMinZoom/getMaxZoom for valid range)
   */
  setZoomAnimated(factor: number): void;

  /**
   * Get the minimum supported zoom factor.
   * For virtual devices with ultra-wide, this is 1.0 (corresponds to 0.5x user-facing).
   */
  getMinZoom(): Promise<number>;

  /**
   * Get the maximum supported zoom factor (capped at 15x for UX).
   */
  getMaxZoom(): Promise<number>;

  /**
   * Get the zoom factors where the device switches between physical lenses.
   * Returns empty array for single-camera devices.
   * For triple camera: typically [2.0, 6.0] meaning:
   * - Below 2.0: ultra-wide lens (0.5x-1x user-facing)
   * - At 2.0: switches FROM ultra-wide TO wide lens (1x user-facing)
   * - At 6.0: switches FROM wide TO telephoto lens (3x user-facing)
   */
  getSwitchOverZoomFactors(): Promise<number[]>;

  /**
   * Check if the current device has an ultra-wide camera.
   * This is true for builtInTripleCamera and builtInDualWideCamera (iPhone 11+, Pro models).
   * This is false for builtInDualCamera (Wide + Telephoto, e.g., iPhone X/XS) and single-lens devices.
   *
   * Use this to correctly interpret zoom factors:
   * - If hasUltraWide: minZoom (1.0) = 0.5x user-facing, switchOverFactors[0] (2.0) = 1x user-facing
   * - If !hasUltraWide: minZoom (1.0) = 1x user-facing, switchOverFactors[0] (2.0) = 2x user-facing (telephoto)
   */
  hasUltraWideCamera(): Promise<boolean>;

  /**
   * Focus at a normalized point in the preview.
   * Also adjusts exposure point if supported.
   * @param x Normalized x coordinate (0-1, left to right)
   * @param y Normalized y coordinate (0-1, top to bottom)
   */
  focusAtPoint(x: number, y: number): void;

  /**
   * Get diagnostic info about the current camera device for debugging.
   * Returns device type, supported zoom range, switching behavior, and more.
   * Useful for debugging zoom issues on different device configurations.
   */
  getDeviceDiagnostics(): Promise<{
    deviceType: string;
    minZoom: number;
    maxZoom: number;
    currentZoom: number;
    switchOverFactors: number[];
    switchingBehavior: number;
    isVirtualDevice: boolean;
  }>;

  /**
   * Check if the current camera device supports depth data capture.
   * Returns true for dual/triple rear cameras and TrueDepth front camera.
   * Returns false for single rear cameras (iPhone SE, 16e, Air).
   */
  isDepthSupported(): Promise<boolean>;

  /**
   * Check if enabling depth would restrict zoom on this device.
   * Returns true if zoom is limited to discrete levels (min == max in all ranges).
   * This typically happens on dual-camera devices (iPhone 12-16 base).
   * Returns false for triple-camera devices (Pro) and TrueDepth front cameras.
   */
  hasDepthZoomLimitations(): Promise<boolean>;

  /**
   * Get zoom ranges supported when depth data delivery is enabled.
   * Returns array of [min, max] pairs. If min == max, it's a discrete level.
   * Empty array means no depth support or no zoom restrictions.
   *
   * Example for dual-camera iPhone: [[2.0, 2.0], [4.0, 4.0]] (discrete 1x and 2x only)
   * Example for triple-camera iPhone: [[1.0, 6.0]] (continuous zoom supported)
   */
  getDepthSupportedZoomRanges(): Promise<number[][]>;

  /**
   * Present a native full-screen preview for any file using QLPreviewController.
   * Supports images, videos, PDFs, and other common file types.
   * @param filePath Absolute filesystem path to the file.
   */
  previewFile(filePath: string): Promise<void>;
}
export default TurboModuleRegistry.getEnforcing<Spec>("Zcam1Sdk");
