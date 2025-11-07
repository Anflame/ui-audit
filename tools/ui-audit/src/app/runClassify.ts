import path4 from 'node:path';

import fs4 from 'fs-extra';

import { aggregate } from '../classifiers/aggregate';
import { deriveComponentType } from '../classifiers/deriveComponentType';
import { mapJsxToImports } from '../classifiers/mapJsxToImports';
import { loadConfig as loadCfg2, type ResolvedConfig } from '../utils/config';

import type { FileScan } from '../domain/model';

export const runClassify = async (cwd: string = process.cwd()) => {
  const cfg: ResolvedConfig = await loadCfg2(cwd);
  const stage1Path = path4.join(cwd, '.ui-audit', 'tmp', 'stage1-scan.json');
  if (!(await fs4.pathExists(stage1Path))) throw new Error('Не найден stage1-scan.json. Сначала запусти Stage 1.');
  const data = (await fs4.readJSON(stage1Path)) as { project: string; files: number; scans: FileScan[] };
  const items = data.scans.flatMap((scan) => mapJsxToImports(scan).map((u) => deriveComponentType(scan.file, u, cfg)));
  const report = aggregate(items);
  const outDir = path4.join(cwd, '.ui-audit', 'tmp');
  const outPath = path4.join(outDir, 'classified.json');
  await fs4.outputJson(outPath, report, { spaces: 2 });
  console.log('── UI-Audit / Stage 2');
  console.log('Сводка по типам:');
  for (const [k, v] of Object.entries(report.summary)) console.log(`  ${k}: ${v}`);
  console.log(`JSON: ${path4.relative(cwd, outPath)}`);
  return report;
};
