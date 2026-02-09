import { createC2pa, Manifest, Reader } from "@contentauth/c2pa-web";

import wasmSrc from "@contentauth/c2pa-web/resources/c2pa.wasm?url";

import {
  computeHashFromBuffer,
  PhotoMetadataInfo,
  uniffiInitAsync,
  VideoMetadataInfo,
  AuthenticityStatus,
} from "./bindings";
import { utf8ToBytes, bytesToHex, concatBytes } from "@noble/hashes/utils.js";
import init, { verify_groth16 } from "@succinctlabs/sp1-wasm-verifier";
import { base64 } from "@scure/base";
import { decode } from "cbor2";
import { canonicalize } from "json-canonicalize";
import { sha256 } from "@noble/hashes/sha2.js";
import * as x509 from "@peculiar/x509";
import { fromBER } from "asn1js";
import { err, errAsync, ok, okAsync, Result, ResultAsync } from "neverthrow";

export {
  PhotoMetadataInfo,
  VideoMetadataInfo,
  AuthenticityStatus,
} from "./bindings";

export interface CaptureMetadata {
  when: string;
  parameters: PhotoMetadataInfo | VideoMetadataInfo;
}

const APPLE_ROOT_CERT =
  "MIICITCCAaegAwIBAgIQC/O+DvHN0uD7jG5yH2IXmDAKBggqhkjOPQQDAzBSMSYwJAYDVQQDDB1BcHBsZSBBcHAgQXR0ZXN0YXRpb24gUm9vdCBDQTETMBEGA1UECgwKQXBwbGUgSW5jLjETMBEGA1UECAwKQ2FsaWZvcm5pYTAeFw0yMDAzMTgxODMyNTNaFw00NTAzMTUwMDAwMDBaMFIxJjAkBgNVBAMMHUFwcGxlIEFwcCBBdHRlc3RhdGlvbiBSb290IENBMRMwEQYDVQQKDApBcHBsZSBJbmMuMRMwEQYDVQQIDApDYWxpZm9ybmlhMHYwEAYHKoZIzj0CAQYFK4EEACIDYgAERTHhmLW07ATaFQIEVwTtT4dyctdhNbJhFs/Ii2FdCgAHGbpphY3+d8qjuDngIN3WVhQUBHAoMeQ/cLiP1sOUtgjqK9auYen1mMEvRq9Sk3Jm5X8U62H+xTD3FE9TgS41o0IwQDAPBgNVHRMBAf8EBTADAQH/MB0GA1UdDgQWBBSskRBTM72+aEH/pwyp5frq5eWKoTAOBgNVHQ8BAf8EBAMCAQYwCgYIKoZIzj0EAwMDaAAwZQIwQgFGnByvsiVbpTKwSga0kP0e8EeDS4+sQmTvb7vn53O5+FRXgeLhpJ06ysC5PrOyAjEAp5U4xDgEgllF7En3VcE3iexZZtKeYnpqtijVoyFraWVIyd/dganmrduC1bmTBGwD";

const DEV_AA_GUID = bytesToHex(utf8ToBytes("appattestdevelop"));
const PROD_AA_GUID = bytesToHex(
  concatBytes(utf8ToBytes("appattest"), new Uint8Array(7)),
);

const c2pa = await createC2pa({ wasmSrc });

await uniffiInitAsync();
await init();

export class VerifiableFile {
  file: File;
  readerPromise: Promise<Reader | null>;
  cachedActiveManifest: Manifest | undefined;
  cachedHash: ArrayBuffer | undefined;

  /**
   * Creates a VerifiableFile instance by extracting the C2PA manifest from the file.
   * @param file - The file to verify
   */
  constructor(file: File) {
    this.file = file;
    this.readerPromise = c2pa.reader.fromBlob(file.type, file);
  }

