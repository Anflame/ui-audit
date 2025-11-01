import traverse from '@babel/traverse';
import * as t from '@babel/types';

export const collectImportsSet = (astFile: t.File): { antdLocals: Set<string>; allLocals: Set<string> } => {
  const antdLocals = new Set<string>();
  const allLocals = new Set<string>();

  traverse(astFile, {
    ImportDeclaration: (p) => {
      const src = (p.node.source.value || '') as string;
      for (const sp of p.node.specifiers) {
        if (t.isImportSpecifier(sp) || t.isImportDefaultSpecifier(sp) || t.isImportNamespaceSpecifier(sp)) {
          allLocals.add(sp.local.name);
          if (src === 'antd' || src.startsWith('@ant-design/icons')) {
            antdLocals.add(sp.local.name);
          }
        }
      }
    },
  });
  return { antdLocals, allLocals };
};
