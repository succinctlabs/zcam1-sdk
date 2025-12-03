import { generate, getPublicKeyFixed } from "@pagopa/io-react-native-crypto";
import {
  generateHardwareKey,
  getAttestation,
} from "@pagopa/io-react-native-integrity";
import EncryptedStorage from "react-native-encrypted-storage";
import { getCertChain } from "zcam1-common";
import { CERT_KEY_TAG } from "./camera";
import { secureEnclaveKeyId } from "./crypto";

export { ZCamera } from "./camera";

export type Attestation = {
  data: string;
  challenge: string;
};

export type DeviceInfo = {
  deviceKeyId: string;
  contentKeyId: Uint8Array;
  certChainPem: string;
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

  const publicKey = await getPublicKeyFixed(CERT_KEY_TAG).catch(() => {
    return generate(CERT_KEY_TAG);
  });

  if (publicKey.kty !== "EC") {
    throw "Only EC public keys are supported";
  }

  contentKeyId = secureEnclaveKeyId(publicKey);

  const certChainPem = await getCertChain(publicKey, settings.backendUrl);

  console.log("Certificate Chain", certChainPem);

  if (deviceKeyId === undefined) {
    deviceKeyId = await generateHardwareKey();
    EncryptedStorage.setItem("deviceKeyId", deviceKeyId);
  }
  if (deviceKeyId) {
    return { deviceKeyId, contentKeyId, certChainPem };
  } else {
    throw "failed to generate a device key";
  }
}

export async function register(
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
