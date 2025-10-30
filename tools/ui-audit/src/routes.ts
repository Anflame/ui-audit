import { readFileSync } from 'fs';
import fs from 'node:fs';
import * as path from 'node:path';

import { parse } from '@babel/parser';

import { Config, FileAst } from './types';
import { handleError } from './utils/errors';
import { extractRoutes } from './utils/routes';

export const parseRoutes = () => {
  try {
    const uiAuditConfig = fs.readFileSync(path.resolve('ui-audit.config.json'), 'utf8');

    const parsedUiAuditConfig: Config = JSON.parse(uiAuditConfig);

    const forest = parsedUiAuditConfig.routerFiles.reduce<FileAst[]>((acc, routerFile) => {
      if (!routerFile) return acc;

      const filePath = path.resolve(process.cwd(), routerFile);
      const code = readFileSync(filePath, 'utf-8');
      const ast = parse(code, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx'],
      });

      acc.push({
        filePath,
        ast,
      });

      return acc;
    }, []);

    const filesRoutes = extractRoutes(forest);
    filesRoutes.flatMap((x) => x.routes);

    console.log({ filesRoutes });
  } catch (err) {
    console.log({ err });
    handleError((err as Error).message);
  }
};
