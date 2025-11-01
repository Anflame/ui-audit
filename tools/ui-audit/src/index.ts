import { runClassify } from './app/runClassify';
import { runDetectWrappers } from './app/runDetectWrappers';
import { runScan } from './app/runScan';
import { writeExcel } from './report/excel';
import { loadConfig } from './utils/config';

export const main = async (): Promise<void> => {
  const cwd = process.cwd();
  await runScan(cwd);
  await runClassify(cwd);
  const final = await runDetectWrappers(cwd);
  const cfg = await loadConfig(cwd);
  const xlsx = await writeExcel(cwd, cfg.projectName, final);
  console.log('── UI-Audit / Excel');
  console.log(`Excel: ${xlsx}`);
};

// Публичный API пакета оставляем минимальным — только main
export type {} from './app/runScan';
export type {} from './app/runClassify';
export type {} from './app/runDetectWrappers';
export type {} from './report/excel';
