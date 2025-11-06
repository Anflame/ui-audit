// src/app/collectPages.ts
import path from 'node:path';

import traverse, { type NodePath as NP } from '@babel/traverse';
import * as t from '@babel/types';
import fs from 'fs-extra';

import { ParserBabel } from '../adapters/parserBabel';
import { resolveImportPath, resolveModuleDeep } from '../utils/resolveModule';

export type PageInfo = {
  pageTitle?: string;
  pageRoute?: string;
  pageFilePath?: string;
  componentName?: string;
};

const extractRoutePathMap = async (entryPath: string): Promise<Record<string, string>> => {
  const parser = new ParserBabel();
  const code = await fs.readFile(entryPath, 'utf8');
  const ast = parser.parse(code) as unknown as t.File;

  // ВАЖНО: явная аннотация, чтобы TS не превращал в never
  let foundObject: t.ObjectExpression | null = null;

  traverse(ast, {
    VariableDeclarator(p: NP<t.VariableDeclarator>): void {
      if (foundObject) return;
      if (!p.node.id || !t.isIdentifier(p.node.id)) return;
      if (p.node.id.name !== 'RoutePath') return;

      let init: t.Node | null | undefined = p.node.init;
      if (!init) return;

      // снимаем TS-обёртки
      if (t.isTSAsExpression(init) || t.isTSTypeAssertion(init)) init = init.expression as t.Node;

      if (init && t.isObjectExpression(init)) {
        foundObject = init;
      }
    },
  });

  const map: Record<string, string> = {};

  // берём локальную переменную для уверенного сужения типа
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
        const clean = cooked.startsWith('/') ? cooked.slice(1) : cooked;
        map[key] = clean || '/';
      } else if (t.isStringLiteral(val)) {
        const raw = val.value;
        const clean = raw.startsWith('/') ? raw.slice(1) : raw;
        map[key] = clean || '/';
      }
    }
  }

  return map;
};

export const collectPagesFromRouter = async (cwd: string, routerFile: string): Promise<Record<string, PageInfo>> => {
  const parser = new ParserBabel();
  const abs = path.isAbsolute(routerFile) ? routerFile : path.join(cwd, routerFile);
  const code = await fs.readFile(abs, 'utf8');
  const ast = parser.parse(code) as unknown as t.File;

  // local importName -> spec
  const importMap = new Map<string, string>();
  traverse(ast, {
    ImportDeclaration(p) {
      const src = (p.node.source.value || '') as string;
      for (const sp of p.node.specifiers) {
        if (t.isImportSpecifier(sp) || t.isImportDefaultSpecifier(sp)) {
          importMap.set(sp.local.name, src);
        }
      }
    },
  });

  // где объявлен RoutePath
  const routePathImportSpec = Array.from(importMap.entries()).find(([, v]) => v.includes('routeConfig'))?.[1];
  let routeMap: Record<string, string> = {};
  if (routePathImportSpec) {
    const resolved = await resolveImportPath(abs, routePathImportSpec);
    if (resolved) routeMap = await extractRoutePathMap(resolved);
  }

  type RawRoute = { title?: string; routeClean?: string; compId?: string };
  const rawRoutes: RawRoute[] = [];

  // Собираем объекты из массива routes: [{ title, path: RoutePath.X || '/y', component: Comp }]
  traverse(ast, {
    ObjectProperty(p) {
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
    const shallow = await resolveImportPath(abs, spec);
    const deep = await resolveModuleDeep(abs, spec);
    const target = deep ?? shallow;
    if (!target) continue;

    const info: PageInfo = {
      pageTitle: r.title,
      pageRoute: r.routeClean,
      pageFilePath: target,
      componentName: r.compId,
    };

    pages[target] = info;
    if (shallow && shallow !== target) pages[shallow] = info;
  }

  return pages;
};

export const buildPagesIndex = async (cwd: string, routerFiles: string[]): Promise<Record<string, PageInfo>> => {
  const acc: Record<string, PageInfo> = {};
  for (const rf of routerFiles) {
    Object.assign(acc, await collectPagesFromRouter(cwd, rf));
  }
  return acc;
};
