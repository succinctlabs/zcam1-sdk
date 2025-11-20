import { getPublicKeyFixed } from "@pagopa/io-react-native-crypto";
import {
  generateHardwareKey,
  getAttestation,
} from "@pagopa/io-react-native-integrity";
import { jwkThumbprintB64Url } from "./crypto";

export { ZCamera } from "./camera";

export type Settings = {
  bundleId: string;
  backendUrl: string;
};

export class ZPhoto {
  originalPath: string;
  path: string;

  constructor(originalPath: string, path: string) {
    this.originalPath = originalPath;
    this.path = path;
  }

  async bindToDevice(): Promise<void> {
    // todo
  }
}

export async function init(settings: Settings): Promise<string | undefined> {
  const contentPubKey = await getPublicKeyFixed(settings.bundleId);
  const contentPubKeyHash = jwkThumbprintB64Url(contentPubKey);

  console.warn(settings.backendUrl);
  let response = await fetch(settings.backendUrl + "/init", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ contentPubKeyHash }),
  });

  console.warn("Response");

  if (!response.ok) {
    throw "failed to init:" + (await response.text());
  }

  let challenge = await response.text();

  console.warn("Challenge: " + challenge);

  const deviceKeyId = await generateHardwareKey();
  const attestation = await getAttestation(challenge, deviceKeyId);

  response = await fetch(settings.backendUrl + "/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contentPubKeyHash,
      deviceKeyId,
      attestation,
      bindingSignature: "",
    }),
  });

  if (!response.ok) {
    throw "failed to register:" + (await response.text());
  }

  return "";
}
