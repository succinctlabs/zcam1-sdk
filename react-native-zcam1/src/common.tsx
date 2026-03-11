import { sha1 } from "@noble/hashes/legacy.js";
import { generate, getPublicKeyFixed, type PublicKey } from "@pagopa/io-react-native-crypto";
import { base64, base64nopad, base64url, base64urlnopad } from "@scure/base";
import { Platform } from "react-native";
import { isEmulator } from "react-native-device-info";

const CONTENT_KEY_TAG = "ZCAM1_CONTENT_KEY_TAG";

// Mock P-256 key used on emulators where hardware-backed key generation is unavailable.
const MOCK_EMULATOR_CONTENT_KEY = {
  kty: "EC" as const,
  crv: "P-256",
  x: "RppjUgQnczmTmn56a9D_jkSp8aa3c79PJqdpizyENR0",
  y: "ZdPRyOD6bo0Iy_gD-aHujhhgut4cS5yjOtsSeUsYkkc",
};

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
  const isAndroidEmulator = await isEmulator().then(
    (isEmulator) => isEmulator && Platform.OS === "android",
  );

  if (isAndroidEmulator) {
    return MOCK_EMULATOR_CONTENT_KEY;
  }

  return await getPublicKeyFixed(CONTENT_KEY_TAG).catch(async () => {
    await generate(CONTENT_KEY_TAG);
    return getPublicKeyFixed(CONTENT_KEY_TAG);
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
    throw new Error("Invalid key type");
  }
}
