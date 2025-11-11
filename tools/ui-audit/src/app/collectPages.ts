// src/app/collectPages.ts
import path from 'node:path';

import traverse, { type NodePath as NP } from '@babel/traverse';
import * as t from '@babel/types';
import fs from 'fs-extra';

import { ParserBabel } from '../adapters/parserBabel';
import {
  resolveAliasImportPath,
  resolveAliasModuleDeep,
  resolveImportPath,
  resolveModuleDeep,
} from '../utils/resolveModule';
import { toPosixOrNull, toPosixPath } from '../utils/normalizePath';

export type PageInfo = {
  pageTitle?: string;
  pageRoute?: string;
  pageFilePath?: string;
  componentName?: string;
};

type AliasMap = Record<string, string | string[]> | undefined;

type ImportEntry = {
  local: string;
  source: string;
  imported: string | null;
  kind: 'named' | 'default' | 'namespace';
};

type LazyEntry = {
  importPath: string;
};

type ReExportEntry = {
  exported: string | null;
  imported: string | null;
  source: string;
  all?: boolean;
};

type ModuleMeta = {
  filePath: string;
  ast: t.File;
  importMap: Map<string, ImportEntry>;
  definitions: Map<string, t.Node>;
  exports: Map<string, t.Node>;
  defaultExport?: t.Node;
  lazyComponents: Map<string, LazyEntry>;
  reExports: ReExportEntry[];
};

type BaseContext = {
  cwd: string;
  aliases: AliasMap;
  parser: ParserBabel;
};

type ModuleContext = ModuleMeta & { base: BaseContext };

type ResolvedNode = {
  node: t.ObjectExpression | t.ArrayExpression;
  ctx: ModuleContext;
};

type RawRoute = {
  title?: string;
  routeClean?: string;
  compId?: string;
  lazySpec?: string;
  ctx: ModuleContext;
};

const moduleCache = new Map<string, Promise<ModuleMeta>>();

const unwrapExpression = (node: t.Node | null | undefined): t.Node | null => {
  let current = node ?? null;
  while (current) {
    if (t.isTSAsExpression(current) || t.isTSTypeAssertion(current) || t.isTSNonNullExpression(current)) {
      current = current.expression as t.Node;
      continue;
    }
    if (t.isParenthesizedExpression(current)) {
      current = current.expression;
      continue;
    }
    break;
  }
  return current;
};

const cleanRouteString = (raw: string): string => {
  const trimmed = raw.startsWith('/') ? raw.slice(1) : raw;
  return trimmed || '/';
};

const getPropertyName = (key: t.Expression | t.PrivateName): string | null => {
  if (t.isIdentifier(key)) return key.name;
  if (t.isStringLiteral(key)) return key.value;
  return null;
};

const isLazyCallee = (node: t.Expression): boolean => {
  if (t.isIdentifier(node)) return node.name === 'lazy';
  if (t.isMemberExpression(node) && t.isIdentifier(node.property)) {
    return node.property.name === 'lazy';
  }
  return false;
};

const extractImportFromDynamic = (call: t.CallExpression): string | null => {
  if (call.callee.type !== 'Import') return null;
  const [arg] = call.arguments;
  if (!arg) return null;
  const norm = unwrapExpression(arg as t.Node);
  if (norm && t.isStringLiteral(norm)) return norm.value;
  return null;
};

