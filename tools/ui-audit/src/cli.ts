import { main as mainUiAudit } from './index';

mainUiAudit().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
