export {
  buildSelfSignedCertificate,
  SelfSignedCertChain,
  authenticityStatus,
  AuthenticityStatus,
  IosProvingClient,
  FulfillmentStatus,
} from "./bindings";

/**
 * Camera component for capturing photos with secure enclave integration.
 */
export { ZCamera, type CameraFilter } from "./camera";

export { privateDirectory, ZImagePicker } from "./picker";

export { initCapture, type CaptureInfo } from "./capture";

export {
  ProverProvider,
  ProvingClient,
  useProver,
  useProofRequestStatus,
} from "./prove";

export { VerifiableFile, type CaptureMetadata } from "./verify";

/**
 * Flash mode for photo capture.
 */
export { type FlashMode } from "./NativeZcam1Capture";
