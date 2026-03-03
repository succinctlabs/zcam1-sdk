import { Reader } from "@contentauth/c2pa-node";
import type { Manifest } from "@contentauth/c2pa-types";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

import {
  computeHashFromBuffer,
  AuthenticityStatus,
  uniffiInitAsync,
} from "./bindings.node";
import init from "@succinctlabs/sp1-wasm-verifier";
import {
  CaptureMetadata,
  retrieveAssertion,
  retrieveAction,
  verifyBindingsAssertion,
  verifyProofAssertion,
} from "./core";
import { errAsync, okAsync, Result, ResultAsync } from "neverthrow";

export {
  PhotoMetadataInfo,
  VideoMetadataInfo,
  AuthenticityStatus,
} from "./bindings.node";

export type { CaptureMetadata } from "./core";

await uniffiInitAsync();

// Node.js fetch does not support file:// URLs, so we load the WASM bytes
// directly from disk using createRequire to resolve the package path.
const _require = createRequire(import.meta.url);
const sp1WasmBytes = readFileSync(
  _require.resolve("@succinctlabs/sp1-wasm-verifier/sp1_wasm_verifier_bg.wasm"),
);
await init({ module_or_path: sp1WasmBytes });

export class VerifiableBuffer {
  buffer: Buffer;
  mimeType: string;
  cachedActiveManifest: Manifest | undefined;
  cachedHash: ArrayBuffer | undefined;

  /**
   * Creates a VerifiableBuffer instance for Node.js C2PA manifest extraction.
   * @param buffer - The file data as a Node.js Buffer
   * @param mimeType - The MIME type of the file (e.g. "image/jpeg")
   */
  constructor(buffer: Buffer, mimeType: string) {
    this.buffer = buffer;
    this.mimeType = mimeType;
  }

  /**
   * Verifies the bindings assertion in a C2PA manifest by validating the attestation
   * and assertion against the data hash and capture action metadata.
   *
   * @param production - Whether to use production or development Apple App Attestation GUID
   * @returns true if the bindings are valid, or an error
   */
  verifyBindings(production: boolean): ResultAsync<boolean, Error> {
    return this.extractActiveManifest()
      .andThen((manifest) => {
        return Result.combine([
          retrieveAssertion(manifest, "succinct.bindings"),
          retrieveAction(manifest, "succinct.capture"),
        ]);
      })
      .andThen(([bindingsAssertion, captureAction]) => {
        return ResultAsync.fromSafePromise(this.dataHash()).andThen(
          (photoHash) => {
            return verifyBindingsAssertion(
              bindingsAssertion,
              captureAction,
              photoHash,
              production,
            );
          },
        );
      });
  }

  /**
   * Verifies the zero-knowledge proof assertion in a C2PA manifest using Groth16 verification.
   *
   * @param appId - The application identifier to include in the public inputs
   * @returns A promise that resolves to true if the proof is valid, false otherwise
   */
  verifyProof(appId: string): ResultAsync<boolean, Error> {
    return this.extractActiveManifest()
      .andThen((manifest) => retrieveAssertion(manifest, "succinct.proof"))
      .andThen((proofAssertion) => {
        return ResultAsync.fromSafePromise(this.dataHash()).andThen(
          (photoHash) => {
            return verifyProofAssertion(proofAssertion, photoHash, appId);
          },
        );
      });
  }

  /**
   * Computes the content hash of the buffer.
   * @returns The content hash as a Uint8Array
   */
  async dataHash(): Promise<Uint8Array> {
    if (this.cachedHash === undefined) {
      // buffer.buffer may be a SharedArrayBuffer; copy to plain ArrayBuffer
      const ab = this.buffer.buffer.slice(
        this.buffer.byteOffset,
        this.buffer.byteOffset + this.buffer.byteLength,
      ) as ArrayBuffer;
      this.cachedHash = computeHashFromBuffer(ab, this.mimeType);
    }

    return new Uint8Array(this.cachedHash);
  }

  /**
   * Extracts the capture metadata from a C2PA manifest, including timestamp and capture parameters.
   *
   * @returns A promise that resolves to the capture metadata containing when and parameters information
   */
  captureMetadata(): ResultAsync<CaptureMetadata, Error> {
    return this.extractActiveManifest().andThen((manifest) =>
      retrieveAction<CaptureMetadata>(manifest, "succinct.capture"),
    );
  }

  /**
   * Determines the authenticity status of the buffer based on its C2PA manifest.
   *
   * @returns The buffer's authenticity status:
   *   - `Bindings`: Contains a bindings assertion
   *   - `Proof`: Contains a proof assertion
   *   - `InvalidManifest`: Manifest exists but lacks required assertions
   *   - `NoManifest`: No C2PA metadata found
   */
  async authenticityStatus(): Promise<AuthenticityStatus> {
    const activeManifest = await this.extractActiveManifest();

    if (activeManifest.isErr()) {
      const msg = activeManifest.error.message;
      if (msg === "No C2PA metadata found") {
        return AuthenticityStatus.NoManifest;
      }
      return AuthenticityStatus.InvalidManifest;
    }

    const manifest = activeManifest.value;

    if (retrieveAssertion(manifest, "succinct.bindings").isOk()) {
      return AuthenticityStatus.Bindings;
    }
    if (retrieveAssertion(manifest, "succinct.proof").isOk()) {
      return AuthenticityStatus.Proof;
    }

    return AuthenticityStatus.InvalidManifest;
  }

  bindings(): ResultAsync<Record<string, any>, Error> {
    return this.extractActiveManifest().andThen((manifest) =>
      retrieveAssertion(manifest, "succinct.bindings"),
    );
  }

  proof(): ResultAsync<Record<string, any>, Error> {
    return this.extractActiveManifest().andThen((manifest) =>
      retrieveAssertion(manifest, "succinct.proof"),
    );
  }

  private extractActiveManifest(): ResultAsync<Manifest, Error> {
    if (this.cachedActiveManifest) {
      return okAsync(this.cachedActiveManifest);
    }

    return ResultAsync.fromSafePromise(
      Reader.fromAsset({ buffer: this.buffer, mimeType: this.mimeType }),
    ).andThen((reader) => {
      if (!reader) return errAsync(new Error("No C2PA metadata found"));

      const store = reader.json();
      if (!store.active_manifest)
        return errAsync(new Error("No active manifest found"));

      this.cachedActiveManifest = store.manifests[store.active_manifest];
      return okAsync(this.cachedActiveManifest);
    });
  }
}
