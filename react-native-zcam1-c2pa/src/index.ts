import Zcam1C2pa from "./NativeZcam1C2pa";

export function ensureSecureEnclaveKey(keyTag: string): Promise<boolean> {
  return Zcam1C2pa.ensureSecureEnclaveKey(keyTag);
}

export function exportPublicKeyPEM(keyTag: string): Promise<string> {
  return Zcam1C2pa.exportPublicKeyPEM(keyTag);
}

export function createSelfSignedCertificatePEM(
  options: CreateSelfSignedCertificateOptions,
): Promise<string> {
  const {
    keyTag,
    commonName,
    organization,
    organizationalUnit,
    country,
    locality,
    stateOrProvince,
    validDays,
  } = options;
  return Zcam1C2pa.createSelfSignedCertificatePEM(
    keyTag,
    commonName,
    organization,
    organizationalUnit,
    country,
    locality,
    stateOrProvince,
    validDays,
  );
}

export function createCertificateChainPEM(
  options: CreateCertificateChainOptions,
): Promise<string> {
  const {
    keyTag,
    commonName,
    organization,
    organizationalUnit,
    country,
    locality,
    stateOrProvince,
    validDays,
  } = options;
  return Zcam1C2pa.createCertificateChainPEM(
    keyTag,
    commonName,
    organization,
    organizationalUnit,
    country,
    locality,
    stateOrProvince,
    validDays,
  );
}

export function signImage(options: SignImageOptions): Promise<string> {
  const {
    sourcePath,
    destinationPath,
    manifestJSON,
    keyTag,
    dataHash,
    certificateChainPEM,
    tsaURL,
    embed,
  } = options;
  if (dataHash) {
    return Zcam1C2pa.signImageWithDataHashed(
      sourcePath,
      destinationPath,
      manifestJSON,
      keyTag,
      dataHash,
      certificateChainPEM,
      tsaURL,
      embed,
    );
  } else {
    return Zcam1C2pa.signImage(
      sourcePath,
      destinationPath,
      manifestJSON,
      keyTag,
      certificateChainPEM,
      tsaURL,
      embed,
    );
  }
}

export type SignImageOptions = {
  sourcePath: string;
  destinationPath: string;
  manifestJSON: string;
  keyTag: string;
  dataHash?: string;
  certificateChainPEM: string;
  tsaURL?: string;
  embed?: boolean;
};

export type CreateSelfSignedCertificateOptions = {
  keyTag: string;
  commonName: string;
  organization?: string;
  organizationalUnit?: string;
  country?: string;
  locality?: string;
  stateOrProvince?: string;
  validDays?: number;
};

export type CreateCertificateChainOptions = {
  keyTag: string;
  commonName: string;
  organization: string;
  organizationalUnit?: string;
  country?: string;
  locality?: string;
  stateOrProvince?: string;
  validDays?: number;
};
