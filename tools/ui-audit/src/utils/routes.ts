import traverse from '@babel/traverse';

import { FileRoutes, FileAst, RouteLike } from '../types';

export const evalLiteral = (node: any): any => {
  switch (node?.type) {
    case 'StringLiteral':
      return node.value;
    case 'NumericLiteral':
      return node.value;
    case 'BooleanLiteral':
      return node.value;
    case 'NullLiteral':
      return null;
    case 'ArrayExpression':
      return node.elements.map(evalLiteral);
    case 'ObjectExpression':
      return Object.fromEntries(node.properties.map((p: any) => [p.key.name ?? p.key.value, evalLiteral(p.value)]));
    default:
      return undefined;
  }
};

export const extractRoutes = (forest: FileAst[]): { filePath: string; routes: RouteLike[] }[] => {
  const result: { filePath: string; routes: RouteLike[] }[] = [];

  for (const { filePath, ast } of forest) {
    const fileRoutes: RouteLike[] = [];

    traverse(ast, {
      // export default [ ... ]  или export default { ... }
      ExportDefaultDeclaration(path) {
        const decl = path.node.declaration;
        if (decl.type === 'ArrayExpression') {
          fileRoutes.push(...evalLiteral(decl));
        } else if (decl.type === 'ObjectExpression') {
          fileRoutes.push(evalLiteral(decl));
        }
      },
      // const routes = [ ... ]  или  const routes = { ... }; export { routes }
      VariableDeclarator(path) {
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
    });

    result.push({ filePath, routes: fileRoutes });
  }

  return result;
};

export const mergeRouteTrees = (filesRoutes: FileRoutes[]) => {
  // В простейшем случае — просто плоский массив:
  // Если у узлов есть { path, children: [...] }, это уже «лес» деревьев.
  // Часто достаточно вернуть массив корней:
  return;
};
