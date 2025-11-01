import path from 'node:path';

import ExcelJS from 'exceljs';
import fs from 'fs-extra';

import type { ClassifiedReport } from '../classifiers/aggregate';

export const writeExcel = async (cwd: string, projectName: string, report: ClassifiedReport): Promise<string> => {
  const outDir = path.join(cwd, '.ui-audit', 'out');
  await fs.ensureDir(outDir);
  const xlsxPath = path.join(outDir, `ui-audit-${projectName}.xlsx`);

  const wb = new ExcelJS.Workbook();
  const wsSummary = wb.addWorksheet('Сводка');
  const wsDetails = wb.addWorksheet('Детализация');

  wsSummary.addRow(['Тип компонента', 'Количество']);
  for (const [k, v] of Object.entries(report.summary)) wsSummary.addRow([k, v]);
  wsSummary.columns = [
    { key: 'type', width: 30 },
    { key: 'count', width: 15 },
  ];

  wsDetails.addRow(['Файл', 'Компонент', 'Тип', 'Источник', 'Кол-во']);
  for (const it of report.items) {
    wsDetails.addRow([it.file, it.component, it.type, it.sourceModule ?? '', it.count]);
  }
  wsDetails.columns = [
    { key: 'file', width: 60 },
    { key: 'component', width: 30 },
    { key: 'type', width: 30 },
    { key: 'source', width: 30 },
    { key: 'cnt', width: 10 },
  ];

  await wb.xlsx.writeFile(xlsxPath);
  return xlsxPath;
};
