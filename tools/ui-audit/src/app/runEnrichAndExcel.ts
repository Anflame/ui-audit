// src/app/runEnrichAndExcel.ts
import path from 'node:path';

import fs from 'fs-extra';
import * as t from '@babel/types';

import { COMPONENT_TYPES } from '../domain/constants';
import { WRAPPER_LABEL } from './runDetectWrappers';
import { writeExcel, type DetailRow } from '../report/excel';
import { loadConfig as loadCfg } from '../utils/config';
import {
  resolveAliasImportPath,
  resolveAliasModuleDeep,
  resolveImportPath,
  resolveModuleDeep,
} from '../utils/resolveModule';
import { isLocalImport } from '../utils/isLocalModule';

import { buildPagesIndex, type PageInfo } from './collectPages';
import { buildReverseDeps, findOwningPages } from './depsGraph';
import { ParserBabel } from '../adapters/parserBabel';

import type { ClassifiedReport } from '../classifiers/aggregate';
import type { ClassifiedItem } from '../classifiers/deriveComponentType';
import type { FileScan } from '../domain/model';

type ExportResolverCtx = {
  cwd: string;
  aliases: Record<string, string | string[]> | undefined;
};

const parser = new ParserBabel();
const astCache = new Map<string, t.File | null>();
const resolvedExportCache = new Map<string, string | null>();

const loadAst = async (file: string): Promise<t.File | null> => {
  if (astCache.has(file)) return astCache.get(file) ?? null;
  try {
    const code = await fs.readFile(file, 'utf8');
    const parsed = parser.parse(code) as unknown as t.File;
    astCache.set(file, parsed);
    return parsed;
  } catch {
    astCache.set(file, null);
    return null;
  }
};

const resolveModuleFile = async (
  ctx: ExportResolverCtx,
  fromFile: string,
  spec: string,
): Promise<string | null> => {
  const deepLocal = await resolveModuleDeep(fromFile, spec);
  if (deepLocal) return deepLocal;
  const shallowLocal = await resolveImportPath(fromFile, spec);
  if (shallowLocal) return shallowLocal;
  const deepAlias = await resolveAliasModuleDeep(ctx.cwd, ctx.aliases, spec);
  if (deepAlias) return deepAlias;
  return resolveAliasImportPath(ctx.cwd, ctx.aliases, spec);
};

const resolveExportedFile = async (
  ctx: ExportResolverCtx,
  moduleFile: string,
  exportName: string,
  visited: Set<string>,
): Promise<string | null> => {
  const cacheKey = `${moduleFile}::${exportName}`;
  if (resolvedExportCache.has(cacheKey)) return resolvedExportCache.get(cacheKey) ?? null;
  const visitKey = `${moduleFile}::${exportName}`;
  if (visited.has(visitKey)) return null;
  visited.add(visitKey);
  try {
    const parsed = await loadAst(moduleFile);
    if (!parsed) return null;

    for (const stmt of parsed.program.body) {
      if (t.isExportDefaultDeclaration(stmt)) {
        if (exportName === 'default') {
          resolvedExportCache.set(cacheKey, moduleFile);
          return moduleFile;
        }
        continue;
      }

      if (t.isExportNamedDeclaration(stmt)) {
        if (!stmt.source) {
          if (stmt.declaration) {
            if (t.isFunctionDeclaration(stmt.declaration) || t.isClassDeclaration(stmt.declaration)) {
              const id = stmt.declaration.id;
              if (id && t.isIdentifier(id) && id.name === exportName) {
                resolvedExportCache.set(cacheKey, moduleFile);
                return moduleFile;
              }
            }
            if (t.isVariableDeclaration(stmt.declaration)) {
              for (const decl of stmt.declaration.declarations) {
                if (t.isIdentifier(decl.id) && decl.id.name === exportName) {
                  resolvedExportCache.set(cacheKey, moduleFile);
                  return moduleFile;
                }
              }
            }
          }

          for (const spec of stmt.specifiers) {
            if (!t.isExportSpecifier(spec)) continue;
            const exported = t.isIdentifier(spec.exported) ? spec.exported.name : spec.exported.value;
            if (exported === exportName) {
              resolvedExportCache.set(cacheKey, moduleFile);
              return moduleFile;
            }
          }
          continue;
        }

        const target = await resolveModuleFile(ctx, moduleFile, String(stmt.source.value));
        if (!target) continue;

        for (const spec of stmt.specifiers) {
          if (!t.isExportSpecifier(spec)) continue;
          const exported = t.isIdentifier(spec.exported) ? spec.exported.name : spec.exported.value;
          if (exported !== exportName) continue;
          const imported = spec.local.name;
          const resolved = await resolveExportedFile(ctx, target, imported, visited);
          if (resolved) {
            resolvedExportCache.set(cacheKey, resolved);
            return resolved;
          }
        }
      }

      if (t.isExportAllDeclaration(stmt) && stmt.source) {
        const target = await resolveModuleFile(ctx, moduleFile, String(stmt.source.value));
        if (!target) continue;
        const resolved = await resolveExportedFile(ctx, target, exportName, visited);
        if (resolved) {
          resolvedExportCache.set(cacheKey, resolved);
          return resolved;
        }
      }
    }
  } catch {
    /* empty */
  } finally {
    visited.delete(visitKey);
  }

  resolvedExportCache.set(cacheKey, null);
  return null;
};

