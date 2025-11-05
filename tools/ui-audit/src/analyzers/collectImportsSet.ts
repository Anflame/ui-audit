import traverse2 from '@babel/traverse';
import * as t2 from '@babel/types';

export const collectImportsSet = (astFile: t2.File): { antdLocals: Set<string>; allLocals: Set<string> } => {
  const antdLocals = new Set<string>();
  const allLocals = new Set<string>();
  traverse2(astFile, {
    ImportDeclaration: (p) => {
      const src = (p.node.source.value || '') as string;
      for (const sp of p.node.specifiers) {
        if (t2.isImportSpecifier(sp) || t2.isImportDefaultSpecifier(sp) || t2.isImportNamespaceSpecifier(sp)) {
          allLocals.add(sp.local.name);
          if (src === 'antd' || src.startsWith('antd/') || src.startsWith('@ant-design/icons'))
            antdLocals.add(sp.local.name);
        }
      }
    },
  });
  return { antdLocals, allLocals };
};