const extractLazyImportPath = (expr: t.Node | null): string | null => {
  if (!expr || !t.isCallExpression(expr)) return null;
  if (!isLazyCallee(expr.callee)) return null;

  const [firstArg] = expr.arguments;
  if (!firstArg) return null;

  const resolved = unwrapExpression(firstArg as t.Node);
  if (resolved && (t.isArrowFunctionExpression(resolved) || t.isFunctionExpression(resolved))) {
    const extractFromBody = (node: t.Node | null | undefined): string | null => {
      if (!node) return null;
      const unwrapped = unwrapExpression(node as t.Node);
      if (!unwrapped) return null;
      if (t.isAwaitExpression(unwrapped)) return extractFromBody(unwrapped.argument as t.Node);
      if (t.isCallExpression(unwrapped)) {
        const direct = extractImportFromDynamic(unwrapped);
        if (direct) return direct;
        if (t.isMemberExpression(unwrapped.callee) && t.isCallExpression(unwrapped.callee.object)) {
          return extractFromBody(unwrapped.callee.object);
        }
      }
      return null;
    };

    if (t.isCallExpression(resolved.body) || t.isAwaitExpression(resolved.body)) {
      const found = extractFromBody(resolved.body);
      if (found) return found;
    }
    if (t.isBlockStatement(resolved.body)) {
      for (const stmt of resolved.body.body) {
        if (t.isReturnStatement(stmt)) {
          const found = extractFromBody(stmt.argument as t.Node);
          if (found) return found;
        }
      }
    }
  }

  return null;
};

const analyzeModule = async (filePath: string, parser: ParserBabel): Promise<ModuleMeta> => {
  const cached = moduleCache.get(filePath);
  if (cached) return cached;

  const pending = (async () => {
    const code = await fs.readFile(filePath, 'utf8');
    const ast = parser.parse(code) as unknown as t.File;

    const importMap = new Map<string, ImportEntry>();
    const definitions = new Map<string, t.Node>();
    const exports = new Map<string, t.Node>();
    const lazyComponents = new Map<string, LazyEntry>();
    const reExports: ReExportEntry[] = [];

    traverse(ast, {
      ImportDeclaration(p) {
        const src = (p.node.source.value || '') as string;
        for (const spec of p.node.specifiers) {
          if (t.isImportSpecifier(spec)) {
            const imported = t.isIdentifier(spec.imported)
              ? spec.imported.name
              : spec.imported.value;
            importMap.set(spec.local.name, {
              local: spec.local.name,
              source: src,
              imported,
              kind: 'named',
            });
          } else if (t.isImportDefaultSpecifier(spec)) {
            importMap.set(spec.local.name, {
              local: spec.local.name,
              source: src,
              imported: 'default',
              kind: 'default',
            });
          } else if (t.isImportNamespaceSpecifier(spec)) {
            importMap.set(spec.local.name, {
              local: spec.local.name,
              source: src,
              imported: null,
              kind: 'namespace',
            });
          }
        }
      },
      VariableDeclarator(p: NP<t.VariableDeclarator>) {
        if (!t.isIdentifier(p.node.id)) return;
        const init = unwrapExpression(p.node.init as t.Node);
        if (!init) return;
        definitions.set(p.node.id.name, init);
        const lazyImport = extractLazyImportPath(init);
        if (lazyImport) {
          lazyComponents.set(p.node.id.name, { importPath: lazyImport });
        }
      },
      ExportNamedDeclaration(p) {
        const decl = p.node.declaration;
        const source = p.node.source ? ((p.node.source.value || '') as string) : null;

        if (decl && t.isVariableDeclaration(decl)) {
          for (const d of decl.declarations) {
            if (!t.isIdentifier(d.id)) continue;
            const value = unwrapExpression(d.init as t.Node);
            if (!value) continue;
            definitions.set(d.id.name, value);
            exports.set(d.id.name, value);
            const lazyImport = extractLazyImportPath(value);
            if (lazyImport) lazyComponents.set(d.id.name, { importPath: lazyImport });
          }
        } else if (decl && t.isIdentifier(decl)) {
          const existing = definitions.get(decl.name);
          if (existing) exports.set(decl.name, existing);
        }

        for (const spec of p.node.specifiers) {
          if (!t.isIdentifier(spec.local) && !t.isStringLiteral(spec.local)) continue;
          const local = t.isIdentifier(spec.local) ? spec.local.name : spec.local.value;
          const exported = t.isIdentifier(spec.exported) ? spec.exported.name : spec.exported.value;

          if (source) {
            reExports.push({ exported, imported: local, source });
          } else {
            const resolved = definitions.get(local);
            if (resolved) exports.set(exported, resolved);
          }
        }
      },
      ExportDefaultDeclaration(p) {
        const decl = unwrapExpression(p.node.declaration as t.Node);
        if (!decl) return;
        if (t.isIdentifier(decl)) {
          const resolved = definitions.get(decl.name);
          if (resolved) exports.set('default', resolved);
        } else {
          exports.set('default', decl);
        }
      },
      ExportAllDeclaration(p) {
        if (p.node.source && t.isStringLiteral(p.node.source)) {
          reExports.push({ exported: null, imported: null, source: p.node.source.value, all: true });
        }
      },
    });

    const defaultExport = exports.get('default');

    return {
      filePath,
      ast,
      importMap,
      definitions,
      exports,
      defaultExport,
      lazyComponents,
      reExports,
    } satisfies ModuleMeta;
  })();

  moduleCache.set(filePath, pending);
  return pending;
};

