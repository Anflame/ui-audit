import { resolveAliasImportPath, resolveImportPath } from '../utils/resolveModule';
import { toPosixOrNull, toPosixPath } from '../utils/normalizePath';

import type { PageInfo } from './collectPages';
import type { FileScan } from '../domain/model';

export type Deps = { parentsOf: Map<string, Set<string>>; childrenOf: Map<string, Set<string>> };

export const buildReverseDeps = async (
  cwd: string,
  scans: FileScan[],
  aliases: Record<string, string> | undefined,
): Promise<Deps> => {
  const parentsOf = new Map<string, Set<string>>();
  const childrenOf = new Map<string, Set<string>>();

  for (const s of scans) {
    const parentFile = toPosixPath(s.file);
    for (const im of s.imports) {
      let child: string | null = null;

      if (im.source.startsWith('./') || im.source.startsWith('../')) {
        child = await resolveImportPath(parentFile, im.source);
      } else {
        child = await resolveAliasImportPath(cwd, aliases, im.source);
      }

      const childPosix = toPosixOrNull(child);
      if (!childPosix) continue;

      if (!parentsOf.has(childPosix)) parentsOf.set(childPosix, new Set());
      parentsOf.get(childPosix)!.add(parentFile);

      if (!childrenOf.has(parentFile)) childrenOf.set(parentFile, new Set());
      childrenOf.get(parentFile)!.add(childPosix);
    }
  }

  return { parentsOf, childrenOf };
};

export const findOwningPage = (file: string, pages: Record<string, PageInfo>, deps: Deps): PageInfo | undefined => {
  const start = toPosixPath(file);
  const visited = new Set<string>();
  const q: string[] = [start];

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
