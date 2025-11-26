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

  /**
   * If true, the native side may also save the photo into
   * the system photo library in addition to returning a file path.
   */
  saveToCameraRoll?: boolean;
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

export interface Spec extends TurboModule {
  // C2PA: Ensure a Secure Enclave key exists for the given key tag.
  // Returns true if the key exists or was created.
  ensureSecureEnclaveKey(keyTag: string): Promise<boolean>;

  // C2PA: Export the public key in PEM format for the given key tag.
  exportPublicKeyPEM(keyTag: string): Promise<string>;

  // C2PA: Create a self-signed certificate (PEM) using the Secure Enclave key identified by keyTag.
  createSelfSignedCertificatePEM(
    keyTag: string,
    commonName: string,
    organization?: string,
    organizationalUnit?: string,
    country?: string,
    locality?: string,
    stateOrProvince?: string,
    validDays?: number,
  ): Promise<string>;

  // C2PA: Create a certificate chain (end-entity, intermediate, root) using the Secure Enclave key identified by keyTag.
  createCertificateChainPEM(
    keyTag: string,
    commonName: string,
    organization: string,
    organizationalUnit?: string,
    country?: string,
    locality?: string,
    stateOrProvince?: string,
    validDays?: number,
  ): Promise<string>;

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
  ): Promise<TakeNativePhotoResult>;
}
export default TurboModuleRegistry.getEnforcing<Spec>("Zcam1Sdk");
