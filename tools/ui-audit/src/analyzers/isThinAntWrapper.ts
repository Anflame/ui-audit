import traverse, { type NodePath } from '@babel/traverse';
import * as t from '@babel/types';

const isAntName = (name: t.JSXIdentifier | t.JSXMemberExpression | t.JSXNamespacedName, antdLocals: Set<string>): boolean => {
  if (t.isJSXIdentifier(name)) return antdLocals.has(name.name);
  if (t.isJSXMemberExpression(name)) {
    let current: t.JSXMemberExpression['object'] | t.JSXIdentifier = name.object;
    while (t.isJSXMemberExpression(current)) current = current.object;
    return t.isJSXIdentifier(current) ? antdLocals.has(current.name) : false;
  }
  return false;
};

const getBaseJsxIdentifier = (
  name: t.JSXIdentifier | t.JSXMemberExpression | t.JSXNamespacedName,
): string | null => {
  if (t.isJSXIdentifier(name)) return name.name;
  if (t.isJSXMemberExpression(name)) {
    let current: t.JSXMemberExpression['object'] | t.JSXIdentifier = name.object;
    while (t.isJSXMemberExpression(current)) current = current.object;
    return t.isJSXIdentifier(current) ? current.name : null;
  }
  return null;
};

const classifyJsxChildren = (
  children: (t.JSXElement | t.JSXFragment | t.JSXText | t.JSXSpreadChild | t.JSXExpressionContainer)[],
  antdLocals: Set<string>,
  allowedWrapperLocals: Set<string>,
): { hasAnt: boolean; hasForeign: boolean } => {
  let hasAnt = false;
  let hasForeign = false;
  for (const child of children) {
    if (hasForeign) break;
    if (t.isJSXElement(child)) {
      const res = classifyJsxElement(child, antdLocals, allowedWrapperLocals);
      hasAnt ||= res.hasAnt;
      hasForeign ||= res.hasForeign;
    } else if (t.isJSXFragment(child)) {
      const res = classifyJsxChildren(child.children as typeof children, antdLocals, allowedWrapperLocals);
      hasAnt ||= res.hasAnt;
      hasForeign ||= res.hasForeign;
    } else if (t.isJSXExpressionContainer(child)) {
      const res = classifyExpression(child.expression, antdLocals, allowedWrapperLocals);
      hasAnt ||= res.hasAnt;
      hasForeign ||= res.hasForeign;
    } else if (t.isJSXText(child)) {
      if (child.value.trim().length > 0) hasForeign = true;
    } else if (child) {
      hasForeign = true;
    }
  }
  return { hasAnt, hasForeign };
};

const classifyJsxElement = (
  element: t.JSXElement,
  antdLocals: Set<string>,
  allowedWrapperLocals: Set<string>,
): { hasAnt: boolean; hasForeign: boolean } => {
  if (isAntName(element.openingElement.name, antdLocals)) {
    return { hasAnt: true, hasForeign: false };
  }

  const base = getBaseJsxIdentifier(element.openingElement.name);
  if (base && allowedWrapperLocals.has(base)) {
    return classifyJsxChildren(element.children as Parameters<typeof classifyJsxChildren>[0], antdLocals, allowedWrapperLocals);
  }

  return { hasAnt: false, hasForeign: true };
};

const classifyExpression = (
  expr: t.Expression | t.PrivateName | null | undefined,
  antdLocals: Set<string>,
  allowedWrapperLocals: Set<string>,
): { hasAnt: boolean; hasForeign: boolean } => {
  if (!expr) return { hasAnt: false, hasForeign: false };

  if (t.isParenthesizedExpression(expr)) return classifyExpression(expr.expression, antdLocals, allowedWrapperLocals);

  if (t.isJSXElement(expr)) return classifyJsxElement(expr, antdLocals, allowedWrapperLocals);

  if (t.isJSXFragment(expr))
    return classifyJsxChildren(expr.children as Parameters<typeof classifyJsxChildren>[0], antdLocals, allowedWrapperLocals);

  if (t.isConditionalExpression(expr)) {
    const left = classifyExpression(expr.consequent, antdLocals, allowedWrapperLocals);
    const right = classifyExpression(expr.alternate, antdLocals, allowedWrapperLocals);
    return { hasAnt: left.hasAnt || right.hasAnt, hasForeign: left.hasForeign || right.hasForeign };
  }

  if (t.isLogicalExpression(expr)) {
    return classifyExpression(expr.right, antdLocals, allowedWrapperLocals);
  }

  if (t.isSequenceExpression(expr)) {
    if (expr.expressions.length === 0) return { hasAnt: false, hasForeign: false };
    return classifyExpression(expr.expressions[expr.expressions.length - 1], antdLocals, allowedWrapperLocals);
  }

  if (t.isCallExpression(expr)) {
    if (
      t.isMemberExpression(expr.callee) &&
      t.isIdentifier(expr.callee.object) &&
      expr.callee.object.name === 'React' &&
      t.isIdentifier(expr.callee.property) &&
      expr.callee.property.name === 'createElement'
    ) {
      const first = expr.arguments[0];
      if (t.isIdentifier(first)) {
        return antdLocals.has(first.name)
          ? { hasAnt: true, hasForeign: false }
          : { hasAnt: false, hasForeign: true };
      }
    }
    return { hasAnt: false, hasForeign: true };
  }

  if (t.isIdentifier(expr)) {
    if (expr.name === 'undefined' || expr.name === 'null') return { hasAnt: false, hasForeign: false };
  }

  if (t.isNullLiteral(expr) || t.isBooleanLiteral(expr)) return { hasAnt: false, hasForeign: false };

  return { hasAnt: false, hasForeign: true };
};

