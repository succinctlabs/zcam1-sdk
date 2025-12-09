import { sha256 } from "@noble/hashes/sha2.js";
import { base64 } from "@scure/base";
import { FileSystem } from "react-native-file-access";

export async function hashFile(filePath: string): Promise<string> {
  const base64Data = await FileSystem.readFile(filePath, "base64");
  const bytes = base64ToBytes(base64Data);
  const hash = sha256(bytes);

  return base64.encode(hash);
}

function base64ToBytes(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
