import { describe, expect, it } from "vitest";
import { verifyBindings, verifyProof } from "../src/index";
import withBindingsUrl from "./fixtures/with-bindings.jpg?url";
import withProofUrl from "./fixtures/with-proof.jpg?url";

describe("extractManifest", () => {
  it("bindings verification", async () => {
    const response = await fetch(withBindingsUrl);
    const blob = await response.blob();
    const file = new File([blob], "with-bindings.jpg", {
      type: blob.type || "image/jpeg",
    });

    let isValid = await verifyBindings(file, false);

    expect(isValid).toBe(true);
  });

  it("proof verification", async () => {
    const response = await fetch(withProofUrl);
    const blob = await response.blob();
    const file = new File([blob], "with-proof.jpg", {
      type: blob.type || "image/jpeg",
    });

    let isValid = await verifyProof(
      file,
      "NLS5R4YCGX.com.anonymous.zcam1-e2e-example",
    );

    expect(isValid).toBe(true);
  });
});
