import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  buildSelfSignedCertificate,
  extractManifest,
  formatFromPath,
  ManifestEditor,
  SelfSignedCertChain,
  ExistingCertChain,
} from "@succinctlabs/react-native-zcam1-c2pa";
import {
  FulfillmentStatus,
  type Initialized,
  IosProvingClient,
  type IosProvingClientInterface,
  ProofRequestStatus,
} from "./proving";
import { base64 } from "@scure/base";
import {
  getContentPublicKey,
  getSecureEnclaveKeyId,
} from "@succinctlabs/react-native-zcam1-common";
import { Dirs, Util } from "react-native-file-access";

export { IosProvingClient, FulfillmentStatus } from "./proving";
export {
  buildSelfSignedCertificate,
  authenticityStatus,
  SelfSignedCertChain,
  AuthenticityStatus,
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
  onInitialized: Initialized,
  onProofRequest?: (requestId: string, photoPath: string) => void,
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
    client = new IosProvingClient(settings.privateKey, onInitialized);
  } else {
    client = IosProvingClient.mock(onInitialized);
  }

  return new ProvingClient(
    client,
    contentKeyId,
    certChainPem,
    settings.production,
    onProofRequest,
  );
}

export type ProverContextValue = {
  provingClient: ProvingClient | null;
  provingTasks: ProvingTasksState;
  provingTasksCount: number;
  isInitializing: boolean;
  error: unknown;
};

export type ProofRequestContextValue = {
  isInitializing: boolean;
  error: unknown;
  fulfillementStatus: FulfillmentStatus;
  proof: ArrayBuffer | undefined;
};

export type ProvingTask = {
  photoPath: string;
  createdAtMs: number;
};

export type ProvingTasksState = Record<string, ProvingTask>;

type ProvingTasksAction =
  | { type: "reset" }
  | { type: "requested"; requestId: string; photoPath: string }
  | { type: "removed"; requestId: string };

function provingTasksReducer(
  state: ProvingTasksState,
  action: ProvingTasksAction,
): ProvingTasksState {
  switch (action.type) {
    case "reset":
      return {};
    case "requested":
      return {
        ...state,
        [action.requestId]: {
          photoPath: action.photoPath,
          createdAtMs: Date.now(),
        },
      };
    case "removed": {
      if (!(action.requestId in state)) return state;
      const { [action.requestId]: _removed, ...rest } = state;
      return rest;
    }
    default:
      return state;
  }
}

const ProverContext = createContext<ProverContextValue | null>(null);

export type ProverProviderProps = {
  children: React.ReactNode;
  /**
   * Provider configuration. The provider always initializes itself from these settings.
   */
  settings: Settings;

  onFulfilled?: (
    requestId: string,
    photoPath: string,
    proof: ArrayBuffer,
    provingClient: ProvingClient,
  ) => void;
  onUnfulfillable?: (requestId: string) => void;
};

