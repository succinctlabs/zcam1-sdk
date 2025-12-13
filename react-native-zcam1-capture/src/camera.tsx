import React from "react";
import {
  Platform,
  requireNativeComponent,
  StyleProp,
  ViewStyle,
} from "react-native";
import { Util } from "react-native-file-access";
import { base64 } from "@scure/base";
import { generateHardwareSignatureWithAssertion } from "@pagopa/io-react-native-integrity";
import { ManifestEditor } from "react-native-zcam1-c2pa";
import { DeviceInfo, Settings, ZPhoto } from ".";
import { hashFile } from "./crypto";
import NativeZcam1Sdk from "./NativeZcam1Sdk";

export const CERT_KEY_TAG = "CERT_KEY_TAG";

/**
 * Capture format produced by the native Swift camera.
 * - "jpeg": standard compressed JPEG file
 * - "dng": RAW DNG file (original), C2PA-signed JPEG copy is still produced
 */
export type CaptureFormat = "jpeg" | "dng";

export interface ZCameraProps {
  /** Which camera to use. Defaults to "back". */
  position?: "front" | "back";
  /** Whether the camera is actively running. Defaults to true. */
  isActive?: boolean;
  /** Desired capture format. Defaults to "jpeg". */
  captureFormat?: CaptureFormat;

  deviceInfo: DeviceInfo;

  settings: Settings;

  /** Optional style for the underlying native view. */
  style?: StyleProp<ViewStyle>;
}

/** Options for a single capture call. */
export interface TakePhotoOptions {
  format?: CaptureFormat;
}

/** Shape expected from the native Swift capture implementation. */
type NativeCaptureResult = {
  /** Local filesystem path to the captured image file. */
  filePath: string;
  /** The actual format of the captured file. */
  format: CaptureFormat;
  /** Optional metadata (EXIF / TIFF) for C2PA manifest enrichment. */
  metadata?: Record<string, any> | null;
};

/** Props passed to the native Swift camera view. */
type NativeCameraViewProps = {
  style?: StyleProp<ViewStyle>;
  isActive?: boolean;
  position?: "front" | "back";
  captureFormat?: CaptureFormat;
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

    // Capture using native Swift camera (preview handled by native view).
    const result: NativeCaptureResult = await NativeZcam1Sdk.takeNativePhoto(
      format,
      this.props.position || "back",
    );

    if (!result || !result.filePath) {
      throw new Error(
        "Native camera capture did not return a valid file path.",
      );
    }

    const originalPath = result.filePath;
    const metadata = result.metadata ?? {};

    // Compute hash of the captured file (for signImageWithDataHashed).
    const dataHash = await hashFile(originalPath);

    const tiff = (metadata as any)["{TIFF}"] ?? {};
    const when =
      tiff.DateTime || new Date().toISOString().replace("T", " ").split(".")[0];
    const deviceModel = tiff.Model || "Unknown";
    const softwareVersion = tiff.Software || "Unknown";

    // Build destination path for the signed asset (JPEG).
    const destinationPath =
      Util.dirname(originalPath) +
      `/tmp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${format}`;

    // Generate hardware signature (or mock for simulator).
    let assertion: string;
    try {
      assertion = await generateHardwareSignatureWithAssertion(
        dataHash,
        this.props.deviceInfo.deviceKeyId,
      );
    } catch (error: any) {
      // If running in simulator, hardware signing is not supported.
      if (error?.code === "-1" || error?.message?.includes("UNSUPPORTED_SERVICE")) {
        console.warn(
          "[ZCAM] Running in simulator - using mock assertion for photo signing. This is for development only."
        );
        // Use a mock assertion for simulator testing.
        assertion = `SIMULATOR_PHOTO_ASSERTION_${Date.now()}`;
      } else {
        throw error;
      }
    }

    // Perform C2PA signing for both real device and simulator.
    // Simulator now uses test credentials that allow proper signing.
    const manifestEditor = new ManifestEditor(originalPath);

    // Add the "capture" action to the manifest.
    manifestEditor.addAction(
      JSON.stringify({
        action: "c2pa.capture",
        when,
        parameters: {
          device_make: Platform.OS === "ios" ? "Apple" : "Unknown",
          device_model: deviceModel,
          software_version: softwareVersion,
        },
      }),
    );

    // Add an assertion containing all data needed to later generate a proof.
    manifestEditor.addAssertion(
      "succinct.bindings",
      JSON.stringify({
        app_id: this.props.settings.appId,
        device_key_id: this.props.deviceInfo.deviceKeyId,
        attestation: this.props.deviceInfo.attestation,
        assertion,
      }),
    );

    // Sign the captured image with C2PA, producing a new signed JPEG file.
    await manifestEditor.embedManifestToFile(
      destinationPath,
      base64.decode(dataHash),
      "image/jpeg",
      this.props.deviceInfo.contentKeyId,
      this.props.deviceInfo.certChainPem,
    );

    return new ZPhoto(originalPath, destinationPath);
  }

  /* Render the native Swift camera preview view. */
  public render(): React.ReactNode {
    const {
      isActive = true,
      position = "back",
      captureFormat,
      style,
    } = this.props;

    return (
      <Zcam1CameraView
        ref={this.nativeRef}
        style={[{ flex: 1 }, style]}
        isActive={isActive}
        position={position}
        captureFormat={captureFormat}
      />
    );
  }
}
