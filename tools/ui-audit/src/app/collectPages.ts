import path from 'node:path';

import traverse, { type NodePath as NP } from '@babel/traverse';
import * as t from '@babel/types';
import fs from 'fs-extra';

import { ParserBabel } from '../adapters/parserBabel';
import { resolveImportPath } from '../utils/resolveModule';

export type PageInfo = { pageTitle?: string; pageRoute?: string; pageFilePath?: string; componentName?: string };

const extractRoutePathMap = async (routeConfigPath: string): Promise<Record<string, string>> => {
  const parser = new ParserBabel();
  const code = await fs.readFile(routeConfigPath, 'utf8');
  const ast = parser.parse(code) as unknown as t.File;
  const map: Record<string, string> = {};

  traverse(ast, {
    VariableDeclarator: (p: NP<t.VariableDeclarator>) => {
      if (!p.node.id || !t.isIdentifier(p.node.id)) return;
      if (p.node.id.name !== 'RoutePath') return;
      let init: t.Node | null | undefined = p.node.init;
      if (!init) return;
      if (t.isTSAsExpression(init) || t.isTSTypeAssertion(init)) init = init.expression as t.Node;
      if (!init || !t.isObjectExpression(init)) return;
      for (const prop of init.properties) {
        if (!t.isObjectProperty(prop)) continue;
        const key = t.isIdentifier(prop.key) ? prop.key.name : t.isStringLiteral(prop.key) ? prop.key.value : undefined;
        if (!key) continue;
        const val = prop.value;
        if (t.isTemplateLiteral(val)) {
          // `${prefixRouteUrl}faq` -> берём только «статические» куски quasis
          const cooked = val.quasis.map((q) => q.value.cooked ?? '').join('');
          map[key] = cooked.startsWith('/') ? cooked.slice(1) : cooked;
        } else if (t.isStringLiteral(val)) {
          const raw = val.value;
          map[key] = raw.startsWith('/') ? raw.slice(1) : raw;
        }
      }
    },
  });

  return map;
};

export const collectPagesFromRouter = async (cwd: string, routerFile: string): Promise<Record<string, PageInfo>> => {
  const parser = new ParserBabel();
  const abs = path.isAbsolute(routerFile) ? routerFile : path.join(cwd, routerFile);
  const code = await fs.readFile(abs, 'utf8');
  const ast = parser.parse(code) as unknown as t.File;

  // localName -> source
  const importMap = new Map<string, string>();
  traverse(ast, {
    ImportDeclaration: (p) => {
      const src = (p.node.source.value || '') as string;
      for (const sp of p.node.specifiers) {
        if (t.isImportSpecifier(sp) || t.isImportDefaultSpecifier(sp)) {
          importMap.set(sp.local.name, src);
        }
      }
    },
  });

  // ищем файл, который экспортирует RoutePath (по имени символа, а не по пути)
  const routePathSource = Array.from(importMap.entries()).find(([local]) => local === 'RoutePath')?.[1];
  let routeMap: Record<string, string> = {};
  if (routePathSource) {
    const resolved = await resolveImportPath(abs, routePathSource, { cwd, aliases: {} }); // тут алиасы обычно не нужны
    if (resolved) routeMap = await extractRoutePathMap(resolved);
  }

  type RawRoute = { title?: string; routeClean?: string; compId?: string };
  const rawRoutes: RawRoute[] = [];

  traverse(ast, {
    ObjectProperty: (p) => {
      if (t.isIdentifier(p.node.key) && p.node.key.name === 'routes' && t.isArrayExpression(p.node.value)) {
        for (const el of p.node.value.elements) {
          if (!el || !t.isObjectExpression(el)) continue;
          let title: string | undefined;
          let pathExpr: t.Node | undefined;
          let compId: string | undefined;

          for (const prop of el.properties) {
            if (!t.isObjectProperty(prop)) continue;
            const k = t.isIdentifier(prop.key) ? prop.key.name : t.isStringLiteral(prop.key) ? prop.key.value : '';
            if (k === 'title' && t.isStringLiteral(prop.value)) title = prop.value.value;
            if (k === 'path') pathExpr = prop.value;
            if (k === 'component' && t.isIdentifier(prop.value)) compId = prop.value.name;
          }

          let routeClean: string | undefined;
          if (
            pathExpr &&
            t.isMemberExpression(pathExpr) &&
            t.isIdentifier(pathExpr.object) &&
            t.isIdentifier(pathExpr.property)
          ) {
            const key = pathExpr.property.name;
            routeClean = routeMap[key] || '';
          } else if (pathExpr && t.isStringLiteral(pathExpr)) {
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
    const pageFilePath = await resolveImportPath(abs, spec, { cwd, aliases: {} });
    if (pageFilePath) {
      pages[pageFilePath] = {
        pageTitle: r.title,
        pageRoute: r.routeClean,
        pageFilePath,
        componentName: r.compId,
      };
    }
  }
  return pages;
};

export const buildPagesIndex = async (cwd: string, routerFiles: string[]): Promise<Record<string, PageInfo>> => {
  const acc: Record<string, PageInfo> = {};
  for (const rf of routerFiles) Object.assign(acc, await collectPagesFromRouter(cwd, rf));
  return acc;
};
