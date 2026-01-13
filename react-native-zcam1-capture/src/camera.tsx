import React from "react";
import {
  requireNativeComponent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import {
  buildSelfSignedCertificate,
  ExistingCertChain,
  SelfSignedCertChain,
} from "@succinctlabs/react-native-zcam1-c2pa";
import { type CaptureInfo, ZPhoto } from "./types";
import { embedBindings } from "./embed";
import NativeZcam1Sdk, { type FlashMode } from "./NativeZcam1Sdk";
import { generateAppAttestAssertionFromPhotoHash } from "./utils";

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

  /** Zoom factor (1.0 = no zoom, 2.0 = 2x). Defaults to 1.0. */
  zoom?: number;
  /** Whether torch (flashlight) is enabled during preview. Defaults to false. */
  torch?: boolean;
  /** Exposure compensation in EV units. Defaults to 0. */
  exposure?: number;

  captureInfo: CaptureInfo;

  certChain?: SelfSignedCertChain | ExistingCertChain;

  /** Optional style for the underlying native view. */
  style?: StyleProp<ViewStyle>;
}

/** Options for a single capture call. */
export interface TakePhotoOptions {
  format?: CaptureFormat;
  /** Flash mode for this capture. Defaults to "off". */
  flash?: FlashMode;
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
  zoom?: number;
  torch?: boolean;
  exposure?: number;
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
   * Get the maximum supported zoom factor (capped at 10x).
   */
  async getMaxZoom(): Promise<number> {
    return NativeZcam1Sdk.getMaxZoom();
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

    // Capture using native Swift camera (preview handled by native view).
    const result: NativeCaptureResult = await NativeZcam1Sdk.takeNativePhoto(
      format,
      this.props.position || "back",
      flash,
    );

    if (!result || !result.filePath) {
      throw new Error(
        "Native camera capture did not return a valid file path.",
      );
    }

    const originalPath = result.filePath;
    const metadata = result.metadata ?? {};

    const tiff = (metadata as any)["{TIFF}"] ?? {};

    console.log("All metadata:", metadata);
    console.log("TIFF metadata:", tiff);

    const when =
      tiff.DateTime || new Date().toISOString().replace("T", " ").split(".")[0];
    const deviceMake = tiff.Model || "Apple";
    const deviceModel = tiff.Model || "Unknown";
    const softwareVersion = tiff.Software || "Unknown";

    const destinationPath = await embedBindings(
      originalPath,
      when,
      {
        device_make: deviceMake,
        device_model: deviceModel,
        software_version: softwareVersion,
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
      zoom = 1.0,
      torch = false,
      exposure = 0,
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
      />
    );
  }
}
