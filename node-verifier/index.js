#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { extname, basename } from "node:path";
import {
  VerifiableBuffer,
  AuthenticityStatus,
} from "@succinctlabs/zcam1-verify";

const MIME_TYPES = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
};

const APP_ID =
  process.env.APP_ID ?? "NLS5R4YCGX.com.anonymous.zcam1-e2e-example";
const PRODUCTION = process.env.PRODUCTION === "true";

function mimeType(filePath) {
  const ext = extname(filePath).toLowerCase();
  const mime = MIME_TYPES[ext];
  if (!mime) {
    console.error(`Unsupported file extension: ${ext}`);
    console.error(
      `Supported extensions: ${Object.keys(MIME_TYPES).join(", ")}`,
    );
    process.exit(1);
  }
  return mime;
}

const filePath = process.argv[2];

if (!filePath) {
  console.error("Usage: node index.js <file>");
  console.error("");
  console.error("Environment variables:");
  console.error(
    "  APP_ID       App identifier for proof verification (default: NLS5R4YCGX.com.anonymous.zcam1-e2e-example)",
  );
  console.error(
    "  PRODUCTION   Use production Apple attestation GUID (default: false)",
  );
  process.exit(1);
}

console.log(`File: ${basename(filePath)}`);

const buffer = readFileSync(filePath);
const verifiable = new VerifiableBuffer(buffer, mimeType(filePath));

// Capture metadata
const metadataResult = await verifiable.captureMetadata();
if (metadataResult.isOk()) {
  const metadata = metadataResult.value;
  console.log("\nCapture metadata:");
  console.log(`  Captured at:  ${metadata.when}`);
  const p = metadata.parameters;
  if (p.deviceMake)
    console.log(
      `  Device:       ${p.deviceMake} ${p.deviceModel} ${p.softwareVersion} ?? ""}`.trimEnd(),
    );
} else {
  console.log("\nCapture metadata: not found");
}

// Authenticity verification
const status = await verifiable.authenticityStatus();
console.log(`\nAuthenticity status: ${AuthenticityStatus[status]}`);

if (status === AuthenticityStatus.Bindings) {
  console.log(`\nVerifying bindings (production=${PRODUCTION})...`);
  const result = await verifiable.verifyBindings(PRODUCTION);
  if (result.isOk()) {
    console.log("  Bindings valid: true");
  } else {
    console.log(`  Bindings valid: false — ${result.error.message}`);
    process.exitCode = 1;
  }
} else if (status === AuthenticityStatus.Proof) {
  console.log(`\nVerifying proof (appId=${APP_ID})...`);
  const result = await verifiable.verifyProof(APP_ID);
  if (result.isOk()) {
    console.log("  Proof valid: true");
  } else {
    console.log(`  Proof valid: false — ${result.error.message}`);
    process.exitCode = 1;
  }
} else if (status === AuthenticityStatus.NoManifest) {
  console.log("No C2PA manifest found — file cannot be verified.");
  process.exitCode = 1;
} else {
  console.log("Manifest found but missing required assertions.");
  process.exitCode = 1;
}
