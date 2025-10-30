export interface FileAst {
  filePath: string;
  ast: any;
}

export type RouteLike = Record<string, unknown>;

export interface FileRoutes {
  filePath: string;
  routes: RouteLike[];
}
