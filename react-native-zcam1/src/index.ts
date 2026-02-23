export {
  buildSelfSignedCertificate,
  SelfSignedCertChain,
  authenticityStatus,
  AuthenticityStatus,
  PhotoMetadataInfo,
  VideoMetadataInfo,
} from "./bindings";

/**
 * Camera component for capturing photos with secure enclave integration.
 */
export { ZCamera } from "./camera";

export { privateDirectory, ZImagePicker } from "./picker";

export { initCapture, type CaptureInfo } from "./capture";

export { VerifiableFile, type CaptureMetadata } from "./verify";

/**
 * Flash mode for photo capture.
 */
export { type FlashMode } from "./NativeZcam1Capture";
