// src/utils/resolveModule.ts
import path from 'node:path';

import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import fs from 'fs-extra';

import { toPosixPath } from './normalizePath';

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
  if (direct) return toPosixPath(direct);

  for (const ext of TRY_EXT) {
    const candidate = await ensureFile(base + ext);
    if (candidate) return toPosixPath(candidate);
  }

  for (const ix of TRY_INDEX) {
    const candidate = await ensureFile(base + ix);
    if (candidate) return toPosixPath(candidate);
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

const pickAliasTarget = (raw: string | string[]): string | null => {
  if (Array.isArray(raw)) {
    for (const candidate of raw) {
      if (typeof candidate === 'string' && candidate.length > 0) return candidate;
    }
    return null;
  }
  return raw ?? null;
};

const matchAliasPattern = (alias: string, spec: string): { remainder: string } | null => {
  if (!alias.includes('*')) {
    if (spec === alias) return { remainder: '' };
    if (spec.startsWith(`${alias}/`)) return { remainder: spec.slice(alias.length + 1) };
    return null;
  }

  const [prefix, suffix] = alias.split('*');
  if (!spec.startsWith(prefix)) return null;
  if (suffix && !spec.endsWith(suffix)) return null;

  const remainder = spec.slice(prefix.length, suffix ? spec.length - suffix.length : undefined);
  return { remainder: remainder.replace(/^\/+/, '') };
};

const applyAliasTarget = (
  cwd: string,
  target: string,
  remainder: string,
): string => {
  if (target.includes('*')) {
    const resolvedTarget = target.replace('*', remainder);
    return path.isAbsolute(resolvedTarget) ? resolvedTarget : path.resolve(cwd, resolvedTarget);
  }

  if (!remainder) {
    return path.isAbsolute(target) ? target : path.resolve(cwd, target);
  }

  const baseDir = path.isAbsolute(target) ? target : path.resolve(cwd, target);
  return path.join(baseDir, remainder);
};

const computeAliasBase = (
  cwd: string,
  aliases: Record<string, string | string[]> | undefined,
  spec: string,
): string | null => {
  if (!aliases) return null;
  for (const [rawAlias, rawTarget] of Object.entries(aliases)) {
    const alias = normalizeAliasKey(rawAlias);
    const picked = pickAliasTarget(rawTarget);
    if (!picked) continue;
    const target = normalizeAliasTarget(picked);

    if (!alias) continue;
    const match = matchAliasPattern(alias, spec);
    if (!match) continue;

    return applyAliasTarget(cwd, target, match.remainder);
  }
  return null;
};

export const resolveAliasImportPath = async (
  cwd: string,
  aliases: Record<string, string | string[]> | undefined,
  spec: string,
): Promise<string | null> => {
  const base = computeAliasBase(cwd, aliases, spec);
  if (!base) return null;
  return resolveFromBase(base);
};

export const resolveAliasModuleDeep = async (
  cwd: string,
  aliases: Record<string, string | string[]> | undefined,
  spec: string,
): Promise<string | null> => {
  const base = computeAliasBase(cwd, aliases, spec);
  if (!base) return null;
  return resolveChain(await resolveFromBase(base));
};