const loadModuleContext = async (filePath: string, base: BaseContext): Promise<ModuleContext> => {
  const meta = await analyzeModule(filePath, base.parser);
  return { ...meta, base };
};

const resolveModuleFile = async (ctx: ModuleContext, spec: string): Promise<string | null> => {
  const deepLocal = await resolveModuleDeep(ctx.filePath, spec);
  if (deepLocal) return deepLocal;
  const shallowLocal = await resolveImportPath(ctx.filePath, spec);
  if (shallowLocal) return shallowLocal;
  const deepAlias = await resolveAliasModuleDeep(ctx.base.cwd, ctx.base.aliases, spec);
  if (deepAlias) return deepAlias;
  return resolveAliasImportPath(ctx.base.cwd, ctx.base.aliases, spec);
};

const resolveExportedNode = async (
  ctx: ModuleContext,
  exportName: string,
  visited: Set<string>,
): Promise<t.Node | null> => {
  if (exportName === 'default' && ctx.defaultExport) return ctx.defaultExport;
  const direct = ctx.exports.get(exportName);
  if (direct) return direct;

  for (const re of ctx.reExports) {
    if (re.all) {
      const targetPath = await resolveModuleFile(ctx, re.source);
      if (!targetPath) continue;
      const key = `${targetPath}::${exportName}`;
      if (visited.has(key)) continue;
      visited.add(key);
      try {
        const targetCtx = await loadModuleContext(targetPath, ctx.base);
        const resolved = await resolveExportedNode(targetCtx, exportName, visited);
        if (resolved) return resolved;
      } finally {
        visited.delete(key);
      }
      continue;
    }

    const exportedName = re.exported ?? re.imported;
    if (!exportedName) continue;
    if (exportedName !== exportName) continue;
    const imported = re.imported ?? exportName;
    const targetPath = await resolveModuleFile(ctx, re.source);
    if (!targetPath) continue;
    const key = `${targetPath}::${imported}`;
    if (visited.has(key)) continue;
    visited.add(key);
    try {
      const targetCtx = await loadModuleContext(targetPath, ctx.base);
      const resolved = await resolveExportedNode(targetCtx, imported, visited);
      if (resolved) return resolved;
    } finally {
      visited.delete(key);
    }
  }

  return null;
};

