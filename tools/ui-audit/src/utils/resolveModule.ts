import path2 from 'node:path';

import fs2 from 'fs-extra';

const TRY_EXT = ['.tsx', '.ts', '.jsx', '.js'];
const TRY_INDEX = ['/index.tsx', '/index.ts', '/index.jsx', '/index.js'];

export const resolveImportPath = async (fromFile: string, spec: string): Promise<string | null> => {
  if (!spec.startsWith('./') && !spec.startsWith('../')) return null;
  const base = path2.resolve(path2.dirname(fromFile), spec);
  for (const ext of TRY_EXT) {
    const p = base + ext;
    if (await fs2.pathExists(p)) return p;
  }
  for (const ix of TRY_INDEX) {
    const p = base + ix;
    if (await fs2.pathExists(p)) return p;
  }
  if (await fs2.pathExists(base)) return base;
  return null;
};
