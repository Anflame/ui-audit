import { resolveImportPath as resolveImportPath3 } from '../utils/resolveModule';

import type { PageInfo } from './collectPages';
import type { FileScan } from '../domain/model';

export type Deps = { parentsOf: Map<string, Set<string>> };

export const buildReverseDeps = async (_cwd: string, scans: FileScan[]): Promise<Deps> => {
  const parentsOf = new Map<string, Set<string>>();
  for (const s of scans) {
    for (const im of s.imports) {
      if (!im.source.startsWith('./') && !im.source.startsWith('../')) continue;
      const child = await resolveImportPath3(s.file, im.source);
      if (!child) continue;
      if (!parentsOf.has(child)) parentsOf.set(child, new Set());
      parentsOf.get(child)!.add(s.file);
    }
  }
  return { parentsOf };
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
