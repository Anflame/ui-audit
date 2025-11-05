import { runClassify } from './app/runClassify';
import { runDetectWrappers } from './app/runDetectWrappers';
import { runEnrichAndExcel } from './app/runEnrichAndExcel';
import { runScan } from './app/runScan';

export const main = async (): Promise<void> => {
  const cwd = process.cwd();
  await runScan(cwd);
  await runClassify(cwd);
  await runDetectWrappers(cwd);
  await runEnrichAndExcel(cwd);
};

export type {} from './app/runScan';
export type {} from './app/runClassify';
export type {} from './app/runDetectWrappers';
export type {} from './app/runEnrichAndExcel';
