import path from 'node:path';

import * as t from '@babel/types';
import fs from 'fs-extra';

import { ParserBabel } from '../adapters/parserBabel';
import { collectImportsSet } from '../analyzers/collectImportsSet';
import { hasAntdJsxUsage } from '../analyzers/hasAntdJsxUsage';
import { analyzeThinAntWrapper } from '../analyzers/isThinAntWrapper';
import { COMPONENT_TYPES, isCamelCaseComponent, isInteractiveIntrinsic } from '../domain/constants';
import { resolveAliasModuleDeep, resolveModuleDeep } from '../utils/resolveModule';
import { toPosixPath } from '../utils/normalizePath';
import { isLocalImport } from '../utils/isLocalModule';
import { loadConfig as loadCfg, type ResolvedConfig } from '../utils/config';

import type { ClassifiedReport } from '../classifiers/aggregate';
import type { ClassifiedItem } from '../classifiers/deriveComponentType';

const resolveLocalComponent = async (
  cfg: ResolvedConfig,
  fromFile: string,
  spec: string,
): Promise<string | null> => {
  const rel = await resolveModuleDeep(fromFile, spec);
  if (rel) return rel;
  return resolveAliasModuleDeep(cfg.cwd, cfg.aliases, spec);
};

const computeCommonRoots = (cfg: ResolvedConfig): string[] => {
  const roots = new Set<string>();
  for (const root of cfg.srcRoots) {
    const absRoot = path.isAbsolute(root) ? root : path.resolve(cfg.cwd, root);
    const candidate = path.join(absRoot, 'components', 'common');
    roots.add(toPosixPath(candidate));
  }

  if (cfg.aliases) {
    for (const target of Object.values(cfg.aliases)) {
      const absTarget = path.isAbsolute(target) ? target : path.resolve(cfg.cwd, target);
      const normalized = toPosixPath(absTarget);
      const marker = '/components/common';
      const idx = normalized.indexOf(marker);
      if (idx !== -1) {
        roots.add(normalized.slice(0, idx + marker.length));
      }
    }
  }

  return Array.from(roots);
};

const isWithinCommon = (filePath: string, roots: string[]): boolean => {
  for (const root of roots) {
    if (filePath === root) return true;
    if (filePath.startsWith(`${root}/`)) return true;
  }
  return false;
};

