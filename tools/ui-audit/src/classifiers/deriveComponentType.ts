import { COMPONENT_TYPES } from '../domain/constants';

import { classifyByLibrary } from './classifyByLibrary';

import type { JsxUsage } from './mapJsxToImports';
import type { UiAuditConfig } from '../domain/model';

export type ClassifiedItem = {
  file: string;
  component: string;
  type: (typeof COMPONENT_TYPES)[keyof typeof COMPONENT_TYPES];
  sourceModule?: string;
  count: number;
  label?: string;
  componentFile?: string;
};

export const deriveComponentType = (file: string, usage: JsxUsage, cfg: UiAuditConfig): ClassifiedItem => {
  if (!usage.import)
    return { file, component: usage.element, type: COMPONENT_TYPES.LOCAL, count: usage.count, label: usage.label };
  const group = classifyByLibrary(usage.import.source, cfg);
  if (group === 'antd')
    return {
      file,
      component: usage.element,
      type: COMPONENT_TYPES.ANTD,
      sourceModule: usage.import.source,
      count: usage.count,
      label: usage.label,
    };
  if (group === 'ksnm-common-ui')
    return {
      file,
      component: usage.element,
      type: COMPONENT_TYPES.KSNM,
      sourceModule: usage.import.source,
      count: usage.count,
      label: usage.label,
    };
  return {
    file,
    component: usage.element,
    type: COMPONENT_TYPES.LOCAL,
    sourceModule: usage.import.source,
    count: usage.count,
    label: usage.label,
  };
};