const resolveExportedFilePath = async (
  ctx: ModuleContext,
  exportName: string,
  visited: Set<string>,
): Promise<string | null> => {
  if (exportName === 'default') {
    if (ctx.defaultExport || ctx.exports.has('default')) return ctx.filePath;
  } else if (ctx.exports.has(exportName)) {
    return ctx.filePath;
  }

  for (const re of ctx.reExports) {
    if (re.all) {
      const targetPath = await resolveModuleFile(ctx, re.source);
      if (!targetPath) continue;
      const key = `${targetPath}::${exportName}`;
      if (visited.has(key)) continue;
      visited.add(key);
      try {
        const targetCtx = await loadModuleContext(targetPath, ctx.base);
        const resolved = await resolveExportedFilePath(targetCtx, exportName, visited);
        if (resolved) return resolved;
      } finally {
        visited.delete(key);
      }
      continue;
    }

    const exportedName = re.exported ?? re.imported;
    if (!exportedName) continue;
    if (exportedName !== exportName) continue;
    const imported = re.imported ?? exportName;
    const targetPath = await resolveModuleFile(ctx, re.source);
    if (!targetPath) continue;
    const key = `${targetPath}::${imported}`;
    if (visited.has(key)) continue;
    visited.add(key);
    try {
      const targetCtx = await loadModuleContext(targetPath, ctx.base);
      const resolved = await resolveExportedFilePath(targetCtx, imported, visited);
      if (resolved) return resolved;
    } finally {
      visited.delete(key);
    }
  }

  return null;
};

const resolveIdentifierValue = async (
  id: t.Identifier,
  ctx: ModuleContext,
  visited: Set<string>,
): Promise<ResolvedNode | null> => {
  const local = ctx.definitions.get(id.name);
  if (local && (t.isObjectExpression(local) || t.isArrayExpression(local))) {
    return { node: local, ctx };
  }

  const importEntry = ctx.importMap.get(id.name);
  if (!importEntry) return null;
  if (importEntry.kind === 'namespace') return null;

  const moduleFile = await resolveModuleFile(ctx, importEntry.source);
  if (!moduleFile) return null;

  const exportKey = importEntry.kind === 'default' ? 'default' : importEntry.imported ?? id.name;
  const visitedKey = `${moduleFile}::${exportKey}`;
  if (visited.has(visitedKey)) return null;
  visited.add(visitedKey);
  try {
    const targetCtx = await loadModuleContext(moduleFile, ctx.base);
    const resolved = await resolveExportedNode(targetCtx, exportKey, visited);
    if (resolved && (t.isObjectExpression(resolved) || t.isArrayExpression(resolved))) {
      return { node: resolved, ctx: targetCtx };
    }
  } finally {
    visited.delete(visitedKey);
  }

  return null;
};

const resolveSpreadValue = async (
  expr: t.Expression,
  ctx: ModuleContext,
  visited: Set<string>,
): Promise<ResolvedNode | null> => {
  const unwrapped = unwrapExpression(expr);
  if (!unwrapped) return null;

  if (t.isObjectExpression(unwrapped) || t.isArrayExpression(unwrapped)) {
    return { node: unwrapped, ctx };
  }

  if (t.isIdentifier(unwrapped)) {
    return resolveIdentifierValue(unwrapped, ctx, visited);
  }

  return null;
};

const computeRouteFromExpression = (
  expr: t.Node | undefined,
  routeMap: Record<string, string>,
): string | undefined => {
  if (!expr) return undefined;
  if (t.isStringLiteral(expr)) return cleanRouteString(expr.value);
  if (t.isTemplateLiteral(expr)) {
    let acc = '';
    for (let i = 0; i < expr.quasis.length; i += 1) {
      const quasi = expr.quasis[i];
      acc += quasi?.value.cooked ?? '';
      if (i < expr.expressions.length) {
        const part = computeRouteFromExpression(expr.expressions[i] as t.Node, routeMap);
        if (!part) return undefined;
        acc += part === '/' ? '' : part;
      }
    }
    return cleanRouteString(acc);
  }
  if (t.isBinaryExpression(expr) && expr.operator === '+') {
    const left = computeRouteFromExpression(expr.left as t.Node, routeMap);
    const right = computeRouteFromExpression(expr.right as t.Node, routeMap);
    if (!left || !right) return undefined;
    return cleanRouteString(`${left}${right}`);
  }
  if (
    t.isMemberExpression(expr) &&
    t.isIdentifier(expr.object) &&
    t.isIdentifier(expr.property)
  ) {
    const key = expr.property.name;
    const value = routeMap[key];
    if (value) return value;
  }
  return undefined;
};

