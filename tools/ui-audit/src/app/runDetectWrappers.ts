import path5 from 'node:path';

import * as t5 from '@babel/types';
import fs5 from 'fs-extra';

import { ParserBabel as ParserBabel2 } from '../adapters/parserBabel';
import { collectImportsSet } from '../analyzers/collectImportsSet';
import { hasAntdJsxUsage } from '../analyzers/hasAntdJsxUsage';
import { COMPONENT_TYPES, isCamelCaseComponent, isRelativeModule, isInteractiveIntrinsic } from '../domain/constants';
import { resolveImportPath } from '../utils/resolveModule';

import type { ClassifiedReport } from '../classifiers/aggregate';
import type { ClassifiedItem } from '../classifiers/deriveComponentType';

export const runDetectWrappers = async (cwd: string = process.cwd()) => {
  const parser = new ParserBabel2();
  const stage2Path = path5.join(cwd, '.ui-audit', 'tmp', 'classified.json');
  if (!(await fs5.pathExists(stage2Path))) throw new Error('Не найден classified.json. Сначала запусти Stage 2.');
  const report = (await fs5.readJSON(stage2Path)) as ClassifiedReport;
  const updated: ClassifiedItem[] = [];
  for (const it of report.items) {
    if (!it.sourceModule && !/[A-Z]/.test(it.component)) {
      if (!isInteractiveIntrinsic(it.component)) continue;
    }
    if (
      it.type === COMPONENT_TYPES.LOCAL &&
      it.sourceModule &&
      isCamelCaseComponent(it.component) &&
      isRelativeModule(it.sourceModule)
    ) {
      const resolved = await resolveImportPath(it.file, it.sourceModule);
      if (resolved) {
        try {
          const code = await fs5.readFile(resolved, 'utf8');
          const ast = parser.parse(code) as unknown as t5.File;
          const { antdLocals } = collectImportsSet(ast);
          if (antdLocals.size > 0 && hasAntdJsxUsage(ast, antdLocals)) {
            updated.push({ ...it, type: COMPONENT_TYPES.ANTD_WRAPPER, sourceModule: 'antd', componentFile: resolved });
            continue;
          }
        } catch {
          /* keep as is */
        }
      }
    }
    updated.push(it);
  }
  const summary = {
    [COMPONENT_TYPES.ANTD]: 0,
    [COMPONENT_TYPES.ANTD_WRAPPER]: 0,
    [COMPONENT_TYPES.KSNM]: 0,
    [COMPONENT_TYPES.LOCAL]: 0,
  } as Record<string, number>;
  for (const it of updated) summary[it.type] = (summary[it.type] ?? 0) + it.count;
  const outDir = path5.join(cwd, '.ui-audit', 'tmp');
  const outPath = path5.join(outDir, 'classified-final.json');
  await fs5.outputJson(outPath, { items: updated, summary }, { spaces: 2 });
  console.log('── UI-Audit / Stage 3: wrappers');
  console.log('Сводка (после детекции обёрток):');
  for (const [k, v] of Object.entries(summary)) console.log(`  ${k}: ${v}`);
  console.log(`JSON: ${path5.relative(cwd, outPath)}`);
  return { items: updated, summary } as ClassifiedReport;
};
