import {
  generate,
  getPublicKeyFixed,
  PublicKey,
} from "@pagopa/io-react-native-crypto";
import { base64, base64url } from "@scure/base";
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
    // The @pagopa/io-react-native-crypto library may return x and y in various base64 formats.
    // Try multiple decoding strategies.
    const decodeBase64OrBase64Url = (encoded: string): Uint8Array => {
      // Strategy 1: Try as-is with base64url decoder (handles base64url without padding).
      try {
        return base64url.decode(encoded);
      } catch (e1) {
        // Strategy 2: Try adding padding if it's base64url without padding.
        try {
          const padded = encoded + "=".repeat((4 - (encoded.length % 4)) % 4);
          return base64url.decode(padded);
        } catch (e2) {
          // Strategy 3: Convert from standard base64 to base64url.
          try {
            const base64urlEncoded = encoded
              .replace(/\+/g, "-")
              .replace(/\//g, "_")
              .replace(/=/g, "");
            return base64url.decode(base64urlEncoded);
          } catch (e3) {
            // Strategy 4: It might be standard base64.
            try {
              return base64.decode(encoded);
            } catch (e4) {
              throw new Error(
                `Failed to decode base64/base64url string: ${encoded.substring(0, 20)}... (all strategies failed)`
              );
            }
          }
        }
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
