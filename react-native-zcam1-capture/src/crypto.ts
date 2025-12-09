import { sha256 } from "@noble/hashes/sha2.js";
import { base64 } from "@scure/base";
import { FileSystem } from "react-native-file-access";

/**
 * Computes the SHA-256 hash of a file and returns it as a base64-encoded string.
 *
 * @param filePath - The path to the file to hash
 * @returns A Promise that resolves to the base64-encoded SHA-256 hash of the file
 */
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
