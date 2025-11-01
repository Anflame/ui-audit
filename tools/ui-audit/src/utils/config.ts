import path from 'node:path';

import fs from 'fs-extra';

import type { UiAuditConfig } from '../domain/model';

export interface ResolvedConfig extends UiAuditConfig {
  cwd: string;
}

export const loadConfig = async (cwd: string = process.cwd()): Promise<ResolvedConfig> => {
  const configPath = path.join(cwd, 'ui-audit.config.json');
  if (!(await fs.pathExists(configPath))) {
    throw new Error(`Не найден ui-audit.config.json в ${cwd}`);
  }
  const raw = (await fs.readJSON(configPath)) as UiAuditConfig;

  return {
    projectName: raw.projectName,
    routerFiles: raw.routerFiles ?? [],
    srcRoots: raw.srcRoots ?? ['src'],
    aliases: raw.aliases ?? {},
    libraries: raw.libraries ?? {},
    options: raw.options ?? {},
    cwd,
  };
};
