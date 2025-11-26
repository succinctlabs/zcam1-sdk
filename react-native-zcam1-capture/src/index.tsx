import { generate, getPublicKeyFixed } from "@pagopa/io-react-native-crypto";
import {
  generateHardwareKey,
  getAttestation,
} from "@pagopa/io-react-native-integrity";
import EncryptedStorage from "react-native-encrypted-storage";
import { CERT_KEY_TAG } from "./camera";

export { ZCamera } from "./camera";

export type Attestation = {
  data: string;
  challenge: string;
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

export async function initDevice(): Promise<string> {
  let keyId = undefined; //await EncryptedStorage.getItem("deviceKeyId");

  if (keyId === undefined) {
    keyId = await generateHardwareKey();
    EncryptedStorage.setItem("deviceKeyId", keyId);
  }
  if (keyId) {
    return keyId;
  } else {
    throw "failed to generate a device key";
  }
}

export async function register(
  keyId: string,
  settings: Settings,
): Promise<Attestation> {
  await getPublicKeyFixed(CERT_KEY_TAG).catch(() => {
    generate(CERT_KEY_TAG);
  });

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
