import { sha1 } from "@noble/hashes/legacy.js";
import { generate, getPublicKeyFixed, type PublicKey } from "@pagopa/io-react-native-crypto";
import { base64, base64nopad, base64url, base64urlnopad } from "@scure/base";

const CONTENT_KEY_TAG = "ZCAM1_CONTENT_KEY_TAG";

export interface ECKey {
  kty: "EC";
  crv: string;
  x: string;
  y: string;
}

// Flexible base64 decoder that handles both standard and url-safe formats, with or without padding.
// iOS Secure Enclave returns keys in varying formats depending on the iOS version.
function flexibleBase64Decode(str: string): Uint8Array {
  const isUrlSafe = str.includes("-") || str.includes("_");
  const hasPadding = str.includes("=");

  if (isUrlSafe) {
    return hasPadding ? base64url.decode(str) : base64urlnopad.decode(str);
  }
  return hasPadding ? base64.decode(str) : base64nopad.decode(str);
}

export async function getContentPublicKey(): Promise<PublicKey> {
  return await getPublicKeyFixed(CONTENT_KEY_TAG).catch(() => {
    return generate(CONTENT_KEY_TAG);
  });
}

export function getSecureEnclaveKeyId(publicKey: ECKey): Uint8Array {
  if (publicKey.kty === "EC") {
    const x = flexibleBase64Decode(publicKey.x);
    const y = flexibleBase64Decode(publicKey.y);

    const out = new Uint8Array(1 + x.length + y.length);
    out[0] = 0x04; // uncompressed point format
    out.set(x, 1);
    out.set(y, 1 + x.length);

    return sha1(out);
  } else {
    throw "Invalid key type";
  }
}
