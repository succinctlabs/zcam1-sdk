import Zcam1Sdk from "./NativeZcam1Sdk";

export function ensureSecureEnclaveKey(keyTag: string): Promise<boolean> {
  return Zcam1Sdk.ensureSecureEnclaveKey(keyTag);
}

export function exportPublicKeyPEM(keyTag: string): Promise<string> {
  return Zcam1Sdk.exportPublicKeyPEM(keyTag);
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
  return Zcam1Sdk.createSelfSignedCertificatePEM(
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
  return Zcam1Sdk.createCertificateChainPEM(
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
