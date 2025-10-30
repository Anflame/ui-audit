import { FileAst, RouteLike } from '../types';
import traverse from '@babel/traverse';

export function extractRoutes(forest: FileAst[]): { filePath: string; routes: RouteLike[] }[] {
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
          Array.isArray(val) ? fileRoutes.push(...val) : fileRoutes.push(val);
        }
      },
    });

    result.push({ filePath, routes: fileRoutes });
  }

  return result;
}
