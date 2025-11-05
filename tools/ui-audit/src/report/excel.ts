import path7 from 'node:path';

import ExcelJS from 'exceljs';
import fs7 from 'fs-extra';

import type { ClassifiedReport } from '../classifiers/aggregate';

export type DetailRow = {
  pageTitle?: string;
  pageFile?: string;
  route?: string;
  uiComponent: string;
  componentFile: string;
  label?: string;
  sourceLib: 'antd' | 'ksnm-common-ui' | 'local';
  type: string;
};

export const writeExcel = async (
  cwd: string,
  projectName: string,
  report: ClassifiedReport,
  details: DetailRow[],
): Promise<string> => {
  const outDir = path7.join(cwd, '.ui-audit', 'out');
  await fs7.ensureDir(outDir);
  const xlsxPath = path7.join(outDir, `ui-audit-${projectName}.xlsx`);
  const wb = new ExcelJS.Workbook();
  const wsSummary = wb.addWorksheet('Сводка');
  const wsDetails = wb.addWorksheet('Детализация');

  wsSummary.addRow(['Тип компонента', 'Количество']);
  for (const [k, v] of Object.entries(report.summary)) wsSummary.addRow([k, v]);
  wsSummary.columns = [
    { key: 'type', width: 30 },
    { key: 'count', width: 15 },
  ];

  wsDetails.addRow([
    'Название страницы',
    'Файл страницы - Путь к компоненту',
    'Маршрут',
    'UI компонент',
    'Файл компонента',
    'Лейбл',
    'Библиотека — источник',
    'Тип компонента',
  ]);
  for (const r of details)
    wsDetails.addRow([
      r.pageTitle ?? '',
      r.pageFile ?? '',
      r.route ?? '',
      r.uiComponent,
      r.componentFile,
      r.label ?? '',
      r.sourceLib,
      r.type,
    ]);
  wsDetails.columns = [
    { width: 30 },
    { width: 60 },
    { width: 30 },
    { width: 30 },
    { width: 60 },
    { width: 40 },
    { width: 25 },
    { width: 25 },
  ];

  await wb.xlsx.writeFile(xlsxPath);
  return xlsxPath;
};
