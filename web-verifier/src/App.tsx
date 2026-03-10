import { useMemo, useState } from "react";

import {
  AuthenticityStatus,
  PhotoMetadataInfo,
  VerifiableFile,
  VideoMetadataInfo,
  type CaptureMetadata,
} from "@succinctlabs/zcam1-verify";
import { base64 } from "@scure/base";

import { Accordion } from "./components/Accordion";
import SuccinctLogo from "./components/SuccinctLogo.tsx";
import {
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowDownTrayIcon,
} from "@heroicons/react/20/solid";

interface Bindings {
  app_id: string;
  attestation: string;
  assertion: string;
  device_key_id: string;
}

interface Proof {
  data: string;
  vkHash: string;
}

function App() {
  const [fileStatus, setFileStatus] = useState<AuthenticityStatus | undefined>(
    undefined,
  );
  const [verifiableFile, setVerifiableFile] = useState<
    VerifiableFile | undefined
  >(undefined);
  const [rawC2pa, setRawC2pa] = useState<string | undefined>(undefined);

  const [photoHash, setPhotoHash] = useState<string | undefined>(undefined);
  const [bindings, setBindings] = useState<Bindings | undefined>(undefined);
  const [proof, setProof] = useState<Proof | undefined>(undefined);

  const [metadata, setMetadata] = useState<CaptureMetadata | undefined>(
    undefined,
  );

  const [isValid, setIsValid] = useState<boolean | undefined>(undefined);

  const previewUrl = useMemo(() => {
    if (!verifiableFile) return undefined;
    return URL.createObjectURL(verifiableFile.file);
  }, [verifiableFile]);

  const handleFile = async (file: File) => {
    const verifiableFile = new VerifiableFile(file);
    const reader = await verifiableFile.c2paReader().unwrapOr(undefined);
    const manifestStore = await reader?.manifestStore();
    const fileStatus = await verifiableFile.authenticityStatus();
    const photoHash = await verifiableFile.dataHash();
    const metadata = await verifiableFile.captureMetadata().unwrapOr(undefined);

    setVerifiableFile(verifiableFile);
    setRawC2pa(
      manifestStore ? JSON.stringify(manifestStore, null, 2) : undefined,
    );
    setProof(undefined);
    setBindings(undefined);
    setMetadata(metadata);
    setFileStatus(fileStatus);
    setPhotoHash(base64.encode(photoHash));
    setIsValid(undefined);

    switch (fileStatus) {
      case AuthenticityStatus.Bindings:
        setBindings(
          await verifiableFile
            .bindings()
            .map((b) => {
              return {
                app_id: b["app_id"],
                attestation: b["attestation"],
                assertion: b["assertion"],
                device_key_id: b["device_key_id"],
              };
            })
            .unwrapOr(undefined),
        );
        break;
      case AuthenticityStatus.Proof:
        setProof(
          await verifiableFile
            .proof()
            .map((p) => {
              console.log("proof", p);
              return {
                data: p["data"],
                vkHash: p["vk_hash"],
              };
            })
            .unwrapOr(undefined),
        );
        break;
    }
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    if (file) {
      await handleFile(file);
    }
  };

  const handleFileFetch = async (fileName: string) => {
    const response = await fetch(fileName);

    const blob = await response.blob();
    const file = new File([blob], fileName, { type: blob.type });
    await handleFile(file);
  };

  const handleVerify = async () => {
    if (verifiableFile) {
      switch (fileStatus) {
        case AuthenticityStatus.Bindings:
          setIsValid(
            await verifiableFile.verifyBindings(false).unwrapOr(undefined),
          );
          break;
        case AuthenticityStatus.Proof:
          setIsValid(
            await verifiableFile
              .verifyProof("NLS5R4YCGX.com.anonymous.zcam1-e2e-example")
              .unwrapOr(undefined),
          );
          break;
      }
    }
  };

  return (
    <div className="mb-20">
      <header className="flex items-center">
        <h1 className="mt-8 flex-1 text-pink-500">ZCAM Verifier</h1>
        <a href="https://www.succinct.xyz/">
          <SuccinctLogo className="w-35 h-7.5" />
        </a>
      </header>
      <div>
        <p>
          This small tool allows to extract the data embedded inside a authentic
          photo or video. The source code is available at the{" "}
          <a href="https://github.com/succinctlabs/zcam1-sdk">ZCAM SDK</a>{" "}
          repository.
        </p>

        <p>
          To get started, you can either upload a ZCAM authentic photo or video,
          or use one of the example files below.
        </p>

        <div className="grid grid-cols-2 ">
          <div>
            <h4>Upload a file...</h4>
            <input type="file" onChange={handleFileUpload} accept="*" />
          </div>
          <div>
            <h4>...or select one of the two samples below</h4>
            <ul>
              <li>
                <span className="inline-flex items-center gap-1">
                  <button
                    className="px-2 border border-solid border-pink-300 rounded"
                    onClick={() => handleFileFetch("with-bindings.jpg")}
                  >
                    With bindings
                  </button>
                  <a href="/with-bindings.jpg">
                    <ArrowDownTrayIcon className="size-5" />
                  </a>
                </span>
              </li>
              <li>
                <span className="inline-flex items-center gap-1">
                  <button
                    className="px-2 border border-solid border-pink-300 rounded"
                    onClick={() => handleFileFetch("with-proof.jpg")}
                  >
                    With a zero-knowledge proof
                  </button>
                  <a href="/with-proof.jpg">
                    <ArrowDownTrayIcon className="size-5" />
                  </a>
                </span>
              </li>
            </ul>
          </div>
        </div>

        {verifiableFile && (
          <>
            <h2>Asset Metadata Extraction Results</h2>
            <ul className="list-none space-y-2">
              {fileStatus === AuthenticityStatus.NoManifest && (
                <li className="flex items-start">
                  <ExclamationTriangleIcon className="h-5 w-5 mt-1 shrink-0 text-orange-500" />
                  No C2PA metadata were found in the provided file.
                </li>
              )}

              {fileStatus === AuthenticityStatus.InvalidManifest && (
                <li className="flex items-center gap-2">
                  <ExclamationCircleIcon className="h-5 w-5 mt-1 shrink-0 text-red-500" />
                  The C2PA manifest is invalid.
                </li>
              )}

              {(bindings || proof) && (
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="h-5 w-5 mt-1 shrink-0 text-green-500" />
                  <span>
                    The C2PA manifest has been successfully extracted from the
                    provided file, and contains Succinct assertions.
                  </span>
                </li>
              )}

              {photoHash && (
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="h-5 w-5 mt-1 shrink-0 text-green-500" />
                  <span>The asset hash has been computed.</span>
                </li>
              )}

              {bindings && (
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="h-5 w-5 mt-1 shrink-0 text-green-500" />
                  <span>
                    The uploaded file contains all the data necessary to prove
                    that the photo was signed using a valid Apple attested key.
                    You can review it in the <i>Bindings</i> section below.
                  </span>
                </li>
              )}

              {proof && (
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="h-5 w-5 mt-1 shrink-0 text-green-500" />
                  <span>
                    The uploaded file contains a zero-knowledge proof that
                    verifies the attestation without revealing sensitive
                    details. You can review it in the <i>Proof</i> section
                    below.
                  </span>
                </li>
              )}

              {metadata && (
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="h-5 w-5 mt-1 shrink-0 text-green-500" />
                  <span>
                    The capture metadata has been extracted from the C2PA
                    manifest and are reported below in the{" "}
                    <i>Capture metadata</i> Section.
                  </span>
                </li>
              )}
            </ul>
          </>
        )}

        {previewUrl && (
          <Accordion title="Asset Preview">
            {verifiableFile!.file.type.startsWith("video/") ? (
              <video
                controls
                className="max-w-full max-h-96"
                src={previewUrl}
              />
            ) : (
              <img
                className="max-w-full max-h-96"
                src={previewUrl}
                alt="Uploaded asset"
              />
            )}
          </Accordion>
        )}

        {photoHash && (
          <Accordion title="Asset Hash">
            <p>
              The asset hash below (in base64 format) had been computed from the
              file bytes, excluding the C2PA manifest.{" "}
            </p>
            <pre>
              <code>{photoHash}</code>
            </pre>
          </Accordion>
        )}

        {bindings && (
          <Accordion title="Bindings">
            <table>
              <tbody>
                <tr>
                  <td>App Id</td>
                  <td>{bindings.app_id}</td>
                </tr>
                <tr>
                  <td>Attestation</td>
                  <td className="break-all">{bindings.attestation}</td>
                </tr>
                <tr>
                  <td>Assertion</td>
                  <td className="break-all">{bindings.assertion}</td>
                </tr>
                <tr>
                  <td className="whitespace-nowrap">Device key Id</td>
                  <td>{bindings["device_key_id"]}</td>
                </tr>
              </tbody>
            </table>
          </Accordion>
        )}

        {proof && (
          <Accordion title="Proof">
            <table>
              <tbody>
                <tr>
                  <td>Data</td>
                  <td className="break-all">{proof.data}</td>
                </tr>
                <tr>
                  <td className="whitespace-nowrap">Verification key hash</td>
                  <td>{proof.vkHash}</td>
                </tr>
              </tbody>
            </table>
          </Accordion>
        )}

        {metadata && (
          <Accordion title="Capture Metadata">
            <table>
              <tbody>
                <tr>
                  <td>When</td>
                  <td>{metadata.when}</td>
                </tr>
                <MetadataRows parameters={metadata.parameters} />
              </tbody>
            </table>
          </Accordion>
        )}

        {rawC2pa && (
          <Accordion title="C2PA Manifest Store">
            <pre>
              <code className="text-xs">{rawC2pa}</code>
            </pre>
          </Accordion>
        )}

        {(bindings || proof) && (
          <div>
            <h2>Authenticity Verification</h2>
            <p>
              Depending on when the provided file contains bindings or a proof,
              the verification process is different:
            </p>
            <ul>
              <li>
                With bindings, the Apple App Attest{" "}
                <a href="https://developer.apple.com/documentation/devicecheck/establishing-your-app-s-integrity">
                  verification process
                </a>{" "}
                is executed to certify the asset is originating from a real
                device.
              </li>
              <li>
                With a zero-knowledge proof, the above ckecks were done when the
                proof was generated. The verification process only consist of{" "}
                <a href="https://docs.succinct.xyz/docs/sp1/generating-proofs/off-chain-verification">
                  verifying that the proof is valid
                </a>
                .
              </li>
            </ul>
            <div className="flex justify-center">
              <button
                className="bg-pink-500 text-white text-lg px-4 py-2 rounded-lg"
                onClick={handleVerify}
              >
                Verify
              </button>
            </div>
          </div>
        )}

        {isValid !== undefined && <h2>Verification Results</h2>}

        {isValid === true && fileStatus === AuthenticityStatus.Bindings && (
          <p className="flex items-center gap-2">
            <CheckCircleIcon className="h-6 w-6 shrink-0 text-green-500" />
            The file has valid bindings!
          </p>
        )}
        {isValid === false && fileStatus === AuthenticityStatus.Bindings && (
          <p className="flex items-center gap-2">
            <ExclamationCircleIcon className="h-5 w-5 mt-1 shrink-0 text-red-500" />
            The file does not have valid bindings!
          </p>
        )}
        {isValid === true && fileStatus === AuthenticityStatus.Proof && (
          <p className="flex items-center gap-2">
            <CheckCircleIcon className="h-6 w-6 shrink-0 text-green-500" />
            The file has a valid proof!
          </p>
        )}
        {isValid === false && fileStatus === AuthenticityStatus.Proof && (
          <p className="flex items-center gap-2">
            <ExclamationCircleIcon className="h-5 w-5 mt-1 shrink-0 text-red-500" />
            The file does not have a valid proof!
          </p>
        )}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: string | number | boolean | undefined;
}) {
  if (value === undefined) return null;
  return (
    <tr>
      <td>{label}</td>
      <td>{String(value)}</td>
    </tr>
  );
}