const collectRoutesFromObject = async (
  obj: t.ObjectExpression,
  ctx: ModuleContext,
  routeMap: Record<string, string>,
  visited: Set<string>,
): Promise<RawRoute[]> => {
  const nestedArrays: Array<{ array: t.ArrayExpression; ctx: ModuleContext }> = [];
  const results: RawRoute[] = [];

  let title: string | undefined;
  let pathExpr: t.Node | undefined;
  let compId: string | undefined;
  let lazySpec: string | undefined;

  for (const prop of obj.properties) {
    if (t.isObjectProperty(prop)) {
      const keyName = getPropertyName(prop.key as t.Expression);
      if (!keyName) continue;
      const value = unwrapExpression(prop.value as t.Node);

      if (keyName === 'title' && value && t.isStringLiteral(value)) {
        title = value.value;
        continue;
      }

      if (keyName === 'path') {
        pathExpr = value ?? undefined;
        continue;
      }

      if (keyName === 'component') {
        if (value && t.isIdentifier(value)) {
          compId = value.name;
        } else if (value) {
          const lazyImport = extractLazyImportPath(value);
          if (lazyImport) lazySpec = lazyImport;
        }
        continue;
      }

      if ((keyName === 'routes' || keyName === 'children') && value) {
        if (t.isArrayExpression(value)) {
          nestedArrays.push({ array: value, ctx });
        } else if (t.isIdentifier(value)) {
          const resolved = await resolveIdentifierValue(value, ctx, visited);
          if (resolved && t.isArrayExpression(resolved.node)) {
            nestedArrays.push({ array: resolved.node, ctx: resolved.ctx });
          }
        }
      }
    } else if (t.isSpreadElement(prop)) {
      const resolved = await resolveSpreadValue(prop.argument, ctx, visited);
      if (!resolved) continue;
      if (t.isObjectExpression(resolved.node)) {
        const nested = await collectRoutesFromObject(resolved.node, resolved.ctx, routeMap, visited);
        results.push(...nested);
      } else if (t.isArrayExpression(resolved.node)) {
        const nested = await collectRoutesFromArray(resolved.node, resolved.ctx, routeMap, visited);
        results.push(...nested);
      }
    }
  }

  if (compId || lazySpec) {
    results.push({
      title,
      routeClean: computeRouteFromExpression(pathExpr, routeMap),
      compId,
      lazySpec,
      ctx,
    });
  }

  for (const nested of nestedArrays) {
    const nestedRoutes = await collectRoutesFromArray(nested.array, nested.ctx, routeMap, visited);
    results.push(...nestedRoutes);
  }

  return results;
};

const collectRoutesFromArray = async (
  arr: t.ArrayExpression,
  ctx: ModuleContext,
  routeMap: Record<string, string>,
  visited: Set<string>,
): Promise<RawRoute[]> => {
  const results: RawRoute[] = [];

  for (const el of arr.elements) {
    if (!el) continue;

    if (t.isObjectExpression(el)) {
      const nested = await collectRoutesFromObject(el, ctx, routeMap, visited);
      results.push(...nested);
      continue;
    }

    if (t.isSpreadElement(el)) {
      const resolved = await resolveSpreadValue(el.argument, ctx, visited);
      if (!resolved) continue;
      if (t.isArrayExpression(resolved.node)) {
        const nested = await collectRoutesFromArray(resolved.node, resolved.ctx, routeMap, visited);
        results.push(...nested);
      } else if (t.isObjectExpression(resolved.node)) {
        const nested = await collectRoutesFromObject(resolved.node, resolved.ctx, routeMap, visited);
        results.push(...nested);
      }
      continue;
    }

    if (t.isIdentifier(el)) {
      const resolved = await resolveIdentifierValue(el, ctx, visited);
      if (!resolved) continue;
      if (t.isArrayExpression(resolved.node)) {
        const nested = await collectRoutesFromArray(resolved.node, resolved.ctx, routeMap, visited);
        results.push(...nested);
      } else if (t.isObjectExpression(resolved.node)) {
        const nested = await collectRoutesFromObject(resolved.node, resolved.ctx, routeMap, visited);
        results.push(...nested);
      }
    }
  }

  return results;
};

