import { generate, getPublicKeyFixed } from "@pagopa/io-react-native-crypto";

import {
  generateHardwareKey,
  getAttestation,
} from "@pagopa/io-react-native-integrity";
import EncryptedStorage from "react-native-encrypted-storage";
import { CERT_KEY_TAG } from "./camera";

export { ZCamera } from "./camera";

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

export async function init(settings: Settings): Promise<void> {
  await getPublicKeyFixed(CERT_KEY_TAG).catch(() => {
    generate(CERT_KEY_TAG);
  });

  let keyIdHex = await EncryptedStorage.getItem("deviceKeyId");

  if (keyIdHex === undefined) {
    keyIdHex = await generateHardwareKey();
    EncryptedStorage.setItem("deviceKeyId", keyIdHex);
  }

  if (keyIdHex) {
    let response = await fetch(settings.backendUrl + "/ios/register/init", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ keyIdHex }),
    });

    if (!response.ok) {
      throw "failed to init:" + (await response.text());
    }

    let challenge = await response.text();
    const attestationHex = await getAttestation(challenge, keyIdHex);

    response = await fetch(settings.backendUrl + "/ios/register/validate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        attestationHex,
        keyIdHex,
        appId: settings.appId,
        production: settings.production,
      }),
    });

    if (!response.ok) {
      throw "failed to validate:" + (await response.text());
    }
  } else {
    throw "failed to generate a device key";
  }
}
