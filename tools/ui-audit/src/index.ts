import { runScan } from './app/runScan';

export async function main() {
  console.log('✅ UI Audit CLI работает (TypeScript версия)!');
  await runScan(process.cwd());
}
