import { isRelativeModule } from '../domain/constants';

const normalizeAliasKey = (alias: string): string => alias.replace(/\/+$/, '');

const aliasMatchesSpec = (alias: string, spec: string): boolean => {
  if (!alias.includes('*')) {
    if (spec === alias) return true;
    return spec.startsWith(`${alias}/`);
  }

  const [prefix, suffix] = alias.split('*');
  if (prefix && !spec.startsWith(prefix)) return false;
  if (suffix && !spec.endsWith(suffix)) return false;

  const remainder = spec.slice(prefix.length, suffix ? spec.length - suffix.length : undefined);
  if (!remainder && alias.includes('/*')) return false;
  return true;
};

export const matchesAlias = (
  spec: string,
  aliases: Record<string, string | string[]> | undefined,
): boolean => {
  if (!aliases) return false;
  for (const rawAlias of Object.keys(aliases)) {
    const alias = normalizeAliasKey(rawAlias);
    if (!alias) continue;
    if (aliasMatchesSpec(alias, spec)) return true;
  }
  return false;
};

export const isLocalImport = (
  spec: string,
  aliases: Record<string, string | string[]> | undefined,
): boolean => isRelativeModule(spec) || matchesAlias(spec, aliases);
