import {
  generateHardwareKey,
  getAttestation,
} from "@pagopa/io-react-native-integrity";
import EncryptedStorage from "react-native-encrypted-storage";
import {
  getCertChain,
  getContentPublicKey,
  getSecureEnclaveKeyId,
} from "zcam1-common";

export { ZCamera } from "./camera";

export type Attestation = {
  data: string;
  challenge: string;
};

export type DeviceInfo = {
  deviceKeyId: string;
  contentKeyId: Uint8Array;
  certChainPem: string;
  attestation: Attestation;
};

export type Settings = {
  backendUrl: string;
  appId: string;
  production: boolean;
};

export class ZPhoto {
  originalPath: string;
  path: string;

  constructor(originalPath: string, path: string) {
    this.originalPath = originalPath;
    this.path = path;
  }
}

export async function initDevice(settings: Settings): Promise<DeviceInfo> {
  let deviceKeyId: string | undefined;
  let contentKeyId: Uint8Array | undefined;

  const contentPublicKey = await getContentPublicKey();

  if (contentPublicKey.kty !== "EC") {
    throw "Only EC public keys are supported";
  }

  contentKeyId = getSecureEnclaveKeyId(contentPublicKey);

  const certChainPem = await getCertChain(
    contentPublicKey,
    settings.backendUrl,
  );

  if (deviceKeyId === undefined) {
    deviceKeyId = await generateHardwareKey();
    EncryptedStorage.setItem("deviceKeyId", deviceKeyId);
  }

  if (deviceKeyId === undefined) {
    throw "failed to generate a device key";
  }

  const attestation = await updateRegistration(deviceKeyId, settings);

  return { deviceKeyId, contentKeyId, certChainPem, attestation };
}

export async function updateRegistration(
  keyId: string,
  settings: Settings,
): Promise<Attestation> {
  let response = await fetch(settings.backendUrl + "/ios/register/init", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ keyId }),
  });

  if (!response.ok) {
    throw "failed to init:" + (await response.text());
  }

  let challenge = await response.text();
  const attestation = await getAttestation(challenge, keyId);

  response = await fetch(settings.backendUrl + "/ios/register/validate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      attestation,
      keyId,
      appId: settings.appId,
      production: settings.production,
    }),
  });

  if (!response.ok) {
    throw "failed to validate:" + (await response.text());
  }

  return { data: attestation, challenge };
}
