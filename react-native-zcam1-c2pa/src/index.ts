import Zcam1C2pa from "./NativeZcam1C2pa";

export function readFile(path: string): Promise<string> {
  return Zcam1C2pa.readFile(path);
}

export function signImage(options: SignImageOptions): Promise<string> {
  const {
    sourcePath,
    destinationPath,
    manifestJSON,
    keyTag,
    dataHash,
    certificateChainPEM,
    tsaURL,
    embed,
  } = options;
  if (dataHash) {
    return Zcam1C2pa.signImageWithDataHashed(
      sourcePath,
      destinationPath,
      manifestJSON,
      keyTag,
      dataHash,
      certificateChainPEM,
      tsaURL,
      embed,
    );
  } else {
    return Zcam1C2pa.signImage(
      sourcePath,
      destinationPath,
      manifestJSON,
      keyTag,
      certificateChainPEM,
      tsaURL,
      embed,
    );
  }
}

export type SignImageOptions = {
  sourcePath: string;
  destinationPath: string;
  manifestJSON: string;
  keyTag: string;
  dataHash?: string;
  certificateChainPEM: string;
  tsaURL?: string;
  embed?: boolean;
};
