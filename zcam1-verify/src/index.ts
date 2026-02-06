import { createC2pa, Manifest } from "@contentauth/c2pa-web";

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
  hash: ArrayBuffer | undefined;

  /**
   * Creates a VerifiableFile instance by extracting the C2PA manifest from the file.
   * @param file - The file to verify
   */
  constructor(file: File) {
    this.file = file;
  }

  /**
   * Verifies the bindings assertion in a C2PA manifest by validating the attestation
   * and assertion against the photo hash and capture action metadata.
   *
   * @param production - Whether to use production or development Apple App Attestation GUID
   * @returns A promise that resolves to true if the bindings are valid, throws an error otherwise
   */
  async verifyBindings(production: boolean): Promise<boolean> {
    const activeManifest = await extractActiveManifest(this.file);
    const bindingsAssertion = retrieveAssertion(
      activeManifest,
      "succinct.bindings",
    );
    const fileBuffer = await this.file.arrayBuffer();
    const photoHash = new Uint8Array(
      computeHashFromBuffer(fileBuffer, this.file.type),
    );

    const captureAction = retrieveAction(activeManifest, "succinct.capture");
    const normalizedCaptureAction = canonicalize(captureAction);
    const clientData = computeClientData(
      photoHash,
      utf8ToBytes(normalizedCaptureAction),
    );

    const publicKey = await validateAttestation(
      bindingsAssertion.attestation,
      bindingsAssertion.device_key_id,
      bindingsAssertion.device_key_id,
      bindingsAssertion.app_id,
      production,
      !production,
    );

    return await validateAssertion(
      bindingsAssertion.assertion,
      clientData,
      publicKey,
      bindingsAssertion.app_id,
    );
  }

  /**
   * Verifies the zero-knowledge proof assertion in a C2PA manifest using Groth16 verification.
   *
   * @param appId - The application identifier to include in the public inputs
   * @returns A promise that resolves to true if the proof is valid, false otherwise
   */
  async verifyProof(appId: string): Promise<boolean> {
    const activeManifest = await extractActiveManifest(this.file);
    const proofAssertion = retrieveAssertion(activeManifest, "succinct.proof");
    const fileBuffer = await this.file.arrayBuffer();
    const photoHash = new Uint8Array(
      computeHashFromBuffer(fileBuffer, this.file.type),
    );
    const appIdBytes = utf8ToBytes(appId);
    const appleRootCert = utf8ToBytes(APPLE_ROOT_CERT);
    let publicInputs = concatBytes(photoHash, appIdBytes, appleRootCert);

    return verify_groth16(
      base64.decode(proofAssertion["data"]),
      publicInputs,
      proofAssertion["vk_hash"],
    );
  }

  /**
   * Returns the file's content hash as recorded in the active C2PA manifest.
   * @returns The manifest data hash (base64-encoded string)
   */
  async dataHash(): Promise<string> {
    if (this.hash === undefined) {
      const fileBuffer = await this.file.arrayBuffer();
      this.hash = computeHashFromBuffer(fileBuffer, this.file.type);
    }

    return base64.encode(new Uint8Array(this.hash));
  }

  /**
   * Extracts the capture metadata from a C2PA manifest, including timestamp and capture parameters.
   *
   * @returns A promise that resolves to the capture metadata containing when and parameters information
   */
  async captureMetadata(): Promise<CaptureMetadata> {
    const manifest = await extractActiveManifest(this.file);
    return await retrieveAction(manifest, "succinct.capture");
  }

  /**
   * Determines the authenticity status of the file based on its C2PA manifest.
   *
   * @returns A promise that resolves to the file's authenticity status:
   *   - `Bindings`: File contains a bindings assertion
   *   - `Proof`: File contains a proof assertion
   *   - `InvalidManifest`: Manifest exists but lacks required assertions
   *   - `NoManifest`: No C2PA manifest found
   */
  async authenticityStatus(): Promise<AuthenticityStatus> {
    return extractActiveManifest(this.file)
      .then((manifest) => {
        try {
          retrieveAssertion(manifest, "succinct.bindings");
          return AuthenticityStatus.Bindings;
        } catch {}
        try {
          retrieveAssertion(manifest, "succinct.proof");
          return AuthenticityStatus.Proof;
        } catch {}

        return AuthenticityStatus.InvalidManifest;
      })
      .catch(() => AuthenticityStatus.NoManifest);
  }
}

async function extractActiveManifest(file: File): Promise<Manifest> {
  const reader = await c2pa.reader.fromBlob(file.type, file);

  if (!reader) {
    throw new Error("The provided file doesn't contain C2PA metadata");
  }

  let store = await reader.manifestStore();

  if (!store.active_manifest) {
    throw new Error("The provided file doesn't contain a C2PA manifest");
  }

  return store.manifests[store.active_manifest];
}

function retrieveAction(manifest: Manifest, label: string): any {
  const actionsAssertion = retrieveAssertion(manifest, "c2pa.actions.v2");
  for (const a of actionsAssertion.actions) {
    if (a.action === label) {
      return a;
    }
  }

  throw new Error(`The provided file doesn't contain a ${label} action`);
}

function retrieveAssertion(manifest: Manifest, label: string): any {
  if (manifest.assertions) {
    for (const a of manifest.assertions) {
      if (a.label === label) {
        return a.data;
      }
    }
  }

  throw new Error(`The provided file doesn't contain a ${label} assertion`);
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
): Promise<CryptoKey> {
  const decodedAttestation: any = decode(base64.decode(attestation));

  if (
    decodedAttestation.fmt !== "apple-appattest" ||
    decodedAttestation.attStmt?.x5c?.length !== 2 ||
    !decodedAttestation.attStmt?.receipt ||
    !decodedAttestation.authData
  ) {
    throw new Error("Invalid attestation");
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

  return cryptoPublicKey;
}

async function validateAssertion(
  assertion: string,
  clientData: string,
  publicKey: CryptoKey,
  appId: string,
): Promise<boolean> {
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

  return true;
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
