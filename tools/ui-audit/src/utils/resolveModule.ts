// src/utils/resolveModule.ts
import path from 'node:path';

import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import fs from 'fs-extra';

const TRY_EXT = ['.tsx', '.ts', '.jsx', '.js'];
const TRY_INDEX = ['/index.tsx', '/index.ts', '/index.jsx', '/index.js'];

const ensureFile = async (candidate: string): Promise<string | null> => {
  try {
    const stat = await fs.stat(candidate);
    if (stat.isFile()) return candidate;
  } catch {
    /* empty */
  }
  return null;
};

export const resolveImportPath = async (fromFile: string, spec: string): Promise<string | null> => {
  if (!spec.startsWith('./') && !spec.startsWith('../')) return null;

  const base = path.resolve(path.dirname(fromFile), spec);

  // 1) прямой путь с указанным расширением
  const direct = await ensureFile(base);
  if (direct) return direct;

  // 2) перебор расширений
  for (const ext of TRY_EXT) {
    const candidate = await ensureFile(base + ext);
    if (candidate) return candidate;
  }

  // 3) index.* внутри директории
  for (const ix of TRY_INDEX) {
    const candidate = await ensureFile(base + ix);
    if (candidate) return candidate;
  }

  return null;
};

/** Идём глубоко по баррелям: если в файле только реэкспорты — шагаем дальше. */
export const resolveModuleDeep = async (fromFile: string, spec: string): Promise<string | null> => {
  const seen = new Set<string>();
  let cur = await resolveImportPath(fromFile, spec);

  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const code = await fs.readFile(cur, 'utf8');
    const ast = parse(code, {
      sourceType: 'module',
      plugins: [
        'typescript',
        'jsx',
        'decorators-legacy',
        'classProperties',
        'objectRestSpread',
        'dynamicImport',
        'importMeta',
      ],
    });

    let onlyReexports = true;
    let nextSpec: string | null = null;

    traverse(ast, {
      ImportDeclaration() {
        onlyReexports = false;
      },
      ExportNamedDeclaration(p) {
        const n = p.node;
        if (n.source && t.isStringLiteral(n.source)) nextSpec = n.source.value;
        else onlyReexports = false;
      },
      ExportAllDeclaration(p) {
        const n = p.node;
        if (n.source && t.isStringLiteral(n.source)) nextSpec = n.source.value;
      },
      // Любой «реальный» код — не баррель
      FunctionDeclaration() {
        onlyReexports = false;
      },
      VariableDeclaration() {
        onlyReexports = false;
      },
      ClassDeclaration() {
        onlyReexports = false;
      },
      JSXElement() {
        onlyReexports = false;
      },
      JSXFragment() {
        onlyReexports = false;
      },
    });

    if (!onlyReexports) return cur;

    if (nextSpec) {
      const next = await resolveImportPath(cur, nextSpec);
      if (!next) return cur;
      cur = next;
      continue;
    }

    return cur;
  }

  return cur;
};
