import { defineConfig } from "vitest/config";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [
    dts({
      entryRoot: "src",
      insertTypesEntry: true,
    }),
  ],
  assetsInclude: ["**/*.wasm"],
  optimizeDeps: {
    exclude: ["@succinctlabs/sp1-wasm-verifier"],
  },
  build: {
    lib: {
      entry: "src/index.ts",
      name: "ZcamVerify",
      formats: ["es"],
      fileName: () => "index.js",
    },
    rollupOptions: {
      // Keep peer deps bundled by default for browser-friendly output.
      // If you prefer externalizing, add dependencies here.
      external: ["neverthrow"],
    },
    sourcemap: true,
    target: "es2022",
  },
  test: {
    include: ["tests/**/*.test.ts", "tests/**/*.spec.ts"],
    browser: {
      enabled: true,
      name: "chromium",
      provider: "playwright",
    },
  },
});