const normSourceLib = (it: ClassifiedItem): 'antd' | 'antd-wrapped' | 'ksnm-common-ui' | 'local' => {
  if (it.type === COMPONENT_TYPES.ANTD) return it.label === WRAPPER_LABEL ? 'antd-wrapped' : 'antd';
  if (it.type === COMPONENT_TYPES.KSNM) return 'ksnm-common-ui';
  return 'local';
};

export const runEnrichAndExcel = async (cwd: string = process.cwd()) => {
  const cfg = await loadCfg(cwd);
  const s1Path = path.join(cwd, '.ui-audit', 'tmp', 'stage1-scan.json');
  const s3Path = path.join(cwd, '.ui-audit', 'tmp', 'classified-final.json');

  const s1 = (await fs.readJSON(s1Path)) as { scans: FileScan[] };
  const final = (await fs.readJSON(s3Path)) as ClassifiedReport;

  const resolverCtx: ExportResolverCtx = { cwd: cfg.cwd, aliases: cfg.aliases };

  // Позволяет восстановить путь до файла компонента при выводе деталей
  const scanByFile = new Map<string, FileScan>();
  for (const scan of s1.scans) scanByFile.set(scan.file.replace(/\\/g, '/'), scan);

  const resolveComponentFile = async (it: ClassifiedItem): Promise<string | null> => {
    const scan = scanByFile.get(it.file);
    const baseName = it.component.includes('.') ? it.component.split('.')[0] : it.component;
    const importInfo = scan?.imports.find((im) => im.localName === baseName);
    const source = it.sourceModule ?? importInfo?.source;

    if (!source) return null;

    const resolvedModule = await resolveModuleFile(resolverCtx, it.file, source);
    if (!resolvedModule) return null;

    if (importInfo && isLocalImport(source, cfg.aliases)) {
      const exportName = importInfo.importedName && importInfo.importedName !== '*' ? importInfo.importedName : 'default';
      const resolvedExport = await resolveExportedFile(resolverCtx, resolvedModule, exportName, new Set());
      if (resolvedExport) return resolvedExport;
    }

    return resolvedModule;
  };

  const deps = await buildReverseDeps(cwd, s1.scans, cfg.aliases);

  // строим индекс страниц из routeConfig
  const pages = await buildPagesIndex(cwd, cfg.routerFiles ?? [], cfg.aliases);
  // Дополнительно: создаём быстрый поиск страниц по двум ключам
  const isPage = (file: string): PageInfo | undefined => pages[file];

  const details: DetailRow[] = [];

  const toRelative = (filePath: string | undefined | null): string | undefined => {
    if (!filePath) return undefined;
    const rel = path.relative(cfg.cwd, filePath).replace(/\\/g, '/');
    return rel || '.';
  };

  const formatRoute = (route?: string): string | undefined => {
    if (!route) return undefined;
    if (route === '/') return '/';
    const trimmed = route.replace(/^\/+/, '');
    return `/${trimmed}`;
  };

  for (const it of final.items) {
    const lib = normSourceLib(it);

    const resolvedPath = await resolveComponentFile(it);

    let componentFileRaw = '';
    if (lib === 'antd-wrapped' || lib === 'antd') {
      componentFileRaw = it.componentFile ?? resolvedPath ?? it.sourceModule ?? 'antd';
    } else if (lib === 'ksnm-common-ui') {
      componentFileRaw = 'ksnm-common-ui';
    } else {
      componentFileRaw = it.componentFile ?? resolvedPath ?? it.file;
    }

    // 1) прямое попадание файла в индекс страниц (tsx)
    const owners: PageInfo[] = [];
    const direct = isPage(it.file);
    if (direct) owners.push(direct);

    // 2) если нет прямого попадания — ищем через обратные зависимости (поднимемся до barrel/index.ts, который есть в pages)
    if (!direct) owners.push(...findOwningPages(it.file, pages, deps));

    const componentFile =
      componentFileRaw === 'antd' || componentFileRaw === 'ksnm-common-ui'
        ? componentFileRaw
        : toRelative(componentFileRaw) ?? componentFileRaw;

    const usageCount = Math.max(1, it.count ?? 1);
    const targets = owners.length > 0 ? owners : [undefined];

    for (const owner of targets) {
      for (let idx = 0; idx < usageCount; idx += 1) {
        details.push({
          pageTitle: owner?.pageTitle,
          pageFile: toRelative(owner?.pageFilePath),
          route: formatRoute(owner?.pageRoute),
          uiComponent: it.component,
          componentFile,
          label: it.label,
          sourceLib: lib,
          type: it.type,
          usageIndex: usageCount > 1 ? idx + 1 : undefined,
        });
      }
    }
  }

  details.sort((a, b) => {
    const routeA = a.route ?? '';
    const routeB = b.route ?? '';
    if (routeA !== routeB) return routeA.localeCompare(routeB, 'ru');
    const pageA = a.pageFile ?? '';
    const pageB = b.pageFile ?? '';
    if (pageA !== pageB) return pageA.localeCompare(pageB, 'ru');
    return a.uiComponent.localeCompare(b.uiComponent, 'ru');
  });

  const xlsxPath = await writeExcel(cwd, cfg.projectName, final, details);
  console.log('── UI-Audit / Excel');
  console.log(`Excel: ${xlsxPath}`);
  return xlsxPath;
};
