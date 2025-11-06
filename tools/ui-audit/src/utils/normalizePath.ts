import path from 'node:path';

export const toPosixPath = (input: string): string => {
  const normalized = path.normalize(input);
  return normalized.replace(/\\+/g, '/');
};

export const toPosixOrNull = (input: string | null | undefined): string | null => {
  if (!input) return null;
  return toPosixPath(input);
};
