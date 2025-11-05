import { COMPONENT_TYPES, INTRINSIC_HTML, isInteractiveIntrinsic } from '../domain/constants';

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
  componentFile?: string; // для обёрток — путь к файлу компонента-обёртки
};

export const deriveComponentType = (file: string, usage: JsxUsage, cfg: UiAuditConfig): ClassifiedItem | null => {
  // 1) отсекаем неинтерактивные HTML-теги
  if (!usage.import && INTRINSIC_HTML.has(usage.element) && !isInteractiveIntrinsic(usage.element)) {
    return null;
  }

  // 2) нативные интринсики (input/button/…)
  if (!usage.import) {
    return {
      file,
      component: usage.element,
      type: COMPONENT_TYPES.LOCAL,
      count: usage.count,
      label: usage.label,
    };
  }

  // 3) классификация по библиотеке
  const group = classifyByLibrary(usage.import.source, cfg);
  if (group === 'antd') {
    return {
      file,
      component: usage.element,
      type: COMPONENT_TYPES.ANTD,
      sourceModule: usage.import.source,
      count: usage.count,
      label: usage.label,
    };
  }
  if (group === 'ksnm-common-ui') {
    return {
      file,
      component: usage.element,
      type: COMPONENT_TYPES.KSNM,
      sourceModule: usage.import.source,
      count: usage.count,
      label: usage.label,
    };
  }

  // 4) всё остальное — local (потом Stage 3 поднимет до ANTD_WRAPPER при необходимости)
  return {
    file,
    component: usage.element,
    type: COMPONENT_TYPES.LOCAL,
    sourceModule: usage.import.source,
    count: usage.count,
    label: usage.label,
  };
};
