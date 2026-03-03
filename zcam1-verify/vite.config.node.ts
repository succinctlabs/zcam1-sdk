import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import { copyFileSync, mkdirSync } from "fs";
import { resolve } from "path";

export default defineConfig({
  plugins: [
    dts({
      entryRoot: "src",
      include: ["src/index.node.ts", "src/core.ts", "src/bindings.node.ts", "src/generated/**/*.ts"],
      insertTypesEntry: true,
      tsconfigPath: "./tsconfig.node.json",
    }),
    {
      name: "copy-uniffi-wasm",
      closeBundle() {
        mkdirSync("dist", { recursive: true });
        copyFileSync(
          resolve(__dirname, "src/generated/wasm-bindgen/index_bg.wasm"),
          resolve(__dirname, "dist/index_bg.wasm"),
        );
      },
    },
  ],
  build: {
    lib: {
      entry: "src/index.node.ts",
      formats: ["es"],
      fileName: () => "index.node.js",
    },
    rollupOptions: {
      external: [
        "neverthrow",
        "@contentauth/c2pa-node",
        "@succinctlabs/sp1-wasm-verifier",
        "node:fs",
        "node:module",
        "node:path",
        "node:url",
      ],
    },
    sourcemap: true,
    target: "node18",
    emptyOutDir: false,
  },
});
