import { describe, expect, it } from "vitest";
import { VerifiableFile } from "../src/index";
import withBindingsUrl from "./fixtures/with-bindings.jpg?url";
import withProofUrl from "./fixtures/with-proof.jpg?url";
import { AuthenticityStatus } from "../src/bindings";

describe("VerifiableFile", () => {
  it("bindings verification", async () => {
    const response = await fetch(withBindingsUrl);
    const blob = await response.blob();
    const file = new File([blob], "with-bindings.jpg", {
      type: blob.type || "image/jpeg",
    });
    const verifiable = new VerifiableFile(file);

    const isValid = await verifiable.verifyBindings(false);

    expect(isValid._unsafeUnwrap()).toBe(true);
  });

  it("proof verification", async () => {
    const response = await fetch(withProofUrl);
    const blob = await response.blob();
    const file = new File([blob], "with-proof.jpg", {
      type: blob.type || "image/jpeg",
    });
    const verifiable = new VerifiableFile(file);

    const isValid = await verifiable.verifyProof(
      "NLS5R4YCGX.com.anonymous.zcam1-e2e-example",
    );

    expect(isValid._unsafeUnwrap()).toBe(true);
  });

  it("extract metadata", async () => {
    const response = await fetch(withBindingsUrl);
    const blob = await response.blob();
    const file = new File([blob], "with-bindings.jpg", {
      type: blob.type || "image/jpeg",
    });
    const verifiable = new VerifiableFile(file);

    const metadata = (await verifiable.captureMetadata())._unsafeUnwrap();

    expect(metadata.parameters.deviceMake).toBe("Apple");
    expect(metadata.parameters.deviceModel).toBe("iPhone 16");
  });

  it("authenticity status bindings", async () => {
    const response = await fetch(withBindingsUrl);
    const blob = await response.blob();
    const file = new File([blob], "with-bindings.jpg", {
      type: blob.type || "image/jpeg",
    });
    const verifiable = new VerifiableFile(file);

    const authStatus = await verifiable.authenticityStatus();

    expect(authStatus._unsafeUnwrap()).toBe(AuthenticityStatus.Bindings);
  });

  it("authenticity status proof", async () => {
    const response = await fetch(withProofUrl);
    const blob = await response.blob();
    const file = new File([blob], "with-proof.jpg", {
      type: blob.type || "image/jpeg",
    });
    const verifiable = new VerifiableFile(file);

    const authStatus = await verifiable.authenticityStatus();

    expect(authStatus._unsafeUnwrap()).toBe(AuthenticityStatus.Proof);
  });
});
