import { defineConfig } from "tsup";

export default defineConfig({
  clean: true,
  dts: true,
  entry: ["src/cli.ts"],
  format: ["esm"],
  outDir: "dist",
  shims: false,
  sourcemap: true,
  splitting: false,
  target: "node20",
});
