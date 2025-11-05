import path from 'node:path';

import fs from 'fs-extra';

const TRY_EXT = ['.tsx', '.ts', '.jsx', '.js'];
const TRY_INDEX = ['/index.tsx', '/index.ts', '/index.jsx', '/index.js'];

export type ResolveOptions = {
  cwd: string;
  aliases?: Record<string, string>;
};

const applyAlias = (spec: string, opts: ResolveOptions): string | null => {
  const aliases = opts.aliases ?? {};
  for (const [key, target] of Object.entries(aliases)) {
    if (!key) continue;
    if (spec === key || spec.startsWith(`${key}/`)) {
      const rest = spec.slice(key.length).replace(/^\//, '');
      return path.join(opts.cwd, target, rest);
    }
  }
  return null;
};

export const resolveImportPath = async (
  fromFile: string,
  spec: string,
  opts: ResolveOptions,
): Promise<string | null> => {
  // относительные импорты
  if (spec.startsWith('./') || spec.startsWith('../')) {
    const base = path.resolve(path.dirname(fromFile), spec);
    for (const ext of TRY_EXT) {
      const p = base + ext;
      if (await fs.pathExists(p)) return p;
    }
    for (const ix of TRY_INDEX) {
      const p = base + ix;
      if (await fs.pathExists(p)) return p;
    }
    if (await fs.pathExists(base)) return base;
    return null;
  }

  // алиасы (@ → src)
  const aliased = applyAlias(spec, opts);
  if (aliased) {
    for (const ext of TRY_EXT) {
      const p = aliased + ext;
      if (await fs.pathExists(p)) return p;
    }
    for (const ix of TRY_INDEX) {
      const p = aliased + ix;
      if (await fs.pathExists(p)) return p;
    }
    if (await fs.pathExists(aliased)) return aliased;
  }

  // внешние пакеты не резолвим на ФС
  return null;
};
