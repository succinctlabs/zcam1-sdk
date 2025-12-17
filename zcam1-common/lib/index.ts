import {
  generate,
  getPublicKeyFixed,
  PublicKey,
} from "@pagopa/io-react-native-crypto";
import { base64url } from "@scure/base";
import { sha1 } from "@noble/hashes/legacy.js";
import fetch from "cross-fetch";

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

export async function getCertChain(
  leafJwt: ECKey,
  backendUrl: string,
): Promise<string> {
  let response = await fetch(backendUrl + "/cert-chain", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(leafJwt),
  });

  if (!response.ok) {
    throw "failed to retrieve the certificate chain:" + (await response.text());
  }

  return await response.text();
}

export function getSecureEnclaveKeyId(publicKey: ECKey): Uint8Array {
  if (publicKey.kty === "EC") {
    // The @pagopa/io-react-native-crypto library returns x and y in base64url format.
    // Try to decode directly, and if that fails, try converting from standard base64.
    const decodeBase64OrBase64Url = (encoded: string): Uint8Array => {
      try {
        // First try decoding as base64url (no padding).
        return base64url.decode(encoded);
      } catch (e) {
        // If that fails, try converting from standard base64 to base64url.
        const toBase64Url = (b64: string): string => {
          return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
        };
        return base64url.decode(toBase64Url(encoded));
      }
    };

    const x = decodeBase64OrBase64Url(publicKey.x);
    const y = decodeBase64OrBase64Url(publicKey.y);

    const out = new Uint8Array(1 + x.length + y.length);
    out[0] = 0x04; // uncompressed point format
    out.set(x, 1);
    out.set(y, 1 + x.length);

    return sha1(out);
  } else {
    throw "Invalid key type";
  }
}
