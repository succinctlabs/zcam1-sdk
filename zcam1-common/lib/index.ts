import {
  generate,
  getPublicKeyFixed,
  PublicKey,
} from "@pagopa/io-react-native-crypto";
import { base64urlnopad } from "@scure/base";
import { sha1 } from "@noble/hashes/legacy.js";

const CONTENT_KEY_TAG = "ZCAM1_CONTENT_KEY_TAG";

export interface ECKey {
  kty: "EC";
  crv: string;
  x: string;
  y: string;
}

export async function getContentPublicKey(): Promise<PublicKey> {
  return await getPublicKeyFixed(CONTENT_KEY_TAG).catch(() => {
    return generate(CONTENT_KEY_TAG);
  });
}

export function getSecureEnclaveKeyId(publicKey: ECKey): Uint8Array {
  if (publicKey.kty === "EC") {
    const x = base64urlnopad.decode(publicKey.x);
    const y = base64urlnopad.decode(publicKey.y);

    const out = new Uint8Array(1 + x.length + y.length);
    out[0] = 0x04; // uncompressed point format
    out.set(x, 1);
    out.set(y, 1 + x.length);

    return sha1(out);
  } else {
    throw "Invalid key type";
  }
}
