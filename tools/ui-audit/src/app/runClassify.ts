import path from 'node:path';

import fs from 'fs-extra';

import { aggregate } from '../classifiers/aggregate';
import { deriveComponentType } from '../classifiers/deriveComponentType';
import { mapJsxToImports } from '../classifiers/mapJsxToImports';
import { loadConfig } from '../utils/config';

import type { FileScan, UiAuditConfig } from '../domain/model';

export const runClassify = async (cwd: string = process.cwd()) => {
  const cfg = await loadConfig(cwd);
  const stage1Path = path.join(cwd, '.ui-audit', 'tmp', 'stage1-scan.json');
  if (!(await fs.pathExists(stage1Path))) throw new Error('Не найден stage1-scan.json. Сначала запусти Stage 1.');

  const data = (await fs.readJSON(stage1Path)) as { project: string; files: number; scans: FileScan[] };

  const items = data.scans.flatMap((scan) => {
    const usages = mapJsxToImports(scan);
    return usages.map((u) => deriveComponentType(scan.file, u, cfg as UiAuditConfig));
  });

  const report = aggregate(items);

  const outDir = path.join(cwd, '.ui-audit', 'tmp');
  const outPath = path.join(outDir, 'classified.json');
  await fs.outputJson(outPath, report, { spaces: 2 });

  console.log('── UI-Audit / Stage 2');
  console.log('Сводка по типам:');
  for (const [k, v] of Object.entries(report.summary)) console.log(`  ${k}: ${v}`);
  console.log(`JSON: ${path.relative(cwd, outPath)}`);

  return report;
};
