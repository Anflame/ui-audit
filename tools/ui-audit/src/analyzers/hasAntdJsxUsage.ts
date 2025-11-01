import traverse from '@babel/traverse';
import * as t from '@babel/types';

export const hasAntdJsxUsage = (astFile: t.File, antdLocals: Set<string>): boolean => {
  let found = false;
  traverse(astFile, {
    JSXOpeningElement: (p) => {
      if (found) return;
      const name = p.node.name;
      if (t.isJSXIdentifier(name) && antdLocals.has(name.name)) {
        found = true;
      } else if (t.isJSXMemberExpression(name)) {
        // e.g. Form.Item — учитываем Form, если он из antd
        const head = t.isJSXIdentifier(name.object) ? name.object.name : '';
        if (head && antdLocals.has(head)) found = true;
      }
    },
  });
  return found;
};
