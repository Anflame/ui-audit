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
  if (it.type === COMPONENT_TYPES.ANTD || it.type === COMPONENT_TYPES.ANTD_WRAPPER) return 'antd';
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

  for (const it of final.items) {
    const lib = normSourceLib(it);

    let componentFile = '';
    if (it.type === COMPONENT_TYPES.ANTD) componentFile = 'antd';
    else if (it.type === COMPONENT_TYPES.ANTD_WRAPPER) componentFile = it.componentFile ?? 'antd';
    else if (it.type === COMPONENT_TYPES.KSNM) componentFile = 'ksnm-common-ui';
    else componentFile = it.file;

    // 1) прямое попадание файла в индекс страниц (tsx)
    let owner = isPage(it.file);

    // 2) если нет — ищем через обратные зависимости (поднимемся до barrel/index.ts, который есть в pages)
    if (!owner) owner = findOwningPage(it.file, pages, deps);

    details.push({
      pageTitle: owner?.pageTitle,
      pageFile: owner?.pageFilePath,
      route: owner?.pageRoute,
      uiComponent: it.component,
      componentFile,
      label: it.label,
      sourceLib: lib,
      type: it.type,
    });
  }

  const xlsxPath = await writeExcel(cwd, cfg.projectName, final, details);
  console.log('── UI-Audit / Excel');
  console.log(`Excel: ${xlsxPath}`);
  return xlsxPath;
};
