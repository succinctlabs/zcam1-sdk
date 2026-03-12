import { utf8ToBytes } from "@noble/hashes/utils.js";
import { base64 } from "@scure/base";
import { Platform } from "react-native";
import { isEmulatorSync } from "react-native-device-info";

import {
  computeHash,
  extractManifest,
  type ManifestInterface,
  PhotoMetadataInfo,
  verifyBindingsFromManifest,
  verifyGroth16,
  VideoMetadataInfo,
} from "./bindings";

/**
 * Capture metadata extracted from the C2PA manifest.
 * Contains device info and camera settings at capture time.
 */
export interface CaptureMetadata {
  action: string;
  when: string;
  parameters: PhotoMetadataInfo | VideoMetadataInfo;
}

export const APPLE_ROOT_CERT =
  "MIICITCCAaegAwIBAgIQC/O+DvHN0uD7jG5yH2IXmDAKBggqhkjOPQQDAzBSMSYwJAYDVQQDDB1BcHBsZSBBcHAgQXR0ZXN0YXRpb24gUm9vdCBDQTETMBEGA1UECgwKQXBwbGUgSW5jLjETMBEGA1UECAwKQ2FsaWZvcm5pYTAeFw0yMDAzMTgxODMyNTNaFw00NTAzMTUwMDAwMDBaMFIxJjAkBgNVBAMMHUFwcGxlIEFwcCBBdHRlc3RhdGlvbiBSb290IENBMRMwEQYDVQQKDApBcHBsZSBJbmMuMRMwEQYDVQQIDApDYWxpZm9ybmlhMHYwEAYHKoZIzj0CAQYFK4EEACIDYgAERTHhmLW07ATaFQIEVwTtT4dyctdhNbJhFs/Ii2FdCgAHGbpphY3+d8qjuDngIN3WVhQUBHAoMeQ/cLiP1sOUtgjqK9auYen1mMEvRq9Sk3Jm5X8U62H+xTD3FE9TgS41o0IwQDAPBgNVHRMBAf8EBTADAQH/MB0GA1UdDgQWBBSskRBTM72+aEH/pwyp5frq5eWKoTAOBgNVHQ8BAf8EBAMCAQYwCgYIKoZIzj0EAwMDaAAwZQIwQgFGnByvsiVbpTKwSga0kP0e8EeDS4+sQmTvb7vn53O5+FRXgeLhpJ06ysC5PrOyAjEAp5U4xDgEgllF7En3VcE3iexZZtKeYnpqtijVoyFraWVIyd/dganmrduC1bmTBGwD";

/// Google Hardware Attestation Root CA - RSA 4096
/// Serial: f92009e853b6b045
/// Valid: 2022-03-20 to 2042-03-15
/// Used by devices with factory-provisioned attestation keys
export const GOOGLE_HARDWARE_ROOT_RSA = `-----BEGIN CERTIFICATE-----
MIIFHDCCAwSgAwIBAgIJAPHBcqaZ6vUdMA0GCSqGSIb3DQEBCwUAMBsxGTAXBgNV
BAUTEGY5MjAwOWU4NTNiNmIwNDUwHhcNMjIwMzIwMTgwNzQ4WhcNNDIwMzE1MTgw
NzQ4WjAbMRkwFwYDVQQFExBmOTIwMDllODUzYjZiMDQ1MIICIjANBgkqhkiG9w0B
AQEFAAOCAg8AMIICCgKCAgEAr7bHgiuxpwHsK7Qui8xUFmOr75gvMsd/dTEDDJdS
Sxtf6An7xyqpRR90PL2abxM1dEqlXnf2tqw1Ne4Xwl5jlRfdnJLmN0pTy/4lj4/7
tv0Sk3iiKkypnEUtR6WfMgH0QZfKHM1+di+y9TFRtv6y//0rb+T+W8a9nsNL/ggj
nar86461qO0rOs2cXjp3kOG1FEJ5MVmFmBGtnrKpa73XpXyTqRxB/M0n1n/W9nGq
C4FSYa04T6N5RIZGBN2z2MT5IKGbFlbC8UrW0DxW7AYImQQcHtGl/m00QLVWutHQ
oVJYnFPlXTcHYvASLu+RhhsbDmxMgJJ0mcDpvsC4PjvB+TxywElgS70vE0XmLD+O
JtvsBslHZvPBKCOdT0MS+tgSOIfga+z1Z1g7+DVagf7quvmag8jfPioyKvxnK/Eg
sTUVi2ghzq8wm27ud/mIM7AY2qEORR8Go3TVB4HzWQgpZrt3i5MIlCaY504LzSRi
igHCzAPlHws+W0rB5N+er5/2pJKnfBSDiCiFAVtCLOZ7gLiMm0jhO2B6tUXHI/+M
RPjy02i59lINMRRev56GKtcd9qO/0kUJWdZTdA2XoS82ixPvZtXQpUpuL12ab+9E
aDK8Z4RHJYYfCT3Q5vNAXaiWQ+8PTWm2QgBR/bkwSWc+NpUFgNPN9PvQi8WEg5Um
AGMCAwEAAaNjMGEwHQYDVR0OBBYEFDZh4QB8iAUJUYtEbEf/GkzJ6k8SMB8GA1Ud
IwQYMBaAFDZh4QB8iAUJUYtEbEf/GkzJ6k8SMA8GA1UdEwEB/wQFMAMBAf8wDgYD
VR0PAQH/BAQDAgIEMA0GCSqGSIb3DQEBCwUAA4ICAQB8cMqTllHc8U+qCrOlg3H7
174lmaCsbo/bJ0C17JEgMLb4kvrqsXZs01U3mB/qABg/1t5Pd5AORHARs1hhqGIC
W/nKMav574f9rZN4PC2ZlufGXb7sIdJpGiO9ctRhiLuYuly10JccUZGEHpHSYM2G
tkgYbZba6lsCPYAAP83cyDV+1aOkTf1RCp/lM0PKvmxYN10RYsK631jrleGdcdkx
oSK//mSQbgcWnmAEZrzHoF1/0gso1HZgIn0YLzVhLSA/iXCX4QT2h3J5z3znluKG
1nv8NQdxei2DIIhASWfu804CA96cQKTTlaae2fweqXjdN1/v2nqOhngNyz1361mF
mr4XmaKH/ItTwOe72NI9ZcwS1lVaCvsIkTDCEXdm9rCNPAY10iTunIHFXRh+7KPz
lHGewCq/8TOohBRn0/NNfh7uRslOSZ/xKbN9tMBtw37Z8d2vvnXq/YWdsm1+JLVw
n6yYD/yacNJBlwpddla8eaVMjsF6nBnIgQOf9zKSe06nSTqvgwUHosgOECZJZ1Eu
zbH4yswbt02tKtKEFhx+v+OTge/06V+jGsqTWLsfrOCNLuA8H++z+pUENmpqnnHo
vaI47gC+TNpkgYGkkBT6B/m/U01BuOBBTzhIlMEZq9qkDWuM2cA5kW5V3FJUcfHn
w1IdYIg2Wxg7yHcQZemFQg==
-----END CERTIFICATE-----`;

