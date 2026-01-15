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
   * @param factor Zoom factor (1.0 = no zoom, 2.0 = 2x, etc.)
   */
  setZoom(factor: number): void;

  /**
   * Get the maximum supported zoom factor (capped at 10x).
   */
  getMaxZoom(): Promise<number>;

  /**
   * Focus at a normalized point in the preview.
   * Also adjusts exposure point if supported.
   * @param x Normalized x coordinate (0-1, left to right)
   * @param y Normalized y coordinate (0-1, top to bottom)
   */
  focusAtPoint(x: number, y: number): void;
}
export default TurboModuleRegistry.getEnforcing<Spec>("Zcam1Sdk");
