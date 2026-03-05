export type {
  ManifestEditorInterface,
  ManifestInterface,
  ManifestStoreInterface,
} from "./bindings";
export {
  AuthenticityData,
  AuthenticityStatus,
  authenticityStatus,
  buildSelfSignedCertificate,
  C2paError,
  C2paError_Tags,
  Claim,
  computeHash,
  computeHashFromBuffer,
  DepthData,
  DepthDataStatistics,
  DeviceBindings,
  Exclusion,
  extractManifest,
  FilmStyleInfo,
  formatFromPath,
  Manifest,
  ManifestEditor,
  ManifestStore,
  PhotoMetadataInfo,
  Proof,
  SelfSignedCertChain,
  VerifyError,
  VerifyError_Tags,
  VideoMetadataInfo,
} from "./bindings";

/**
 * Camera component for capturing photos with secure enclave integration.
 */
export type {
  CameraFilmStyle,
  CaptureFormat,
  FilmStyleEffect,
  FilmStyleRecipe,
  HighlightShadowConfig,
  MonochromeConfig,
  TakePhotoOptions,
  WhiteBalanceConfig,
  ZCameraProps,
} from "./camera";
export { ZCamera } from "./camera";
export type { CaptureInfo, DeviceOrientation } from "./capture";
export { initCapture, requestLocationPermission, updateRegistration } from "./capture";

/**
 * Core cryptographic key types and secure enclave utilities.
 */
export type { ECKey } from "./common";
export { getContentPublicKey, getSecureEnclaveKeyId } from "./common";
export type { PhotoGallery, PrivateFolder, ZImagePickerProps } from "./picker";

/**
 * Image picker and private directory utilities for secure media selection.\
 */
export { privateDirectory, ZImagePicker } from "./picker";

/**
* Verification utilities for validating media authenticity and capture metadata.

 */
export { type CaptureMetadata, VerifiableFile } from "./verify";

/**
 * Flash mode for photo capture.
 */
export { type FlashMode } from "./NativeZcam1Capture";
