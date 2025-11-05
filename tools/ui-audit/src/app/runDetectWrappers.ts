import path from 'node:path';

import * as t from '@babel/types';
import fs from 'fs-extra';

import { ParserBabel as ParserBabel2 } from '../adapters/parserBabel';
import { collectImportsSet } from '../analyzers/collectImportsSet';
import { hasAntdJsxUsage } from '../analyzers/hasAntdJsxUsage';
import {
  COMPONENT_TYPES,
  isCamelCaseComponent,
  isRelativeModule,
  isInteractiveIntrinsic,
  INTRINSIC_HTML,
} from '../domain/constants';
import { loadConfig as loadCfg } from '../utils/config';
import { resolveImportPath } from '../utils/resolveModule';

import type { ClassifiedReport } from '../classifiers/aggregate';
import type { ClassifiedItem } from '../classifiers/deriveComponentType';

export const runDetectWrappers = async (cwd: string = process.cwd()) => {
  const cfg = await loadCfg(cwd);
  const parser = new ParserBabel2();
  const stage2Path = path.join(cwd, '.ui-audit', 'tmp', 'classified.json');
  if (!(await fs.pathExists(stage2Path))) throw new Error('Не найден classified.json. Сначала запусти Stage 2.');
  const report = (await fs.readJSON(stage2Path)) as ClassifiedReport;

  const updated: ClassifiedItem[] = [];
  const wrapperFiles = new Set<string>();

  for (const it of report.items) {
    // интерактивные нативные оставляем как есть
    if (!it.sourceModule && INTRINSIC_HTML.has(it.component) && isInteractiveIntrinsic(it.component)) {
      updated.push(it);
      continue;
    }

    // Кандидаты на обёртки: LOCAL + CamelCase + относительный импорт
    if (
      it.type === COMPONENT_TYPES.LOCAL &&
      it.sourceModule &&
      isCamelCaseComponent(it.component) &&
      isRelativeModule(it.sourceModule)
    ) {
      const resolved = await resolveImportPath(it.file, it.sourceModule, { cwd, aliases: cfg.aliases });
      if (resolved) {
        try {
          const code = await fs.readFile(resolved, 'utf8');
          const ast = parser.parse(code) as unknown as t.File;
          const { antdLocals } = collectImportsSet(ast);
          if (antdLocals.size > 0 && hasAntdJsxUsage(ast, antdLocals)) {
            updated.push({
              ...it,
              type: COMPONENT_TYPES.ANTD_WRAPPER,
              sourceModule: 'antd',
              componentFile: resolved,
            });
            wrapperFiles.add(resolved);
            continue;
          }
        } catch {
          // падающие файлы оставляем без изменения
        }
      }
    }

    // всё остальное проталкиваем как есть — почистим ниже
    updated.push(it);
  }

  // 1) вырезаем детей Antd, отрисованных внутри файлов-обёрток
  let filtered = updated.filter((x) => !(x.type === COMPONENT_TYPES.ANTD && x.file && wrapperFiles.has(x.file)));

  // 2) вычищаем «обычные» локальные CamelCase (оставляем только интерактивные нативные и обёртки)
  filtered = filtered.filter((x) => {
    if (x.type === COMPONENT_TYPES.ANTD || x.type === COMPONENT_TYPES.KSNM || x.type === COMPONENT_TYPES.ANTD_WRAPPER)
      return true;
    // LOCAL:
    if (!x.sourceModule && INTRINSIC_HTML.has(x.component)) return isInteractiveIntrinsic(x.component);
    // LOCAL + импорт (то есть CamelCase) — выкидываем
    return false;
  });

  const summary: Record<string, number> = {
    [COMPONENT_TYPES.ANTD]: 0,
    [COMPONENT_TYPES.ANTD_WRAPPER]: 0,
    [COMPONENT_TYPES.KSNM]: 0,
    [COMPONENT_TYPES.LOCAL]: 0,
  };
  for (const it of filtered) summary[it.type] = (summary[it.type] ?? 0) + it.count;

  const outDir = path.join(cwd, '.ui-audit', 'tmp');
  const outPath = path.join(outDir, 'classified-final.json');
  await fs.outputJson(outPath, { items: filtered, summary }, { spaces: 2 });

  console.log('── UI-Audit / Stage 3: wrappers');
  console.log('Сводка (после детекции обёрток):');
  for (const [k, v] of Object.entries(summary)) console.log(`  ${k}: ${v}`);
  console.log(`JSON: ${path.relative(cwd, outPath)}`);

  return { items: filtered, summary } as ClassifiedReport;
};
