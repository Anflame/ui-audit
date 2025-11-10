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

type JsxScanResult = { hasAnt: boolean; hasForeign: boolean; wrapped: Set<string> };

const emptyScan = (): JsxScanResult => ({ hasAnt: false, hasForeign: false, wrapped: new Set<string>() });

const mergeScan = (target: JsxScanResult, source: JsxScanResult): void => {
  if (source.hasAnt) target.hasAnt = true;
  if (source.hasForeign) target.hasForeign = true;
  for (const name of source.wrapped) target.wrapped.add(name);
};

const classifyJsxChildren = (
  children: (t.JSXElement | t.JSXFragment | t.JSXText | t.JSXSpreadChild | t.JSXExpressionContainer)[],
  antdLocals: Set<string>,
  allowedWrapperLocals: Set<string>,
  allowedUiLocals: Set<string>,
  depth: number,
  bump = true,
): JsxScanResult => {
  const acc = emptyScan();
  for (const child of children) {
    if (acc.hasForeign) break;
    const nextDepth = bump ? depth + 1 : depth;
    if (t.isJSXElement(child)) {
      const res = classifyJsxElement(child, antdLocals, allowedWrapperLocals, allowedUiLocals, nextDepth);
      mergeScan(acc, res);
    } else if (t.isJSXFragment(child)) {
      const res = classifyJsxChildren(
        child.children as typeof children,
        antdLocals,
        allowedWrapperLocals,
        allowedUiLocals,
        depth + 1,
      );
      mergeScan(acc, res);
    } else if (t.isJSXExpressionContainer(child)) {
      const res = classifyExpression(child.expression, antdLocals, allowedWrapperLocals, allowedUiLocals, nextDepth);
      mergeScan(acc, res);
    } else if (t.isJSXText(child)) {
      if (child.value.trim().length > 0) acc.hasForeign = true;
    } else if (child) {
      acc.hasForeign = true;
    }
  }
  return acc;
};

const classifyJsxElement = (
  element: t.JSXElement,
  antdLocals: Set<string>,
  allowedWrapperLocals: Set<string>,
  allowedUiLocals: Set<string>,
  depth: number,
): JsxScanResult => {
  if (isAntName(element.openingElement.name, antdLocals)) {
    const res = emptyScan();
    res.hasAnt = true;
    const base = getBaseJsxIdentifier(element.openingElement.name);
    if (base && depth === 0) res.wrapped.add(base);
    const childrenScan = classifyJsxChildren(
      element.children as Parameters<typeof classifyJsxChildren>[0],
      antdLocals,
      allowedWrapperLocals,
      allowedUiLocals,
      depth + 1,
    );
    mergeScan(res, childrenScan);
    return res;
  }

  const base = getBaseJsxIdentifier(element.openingElement.name);
  if (base && allowedWrapperLocals.has(base)) {
    return classifyJsxChildren(
      element.children as Parameters<typeof classifyJsxChildren>[0],
      antdLocals,
      allowedWrapperLocals,
      allowedUiLocals,
      depth,
      false,
    );
  }

  if (base && base.toLowerCase() === base) {
    const childrenScan = classifyJsxChildren(
      element.children as Parameters<typeof classifyJsxChildren>[0],
      antdLocals,
      allowedWrapperLocals,
      allowedUiLocals,
      depth + 1,
    );
    return childrenScan;
  }

  if (base && allowedUiLocals.has(base)) {
    return emptyScan();
  }

  const res = emptyScan();
  res.hasForeign = true;
  return res;
};

const isChildrenAccess = (expr: t.Expression | t.PrivateName): boolean => {
  if (t.isIdentifier(expr)) return expr.name === 'children';

  if (t.isMemberExpression(expr)) {
    if (expr.computed) return false;
    if (!t.isIdentifier(expr.property) || expr.property.name !== 'children') return false;

    const obj = expr.object;
    if (t.isIdentifier(obj)) return obj.name === 'props' || /Props$/u.test(obj.name);
    if (t.isThisExpression(obj)) return true;
    if (t.isMemberExpression(obj)) {
      if (obj.computed) return false;
      if (!t.isIdentifier(obj.property)) return false;
      if (obj.property.name === 'props') return t.isThisExpression(obj.object) || isChildrenAccess(obj.object);
    }
    if (t.isOptionalMemberExpression(obj)) {
      if (!t.isIdentifier(obj.property) || obj.property.name !== 'props') return false;
      return t.isThisExpression(obj.object) || isChildrenAccess(obj.object);
    }
  }

  if (t.isOptionalMemberExpression(expr)) {
    if (!t.isIdentifier(expr.property) || expr.property.name !== 'children') return false;
    const obj = expr.object;
    if (t.isIdentifier(obj)) return obj.name === 'props' || /Props$/u.test(obj.name);
    if (t.isThisExpression(obj)) return true;
    if (t.isMemberExpression(obj) || t.isOptionalMemberExpression(obj)) return isChildrenAccess(obj);
  }

  return false;
};