export function ProverProvider({
  children,
  settings,
  onFulfilled,
  onUnfulfillable,
}: ProverProviderProps) {
  const [provingClient, setProvingClient] = useState<ProvingClient | null>(
    null,
  );
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const [provingTasks, dispatchProvingTasks] = useReducer(
    provingTasksReducer,
    {},
  );

  const provingTasksRef = useRef<ProvingTasksState>({});

  // Keep a ref to the latest tasks so async callbacks don't read stale state.
  useEffect(() => {
    provingTasksRef.current = provingTasks;
  }, [provingTasks]);

  const dispatchProvingTasksSync = (action: ProvingTasksAction) => {
    provingTasksRef.current = provingTasksReducer(
      provingTasksRef.current,
      action,
    );
    dispatchProvingTasks(action);
  };

  const provingTasksCount = useMemo(
    () => Object.keys(provingTasks).length,
    [provingTasks],
  );

  // Initialize proving client
  useEffect(() => {
    let cancelled = false;

    setIsInitializing(true);
    setError(null);
    setProvingClient(null);
    dispatchProvingTasksSync({ type: "reset" });

    (async () => {
      try {
        const provingClient = await createProvingClient(
          settings,
          {
            initialized: () => {
              if (cancelled) return;
              setProvingClient(provingClient);
              setIsInitializing(false);
            },
          },
          (requestId: string, photoPath: string) => {
            dispatchProvingTasksSync({
              type: "requested",
              requestId,
              photoPath,
            });
          },
        );
      } catch (e) {
        if (cancelled) return;
        setError(e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [settings]);

  // Poll the proving client to keep task statuses fresh.
  useEffect(() => {
    if (!provingClient) return;

    let cancelled = false;
    let inFlight = false;

    const pollOnce = async () => {
      if (cancelled) return;
      if (inFlight) return;

      const entries = Object.entries(provingTasksRef.current);
      if (entries.length === 0) return;

      inFlight = true;
      try {
        const results = await Promise.allSettled(
          entries.map(async ([requestId]) => {
            const status = await provingClient.getProofStatus(requestId);
            return { requestId, status };
          }),
        );

        if (cancelled) return;

        for (const r of results) {
          if (r.status !== "fulfilled") continue;

          const { requestId, status } = r.value;

          const task = provingTasksRef.current[requestId];
          if (!task) continue;

          if (status.fulfillmentStatus === FulfillmentStatus.Fulfilled) {
            dispatchProvingTasksSync({ type: "removed", requestId });

            if (onFulfilled) {
              if (!status.proof) {
                console.warn(
                  "[ZCAM1] Fulfilled proof request returned no proof bytes",
                  requestId,
                );
              } else {
                onFulfilled(
                  requestId,
                  task.photoPath,
                  status.proof,
                  provingClient,
                );
              }
            }
          } else if (
            status.fulfillmentStatus === FulfillmentStatus.Unfulfillable
          ) {
            dispatchProvingTasksSync({ type: "removed", requestId });

            if (onUnfulfillable) {
              onUnfulfillable(requestId);
            }
          }
        }
      } catch (e) {
        if (!cancelled) {
          console.error("[ZCAM1] ProvingTasksProvider polling failed", e);
        }
      } finally {
        inFlight = false;
      }
    };

    // Kick off once immediately, then poll on an interval.
    void pollOnce();
    const intervalId = setInterval(() => {
      void pollOnce();
    }, 1000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [provingClient, onFulfilled, onUnfulfillable]);

  const value = useMemo<ProverContextValue>(
    () => ({
      provingClient,
      provingTasks,
      provingTasksCount,
      isInitializing,
      error,
    }),
    [provingClient, provingTasks, provingTasksCount, isInitializing, error],
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

export function useProofRequestStatus(
  requestId: string | null,
): ProofRequestContextValue {
  const [fulfillementStatus, setFulfillementStatus] =
    useState<FulfillmentStatus>(FulfillmentStatus.UnspecifiedFulfillmentStatus);
  const [proof, setProof] = useState<ArrayBuffer | undefined>(undefined);
  const { provingClient, isInitializing, error } = useProver();

  useEffect(() => {
    let cancelled = false;

    // Reset per-request state when inputs change.
    setFulfillementStatus(FulfillmentStatus.UnspecifiedFulfillmentStatus);
    setProof(undefined);

    const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

    (async () => {
      if (!provingClient) return;
      if (!requestId) return;

      if (cancelled) return;

      while (!cancelled) {
        const status = await provingClient.getProofStatus(requestId);
        if (cancelled) return;

        setFulfillementStatus(status.fulfillmentStatus);

        if (status.fulfillmentStatus === FulfillmentStatus.Unfulfillable) {
          setProof(undefined);
          return;
        }

        if (status.fulfillmentStatus === FulfillmentStatus.Fulfilled) {
          // Depending on how your backend behaves, proof should be present on Fulfilled.
          if (!status.proof) {
            throw new Error("Fulfilled proof request returned no proof bytes");
          }

          setProof(status.proof);

          return;
        }

        await sleep(1000);
      }
    })().catch((e) => {
      if (!cancelled) {
        console.error("[ZCAM1] useProofRequestStatus failed", e);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [provingClient, requestId]);

  return {
    isInitializing,
    error,
    fulfillementStatus,
    proof,
  };
}

export class ProvingClient {
  client: IosProvingClientInterface;
  contentKeyId: Uint8Array;
  certChainPem: string;
  production: boolean;
  onProofRequest?: (requestId: string, photoPath: string) => void;

  constructor(
    client: IosProvingClientInterface,
    contentKeyId: Uint8Array,
    certChainPem: string,
    production: boolean,
    onProofRequest?: (requestId: string, photoPath: string) => void,
  ) {
    this.client = client;
    this.contentKeyId = contentKeyId;
    this.certChainPem = certChainPem;
    this.production = production;
    this.onProofRequest = onProofRequest;
  }

  /**
   * Embeds a cryptographic proof into an image file by modifying its C2PA manifest.
   * @param originalPath - Path to the original image file
   * @param deviceInfo - Device information for signing
   * @param settings - Configuration settings for proof generation
   * @returns Path to the new file with embedded proof
   */
  async requestProof(originalPath: string): Promise<string> {
    originalPath = originalPath.replace("file://", "");
    const format = formatFromPath(originalPath);

    if (format === undefined) {
      throw new Error(`Unsupported file format: ${originalPath}`);
    }

    const requestId = await this.client.requestProof(originalPath, format, {
      appAttestProduction: this.production,
    });

    if (this.onProofRequest) {
      this.onProofRequest(requestId, originalPath);
    }

    return requestId;
  }

  async getProofStatus(requestId: string): Promise<ProofRequestStatus> {
    return await this.client.getProofStatus(requestId);
  }

  /**
   * Embeds a cryptographic proof into an image file by modifying its C2PA manifest.
   * @param originalPath - Path to the original image file
   * @param deviceInfo - Device information for signing
   * @param settings - Configuration settings for proof generation
   * @returns Path to the new file with embedded proof
   */
  async embedProof(originalPath: string, proof: ArrayBuffer): Promise<string> {
    originalPath = originalPath.replace("file://", "");
    const format = formatFromPath(originalPath);
    const ext = Util.extname(originalPath);

    if (format === undefined) {
      throw new Error(`Unsupported file format: ${originalPath}`);
    }

    const manifestEditor = ManifestEditor.fromManifest(
      originalPath,
      this.contentKeyId.buffer as ArrayBuffer,
      this.certChainPem,
    );

    const vkHash = this.client.vkHash();

    // Include the proof to the C2PA manifest
    manifestEditor.addAssertion(
      "succinct.proof",
      JSON.stringify({
        data: base64.encode(new Uint8Array(proof)),
        vk_hash: vkHash,
      }),
    );

    const destinationPath =
      Dirs.CacheDir +
      `/zcam-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;

    // Embed the manifest to the photo
    await manifestEditor.embedManifestToFile(destinationPath, format);

    return destinationPath;
  }

  async waitAndEmbedProof(originalPath: string): Promise<string> {
    const requestId = await this.requestProof(originalPath);
    const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

    while (true) {
      const status = await this.getProofStatus(requestId);

      if (status.fulfillmentStatus === FulfillmentStatus.Unfulfillable) {
        throw new Error("The proof is unfulfillable");
      }

      if (status.fulfillmentStatus === FulfillmentStatus.Fulfilled) {
        return this.embedProof(originalPath, status.proof!);
      }

      await sleep(1000);
    }
  }
}
