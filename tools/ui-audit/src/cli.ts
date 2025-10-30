#!/usr/bin/env node
// console.log("✅ UI Audit CLI работает!");
import { main } from "./index";
main().catch(err => {
  console.error(err);
  process.exit(1);
});
