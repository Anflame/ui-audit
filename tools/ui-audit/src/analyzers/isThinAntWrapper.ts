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

const classifyExpression = (
  expr: t.Expression | t.PrivateName | null | undefined,
  antdLocals: Set<string>,
): { hasAnt: boolean; hasForeign: boolean } => {
  if (!expr) return { hasAnt: false, hasForeign: false };

  if (t.isParenthesizedExpression(expr)) return classifyExpression(expr.expression, antdLocals);

  if (t.isJSXElement(expr)) {
    return isAntName(expr.openingElement.name, antdLocals)
      ? { hasAnt: true, hasForeign: false }
      : { hasAnt: false, hasForeign: true };
  }

  if (t.isJSXFragment(expr)) {
    let hasAnt = false;
    let hasForeign = false;
    for (const child of expr.children) {
      if (hasForeign) break;
      if (t.isJSXElement(child)) {
        const res = classifyExpression(child, antdLocals);
        hasAnt ||= res.hasAnt;
        hasForeign ||= res.hasForeign;
      } else if (t.isJSXExpressionContainer(child)) {
        const res = classifyExpression(child.expression, antdLocals);
        hasAnt ||= res.hasAnt;
        hasForeign ||= res.hasForeign;
      } else if (t.isJSXText(child)) {
        if (child.value.trim().length > 0) hasForeign = true;
      } else if (child) {
        hasForeign = true;
      }
    }
    return { hasAnt, hasForeign };
  }

  if (t.isConditionalExpression(expr)) {
    const left = classifyExpression(expr.consequent, antdLocals);
    const right = classifyExpression(expr.alternate, antdLocals);
    return { hasAnt: left.hasAnt || right.hasAnt, hasForeign: left.hasForeign || right.hasForeign };
  }

  if (t.isLogicalExpression(expr)) {
    return classifyExpression(expr.right, antdLocals);
  }

  if (t.isSequenceExpression(expr)) {
    if (expr.expressions.length === 0) return { hasAnt: false, hasForeign: false };
    return classifyExpression(expr.expressions[expr.expressions.length - 1], antdLocals);
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
): 'wrapper' | 'reject' | 'unknown' => {
  let sawAnt = false;
  let sawForeign = false;

  const consider = (expr: t.Expression | t.PrivateName | null | undefined) => {
    const res = classifyExpression(expr, antdLocals);
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
): 'wrapper' | 'reject' | 'unknown' => {
  if (initPath.isArrowFunctionExpression() || initPath.isFunctionExpression()) {
    return evaluateFunctionBody(initPath as NodePath<t.Function | t.ArrowFunctionExpression>, antdLocals);
  }

  if (initPath.isCallExpression()) {
    const firstArg = initPath.get('arguments.0');
    if (Array.isArray(firstArg)) {
      for (const argPath of firstArg) {
        if (argPath && (argPath.isFunctionExpression() || argPath.isArrowFunctionExpression())) {
          const verdict = evaluateFunctionBody(argPath as NodePath<t.Function | t.ArrowFunctionExpression>, antdLocals);
          if (verdict !== 'unknown') return verdict;
        }
      }
    } else if (firstArg && (firstArg.isFunctionExpression() || firstArg.isArrowFunctionExpression())) {
      return evaluateFunctionBody(firstArg as NodePath<t.Function | t.ArrowFunctionExpression>, antdLocals);
    }
  }

  return 'unknown';
};

export const isThinAntWrapper = (
  astFile: t.File,
  componentName: string,
  antdLocals: Set<string>,
): boolean => {
  let verdict: 'wrapper' | 'reject' | 'unknown' = 'unknown';

  traverse(astFile, {
    FunctionDeclaration(path) {
      if (verdict !== 'unknown') return;
      if (!path.node.id || path.node.id.name !== componentName) return;
      verdict = evaluateFunctionBody(path as NodePath<t.Function>, antdLocals);
    },
    VariableDeclarator(path) {
      if (verdict !== 'unknown') return;
      if (!t.isIdentifier(path.node.id) || path.node.id.name !== componentName) return;
      const initPath = path.get('init');
      if (!initPath) return;
      verdict = evaluateInitializer(initPath as NodePath, antdLocals);
    },
    ExportDefaultDeclaration(path) {
      if (verdict !== 'unknown') return;
      const decl = path.get('declaration');
      if (decl.isIdentifier() && decl.node.name === componentName) {
        // already handled via declaration traversal
        return;
      }
      if (decl.isFunctionDeclaration() || decl.isArrowFunctionExpression() || decl.isFunctionExpression()) {
        verdict = evaluateFunctionBody(decl as NodePath<t.Function | t.ArrowFunctionExpression>, antdLocals);
      }
    },
  });

  return verdict === 'wrapper';
};

export default isThinAntWrapper;
