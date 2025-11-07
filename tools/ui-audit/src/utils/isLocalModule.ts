import { isRelativeModule } from '../domain/constants';

export const matchesAlias = (
  spec: string,
  aliases: Record<string, string> | undefined,
): boolean => {
  if (!aliases) return false;
  for (const rawAlias of Object.keys(aliases)) {
    const alias = rawAlias.replace(/\/+$/, '');
    if (!alias) continue;
    if (spec === alias) return true;
    if (spec.startsWith(`${alias}/`)) return true;
  }
  return false;
};

export const isLocalImport = (
  spec: string,
  aliases: Record<string, string> | undefined,
): boolean => isRelativeModule(spec) || matchesAlias(spec, aliases);
