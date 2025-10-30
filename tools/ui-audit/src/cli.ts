import { start } from './index';
start().catch((err) => {
  console.error(err);
  process.exit(1);
});
