import { resolveImportPath } from '../utils/resolveModule';

import type { PageInfo } from './collectPages';
import type { FileScan } from '../domain/model';
import type { ResolvedConfig } from '../utils/config';

export type Deps = { parentsOf: Map<string, Set<string>>; childrenOf: Map<string, Set<string>> };

export const buildReverseDeps = async (cfg: ResolvedConfig, scans: FileScan[]): Promise<Deps> => {
  const parentsOf = new Map<string, Set<string>>();
  const childrenOf = new Map<string, Set<string>>();

  for (const s of scans) {
    for (const im of s.imports) {
      const child = await resolveImportPath(s.file, im.source, { cwd: cfg.cwd, aliases: cfg.aliases });
      if (!child) continue;
      if (!parentsOf.has(child)) parentsOf.set(child, new Set());
      parentsOf.get(child)!.add(s.file);
      if (!childrenOf.has(s.file)) childrenOf.set(s.file, new Set());
      childrenOf.get(s.file)!.add(child);
    }
  }
  return { parentsOf, childrenOf };
};

export const findOwningPage = (file: string, pages: Record<string, PageInfo>, deps: Deps): PageInfo | undefined => {
  const visited = new Set<string>();
  const q: string[] = [file];
  while (q.length) {
    const cur = q.shift()!;
    if (visited.has(cur)) continue;
    visited.add(cur);
    if (pages[cur]) return pages[cur];
    const parents = deps.parentsOf.get(cur);
    if (parents) for (const p of parents) q.push(p);
  }
  return undefined;
};
