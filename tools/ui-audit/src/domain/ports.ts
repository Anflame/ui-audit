import type { FileScan } from './model';

export interface IFileSystem {
  readFile: (absPath: string) => Promise<string>;
  writeJson: (absPath: string, data: unknown, pretty?: boolean) => Promise<void>;
  ensureDir: (absPath: string) => Promise<void>;
  glob: (cwd: string, patterns: string[], ignore: string[]) => Promise<string[]>;
  join: (...parts: string[]) => string;
  relative: (from: string, to: string) => string;
}

export interface IParser {
  parse: (code: string) => unknown;
}

export type Stage1Result = { jsonPath: string; scans: FileScan[] };
