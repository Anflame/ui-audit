import path8 from 'node:path';

import fs8 from 'fs-extra';

import { COMPONENT_TYPES } from '../domain/constants';
import { writeExcel, type DetailRow } from '../report/excel';
import { loadConfig as loadCfg3 } from '../utils/config';

import { buildPagesIndex } from './collectPages';
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
  const cfg = await loadCfg3(cwd);
  const stage1 = path8.join(cwd, '.ui-audit', 'tmp', 'stage1-scan.json');
  const stage3 = path8.join(cwd, '.ui-audit', 'tmp', 'classified-final.json');
  const s1 = (await fs8.readJSON(stage1)) as { scans: FileScan[] };
  const final = (await fs8.readJSON(stage3)) as ClassifiedReport;

  const deps = await buildReverseDeps(cwd, s1.scans);
  const pages = await buildPagesIndex(cwd, cfg.routerFiles ?? []);

  const details: DetailRow[] = [];
  for (const it of final.items) {
    const lib = normSourceLib(it);
    let componentFile = '';
    if (it.type === COMPONENT_TYPES.ANTD) componentFile = 'antd';
    else if (it.type === COMPONENT_TYPES.ANTD_WRAPPER) componentFile = it.componentFile ?? 'antd';
    else if (it.type === COMPONENT_TYPES.KSNM) componentFile = 'ksnm-common-ui';
    else componentFile = it.file;

    const owner = findOwningPage(it.file, pages, deps);

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
