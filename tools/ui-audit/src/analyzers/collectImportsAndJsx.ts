import traverse, { type NodePath } from '@babel/traverse';
import * as t from '@babel/types';

import { INTRINSIC_HTML, INTERACTIVE_HTML } from '../domain/constants';

import type { FileScan, ImportInfo } from '../domain/model';

export const collectImportsAndJsx = (astFile: t.File, file: string): FileScan => {
  const imports: ImportInfo[] = [];
  const jsxElements: string[] = [];
  const interactiveIntrinsics = new Set<string>();
  const jsxFirstLabels = new Map<string, string>();

  traverse(astFile, {
    // --- обычные импорты
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

    // --- ВАЖНО: реэкспорты считаем зависимостями для графа
    ExportAllDeclaration: (path): void => {
      const src = path.node.source?.value;
      if (src) {
        imports.push({ localName: '__reexport__', importedName: '*', source: src });
      }
    },
    ExportNamedDeclaration: (path): void => {
      const src = path.node.source?.value;
      if (src) {
        // локальные имена не нужны для графа, нам важен сам факт связи файл->src
        imports.push({ localName: '__reexport__', importedName: undefined, source: src });
      }
    },

    // --- JSX
    JSXOpeningElement: (p: NodePath<t.JSXOpeningElement>): void => {
      const name = p.node.name;
      let elName = '';
      if (t.isJSXIdentifier(name)) {
        elName = name.name;
      } else if (t.isJSXMemberExpression(name)) {
        const left = t.isJSXIdentifier(name.object) ? name.object.name : '';
        const right = t.isJSXIdentifier(name.property) ? name.property.name : '';
        elName = left && right ? `${left}.${right}` : right || left || 'UNKNOWN';
      }
      if (!elName) return;
      jsxElements.push(elName);

      const markInteractiveIntrinsic = (): void => {
        if (!INTRINSIC_HTML.has(elName)) return;
        if (INTERACTIVE_HTML.has(elName)) {
          interactiveIntrinsics.add(elName);
          return;
        }

        let hasRole = false;
        let hasHandler = false;
        for (const attr of p.node.attributes) {
          if (!t.isJSXAttribute(attr) || !attr.name) continue;
          const nm = t.isJSXIdentifier(attr.name) ? attr.name.name : '';
          if (!nm) continue;
          if (nm === 'role') {
            hasRole = true;
          }
          if (nm.startsWith('on')) {
            hasHandler = true;
          }
          if (hasRole || hasHandler) break;
        }

        if (hasRole || hasHandler) interactiveIntrinsics.add(elName);
      };

      markInteractiveIntrinsic();

      if (!jsxFirstLabels.has(elName)) {
        for (const attr of p.node.attributes) {
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

  return {
    file,
    imports,
    jsxElements,
    labelMap: Object.fromEntries(jsxFirstLabels),
    interactiveIntrinsics: Array.from(interactiveIntrinsics),
  };
};
