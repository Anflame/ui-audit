import path from 'node:path';

import * as t from '@babel/types';
import fs from 'fs-extra';

import { ParserBabel } from '../adapters/parserBabel';
import { collectImportsSet } from '../analyzers/collectImportsSet';
import { hasAntdJsxUsage } from '../analyzers/hasAntdJsxUsage';
import { COMPONENT_TYPES, isCamelCaseComponent, isRelativeModule, isInteractiveIntrinsic } from '../domain/constants';
import { resolveModuleDeep } from '../utils/resolveModule';

import type { ClassifiedReport } from '../classifiers/aggregate';
import type { ClassifiedItem } from '../classifiers/deriveComponentType';

export const runDetectWrappers = async (cwd: string = process.cwd()) => {
  const parser = new ParserBabel();
  const stage2Path = path.join(cwd, '.ui-audit', 'tmp', 'classified.json');
  if (!(await fs.pathExists(stage2Path))) throw new Error('Не найден classified.json. Сначала запусти Stage 2.');
  const report = (await fs.readJSON(stage2Path)) as ClassifiedReport;
  const updated: ClassifiedItem[] = [];

  const wrapperFiles = new Set<string>();

  for (const it of report.items) {
    // Пропускаем неинтерактивные HTML
    if (!it.sourceModule && !/[A-Z]/.test(it.component)) {
      if (!isInteractiveIntrinsic(it.component)) continue;
    }

    if (
      it.type === COMPONENT_TYPES.LOCAL &&
      it.sourceModule &&
      isCamelCaseComponent(it.component) &&
      isRelativeModule(it.sourceModule)
    ) {
      // ГЛУБОКИЙ резолв (баррели/index.ts), чтобы точно дойти до файла компонента
      const resolved = await resolveModuleDeep(it.file, it.sourceModule);
      if (resolved) {
        try {
          const code = await fs.readFile(resolved, 'utf8');
          const ast = parser.parse(code) as unknown as t.File;
          const { antdLocals } = collectImportsSet(ast);
          if (antdLocals.size > 0 && hasAntdJsxUsage(ast, antdLocals)) {
            const wrapped: ClassifiedItem = {
              ...it,
              type: COMPONENT_TYPES.ANTD_WRAPPER,
              sourceModule: 'antd',
              componentFile: resolved,
            };
            updated.push(wrapped);
            wrapperFiles.add(resolved);
            continue;
          }
        } catch {
          // оставляем как есть
        }
      }
    }
    updated.push(it);
  }

  // вырезаем прямых «детей antd» внутри самих файлов-обёрток
  const filtered = updated.filter((x) => !(x.type === COMPONENT_TYPES.ANTD && x.file && wrapperFiles.has(x.file)));

  const summary: Record<string, number> = {
    [COMPONENT_TYPES.ANTD]: 0,
    [COMPONENT_TYPES.ANTD_WRAPPER]: 0,
    [COMPONENT_TYPES.KSNM]: 0,
    [COMPONENT_TYPES.LOCAL]: 0,
  };
  for (const x of filtered) summary[x.type] = (summary[x.type] ?? 0) + x.count;

  const outDir = path.join(cwd, '.ui-audit', 'tmp');
  const outPath = path.join(outDir, 'classified-final.json');
  await fs.outputJson(outPath, { items: filtered, summary }, { spaces: 2 });

  console.log('── UI-Audit / Stage 3: wrappers');
  for (const [k, v] of Object.entries(summary)) console.log(`  ${k}: ${v}`);
  console.log(`JSON: ${path.relative(cwd, outPath)}`);

  return { items: filtered, summary } as ClassifiedReport;
};