const resolveComponentTarget = async (
  compId: string | undefined,
  lazySpec: string | undefined,
  ctx: ModuleContext,
): Promise<{
  target: string | null;
  shallowRelative: string | null;
  shallowAlias: string | null;
}> => {
  let spec: string | null = null;
  let moduleFile: string | null = null;

  if (compId) {
    const importEntry = ctx.importMap.get(compId);
    if (importEntry) {
      spec = importEntry.source;
      moduleFile = await resolveModuleFile(ctx, importEntry.source);
    } else {
      const lazyEntry = ctx.lazyComponents.get(compId);
      if (lazyEntry?.importPath) {
        spec = lazyEntry.importPath;
        moduleFile = await resolveModuleFile(ctx, lazyEntry.importPath);
      }
    }
  }

  if (!spec && lazySpec) {
    spec = lazySpec;
    moduleFile = await resolveModuleFile(ctx, lazySpec);
  }

  if (!spec) {
    return { target: null, shallowRelative: null, shallowAlias: null };
  }

  const shallowRelative = await resolveImportPath(ctx.filePath, spec);
  const shallowAlias = !shallowRelative
    ? await resolveAliasImportPath(ctx.base.cwd, ctx.base.aliases, spec)
    : null;

  const deepRelative = shallowRelative ? await resolveModuleDeep(ctx.filePath, spec) : null;
  const deepAlias = !deepRelative && shallowAlias
    ? await resolveAliasModuleDeep(ctx.base.cwd, ctx.base.aliases, spec)
    : null;

  const exportBaseRaw = shallowAlias ?? shallowRelative ?? moduleFile ?? deepAlias ?? deepRelative;
  const exportBase = toPosixOrNull(exportBaseRaw);

  let targetRaw = deepRelative ?? deepAlias ?? shallowAlias ?? shallowRelative;

  if (compId && exportBase) {
    const moduleCtx = await loadModuleContext(exportBase, ctx.base);
    const precise = await resolveExportedFilePath(moduleCtx, compId, new Set());
    if (precise) targetRaw = precise;
  }

  const target = toPosixOrNull(targetRaw);

  return {
    target,
    shallowRelative: toPosixOrNull(shallowRelative),
    shallowAlias: toPosixOrNull(shallowAlias),
  };
};

const extractRoutePathMap = async (entryPath: string): Promise<Record<string, string>> => {
  const parser = new ParserBabel();
  const code = await fs.readFile(entryPath, 'utf8');
  const ast = parser.parse(code) as unknown as t.File;

  let foundObject: t.ObjectExpression | null = null;

  traverse(ast, {
    VariableDeclarator(p: NP<t.VariableDeclarator>): void {
      if (foundObject) return;
      if (!p.node.id || !t.isIdentifier(p.node.id)) return;
      if (p.node.id.name !== 'RoutePath') return;

      let init: t.Node | null | undefined = p.node.init;
      if (!init) return;

      if (t.isTSAsExpression(init) || t.isTSTypeAssertion(init)) init = init.expression as t.Node;

      if (init && t.isObjectExpression(init)) {
        foundObject = init;
      }
    },
  });

  const map: Record<string, string> = {};
  const obj = foundObject as t.ObjectExpression | null;
  if (obj) {
    for (const prop of obj.properties) {
      if (!t.isObjectProperty(prop)) continue;

      const key: string | undefined = t.isIdentifier(prop.key)
        ? prop.key.name
        : t.isStringLiteral(prop.key)
          ? prop.key.value
          : undefined;
      if (!key) continue;

      const val = prop.value;
      if (t.isTemplateLiteral(val)) {
        const cooked = val.quasis.map((q) => q.value.cooked ?? '').join('');
        map[key] = cleanRouteString(cooked);
      } else if (t.isStringLiteral(val)) {
        map[key] = cleanRouteString(val.value);
      }
    }
  }

  return map;
};

