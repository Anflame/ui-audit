import type { Node } from '@babel/types';

declare module '@babel/traverse' {
  export type NodePath<T = Node> = any;
  export type TraverseOptions = Record<string, unknown>;
  const traverse: (node: Node, visitors: TraverseOptions) => void;
  export default traverse;
}
