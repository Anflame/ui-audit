import path from 'node:path';

// @ts-expect-error: typings for @babel/traverse are not available in this package
import traverse, { type NodePath } from '@babel/traverse';
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

const WRAPPER_LABEL = 'Обёртка над Ant Design';

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
    for (const rawTarget of Object.values(cfg.aliases)) {
      const targets = Array.isArray(rawTarget) ? rawTarget : [rawTarget];
      for (const target of targets) {
        if (typeof target !== 'string' || target.length === 0) continue;
        const absTarget = path.isAbsolute(target) ? target : path.resolve(cfg.cwd, target);
        const normalized = toPosixPath(absTarget);
        const marker = '/components/common';
        const idx = normalized.indexOf(marker);
        if (idx !== -1) {
          roots.add(normalized.slice(0, idx + marker.length));
        }
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

const getJsxElementName = (
  name: t.JSXIdentifier | t.JSXMemberExpression | t.JSXNamespacedName,
): string | null => {
  if (t.isJSXIdentifier(name)) return name.name;
  if (t.isJSXMemberExpression(name)) {
    const resolveMember = (expr: t.JSXMemberExpression): string => {
      const left = t.isJSXIdentifier(expr.object)
        ? expr.object.name
        : t.isJSXMemberExpression(expr.object)
          ? resolveMember(expr.object)
          : '';
      const right = t.isJSXIdentifier(expr.property) ? expr.property.name : '';
      if (left && right) return `${left}.${right}`;
      return right || left || '';
    };
    const res = resolveMember(name);
    return res || null;
  }
  if (t.isJSXNamespacedName(name)) {
    const ns = t.isJSXIdentifier(name.namespace) ? name.namespace.name : '';
    const local = t.isJSXIdentifier(name.name) ? name.name.name : '';
    if (ns && local) return `${ns}:${local}`;
    return local || ns || null;
  }
  return null;
};

const dropNestedWithinWrappers = async (
  parser: ParserBabel,
  items: ClassifiedItem[],
): Promise<ClassifiedItem[]> => {
  const wrappersByFile = new Map<string, Set<string>>();
  const itemsByFile = new Map<string, ClassifiedItem[]>();

  for (const item of items) {
    const file = item.file;
    if (!file) continue;
    if (!itemsByFile.has(file)) itemsByFile.set(file, []);
    itemsByFile.get(file)?.push(item);
    if (item.label === WRAPPER_LABEL) {
      if (!wrappersByFile.has(file)) wrappersByFile.set(file, new Set<string>());
      wrappersByFile.get(file)?.add(item.component);
    }
  }

  if (wrappersByFile.size === 0) return items;

  const astCache = new Map<string, t.File | null>();
  const getAst = async (file: string): Promise<t.File | null> => {
    if (astCache.has(file)) return astCache.get(file) ?? null;
    try {
      const code = await fs.readFile(file, 'utf8');
      const ast = parser.parse(code) as unknown as t.File;
      astCache.set(file, ast);
      return ast;
    } catch {
      astCache.set(file, null);
      return null;
    }
  };

  const dropsByFile = new Map<string, Map<string, number>>();

  for (const [file, wrappers] of wrappersByFile.entries()) {
    if (!file || wrappers.size === 0) continue;
    const fileItems = itemsByFile.get(file);
    if (!fileItems || fileItems.length === 0) continue;

    const tracked = new Set<string>(fileItems.map((it) => it.component));

    const ast = await getAst(file);
    if (!ast) continue;

    const stack: string[] = [];
    const counters = new Map<string, number>();

    traverse(ast, {
      JSXElement: {
        enter(path: NodePath<t.JSXElement>) {
          const name = getJsxElementName(path.node.openingElement.name);
          if (!name) return;
          if (stack.length > 0 && tracked.has(name) && !wrappers.has(name)) {
            counters.set(name, (counters.get(name) ?? 0) + 1);
          }
          if (wrappers.has(name)) stack.push(name);
        },
        exit(path: NodePath<t.JSXElement>) {
          const name = getJsxElementName(path.node.openingElement.name);
          if (!name) return;
          if (wrappers.has(name)) stack.pop();
        },
      },
    });

    if (counters.size > 0) dropsByFile.set(file, counters);
  }

  if (dropsByFile.size === 0) return items;

  const trimmed: ClassifiedItem[] = [];
  for (const item of items) {
    const file = item.file;
    if (!file) {
      trimmed.push(item);
      continue;
    }
    const counters = dropsByFile.get(file);
    if (!counters) {
      trimmed.push(item);
      continue;
    }
    const drop = counters.get(item.component);
    if (!drop) {
      trimmed.push(item);
      continue;
    }
    const remaining = (item.count ?? 0) - drop;
    if (remaining <= 0) continue;
    trimmed.push({ ...item, count: remaining });
  }

  return trimmed;
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
  const wrapperComponentKeys = new Set<string>();
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
              const wrapperKey = `${it.file}:::${it.component}`;
              wrapperComponentKeys.add(wrapperKey);
              const wrapped: ClassifiedItem = {
                ...it,
                type: COMPONENT_TYPES.LOCAL,
                label: WRAPPER_LABEL,
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

  const pruned = await dropNestedWithinWrappers(parser, updated);

  const filtered: ClassifiedItem[] = [];
  for (const item of pruned) {
    if (item.type === COMPONENT_TYPES.ANTD && item.file && wrapperFiles.has(item.file)) {
      const wrappedLocals = wrappedAntLocalsByFile.get(item.file);
      if (wrappedLocals && wrappedLocals.size > 0) {
        const base = item.component.includes('.') ? item.component.split('.')[0] ?? item.component : item.component;
        if (wrappedLocals.has(base)) continue;
      }
    }

    const wrapperKey = `${item.file}:::${item.component}`;
    if (item.type === COMPONENT_TYPES.LOCAL && isCamelCaseComponent(item.component) && !wrapperComponentKeys.has(wrapperKey)) {
      continue;
    }

    if (item.type === COMPONENT_TYPES.LOCAL && item.sourceModule) {
      const key = `${item.file}:::${item.sourceModule}`;
      if (isLocalImport(item.sourceModule, cfg.aliases) && wrapperLocalImports.has(key)) continue;
    }

    filtered.push(item);
  }

  const summary: Record<string, number> = {
    [COMPONENT_TYPES.ANTD]: 0,
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
