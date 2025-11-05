import traverse3 from '@babel/traverse';
import * as t3 from '@babel/types';

export const hasAntdJsxUsage = (astFile: t3.File, antdLocals: Set<string>): boolean => {
  let found = false;
  traverse3(astFile, {
    JSXOpeningElement: (p) => {
      if (found) return;
      const name = p.node.name;
      if (t3.isJSXIdentifier(name) && antdLocals.has(name.name)) found = true;
      else if (t3.isJSXMemberExpression(name)) {
        const head = t3.isJSXIdentifier(name.object) ? name.object.name : '';
        if (head && antdLocals.has(head)) found = true;
      }
    },
  });
  return found;
};
