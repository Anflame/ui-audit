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

const resolveFromBase = async (base: string): Promise<string | null> => {
  const direct = await ensureFile(base);
  if (direct) return direct;

  for (const ext of TRY_EXT) {
    const candidate = await ensureFile(base + ext);
    if (candidate) return candidate;
  }

  for (const ix of TRY_INDEX) {
    const candidate = await ensureFile(base + ix);
    if (candidate) return candidate;
  }

  return null;
};

const resolveChain = async (firstCandidate: string | null): Promise<string | null> => {
  const seen = new Set<string>();
  let cur = firstCandidate;

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
      const nextBase = path.resolve(path.dirname(cur), nextSpec);
      const next = await resolveFromBase(nextBase);
      if (!next) return cur;
      cur = next;
      continue;
    }

    return cur;
  }

  return cur;
};

export const resolveImportPath = async (fromFile: string, spec: string): Promise<string | null> => {
  if (!spec.startsWith('./') && !spec.startsWith('../')) return null;

  const base = path.resolve(path.dirname(fromFile), spec);
  return resolveFromBase(base);
};

export const resolveModuleDeep = async (fromFile: string, spec: string): Promise<string | null> => {
  if (!spec.startsWith('./') && !spec.startsWith('../')) return null;
  const base = path.resolve(path.dirname(fromFile), spec);
  return resolveChain(await resolveFromBase(base));
};

const normalizeAliasKey = (alias: string): string => alias.replace(/\/+$/, '');
const normalizeAliasTarget = (target: string): string => target.replace(/\/+$/, '');

const computeAliasBase = (
  cwd: string,
  aliases: Record<string, string> | undefined,
  spec: string,
): string | null => {
  if (!aliases) return null;
  for (const [rawAlias, rawTarget] of Object.entries(aliases)) {
    const alias = normalizeAliasKey(rawAlias);
    const target = normalizeAliasTarget(rawTarget);

    if (!alias) continue;
    if (spec !== alias && !spec.startsWith(`${alias}/`)) continue;

    const remainder = spec === alias ? '' : spec.slice(alias.length);
    const relative = remainder.replace(/^\/+/, '');
    const baseDir = path.isAbsolute(target) ? target : path.resolve(cwd, target);
    return path.join(baseDir, relative);
  }
  return null;
};

export const resolveAliasImportPath = async (
  cwd: string,
  aliases: Record<string, string> | undefined,
  spec: string,
): Promise<string | null> => {
  const base = computeAliasBase(cwd, aliases, spec);
  if (!base) return null;
  return resolveFromBase(base);
};

export const resolveAliasModuleDeep = async (
  cwd: string,
  aliases: Record<string, string> | undefined,
  spec: string,
): Promise<string | null> => {
  const base = computeAliasBase(cwd, aliases, spec);
  if (!base) return null;
  return resolveChain(await resolveFromBase(base));
};