/// Google Hardware Attestation Root CA - ECDSA P-384
/// Subject: Key Attestation CA1, Android, Google LLC
/// Valid: 2025-07-17 to 2035-07-15
/// Effective February 1, 2026 for RKP-enabled devices
export const GOOGLE_HARDWARE_ROOT_EC = `-----BEGIN CERTIFICATE-----
MIICIjCCAaigAwIBAgIRAISp0Cl7DrWK5/8OgN52BgUwCgYIKoZIzj0EAwMwUjEc
MBoGA1UEAwwTS2V5IEF0dGVzdGF0aW9uIENBMTEQMA4GA1UECwwHQW5kcm9pZDET
MBEGA1UECgwKR29vZ2xlIExMQzELMAkGA1UEBhMCVVMwHhcNMjUwNzE3MjIzMjE4
WhcNMzUwNzE1MjIzMjE4WjBSMRwwGgYDVQQDDBNLZXkgQXR0ZXN0YXRpb24gQ0Ex
MRAwDgYDVQQLDAdBbmRyb2lkMRMwEQYDVQQKDApHb29nbGUgTExDMQswCQYDVQQG
EwJVUzB2MBAGByqGSM49AgEGBSuBBAAiA2IABCPaI3FO3z5bBQo8cuiEas4HjqCt
G/mLFfRT0MsIssPBEEU5Cfbt6sH5yOAxqEi5QagpU1yX4HwnGb7OtBYpDTB57uH5
Eczm34A5FNijV3s0/f0UPl7zbJcTx6xwqMIRq6NCMEAwDwYDVR0TAQH/BAUwAwEB
/zAOBgNVHQ8BAf8EBAMCAQYwHQYDVR0OBBYEFFIyuyz7RkOb3NaBqQ5lZuA0QepA
MAoGCCqGSM49BAMDA2gAMGUCMETfjPO/HwqReR2CS7p0ZWoD/LHs6hDi422opifH
EUaYLxwGlT9SLdjkVpz0UUOR5wIxAIoGyxGKRHVTpqpGRFiJtQEOOTp/+s1GcxeY
uR2zh/80lQyu9vAFCj6E4AXc+osmRg==
-----END CERTIFICATE-----`;

