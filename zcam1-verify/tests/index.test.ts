import { describe, expect, it } from "vitest";
import { verifyProof } from "../src/index";
import fixtureUrl from "./fixtures/with-proof.jpg?url";

describe("extractManifest", () => {
  it("proof verification", async () => {
    const response = await fetch(fixtureUrl);
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
