import path from 'node:path';

import fg from 'fast-glob';
import fs from 'fs-extra';

import type { IFileSystem } from '../domain/ports';

export class FsNode implements IFileSystem {
  readFile = async (absPath: string): Promise<string> => fs.readFile(absPath, 'utf8');
  writeJson = async (absPath: string, data: unknown, pretty?: boolean): Promise<void> => {
    const text = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
    await fs.outputFile(absPath, text, 'utf8');
  };
  ensureDir = async (absPath: string): Promise<void> => fs.ensureDir(absPath);
  glob = async (cwd: string, patterns: string[], ignore: string[]): Promise<string[]> =>
    fg(patterns, { cwd, absolute: true, onlyFiles: true, ignore });
  join = (...parts: string[]): string => path.join(...parts);
  relative = (from: string, to: string): string => path.relative(from, to);
}
