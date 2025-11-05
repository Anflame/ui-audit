import path3 from 'node:path';

import * as t4 from '@babel/types';

import { FsNode } from '../adapters/fsNode';
import { ParserBabel } from '../adapters/parserBabel';
import { collectImportsAndJsx } from '../analyzers/collectImportsAndJsx';
import { loadConfig } from '../utils/config';

import type { FileScan } from '../domain/model';
import type { Stage1Result } from '../domain/ports';

export const runScan = async (cwd: string = process.cwd()): Promise<Stage1Result> => {
  const fs = new FsNode();
  const parser = new ParserBabel();
  const cfg = await loadConfig(cwd);

  const patterns: string[] = cfg.srcRoots.map((r: string) =>
    path3.posix.join(r.split('\\').join('/'), '**/*.{ts,tsx,js,jsx}'),
  );

  const ignore: string[] = [
    '**/node_modules/**',
    '**/dist/**',
    '**/.next/**',
    '**/build/**',
    '**/*.spec.*',
    '**/*.test.*',
  ];

  const files = await fs.glob(cfg.cwd, patterns, ignore);
  const scans: FileScan[] = [];

  for (const abs of files) {
    try {
      const code = await fs.readFile(abs);
      const ast = parser.parse(code) as t4.File;
      scans.push(collectImportsAndJsx(ast, abs));
    } catch {
      // skip broken files silently
    }
  }

  const outDir = fs.join(cfg.cwd, '.ui-audit', 'tmp');
  await fs.ensureDir(outDir);
  const jsonPath = fs.join(outDir, 'stage1-scan.json');
  await fs.writeJson(jsonPath, { project: cfg.projectName, files: scans.length, scans }, true);

  const totalJsx = scans.reduce((a, s) => a + s.jsxElements.length, 0);
  const totalImports = scans.reduce((a, s) => a + s.imports.length, 0);

  console.log('── UI-Audit / Stage 1');
  console.log(`Проект: ${cfg.projectName}`);
  console.log(`Файлов просканировано: ${scans.length}`);
  console.log(`Всего импортов: ${totalImports}`);
  console.log(`Всего JSX-узлов: ${totalJsx}`);
  console.log(`JSON: ${path3.relative(cfg.cwd, jsonPath)}`);

  return { jsonPath, scans };
};
