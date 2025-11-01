import traverse, { type NodePath } from '@babel/traverse';
import * as t from '@babel/types';

import type { FileScan, ImportInfo } from '../domain/model';

export const collectImportsAndJsx = (astFile: t.File, file: string): FileScan => {
  const imports: ImportInfo[] = [];
  const jsxElements: string[] = [];

  traverse(astFile, {
    ImportDeclaration: (path: NodePath<t.ImportDeclaration>): void => {
      const src = path.node.source.value;
      for (const sp of path.node.specifiers) {
        if (t.isImportSpecifier(sp)) {
          imports.push({
            localName: sp.local.name,
            importedName: t.isIdentifier(sp.imported) ? sp.imported.name : undefined,
            source: src,
          });
        } else if (t.isImportDefaultSpecifier(sp)) {
          imports.push({ localName: sp.local.name, importedName: 'default', source: src });
        } else if (t.isImportNamespaceSpecifier(sp)) {
          imports.push({ localName: sp.local.name, importedName: '*', source: src });
        }
      }
    },

    JSXOpeningElement: (path: NodePath<t.JSXOpeningElement>): void => {
      const name = path.node.name;
      if (t.isJSXIdentifier(name)) {
        jsxElements.push(name.name);
        return;
      }
      if (t.isJSXMemberExpression(name)) {
        const left = t.isJSXIdentifier(name.object) ? name.object.name : '';
        const right = t.isJSXIdentifier(name.property) ? name.property.name : '';
        const compound = left && right ? `${left}.${right}` : right || left || 'UNKNOWN';
        jsxElements.push(compound);
      }
    },
  });

  return { file, imports, jsxElements };
};
