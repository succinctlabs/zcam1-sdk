import { PublicKey } from "@pagopa/io-react-native-crypto";
import { sha256 } from "@noble/hashes/sha2.js";
import { sha1 } from "@noble/hashes/legacy.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import { base64url, base64, base64urlnopad } from "@scure/base";
import { FileSystem } from "react-native-file-access";

export function jwkThumbprintB64Url(jwk: PublicKey): string {
  const canon = canonicalJwkForThumbprint(jwk);
  const json = JSON.stringify(canon); // minimal JSON, keys already in required order
  const hash = sha256(utf8ToBytes(json)); // Uint8Array
  return base64url.encode(hash); // base64url without padding
}

export async function hashFile(filePath: string): Promise<string> {
  const base64Data = await FileSystem.readFile(filePath, "base64");
  const bytes = base64ToBytes(base64Data);
  const hash = sha256(bytes);

  return base64.encode(hash);
}

export function secureEnclaveKeyId(publicKey: PublicKey): Uint8Array {
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

export function bytesToHexString(array: Uint8Array): string {
  return Array.from(array)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function base64ToBytes(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function canonicalJwkForThumbprint(jwk: PublicKey): Record<string, string> {
  if (jwk.kty === "EC") {
    // Lexicographic key order: crv, kty, x, y
    return { crv: jwk.crv, kty: "EC", x: jwk.x, y: jwk.y };
  }
  if (jwk.kty === "RSA") {
    // Lexicographic order: e, kty, n
    return { e: jwk.e, kty: "RSA", n: jwk.n };
  }
  throw new Error("Unsupported kty");
}
