import { defineConfig } from 'tsup';
import { builtinModules } from 'node:module';

const externals = [...builtinModules, /^@babel\//, 'debug'];

export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    format: ['esm'],
    dts: true,
    sourcemap: true,
    platform: 'node',
    target: 'node20',
    external: externals,
  },
  {
    entry: { cli: 'src/cli.ts' },
    format: ['cjs'],
    dts: false,
    sourcemap: true,
    platform: 'node',
    target: 'node20',
    splitting: false,
    banner: { js: '#!/usr/bin/env node' },
    outExtension: () => ({ js: '.cjs' }),
    external: externals,
  },
]);
