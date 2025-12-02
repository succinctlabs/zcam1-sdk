export function fromHexString(hexString: string) {
  return Uint8Array.from(
    hexString.match(/.{2}/g)!.map((byte) => parseInt(byte, 16)),
  );
}
