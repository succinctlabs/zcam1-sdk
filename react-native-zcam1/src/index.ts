export {
  AuthenticityStatus,
  authenticityStatus,
  buildSelfSignedCertificate,
  extractManifest,
  PhotoMetadataInfo,
  SelfSignedCertChain,
  VideoMetadataInfo,
} from "./bindings";

/**
 * Camera component for capturing photos with secure enclave integration.
 */
export { ZCamera } from "./camera";
export type { CameraFilmStyle, CaptureInfo, DeviceOrientation } from "./capture";
export { initCapture } from "./capture";
export { privateDirectory, ZImagePicker } from "./picker";
export { type CaptureMetadata, VerifiableFile } from "./verify";

/**
 * Flash mode for photo capture.
 */
export { type FlashMode } from "./NativeZcam1Capture";
