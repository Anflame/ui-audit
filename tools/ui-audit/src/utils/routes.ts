import traverse from '@babel/traverse';

import { FileAst, RouteLike } from '../types';

import { evalLiteral } from './routes/eval';

export const extractRoutes = (forest: FileAst[]): { filePath: string; routes: RouteLike[] }[] => {
  const result: { filePath: string; routes: RouteLike[] }[] = [];

  for (const { filePath, ast } of forest) {
    const fileRoutes: RouteLike[] = [];

    traverse(ast, {
      ExportDefaultDeclaration(path) {
        const decl = path.node.declaration;
        console.log({ decldef: decl });
        if (decl.type === 'ArrayExpression') {
          fileRoutes.push(...evalLiteral(decl));
        } else if (decl.type === 'ObjectExpression') {
          fileRoutes.push(evalLiteral(decl));
        }
      },
      Identifier(path) {
        console.log({ id: path.node.name });
      },
      VariableDeclarator(path) {
        console.log({ type: path.node.type });
        if (
          path.node.id.type === 'Identifier' &&
          path.node.id.name === 'routes' &&
          path.node.init &&
          (path.node.init.type === 'ArrayExpression' || path.node.init.type === 'ObjectExpression')
        ) {
          const val = evalLiteral(path.node.init);
          if (Array.isArray(val)) {
            fileRoutes.push(...val);
          } else {
            fileRoutes.push(val);
          }
        }
      },
      ExportNamedDeclaration(p) {
        const decl = p.node.declaration;
        console.log({ decl });
        if (decl?.type !== 'VariableDeclaration') return;
        for (const d of decl.declarations) {
          if (d.id.type !== 'Identifier' || d.id.name !== 'routes' || !d.init) continue;
          if (d.init.type === 'ArrayExpression') {
            const arr = evalLiteral(d.init);
            if (Array.isArray(arr)) fileRoutes.push(...arr);
          } else if (d.init.type === 'ObjectExpression') {
            fileRoutes.push(evalLiteral(d.init));
          }
        }
      },
    });

    result.push({ filePath, routes: fileRoutes });
  }

  console.log({ result });

  return result;
};
