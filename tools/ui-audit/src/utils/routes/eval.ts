/* eslint-disable  @typescript-eslint/no-explicit-any */
export const evalLiteral = (node: any): any => {
  console.log({ type: node.type });
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
