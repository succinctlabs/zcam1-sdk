import { TurboModuleRegistry, type TurboModule } from "react-native";

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

  // C2PA: Sign an image file with the provided manifest JSON.
  // Returns the produced manifest bytes as a base64-encoded string.
  // destinationPath will be created/overwritten.
  signImage(
    sourcePath: string,
    destinationPath: string,
    manifestJSON: string,
    keyTag: string,
    certificateChainPEM: string,
    tsaURL?: string,
    embed?: boolean,
  ): Promise<string>;

  signImageWithDataHashed(
    sourcePath: string,
    destinationPath: string,
    manifestJSON: string,
    keyTag: string,
    dataHash: string,
    certificateChainPEM: string,
    tsaURL?: string,
    embed?: boolean,
  ): Promise<string>;
}

export default TurboModuleRegistry.getEnforcing<Spec>("Zcam1C2pa");
