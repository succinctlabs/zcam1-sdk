import { TurboModuleRegistry, type TurboModule } from "react-native";

export interface Spec extends TurboModule {
  // C2PA: Sign an image file with the provided manifest JSON.
  // Returns the produced manifest bytes as a base64-encoded string.
  // destinationPath will be created/overwritten.
  signImage(
    sourcePath: string,
    destinationPath: string,
    manifestJSON: string,
    keyTag: string,
    certificateChainPEM: string,
    tsaURL?: string,
    embed?: boolean,
  ): Promise<string>;

  signImageWithDataHashed(
    sourcePath: string,
    destinationPath: string,
    manifestJSON: string,
    keyTag: string,
    dataHash: string,
    certificateChainPEM: string,
    tsaURL?: string,
    embed?: boolean,
  ): Promise<string>;
}

export default TurboModuleRegistry.getEnforcing<Spec>("Zcam1C2pa");
