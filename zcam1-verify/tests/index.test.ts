import { describe, expect, it } from "vitest";
import { VerifiableFile } from "../src/index";
import withBindingsUrl from "./fixtures/with-bindings.jpg?url";
import withProofUrl from "./fixtures/with-proof.jpg?url";

describe("VerifiableFile", () => {
  it("bindings verification", async () => {
    const response = await fetch(withBindingsUrl);
    const blob = await response.blob();
    const file = new File([blob], "with-bindings.jpg", {
      type: blob.type || "image/jpeg",
    });
    const verifiable = new VerifiableFile(file);

    let isValid = await verifiable.verifyBindings(false);

    expect(isValid).toBe(true);
  });

  it("proof verification", async () => {
    const response = await fetch(withProofUrl);
    const blob = await response.blob();
    const file = new File([blob], "with-proof.jpg", {
      type: blob.type || "image/jpeg",
    });
    const verifiable = new VerifiableFile(file);

    let isValid = await verifiable.verifyProof(
      "NLS5R4YCGX.com.anonymous.zcam1-e2e-example",
    );

    expect(isValid).toBe(true);
  });

  it("extract metadata", async () => {
    const response = await fetch(withBindingsUrl);
    const blob = await response.blob();
    const file = new File([blob], "with-bindings.jpg", {
      type: blob.type || "image/jpeg",
    });
    const verifiable = new VerifiableFile(file);

    let metadata = await verifiable.captureMetadata();

    expect(metadata.parameters.deviceMake).toBe("Apple");
    expect(metadata.parameters.deviceModel).toBe("iPhone 16");
  });
});
