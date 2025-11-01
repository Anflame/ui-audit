import { COMPONENT_TYPES } from '../domain/constants';

import type { ClassifiedItem } from './deriveComponentType';

export type Summary = Record<string, number>;

export type ClassifiedReport = {
  items: ClassifiedItem[];
  summary: Summary;
};

export const aggregate = (items: ClassifiedItem[]): ClassifiedReport => {
  const summary: Summary = {
    [COMPONENT_TYPES.ANTD]: 0,
    [COMPONENT_TYPES.ANTD_WRAPPER]: 0,
    [COMPONENT_TYPES.KSNM]: 0,
    [COMPONENT_TYPES.LOCAL]: 0,
  };

  for (const it of items) {
    summary[it.type] = (summary[it.type] ?? 0) + it.count;
  }
  return { items, summary };
};