const classifyExpression = (
  expr: t.Expression | t.PrivateName | null | undefined,
  antdLocals: Set<string>,
  allowedWrapperLocals: Set<string>,
  allowedUiLocals: Set<string>,
  depth: number,
): JsxScanResult => {
  if (!expr) return emptyScan();

  if (t.isParenthesizedExpression(expr))
    return classifyExpression(expr.expression, antdLocals, allowedWrapperLocals, allowedUiLocals, depth);

  if (isChildrenAccess(expr)) return emptyScan();

  if (t.isJSXElement(expr)) return classifyJsxElement(expr, antdLocals, allowedWrapperLocals, allowedUiLocals, depth);

  if (t.isJSXFragment(expr))
    return classifyJsxChildren(
      expr.children as Parameters<typeof classifyJsxChildren>[0],
      antdLocals,
      allowedWrapperLocals,
      allowedUiLocals,
      depth,
    );

  if (t.isConditionalExpression(expr)) {
    const left = classifyExpression(expr.consequent, antdLocals, allowedWrapperLocals, allowedUiLocals, depth);
    const right = classifyExpression(expr.alternate, antdLocals, allowedWrapperLocals, allowedUiLocals, depth);
    const acc = emptyScan();
    mergeScan(acc, left);
    mergeScan(acc, right);
    return acc;
  }

  if (t.isLogicalExpression(expr)) {
    return classifyExpression(expr.right, antdLocals, allowedWrapperLocals, allowedUiLocals, depth);
  }

  if (t.isSequenceExpression(expr)) {
    if (expr.expressions.length === 0) return emptyScan();
    return classifyExpression(
      expr.expressions[expr.expressions.length - 1],
      antdLocals,
      allowedWrapperLocals,
      allowedUiLocals,
      depth,
    );
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
        const res = emptyScan();
        if (antdLocals.has(first.name)) {
          res.hasAnt = true;
          if (depth === 0) res.wrapped.add(first.name);
        } else {
          if (!allowedUiLocals.has(first.name)) res.hasForeign = true;
        }
        return res;
      }
    }
    const res = emptyScan();
    res.hasForeign = true;
    return res;
  }

  if (t.isIdentifier(expr)) {
    if (expr.name === 'undefined' || expr.name === 'null') return emptyScan();
  }

  if (t.isNullLiteral(expr) || t.isBooleanLiteral(expr)) return emptyScan();

  const res = emptyScan();
  res.hasForeign = true;
  return res;
};

type WrapperVerdict = { verdict: 'wrapper' | 'reject' | 'unknown'; wrappedLocals: Set<string> };

const evaluateFunctionBody = (
  fnPath: NodePath<t.Function | t.ArrowFunctionExpression>,
  antdLocals: Set<string>,
  allowedWrapperLocals: Set<string>,
  allowedUiLocals: Set<string>,
): WrapperVerdict => {
  let sawAnt = false;
  let sawForeign = false;
  const wrapped = new Set<string>();

  const consider = (expr: t.Expression | t.PrivateName | null | undefined) => {
    const res = classifyExpression(expr, antdLocals, allowedWrapperLocals, allowedUiLocals, 0);
    if (res.hasAnt) sawAnt = true;
    if (res.hasForeign) sawForeign = true;
    for (const name of res.wrapped) wrapped.add(name);
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

  if (sawForeign) return { verdict: 'reject', wrappedLocals: new Set<string>() };
  if (sawAnt) return { verdict: 'wrapper', wrappedLocals: wrapped };
  return { verdict: 'unknown', wrappedLocals: new Set<string>() };
};

const evaluateInitializer = (
  initPath: NodePath,
  antdLocals: Set<string>,
  allowedWrapperLocals: Set<string>,
  allowedUiLocals: Set<string>,
): WrapperVerdict => {
  if (initPath.isArrowFunctionExpression() || initPath.isFunctionExpression()) {
    return evaluateFunctionBody(
      initPath as NodePath<t.Function | t.ArrowFunctionExpression>,
      antdLocals,
      allowedWrapperLocals,
      allowedUiLocals,
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
            allowedUiLocals,
          );
          if (verdict.verdict !== 'unknown') return verdict;
        }
      }
    } else if (firstArg && (firstArg.isFunctionExpression() || firstArg.isArrowFunctionExpression())) {
      return evaluateFunctionBody(
        firstArg as NodePath<t.Function | t.ArrowFunctionExpression>,
        antdLocals,
        allowedWrapperLocals,
        allowedUiLocals,
      );
    }
  }

  return { verdict: 'unknown', wrappedLocals: new Set<string>() };
};

export const analyzeThinAntWrapper = (
  astFile: t.File,
  componentName: string,
  antdLocals: Set<string>,
  allowedWrapperLocals: Set<string> = new Set<string>(),
  allowedUiLocals: Set<string> = new Set<string>(),
): WrapperVerdict => {
  let verdict: 'wrapper' | 'reject' | 'unknown' = 'unknown';
  let wrapped = new Set<string>();

  const adopt = (res: WrapperVerdict) => {
    if (verdict !== 'unknown') return;
    verdict = res.verdict;
    wrapped = res.wrappedLocals;
  };

  traverse(astFile, {
    FunctionDeclaration(path) {
      if (verdict !== 'unknown') return;
      if (!path.node.id || path.node.id.name !== componentName) return;
      adopt(evaluateFunctionBody(path as NodePath<t.Function>, antdLocals, allowedWrapperLocals, allowedUiLocals));
    },
    VariableDeclarator(path) {
      if (verdict !== 'unknown') return;
      if (!t.isIdentifier(path.node.id) || path.node.id.name !== componentName) return;
      const initPath = path.get('init');
      if (!initPath) return;
      adopt(evaluateInitializer(initPath as NodePath, antdLocals, allowedWrapperLocals, allowedUiLocals));
    },
    ExportDefaultDeclaration(path) {
      if (verdict !== 'unknown') return;
      const decl = path.get('declaration');
      if (decl.isIdentifier() && decl.node.name === componentName) {
        // already handled via declaration traversal
        return;
      }
      if (decl.isFunctionDeclaration() || decl.isArrowFunctionExpression() || decl.isFunctionExpression()) {
        adopt(
          evaluateFunctionBody(
            decl as NodePath<t.Function | t.ArrowFunctionExpression>,
            antdLocals,
            allowedWrapperLocals,
            allowedUiLocals,
          ),
        );
      }
    },
  });

  return { verdict, wrappedLocals: wrapped };
};

export default analyzeThinAntWrapper;
