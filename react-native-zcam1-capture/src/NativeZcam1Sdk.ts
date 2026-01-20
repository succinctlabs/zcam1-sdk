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

export interface DepthDataStatistics {
  /**
   * Minimum depth value in the depth map.
   */
  min: number;

  /**
   * Maximum depth value in the depth map.
   */
  max: number;

  /**
   * Mean depth value across all valid pixels.
   */
  mean: number;

  /**
   * Standard deviation of depth values.
   */
  std_dev: number;

  /**
   * Number of valid (non-NaN, non-infinite) pixels.
   */
  valid_pixels: number;
}

export interface DepthData {
  /**
   * Width of the depth data map in pixels.
   */
  width: number;

  /**
   * Height of the depth data map in pixels.
   */
  height: number;

  /**
   * Pixel format of the depth data (depthFloat32, depthFloat16, disparityFloat32, disparityFloat16).
   */
  pixel_format: string;

  /**
   * Statistics computed from the depth data.
   */
  statistics: DepthDataStatistics;

  /**
   * Accuracy of the depth data: "absolute" or "relative" (iOS 14.1+).
   */
  accuracy: string;
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
   * Only present on devices with depth camera support (e.g., iPhone 12+, iPad Pro).
   */
  depthData?: DepthData | null;
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
   * Duration of the recorded clip in seconds (if available).
   */
  durationSeconds?: number;
}

export type FlashMode = "off" | "on" | "auto";

export interface Spec extends TurboModule {
  /**
   * Capture a photo using the native camera stack (Swift/AVFoundation)
   * without going through react-native-vision-camera.
   *
   * The native implementation is responsible for:
   * - Handling permissions
   * - Presenting a preview / capture UI as needed
   * - Writing the resulting JPEG or DNG file and returning its path
   */
  takeNativePhoto(
    format: TakeNativePhotoFormat,
    position: "front" | "back",
    flash: FlashMode,
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
   * Set zoom factor programmatically.
   * For virtual devices with ultra-wide, 1.0 is ultra-wide (0.5x user-facing),
   * 2.0 is wide-angle (1x user-facing), etc.
   * @param factor Device zoom factor (use getMinZoom/getMaxZoom for valid range)
   */
  setZoom(factor: number): void;

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
   * Focus at a normalized point in the preview.
   * Also adjusts exposure point if supported.
   * @param x Normalized x coordinate (0-1, left to right)
   * @param y Normalized y coordinate (0-1, top to bottom)
   */
  focusAtPoint(x: number, y: number): void;
}
export default TurboModuleRegistry.getEnforcing<Spec>("Zcam1Sdk");
