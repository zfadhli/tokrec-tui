import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  clean: true,
  outDir: "dist",
  // Externalize native FFI deps (can't be bundled)
  deps: {
    neverBundle: ["@opentui/core", "@zfadhli/tokrec"],
  },
});
