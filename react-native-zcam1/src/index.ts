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

export { initCapture, type CaptureInfo } from "./capture";

export { ProverProvider, useProver } from "./prove";

/**
 * Flash mode for photo capture.
 */
export { type FlashMode } from "./NativeZcam1Capture";
