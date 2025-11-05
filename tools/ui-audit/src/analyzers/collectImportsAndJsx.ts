import traverse, { type NodePath } from '@babel/traverse';
import * as t from '@babel/types';

import type { FileScan, ImportInfo } from '../domain/model';

export const collectImportsAndJsx = (astFile: t.File, file: string): FileScan => {
  const imports: ImportInfo[] = [];
  const jsxElements: string[] = [];
  const jsxFirstLabels = new Map<string, string>();

  traverse(astFile, {
    ImportDeclaration: (path): void => {
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

    JSXOpeningElement: (path2: NodePath<t.JSXOpeningElement>): void => {
      const name = path2.node.name;
      let elName = '';
      if (t.isJSXIdentifier(name)) elName = name.name;
      else if (t.isJSXMemberExpression(name)) {
        const left = t.isJSXIdentifier(name.object) ? name.object.name : '';
        const right = t.isJSXIdentifier(name.property) ? name.property.name : '';
        elName = left && right ? `${left}.${right}` : right || left || 'UNKNOWN';
      }
      if (!elName) return;
      jsxElements.push(elName);

      if (!jsxFirstLabels.has(elName)) {
        for (const attr of path2.node.attributes) {
          if (!t.isJSXAttribute(attr) || !attr.name) continue;
          const nm = t.isJSXIdentifier(attr.name) ? attr.name.name : '';
          if (nm !== 'title' && nm !== 'label') continue;
          if (!attr.value) continue;
          if (t.isStringLiteral(attr.value) && attr.value.value.trim()) {
            jsxFirstLabels.set(elName, attr.value.value.trim());
            break;
          }
          if (
            t.isJSXExpressionContainer(attr.value) &&
            t.isStringLiteral(attr.value.expression) &&
            attr.value.expression.value.trim()
          ) {
            jsxFirstLabels.set(elName, attr.value.expression.value.trim());
            break;
          }
        }
      }
    },
  });

  return { file, imports, jsxElements, labelMap: Object.fromEntries(jsxFirstLabels) };
};
