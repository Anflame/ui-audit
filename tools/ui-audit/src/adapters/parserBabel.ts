import { parse } from '@babel/parser';

import type { IParser } from '../domain/ports';

export class ParserBabel implements IParser {
  parse = (code: string): unknown =>
    parse(code, {
      sourceType: 'module',
      plugins: [
        'typescript',
        'jsx',
        'classProperties',
        'decorators-legacy',
        'objectRestSpread',
        'dynamicImport',
        'importMeta',
      ],
    });
}