const evaluateFunctionBody = (
  fnPath: NodePath<t.Function | t.ArrowFunctionExpression>,
  antdLocals: Set<string>,
  allowedWrapperLocals: Set<string>,
): 'wrapper' | 'reject' | 'unknown' => {
  let sawAnt = false;
  let sawForeign = false;

  const consider = (expr: t.Expression | t.PrivateName | null | undefined) => {
    const res = classifyExpression(expr, antdLocals, allowedWrapperLocals);
    if (res.hasAnt) sawAnt = true;
    if (res.hasForeign) sawForeign = true;
  };

  if (fnPath.isArrowFunctionExpression() && !fnPath.get('body').isBlockStatement()) {
    consider(fnPath.node.body);
  } else {
    fnPath.traverse({
      ReturnStatement(retPath) {
        if (retPath.getFunctionParent() !== fnPath) return;
        consider(retPath.node.argument ?? null);
      },
    });
  }

  if (sawForeign) return 'reject';
  if (sawAnt) return 'wrapper';
  return 'unknown';
};

const evaluateInitializer = (
  initPath: NodePath,
  antdLocals: Set<string>,
  allowedWrapperLocals: Set<string>,
): 'wrapper' | 'reject' | 'unknown' => {
  if (initPath.isArrowFunctionExpression() || initPath.isFunctionExpression()) {
    return evaluateFunctionBody(
      initPath as NodePath<t.Function | t.ArrowFunctionExpression>,
      antdLocals,
      allowedWrapperLocals,
    );
  }

  if (initPath.isCallExpression()) {
    const firstArg = initPath.get('arguments.0');
    if (Array.isArray(firstArg)) {
      for (const argPath of firstArg) {
        if (argPath && (argPath.isFunctionExpression() || argPath.isArrowFunctionExpression())) {
          const verdict = evaluateFunctionBody(
            argPath as NodePath<t.Function | t.ArrowFunctionExpression>,
            antdLocals,
            allowedWrapperLocals,
          );
          if (verdict !== 'unknown') return verdict;
        }
      }
    } else if (firstArg && (firstArg.isFunctionExpression() || firstArg.isArrowFunctionExpression())) {
      return evaluateFunctionBody(
        firstArg as NodePath<t.Function | t.ArrowFunctionExpression>,
        antdLocals,
        allowedWrapperLocals,
      );
    }
  }

  return 'unknown';
};

export const isThinAntWrapper = (
  astFile: t.File,
  componentName: string,
  antdLocals: Set<string>,
  allowedWrapperLocals: Set<string> = new Set<string>(),
): boolean => {
  let verdict: 'wrapper' | 'reject' | 'unknown' = 'unknown';

  traverse(astFile, {
    FunctionDeclaration(path) {
      if (verdict !== 'unknown') return;
      if (!path.node.id || path.node.id.name !== componentName) return;
      verdict = evaluateFunctionBody(path as NodePath<t.Function>, antdLocals, allowedWrapperLocals);
    },
    VariableDeclarator(path) {
      if (verdict !== 'unknown') return;
      if (!t.isIdentifier(path.node.id) || path.node.id.name !== componentName) return;
      const initPath = path.get('init');
      if (!initPath) return;
      verdict = evaluateInitializer(initPath as NodePath, antdLocals, allowedWrapperLocals);
    },
    ExportDefaultDeclaration(path) {
      if (verdict !== 'unknown') return;
      const decl = path.get('declaration');
      if (decl.isIdentifier() && decl.node.name === componentName) {
        // already handled via declaration traversal
        return;
      }
      if (decl.isFunctionDeclaration() || decl.isArrowFunctionExpression() || decl.isFunctionExpression()) {
        verdict = evaluateFunctionBody(
          decl as NodePath<t.Function | t.ArrowFunctionExpression>,
          antdLocals,
          allowedWrapperLocals,
        );
      }
    },
  });

  return verdict === 'wrapper';
};

export default isThinAntWrapper;
