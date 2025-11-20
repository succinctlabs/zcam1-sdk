import React from "react";
import {
  Platform,
  requireNativeComponent,
  StyleProp,
  ViewStyle,
} from "react-native";
import { Util } from "react-native-file-access";
import { createCertificateChainPEM, signImage } from "./c2pa";
import { ZPhoto } from ".";
import { hashFile } from "./crypto";
import NativeZcam1Sdk from "./NativeZcam1Sdk";

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

const KEY_TAG = "com.anonymous.zcam1poc";

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

    console.log("Format: " + format);

    // 1. Capture using native Swift camera (preview handled by native view).
    const result: NativeCaptureResult = await NativeZcam1Sdk.takeNativePhoto(
      format,
      "back",
    );

    if (!result || !result.filePath) {
      throw new Error(
        "Native camera capture did not return a valid file path.",
      );
    }

    const originalPath = result.filePath;
    const metadata = result.metadata ?? {};

    console.log("Source: " + originalPath);

    // 2. Prepare C2PA certificate chain.
    const certificateChainPEM = await createCertificateChainPEM({
      keyTag: KEY_TAG,
      commonName: "TEST",
      organization: "Succinct",
    });

    // 3. Compute hash of the captured file (for signImageWithDataHashed).
    const dataHash = await hashFile(originalPath);

    const tiff = (metadata as any)["{TIFF}"] ?? {};
    const when: string =
      tiff.DateTime || new Date().toISOString().replace("T", " ").split(".")[0];
    const deviceModel: string = tiff.Model || "Unknown";

    // 4. Build destination path for the signed asset (JPEG).
    const destinationPath =
      Util.dirname(originalPath) +
      `/tmp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${format}`;

    console.log("Destination: " + destinationPath);

    // 5. Build C2PA manifest.
    const manifestJSON = JSON.stringify({
      claim_generator: "zcam1-poc/0.0.1",
      title: "First C2PA photo!",
      assertions: [
        {
          label: "c2pa.created",
          data: {
            actions: [
              {
                action: "c2pa.capture",
                when,
                parameters: {
                  device_make: Platform.OS === "ios" ? "Apple" : "Unknown",
                  device_model: deviceModel,
                  software_version:
                    Platform.OS === "ios" ? "iOS 18.1" : "unknown",
                  exposure_time: "1/120",
                  iso: 100,
                  aperture: 1.8,
                  capture_mode: "HDR",
                  location: {
                    lat: 33.5427,
                    lon: -117.7854,
                  },
                },
              },
            ],
          },
        },
      ],
    });

    // 6. Sign the captured image with C2PA, producing a new signed JPEG file.
    await signImage({
      sourcePath: originalPath,
      destinationPath,
      manifestJSON,
      keyTag: KEY_TAG,
      dataHash,
      certificateChainPEM,
    });

    return new ZPhoto(originalPath, destinationPath);
  }

  /** Render the native Swift camera preview view. */
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
