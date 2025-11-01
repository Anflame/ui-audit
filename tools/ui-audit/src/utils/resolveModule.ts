import path from 'node:path';

import fs from 'fs-extra';

const TRY_EXT = ['.tsx', '.ts', '.jsx', '.js'];
const TRY_INDEX = ['/index.tsx', '/index.ts', '/index.jsx', '/index.js'];

export const resolveImportPath = async (fromFile: string, spec: string): Promise<string | null> => {
  if (!spec.startsWith('./') && !spec.startsWith('../')) return null;
  const base = path.resolve(path.dirname(fromFile), spec);
  // 1) точное совпадение с добавлением расширений
  for (const ext of TRY_EXT) {
    const p = base + ext;
    if (await fs.pathExists(p)) return p;
  }
  // 2) index.* внутри директории
  for (const ix of TRY_INDEX) {
    const p = base + ix;
    if (await fs.pathExists(p)) return p;
  }
  // 3) как есть (вдруг со своим расширением)
  if (await fs.pathExists(base)) return base;
  return null;
};
