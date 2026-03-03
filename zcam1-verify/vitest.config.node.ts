import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.node.test.ts", "tests/**/*.node.spec.ts"],
    environment: "node",
    server: {
      deps: {
        // Keep these external so their own import.meta.url stays intact for WASM resolution.
        external: [
          "@succinctlabs/sp1-wasm-verifier",
          "@contentauth/c2pa-node",
        ],
      },
    },
  },
});
