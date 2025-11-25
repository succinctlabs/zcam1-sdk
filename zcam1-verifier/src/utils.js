export function fromHexString(hexString) {
  return Uint8Array.from(
    hexString.match(/.{2}/g).map((byte) => parseInt(byte, 16)),
  );
}
