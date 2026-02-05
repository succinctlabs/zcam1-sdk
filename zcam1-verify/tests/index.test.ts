import { describe, expect, it } from "vitest";
import { extractManifest } from "../src/index";
import fixtureUrl from "./fixtures/with-bindings.jpg?url";

describe("extractManifest", () => {
  it("returns a ManifestStore", async () => {
    const response = await fetch(fixtureUrl);
    const blob = await response.blob();
    const file = new File([blob], "with-bindings.jpg", {
      type: blob.type || "image/jpeg",
    });
    let store = await extractManifest(file);
    console.log(store);
  });
});