/// Google Software Attestation Root CA (for emulator/software keys)
/// EXPIRED: Jan 8, 2026 - only use when production=false
export const GOOGLE_SOFTWARE_ROOT = `-----BEGIN CERTIFICATE-----
MIICizCCAjKgAwIBAgIJAKIFntEOQ1tXMAoGCCqGSM49BAMCMIGiMQswCQYDVQQG
EwJVUzETMBEGA1UECAwKQ2FsaWZvcm5pYTEWMBQGA1UEBwwNTW91bnRhaW4gVmll
dzEVMBMGA1UECgwMR29vZ2xlLCBJbmMuMRAwDgYDVQQLDAdBbmRyb2lkMTswOQYD
VQQDDDJBbmRyb2lkIEtleXN0b3JlIFNvZnR3YXJlIEF0dGVzdGF0aW9uIFJvb3Qg
Q0EgLSBHMDAeFw0xNjAxMTEwMDQ2MDlaFw0yNjAxMDgwMDQ2MDlaMIGiMQswCQYD
VQQGEwJVUzETMBEGA1UECAwKQ2FsaWZvcm5pYTEWMBQGA1UEBwwNTW91bnRhaW4g
VmlldzEVMBMGA1UECgwMR29vZ2xlLCBJbmMuMRAwDgYDVQQLDAdBbmRyb2lkMTsw
OQYDVQQDDDJBbmRyb2lkIEtleXN0b3JlIFNvZnR3YXJlIEF0dGVzdGF0aW9uIFJv
b3QgQ0EgLSBHMDBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABGqY1l/nL8BlGM/2
4IclS7ejVYDkjBQHULfvEkXfPfUW7UzBmjMD6zBMJwa3j0YBk6MdsbQBjvnW0hTl
c7tU1YqjYzBhMB0GA1UdDgQWBBQ//ld0vmWK0gwLo5E6RYhL8U0t5DAfBgNVHSME
GDAWgBQ//ld0vmWK0gwLo5E6RYhL8U0t5DAPBgNVHRMBAf8EBTADAQH/MA4GA1Ud
DwEB/wQEAwICBDAKBggqhkjOPQQDAgNHADBEAiBVj8Yv2bXJrHEBLYCpIBJOIFMS
0HS8PIFiJLdTbSeSSAIgMKH/dv4l4DZNN9ci40kdSK28SYKfyKiLzCTp66W4cSE=
-----END CERTIFICATE-----`;

/**
 * Represents a file with a C2PA manifest that can be verified for authenticity.
 */
export class VerifiableFile {
  path: string;
  activeManifest: ManifestInterface;
  hash: ArrayBuffer | undefined;

  /**
   * Creates a VerifiableFile instance by extracting the C2PA manifest from the file.
   * @param path - Path to the file to verify
   */
  constructor(path: string) {
    const store = extractManifest(path);

    this.path = path;
    this.activeManifest = store.activeManifest();
  }

  /**
   * Verifies the manifest's bindings.
   * On iOS: validates Apple App Attest attestation + assertion.
   * On Android: validates Android Key Attestation chain + ECDSA signature.
   */
  verifyBindings(production: boolean): boolean {
    if (this.hash === undefined) {
      this.hash = computeHash(this.path);
    }

    const bindings = this.activeManifest.bindings()!;
    const metadata = this.activeManifest.captureMetadataAction()!;

    return verifyBindingsFromManifest(bindings, metadata, this.hash, production);
  }

  /**
   * Verifies the cryptographic proof embedded in the C2PA manifest.
   * @returns True if the proof is valid, false otherwise
   */
  verifyProof(appId: string): boolean {
    return verifyProofFromManifest(this.activeManifest, this.path, appId);
  }

  /**
   * Returns the file's content hash as recorded in the active C2PA manifest.
   * @returns The manifest data hash (base64-encoded string)
   */
  dataHash(): string | undefined {
    if (this.hash === undefined) {
      this.hash = computeHash(this.path);
    }

    return base64.encode(new Uint8Array(this.hash!));
  }

  /**
   * Returns the capture metadata from the C2PA manifest.
   * Contains device info and camera settings recorded at capture time.
   * @returns The capture metadata, or null if not present
   */
  captureMetadata(): CaptureMetadata | null {
    const actionJson = this.activeManifest.captureMetadataAction();
    if (!actionJson) return null;
    return JSON.parse(actionJson) as CaptureMetadata;
  }
}

function verifyProofFromManifest(
  activeManifest: ManifestInterface,
  path: string,
  appId: string,
): boolean {
  const proof = activeManifest.proof();

  if (proof === undefined) {
    throw new Error("The proof was not found in the manifest");
  }

  const hash = new Uint8Array(computeHash(path));
  const appIdBytes = utf8ToBytes(appId);
  let rootCert = undefined;

  switch (Platform.OS) {
    case "android":
      if (isEmulatorSync()) {
        rootCert = utf8ToBytes(GOOGLE_SOFTWARE_ROOT);
      } else {
        rootCert = utf8ToBytes(GOOGLE_HARDWARE_ROOT_RSA + GOOGLE_HARDWARE_ROOT_EC);
      }
      break;

    case "macos":
    case "ios":
      rootCert = utf8ToBytes(APPLE_ROOT_CERT);
      break;

    default:
      rootCert = new Uint8Array();
  }

  const publicInputs = new Uint8Array(hash.length + appIdBytes.length + rootCert.length);
  publicInputs.set(hash);
  publicInputs.set(appIdBytes, hash.length);
  publicInputs.set(rootCert, hash.length + appIdBytes.length);

  return verifyGroth16(
    base64.decode(proof.data).buffer as ArrayBuffer,
    publicInputs.buffer,
    proof.vkHash,
  );
}
