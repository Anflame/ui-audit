// npm i @babel/parser @babel/traverse
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';

// Простой "eval" для литералов AST -> JS (строки, числа, булево, объекты, массивы)
function evalLiteral(node: any): any {
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
      return undefined; // для функций/идентификаторов/вызовов — оставим как undefined
  }
}

type FileAst = { filePath: string; ast: any };
type RouteLike = Record<string, unknown>;

export async function buildAstForestFromConfig(configPath = 'ui-audit.config.json') {
  const absConfig = path.resolve(process.cwd(), configPath);
  const configRaw = await readFile(absConfig, 'utf8');
  const files: string[] = JSON.parse(configRaw).routes ?? JSON.parse(configRaw);

  for (const rel of files) {
    const filePath = path.resolve(process.cwd(), rel);
    const code = await readFile(filePath, 'utf8');
    const ast = parse(code, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx', 'decorators-legacy'],
    });
    forest.push({ filePath, ast });
  }

  return forest;
}

// Пример: достать из каждого файла экспортированный массив/объект routes
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

// Склеить в единое "дерево" (если у маршрутов есть поле children)
export function mergeRouteTrees(filesRoutes: { filePath: string; routes: RouteLike[] }[]) {
  // В простейшем случае — просто плоский массив:
  const flat = filesRoutes.flatMap((x) => x.routes);

  // Если у узлов есть { path, children: [...] }, это уже «лес» деревьев.
  // Часто достаточно вернуть массив корней:
  return flat;
}

// Пример использования:

export const writeRoutes = async () => {
  const forest = await buildAstForestFromConfig(); // AST каждого файла
  const filesRoutes = extractRoutes(forest); // вытащили структуры маршрутов
  const routeTree = mergeRouteTrees(filesRoutes); // получили "лес"/дерево
  console.log(routeTree);
};
