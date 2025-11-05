import path6 from 'node:path';

import traverse6, { type NodePath as NP6 } from '@babel/traverse';
import * as t6 from '@babel/types';
import fs6 from 'fs-extra';

import { ParserBabel as ParserBabel3 } from '../adapters/parserBabel';
import { resolveImportPath as resolveImportPath2 } from '../utils/resolveModule';

export type PageInfo = { pageTitle?: string; pageRoute?: string; pageFilePath?: string; componentName?: string };

const extractRoutePathMap = async (routeConfigPath: string): Promise<Record<string, string>> => {
  const parser = new ParserBabel3();
  const code = await fs6.readFile(routeConfigPath, 'utf8');
  const ast = parser.parse(code) as unknown as t6.File;
  const map: Record<string, string> = {};
  traverse6(ast, {
    VariableDeclarator: (p: NP6<t6.VariableDeclarator>) => {
      if (!p.node.id || !t6.isIdentifier(p.node.id)) return;
      if (p.node.id.name !== 'RoutePath') return;
      const init = p.node.init;
      if (!init || !t6.isObjectExpression(init)) return;
      for (const prop of init.properties) {
        if (!t6.isObjectProperty(prop)) continue;
        const key = t6.isIdentifier(prop.key)
          ? prop.key.name
          : t6.isStringLiteral(prop.key)
            ? prop.key.value
            : undefined;
        if (!key) continue;
        const val = prop.value;
        if (t6.isTemplateLiteral(val) && val.expressions.length >= 1) {
          const lastQuasi = val.quasis[val.quasis.length - 1];
          const suffix = lastQuasi?.value?.cooked ?? '';
          map[key] = suffix.startsWith('/') ? suffix.slice(1) : suffix;
        } else if (t6.isStringLiteral(val)) {
          const raw = val.value;
          map[key] = raw.startsWith('/') ? raw.slice(1) : raw;
        }
      }
    },
  });
  return map;
};

export const collectPagesFromRouter = async (cwd: string, routerFile: string): Promise<Record<string, PageInfo>> => {
  const parser = new ParserBabel3();
  const abs = path6.isAbsolute(routerFile) ? routerFile : path6.join(cwd, routerFile);
  const code = await fs6.readFile(abs, 'utf8');
  const ast = parser.parse(code) as unknown as t6.File;

  const importMap = new Map<string, string>(); // local -> spec
  traverse6(ast, {
    ImportDeclaration: (p) => {
      const src = (p.node.source.value || '') as string;
      for (const sp of p.node.specifiers)
        if (t6.isImportSpecifier(sp) || t6.isImportDefaultSpecifier(sp)) importMap.set(sp.local.name, src);
    },
  });

  const routePathImport = Array.from(importMap.entries()).find(([, v]) => v.includes('routeConfig'))?.[1];
  let routeMap: Record<string, string> = {};
  if (routePathImport) {
    const resolved = await resolveImportPath2(abs, routePathImport);
    if (resolved) routeMap = await extractRoutePathMap(resolved);
  }

  type RawRoute = { title?: string; routeClean?: string; compId?: string };
  const rawRoutes: RawRoute[] = [];

  traverse6(ast, {
    ObjectProperty: (p) => {
      if (t6.isIdentifier(p.node.key) && p.node.key.name === 'routes' && t6.isArrayExpression(p.node.value)) {
        for (const el of p.node.value.elements) {
          if (!el || !t6.isObjectExpression(el)) continue;
          let title: string | undefined;
          let pathExpr: t6.Node | undefined;
          let compId: string | undefined;
          for (const prop of el.properties) {
            if (!t6.isObjectProperty(prop)) continue;
            const k = t6.isIdentifier(prop.key) ? prop.key.name : t6.isStringLiteral(prop.key) ? prop.key.value : '';
            if (k === 'title' && t6.isStringLiteral(prop.value)) title = prop.value.value;
            if (k === 'path') pathExpr = prop.value;
            if (k === 'component' && t6.isIdentifier(prop.value)) compId = prop.value.name;
          }
          let routeClean: string | undefined;
          if (
            pathExpr &&
            t6.isMemberExpression(pathExpr) &&
            t6.isIdentifier(pathExpr.object) &&
            pathExpr.object.name === 'RoutePath' &&
            t6.isIdentifier(pathExpr.property)
          ) {
            const key = pathExpr.property.name;
            routeClean = routeMap[key] || '';
          } else if (pathExpr && t6.isStringLiteral(pathExpr)) {
            routeClean = pathExpr.value.replace(/^\//, '');
          }
          rawRoutes.push({ title, routeClean, compId });
        }
      }
    },
  });

  const pages: Record<string, PageInfo> = {};
  for (const r of rawRoutes) {
    if (!r.compId) continue;
    const spec = importMap.get(r.compId);
    if (!spec) continue;
    const pageFilePath = await resolveImportPath2(abs, spec);
    if (pageFilePath)
      pages[pageFilePath] = { pageTitle: r.title, pageRoute: r.routeClean, pageFilePath, componentName: r.compId };
  }
  return pages;
};

export const buildPagesIndex = async (cwd: string, routerFiles: string[]): Promise<Record<string, PageInfo>> => {
  const acc: Record<string, PageInfo> = {};
  for (const rf of routerFiles) Object.assign(acc, await collectPagesFromRouter(cwd, rf));
  return acc;
};