function isPhoto(
  params: PhotoMetadataInfo | VideoMetadataInfo,
): params is PhotoMetadataInfo {
  return "iso" in params;
}

function MetadataRows({
  parameters,
}: {
  parameters: PhotoMetadataInfo | VideoMetadataInfo;
}) {
  if (isPhoto(parameters)) {
    return (
      <>
        <Row label="Device Make" value={parameters.deviceMake} />
        <Row label="Device Model" value={parameters.deviceModel} />
        <Row label="Software Version" value={parameters.softwareVersion} />
        <Row label="X Resolution" value={parameters.xResolution} />
        <Row label="Y Resolution" value={parameters.yResolution} />
        <Row label="Orientation" value={parameters.orientation} />
        <Row label="ISO" value={parameters.iso} />
        <Row label="Exposure Time" value={parameters.exposureTime} />
        <Row label="Depth of Field" value={parameters.depthOfField} />
        <Row label="Focal Length" value={parameters.focalLength} />
        <tr>
          <td colSpan={2}>
            <strong>Authenticity Data</strong>
          </td>
        </tr>
        <Row
          label="Jailbroken"
          value={parameters.authenticityData.isJailBroken}
        />
        <Row
          label="Location Spoofing Available"
          value={parameters.authenticityData.isLocationSpoofingAvailable}
        />
        {parameters.depthData && (
          <>
            <tr>
              <td colSpan={2}>
                <strong>Depth Data</strong>
              </td>
            </tr>
            <Row label="Width" value={parameters.depthData.width} />
            <Row label="Height" value={parameters.depthData.height} />
            <Row
              label="Pixel Format"
              value={parameters.depthData.pixelFormat}
            />
            <Row label="Accuracy" value={parameters.depthData.accuracy} />
            <Row label="Min" value={parameters.depthData.statistics.min} />
            <Row label="Max" value={parameters.depthData.statistics.max} />
            <Row label="Mean" value={parameters.depthData.statistics.mean} />
            <Row
              label="Std Dev"
              value={parameters.depthData.statistics.stdDev}
            />
            <Row
              label="Valid Pixels"
              value={parameters.depthData.statistics.validPixelCount}
            />
            <Row
              label="Sample Stride"
              value={parameters.depthData.statistics.sampleStride}
            />
          </>
        )}
      </>
    );
  }

  return (
    <>
      <Row label="Device Make" value={parameters.deviceMake} />
      <Row label="Device Model" value={parameters.deviceModel} />
      <Row label="Software Version" value={parameters.softwareVersion} />
      <Row label="Format" value={parameters.format} />
      <Row label="Has Audio" value={parameters.hasAudio} />
      <Row label="Duration (s)" value={parameters.durationSeconds} />
      <Row label="File Size (bytes)" value={parameters.fileSizeBytes} />
      <Row label="Width" value={parameters.width} />
      <Row label="Height" value={parameters.height} />
      <Row label="Rotation (deg)" value={parameters.rotationDegrees} />
      <Row label="Frame Rate" value={parameters.frameRate} />
      <Row label="Video Codec" value={parameters.videoCodec} />
      <Row label="Audio Codec" value={parameters.audioCodec} />
      <Row label="Audio Sample Rate" value={parameters.audioSampleRate} />
      <Row label="Audio Channels" value={parameters.audioChannels} />
      <tr>
        <td colSpan={2}>
          <strong>Authenticity Data</strong>
        </td>
      </tr>
      <Row
        label="Jailbroken"
        value={parameters.authenticityData.isJailBroken}
      />
      <Row
        label="Location Spoofing Available"
        value={parameters.authenticityData.isLocationSpoofingAvailable}
      />
    </>
  );
}

export default App;
