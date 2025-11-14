// src/app/runEnrichAndExcel.ts
import path from 'node:path';

import fs from 'fs-extra';

import { COMPONENT_TYPES } from '../domain/constants';
import { writeExcel, type DetailRow } from '../report/excel';
import { loadConfig as loadCfg } from '../utils/config';

import { buildPagesIndex, type PageInfo } from './collectPages';
import { buildReverseDeps, findOwningPage } from './depsGraph';

import type { ClassifiedReport } from '../classifiers/aggregate';
import type { ClassifiedItem } from '../classifiers/deriveComponentType';
import type { FileScan } from '../domain/model';

const normSourceLib = (it: ClassifiedItem): 'antd' | 'ksnm-common-ui' | 'local' => {
  if (it.type === COMPONENT_TYPES.ANTD) return 'antd';
  if (it.type === COMPONENT_TYPES.KSNM) return 'ksnm-common-ui';
  return 'local';
};

export const runEnrichAndExcel = async (cwd: string = process.cwd()) => {
  const cfg = await loadCfg(cwd);
  const s1Path = path.join(cwd, '.ui-audit', 'tmp', 'stage1-scan.json');
  const s3Path = path.join(cwd, '.ui-audit', 'tmp', 'classified-final.json');

  const s1 = (await fs.readJSON(s1Path)) as { scans: FileScan[] };
  const final = (await fs.readJSON(s3Path)) as ClassifiedReport;

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

    let componentFileRaw = '';
    if (it.type === COMPONENT_TYPES.ANTD) {
      componentFileRaw = it.componentFile ?? 'antd';
    } else if (it.type === COMPONENT_TYPES.KSNM) {
      componentFileRaw = 'ksnm-common-ui';
    } else {
      componentFileRaw = it.componentFile ?? it.file;
    }

    // 1) прямое попадание файла в индекс страниц (tsx)
    let owner = isPage(it.file);

    // 2) если нет — ищем через обратные зависимости (поднимемся до barrel/index.ts, который есть в pages)
    if (!owner) owner = findOwningPage(it.file, pages, deps);

    const componentFile =
      componentFileRaw === 'antd' || componentFileRaw === 'ksnm-common-ui'
        ? componentFileRaw
        : toRelative(componentFileRaw) ?? componentFileRaw;

    const usageCount = Math.max(1, it.count ?? 1);
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