export const runDetectWrappers = async (cwd: string = process.cwd()) => {
  const parser = new ParserBabel();
  const stage2Path = path.join(cwd, '.ui-audit', 'tmp', 'classified.json');
  if (!(await fs.pathExists(stage2Path))) throw new Error('Не найден classified.json. Сначала запусти Stage 2.');
  const report = (await fs.readJSON(stage2Path)) as ClassifiedReport;
  const updated: ClassifiedItem[] = [];

  const cfg = await loadCfg(cwd);
  const commonRoots = computeCommonRoots(cfg);

  const wrapperFiles = new Set<string>();
  const wrappedAntLocalsByFile = new Map<string, Set<string>>();
  const wrapperLocalImports = new Set<string>();
  const resolveCache = new Map<string, string | null>();

  const resolveWithCache = async (fromFile: string, spec: string): Promise<string | null> => {
    const key = `${fromFile}:::${spec}`;
    if (resolveCache.has(key)) return resolveCache.get(key) ?? null;
    const resolved = await resolveLocalComponent(cfg, fromFile, spec);
    resolveCache.set(key, resolved ?? null);
    return resolved ?? null;
  };

  for (const it of report.items) {
    // Пропускаем неинтерактивные HTML
    if (!it.sourceModule && !/[A-Z]/.test(it.component)) {
      if (!isInteractiveIntrinsic(it.component)) continue;
    }

    if (
      it.type === COMPONENT_TYPES.LOCAL &&
      it.sourceModule &&
      isCamelCaseComponent(it.component) &&
      isLocalImport(it.sourceModule, cfg.aliases)
    ) {
      // ГЛУБОКИЙ резолв (баррели/index.ts), чтобы точно дойти до файла компонента
      const resolved = await resolveWithCache(it.file, it.sourceModule);
      if (resolved) {
        const resolvedPosix = toPosixPath(resolved);
        try {
          const stat = await fs.stat(resolvedPosix);
          if (!stat.isFile()) throw new Error('resolved path is not a file');

          const code = await fs.readFile(resolvedPosix, 'utf8');
          const ast = parser.parse(code) as unknown as t.File;
          const { antdLocals, moduleByLocal } = collectImportsSet(ast);
          const allowedWrapperLocals = new Set<string>();
          const allowedUiLocals = new Set<string>();

          const allowedLibraryModules = new Set<string>();
          for (const [group, modules] of Object.entries(cfg.libraries ?? {})) {
            if (group === 'antd') continue;
            for (const mod of modules) allowedLibraryModules.add(mod);
          }

          for (const [localName, source] of moduleByLocal.entries()) {
            if (!isLocalImport(source, cfg.aliases)) continue;
            const dep = await resolveWithCache(resolvedPosix, source);
            if (!dep) continue;
            if (isWithinCommon(dep, commonRoots)) allowedWrapperLocals.add(localName);
          }

          for (const [localName, source] of moduleByLocal.entries()) {
            for (const mod of allowedLibraryModules) {
              if (source === mod || source.startsWith(`${mod}/`)) {
                allowedUiLocals.add(localName);
                break;
              }
            }
          }

          if (antdLocals.size > 0 && hasAntdJsxUsage(ast, antdLocals)) {
            const analysis = analyzeThinAntWrapper(
              ast,
              it.component,
              antdLocals,
              allowedWrapperLocals,
              allowedUiLocals,
            );
            if (analysis.verdict === 'wrapper') {
              const wrapped: ClassifiedItem = {
                ...it,
                type: COMPONENT_TYPES.ANTD_WRAPPER,
                sourceModule: 'antd',
                componentFile: resolvedPosix,
              };
              updated.push(wrapped);
              wrapperFiles.add(resolvedPosix);
              wrappedAntLocalsByFile.set(resolvedPosix, new Set(analysis.wrappedLocals));
              if (it.sourceModule) wrapperLocalImports.add(`${it.file}:::${it.sourceModule}`);
              continue;
            }
          }
        } catch {
          // оставляем как есть
        }
      }
    }
    updated.push(it);
  }

  // вырезаем прямых «детей antd» внутри самих файлов-обёрток
  const filtered = updated
    .filter((x) => {
      if (x.type !== COMPONENT_TYPES.ANTD) return true;
      if (!x.file) return true;
      if (!wrapperFiles.has(x.file)) return true;
      const wrappedLocals = wrappedAntLocalsByFile.get(x.file);
      if (!wrappedLocals || wrappedLocals.size === 0) return true;
      const base = x.component.includes('.') ? x.component.split('.')[0] ?? x.component : x.component;
      return !wrappedLocals.has(base);
    })
    .filter((x) => {
      if (x.type !== COMPONENT_TYPES.LOCAL) return true;
      if (!x.sourceModule) return true;
      const key = `${x.file}:::${x.sourceModule}`;
      if (!isLocalImport(x.sourceModule, cfg.aliases)) return true;
      return !wrapperLocalImports.has(key);
    });

  const summary: Record<string, number> = {
    [COMPONENT_TYPES.ANTD]: 0,
    [COMPONENT_TYPES.ANTD_WRAPPER]: 0,
    [COMPONENT_TYPES.KSNM]: 0,
    [COMPONENT_TYPES.LOCAL]: 0,
  };
  for (const x of filtered) summary[x.type] = (summary[x.type] ?? 0) + x.count;

  const outDir = path.join(cwd, '.ui-audit', 'tmp');
  const outPath = path.join(outDir, 'classified-final.json');
  await fs.outputJson(outPath, { items: filtered, summary }, { spaces: 2 });

  console.log('── UI-Audit / Stage 3: wrappers');
  for (const [k, v] of Object.entries(summary)) console.log(`  ${k}: ${v}`);
  console.log(`JSON: ${path.relative(cwd, outPath)}`);

  return { items: filtered, summary } as ClassifiedReport;
};
