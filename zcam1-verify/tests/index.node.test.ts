import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { VerifiableBuffer, AuthenticityStatus } from "../src/index.node";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadFixture(name: string): Buffer {
  return readFileSync(resolve(__dirname, "fixtures", name));
}

describe("VerifiableBuffer", () => {
  it("bindings verification", async () => {
    const buffer = loadFixture("with-bindings.jpg");
    const verifiable = new VerifiableBuffer(buffer, "image/jpeg");

    const isValid = await verifiable.verifyBindings(false);

    expect(isValid._unsafeUnwrap()).toBe(true);
  });

  it("proof verification", async () => {
    const buffer = loadFixture("with-proof.jpg");
    const verifiable = new VerifiableBuffer(buffer, "image/jpeg");

    const isValid = await verifiable.verifyProof(
      "NLS5R4YCGX.com.anonymous.zcam1-e2e-example",
    );

    expect(isValid._unsafeUnwrap()).toBe(true);
  });

  it("extract metadata", async () => {
    const buffer = loadFixture("with-bindings.jpg");
    const verifiable = new VerifiableBuffer(buffer, "image/jpeg");

    const metadata = (await verifiable.captureMetadata())._unsafeUnwrap();

    expect(metadata.parameters.deviceMake).toBe("Apple");
    expect(metadata.parameters.deviceModel).toBe("iPhone 16");
  });

  it("authenticity status bindings", async () => {
    const buffer = loadFixture("with-bindings.jpg");
    const verifiable = new VerifiableBuffer(buffer, "image/jpeg");

    const authStatus = await verifiable.authenticityStatus();

    expect(authStatus).toBe(AuthenticityStatus.Bindings);
  });

  it("authenticity status proof", async () => {
    const buffer = loadFixture("with-proof.jpg");
    const verifiable = new VerifiableBuffer(buffer, "image/jpeg");

    const authStatus = await verifiable.authenticityStatus();

    expect(authStatus).toBe(AuthenticityStatus.Proof);
  });
});