export const collectPagesFromRouter = async (
  cwd: string,
  routerFile: string,
  aliases: AliasMap,
): Promise<Record<string, PageInfo>> => {
  const parser = new ParserBabel();
  const absRaw = path.isAbsolute(routerFile) ? routerFile : path.join(cwd, routerFile);
  const abs = toPosixPath(absRaw);

  const base: BaseContext = { cwd, aliases, parser };
  const moduleCtx = await loadModuleContext(abs, base);

  const routePathImport = moduleCtx.importMap.get('RoutePath');
  let routeMap: Record<string, string> = {};

  if (routePathImport) {
    const moduleFile = await resolveModuleFile(moduleCtx, routePathImport.source);
    if (moduleFile) {
      routeMap = await extractRoutePathMap(moduleFile);
    }
  } else {
    for (const entry of moduleCtx.importMap.values()) {
      if (entry.imported === 'RoutePath') {
        const moduleFile = await resolveModuleFile(moduleCtx, entry.source);
        if (moduleFile) {
          routeMap = await extractRoutePathMap(moduleFile);
          break;
        }
      }
    }
  }

  const arrayNodes: Array<t.ArrayExpression> = [];
  const identifierNodes: t.Identifier[] = [];

  traverse(moduleCtx.ast, {
    ObjectProperty(p) {
      const keyName = getPropertyName(p.node.key as t.Expression);
      if (keyName !== 'routes') return;
      const value = unwrapExpression(p.node.value as t.Node);
      if (!value) return;
      if (t.isArrayExpression(value)) {
        arrayNodes.push(value);
      } else if (t.isIdentifier(value)) {
        identifierNodes.push(value);
      }
    },
  });

  const rawRoutes: RawRoute[] = [];
  const visited = new Set<string>();

  for (const arr of arrayNodes) {
    const nested = await collectRoutesFromArray(arr, moduleCtx, routeMap, visited);
    rawRoutes.push(...nested);
  }

  for (const id of identifierNodes) {
    const resolved = await resolveIdentifierValue(id, moduleCtx, visited);
    if (!resolved) continue;
    if (t.isArrayExpression(resolved.node)) {
      const nested = await collectRoutesFromArray(resolved.node, resolved.ctx, routeMap, visited);
      rawRoutes.push(...nested);
    } else if (t.isObjectExpression(resolved.node)) {
      const nested = await collectRoutesFromObject(resolved.node, resolved.ctx, routeMap, visited);
      rawRoutes.push(...nested);
    }
  }

  const pages: Record<string, PageInfo> = {};

  for (const r of rawRoutes) {
    if (!r.compId && !r.lazySpec) continue;

    const { target, shallowAlias, shallowRelative } = await resolveComponentTarget(
      r.compId,
      r.lazySpec,
      r.ctx,
    );
    if (!target) continue;

    const info: PageInfo = {
      pageTitle: r.title,
      pageRoute: r.routeClean,
      pageFilePath: target,
      componentName: r.compId,
    };

    pages[target] = info;
    if (shallowRelative && shallowRelative !== target) pages[shallowRelative] = info;
    if (shallowAlias && shallowAlias !== target) pages[shallowAlias] = info;
  }

  return pages;
};

export const buildPagesIndex = async (
  cwd: string,
  routerFiles: string[],
  aliases: AliasMap,
): Promise<Record<string, PageInfo>> => {
  const acc: Record<string, PageInfo> = {};
  for (const rf of routerFiles) {
    Object.assign(acc, await collectPagesFromRouter(cwd, rf, aliases));
  }
  return acc;
};