  /**
   * Verifies the bindings assertion in a C2PA manifest by validating the attestation
   * and assertion against the photo hash and capture action metadata.
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
            const normalizedCaptureAction = canonicalize(captureAction);
            const clientData = computeClientData(
              photoHash,
              utf8ToBytes(normalizedCaptureAction),
            );

            return ResultAsync.fromSafePromise(
              validateAttestation(
                bindingsAssertion.attestation,
                bindingsAssertion.device_key_id,
                bindingsAssertion.device_key_id,
                bindingsAssertion.app_id,
                production,
                !production,
              ),
            )
              .andThen((r) => r)
              .andThen((publicKey) =>
                ResultAsync.fromSafePromise(
                  validateAssertion(
                    bindingsAssertion.assertion,
                    clientData,
                    publicKey,
                    bindingsAssertion.app_id,
                  ),
                ),
              )
              .andThen((r) => r);
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
            const appIdBytes = utf8ToBytes(appId);
            const appleRootCert = utf8ToBytes(APPLE_ROOT_CERT);
            let publicInputs = concatBytes(
              photoHash,
              appIdBytes,
              appleRootCert,
            );

            const isValid = verify_groth16(
              base64.decode(proofAssertion["data"]),
              publicInputs,
              proofAssertion["vk_hash"],
            );

            return okAsync(isValid);
          },
        );
      });
  }

  /**
   * Computes the content hash of the file.
   * @returns The file's content hash as a Uint8Array
   */
  async dataHash(): Promise<Uint8Array> {
    if (this.cachedHash === undefined) {
      const fileBuffer = await this.file.arrayBuffer();
      this.cachedHash = computeHashFromBuffer(fileBuffer, this.file.type);
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
   * Determines the authenticity status of the file based on its C2PA manifest.
   *
   * @returns The file's authenticity status:
   *   - `Bindings`: File contains a bindings assertion
   *   - `Proof`: File contains a proof assertion
   *   - `InvalidManifest`: Manifest exists but lacks required assertions
   */
  authenticityStatus(): ResultAsync<AuthenticityStatus, Error> {
    return this.extractActiveManifest().andThen((manifest) => {
      if (retrieveAssertion(manifest, "succinct.bindings").isOk()) {
        return okAsync(AuthenticityStatus.Bindings);
      }
      if (retrieveAssertion(manifest, "succinct.proof").isOk()) {
        return okAsync(AuthenticityStatus.Proof);
      }

      return okAsync(AuthenticityStatus.InvalidManifest);
    });
  }

  /**
   * Returns the underlying C2PA Reader for the file.
   * @returns The C2PA Reader, or an error if no C2PA metadata is found
   */
  c2paReader(): ResultAsync<Reader, Error> {
    return ResultAsync.fromSafePromise(this.readerPromise).andThen((reader) => {
      if (reader) return okAsync(reader);
      else return errAsync(new Error("No C2PA metadata found"));
    });
  }

  private extractActiveManifest(): ResultAsync<Manifest, Error> {
    if (this.cachedActiveManifest) {
      return okAsync(this.cachedActiveManifest);
    }

    return this.c2paReader()
      .map((reader) => reader.manifestStore())
      .andThen((store) => {
        if (store.active_manifest) {
          this.cachedActiveManifest = store.manifests[store.active_manifest];
          return okAsync(this.cachedActiveManifest);
        } else return err(new Error("No active manifest found"));
      });
  }
}

function retrieveAction<T = Record<string, any>>(
  manifest: Manifest,
  label: string,
): Result<T, Error> {
  return retrieveAssertion(manifest, "c2pa.actions.v2").andThen(
    (actionsAssertion) => {
      for (const a of actionsAssertion.actions) {
        if (a.action === label) {
          return ok(a);
        }
      }

      return err(new Error(`Action ${label} not found`));
    },
  );
}

function retrieveAssertion(
  manifest: Manifest,
  label: string,
): Result<Record<string, any>, Error> {
  if (manifest.assertions) {
    for (const a of manifest.assertions) {
      if (a.label === label) {
        return ok(a.data as any);
      }
    }
  }

  return err(new Error(`Assertion ${label} not found`));
}

function computeClientData(
  photoHash: Uint8Array,
  normalizedMetadata: Uint8Array,
): string {
  const metadataHash = sha256(normalizedMetadata);

  return `${base64.encode(photoHash)}|${base64.encode(metadataHash)}`;
}

async function validateAttestation(
  attestation: string,
  challenge: string,
  keyId: string,
  appId: string,
  production: boolean,
  leafCertOnly: boolean,
): Promise<Result<CryptoKey, Error>> {
  const decodedAttestation: any = decode(base64.decode(attestation));

  if (
    decodedAttestation.fmt !== "apple-appattest" ||
    decodedAttestation.attStmt?.x5c?.length !== 2 ||
    !decodedAttestation.attStmt?.receipt ||
    !decodedAttestation.authData
  ) {
    return errAsync(new Error("Invalid attestation"));
  }

  const { authData, attStmt } = decodedAttestation;

  // 1. Verify certificate chain
  const certificates: x509.X509Certificate[] = attStmt.x5c.map(
    (data: any) => new x509.X509Certificate(data),
  );

  const subCaCertificate = certificates.find(
    (certificate) =>
      certificate.subject.indexOf("Apple App Attestation CA 1") !== -1,
  );

  if (!subCaCertificate) {
    throw new Error("No sub CA certificate found");
  }

  const clientCertificate = certificates.find(
    (certificate) =>
      certificate.subject.indexOf("Apple App Attestation CA 1") === -1,
  );

  if (!clientCertificate) {
    throw new Error("No client CA certificate found");
  }

  if (!clientCertificate.verify({ publicKey: subCaCertificate.publicKey })) {
    throw new Error(
      "Client CA certificate is not signed by Apple App Attestation CA 1",
    );
  }

  // 2. Create clientDataHash
  const clientDataHash = sha256(utf8ToBytes(challenge));

  // 3. Generate nonce
  const nonceData = concatBytes(decodedAttestation.authData, clientDataHash);
  const nonce = sha256(nonceData);

  // 4. Obtain credential cert extension with OID 1.2.840.113635.100.8.2 and compare with nonce.
  const extension = clientCertificate.extensions.find(
    (v) => v.type === "1.2.840.113635.100.8.2",
  );

  if (!extension) {
    throw new Error("No 1.2.840.113635.100.8.2 extension found");
  }

  const parsedExtension: any = fromBER(extension.value);
  const actualNonce =
    parsedExtension.result.valueBlock.value[0].valueBlock.value[0].valueBlock
      .valueHexView;

  if (bytesToHex(actualNonce) !== bytesToHex(nonce)) {
    throw new Error("Nonce does not match");
  }

  // 5. Get sha256 hash of the credential public key
  const cryptoPublicKey = await clientCertificate.publicKey.export();
  const rawPublicKey = await crypto.subtle.exportKey("raw", cryptoPublicKey);
  const rawPublicKeyBytes = new Uint8Array(rawPublicKey);
  const rawPublicKeyHash = sha256(rawPublicKeyBytes);

  if (keyId !== base64.encode(rawPublicKeyHash)) {
    throw new Error("keyId does not match");
  }

  // 6. Verify RP ID hash.
  const appIdHash = sha256(utf8ToBytes(appId));
  const rpIdHash = authData.subarray(0, 32);

  if (base64.encode(appIdHash) !== base64.encode(rpIdHash)) {
    throw new Error("App Id does not match");
  }

  // 7. Verify counter
  const view = new DataView(authData.buffer, authData.byteOffset);
  const signCount = view.getInt32(33, false);

  if (signCount !== 0) {
    throw new Error("signCount is not 0");
  }

  // 8. Very aaguid is present and is 16 bytes, if production \x61\x70\x70\x61\x74\x74\x65\x73\x74\x00\x00\x00\x00\x00\x00\x00 or appattestdevelop if dev
  const aaguid = bytesToHex(authData.subarray(37, 53));

  if (production) {
    if (aaguid !== PROD_AA_GUID) {
      throw new Error("aaguid is not valid");
    }
  } else {
    if (aaguid !== DEV_AA_GUID) {
      throw new Error("aaguid is not valid");
    }
  }

  return ok(cryptoPublicKey);
}

async function validateAssertion(
  assertion: string,
  clientData: string,
  publicKey: CryptoKey,
  appId: string,
): Promise<Result<boolean, Error>> {
  const decodedAssertion: any = decode(base64.decode(assertion));
  const { signature, authenticatorData } = decodedAssertion;

  // 1. sha256 hash the clientData
  const clientDataHash = sha256(utf8ToBytes(clientData));

  // 2. Create nonce
  const nonce = sha256(concatBytes(authenticatorData, clientDataHash));

  // 3. Verify signature over nonce
  const isSignatureValid = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    publicKey,
    ecdsaDerToRaw(signature),
    nonce as Uint8Array<ArrayBuffer>,
  );

  if (!isSignatureValid) {
    throw new Error("Invalid signature");
  }

  // 4. Verify RP ID
  const appIdHash = sha256(utf8ToBytes(appId));
  const rpIdHash = authenticatorData.subarray(0, 32);

  if (base64.encode(appIdHash) !== base64.encode(rpIdHash)) {
    throw new Error("App Id does not match");
  }

  return ok(true);
}

function ecdsaDerToRaw(der: Uint8Array, size = 32): Uint8Array<ArrayBuffer> {
  const view = der.buffer.slice(
    der.byteOffset,
    der.byteOffset + der.byteLength,
  ) as ArrayBuffer;
  const { result } = fromBER(view);
  const values = (result as any).valueBlock.value;

  if (!Array.isArray(values) || values.length !== 2) {
    throw new Error("Invalid ECDSA DER signature");
  }

  const r = new Uint8Array(values[0].valueBlock.valueHexView);
  const s = new Uint8Array(values[1].valueBlock.valueHexView);

  const out = new Uint8Array(size * 2);
  out.set(
    r.slice(Math.max(0, r.length - size)),
    size - Math.min(size, r.length),
  );
  out.set(
    s.slice(Math.max(0, s.length - size)),
    size * 2 - Math.min(size, s.length),
  );
  return out;
}
