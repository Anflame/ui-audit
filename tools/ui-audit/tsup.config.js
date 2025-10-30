import { defineConfig } from "tsup";
import { builtinModules } from "node:module";

const externals = [
  ...builtinModules, // fs, path, tty, os и т. п.
  /^@babel\//, // не бандлить весь @babel/*
  "debug", // источник dynamic require('tty')
];

export default defineConfig([
  // Библиотека (ESM)
  {
    entry: { index: "src/index.ts" },
    format: ["esm"],
    dts: true,
    sourcemap: true,
    platform: "node",
    target: "node20",
    external: externals,
  },
  // CLI (CJS)
  {
    entry: { cli: "src/cli.ts" },
    format: ["cjs"],
    dts: false,
    sourcemap: true,
    platform: "node",
    target: "node20",
    splitting: false,
    banner: { js: "#!/usr/bin/env node" },
    outExtension: () => ({ js: ".cjs" }),
    external: externals,
  },
]);
