import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  buildSelfSignedCertificate,
  extractManifest,
  ManifestEditor,
  SelfSignedCertChain,
  ExistingCertChain,
} from "react-native-zcam1-c2pa";
import {
  type Initialized,
  IosProvingClient,
  type IosProvingClientInterface,
} from "./proving";
import { base64 } from "@scure/base";
import {
  getContentPublicKey,
  getSecureEnclaveKeyId,
} from "@succinctlabs/react-native-zcam1-common";
import { Dirs } from "react-native-file-access";

export { IosProvingClient } from "./proving";
export {
  buildSelfSignedCertificate,
  SelfSignedCertChain,
} from "@succinctlabs/react-native-zcam1-c2pa";

/**
 * Configuration settings for backend communication.
 */
export type Settings = {
  privateKey?: string;
  certChain?: SelfSignedCertChain | ExistingCertChain;
  production: boolean;
};

/**
 * Creates a `ProvingClient` (non-React helper).
 *
 * Note: If the proofs are generated on the same app where the photos are captured,
 * call the initDevice() function from `react-native-zcam1-capture` instead of
 * this one.
 */
async function createProvingClient(
  settings: Settings,
  callback: Initialized,
): Promise<ProvingClient> {
  let certChainPem: string;
  let client: IosProvingClientInterface;
  const contentPublicKey = await getContentPublicKey();

  if (contentPublicKey.kty !== "EC") {
    throw "Only EC public keys are supported";
  }

  const contentKeyId = getSecureEnclaveKeyId(contentPublicKey);

  if (settings.certChain && "pem" in settings.certChain) {
    certChainPem = settings.certChain.pem;
  } else {
    console.warn("[ZCAM1] Using a self signed certificate");

    certChainPem = buildSelfSignedCertificate(
      contentPublicKey,
      settings.certChain,
    );
  }

  if (settings.privateKey) {
    client = new IosProvingClient(settings.privateKey, callback);
  } else {
    client = IosProvingClient.mock(callback);
  }

  return new ProvingClient(
    client,
    contentKeyId,
    certChainPem,
    settings.production,
  );
}

export type ProverContextValue = {
  provingClient: ProvingClient | null;
  isInitializing: boolean;
  error: unknown;
};

const ProverContext = createContext<ProverContextValue | null>(null);

export type ProverProviderProps = {
  children: React.ReactNode;
  /**
   * Provider configuration. The provider always initializes itself from these settings.
   */
  settings: Settings;
};

export function ProverProvider({ children, settings }: ProverProviderProps) {
  const [provingClient, setProvingClient] = useState<ProvingClient | null>(
    null,
  );
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;

    setIsInitializing(true);
    setError(null);
    setProvingClient(null);

    (async () => {
      try {
        const provingClient = await createProvingClient(settings, {
          initialized: () => {
            if (cancelled) return;
            setProvingClient(provingClient);
            setIsInitializing(false);
          },
        });
      } catch (e) {
        if (cancelled) return;
        setError(e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [settings]);

  const value = useMemo<ProverContextValue>(
    () => ({
      provingClient,
      isInitializing,
      error,
    }),
    [provingClient, isInitializing, error],
  );

  return (
    <ProverContext.Provider value={value}>{children}</ProverContext.Provider>
  );
}

export function useProver(): ProverContextValue {
  const ctx = useContext(ProverContext);
  if (!ctx) {
    throw new Error("useProver must be used within a ProverProvider");
  }
  return ctx;
}

export class ProvingClient {
  client: IosProvingClientInterface;
  contentKeyId: Uint8Array;
  certChainPem: string;
  production: boolean;

  constructor(
    client: IosProvingClientInterface,
    contentKeyId: Uint8Array,
    certChainPem: string,
    production: boolean,
  ) {
    this.client = client;
    this.contentKeyId = contentKeyId;
    this.certChainPem = certChainPem;
    this.production = production;
  }

  /**
   * Embeds a cryptographic proof into an image file by modifying its C2PA manifest.
   * @param originalPath - Path to the original image file
   * @param deviceInfo - Device information for signing
   * @param settings - Configuration settings for proof generation
   * @returns Path to the new file with embedded proof
   */
  async embedProof(originalPath: string): Promise<string> {
    const store = extractManifest(originalPath);
    const activeManifest = store.activeManifest();
    const dataHash = activeManifest.dataHash();
    const bindings = activeManifest.bindings();

    originalPath = originalPath.replace("file://", "");

    if (bindings === undefined) {
      throw new Error("No device bindings found in the C2PA manifest");
    }

    const manifestEditor = ManifestEditor.fromFileAndManifest(
      originalPath,
      store,
      this.contentKeyId.buffer as ArrayBuffer,
      this.certChainPem,
    );

    // Generate the proof
    const proof = await this.client.requestProof({
      attestation: bindings.attestation,
      assertion: bindings.assertion,
      keyId: bindings.deviceKeyId,
      dataHash: base64.decode(dataHash.hash).buffer as ArrayBuffer,
      appId: bindings.appId,
      appAttestProduction: this.production,
    });
    let vkHash = this.client.vkHash();

    // Include the proof to the C2PA manifest
    manifestEditor.addAssertion(
      "succinct.proof",
      JSON.stringify({
        data: base64.encode(new Uint8Array(proof)),
        vk_hash: vkHash,
      }),
    );
    manifestEditor.removeAssertion("succinct.bindings");

    const destinationPath =
      Dirs.CacheDir +
      `/zcam-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`;

    // Embed the manifest to the photo
    await manifestEditor.embedManifestToFile(destinationPath, "image/jpeg");

    return destinationPath;
  }
}
