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
  componentFile?: string;
};

/**
 * Правило Stage-2:
 * - Нативные теги: включаем ТОЛЬКО интерактивные (input/select/textarea/button/… → LOCAL).
 * - ANTD/KSNM: как есть.
 * - Прочие импортируемые CamelCase (локальные/сторонние): ВКЛЮЧАЕМ как LOCAL (кандидаты на обёртки).
 *   Их мы отфильтруем уже на Stage-3, если это не обёртки.
 * - JSX без импорта и не нативный — пропускаем.
 */
export const deriveComponentType = (file: string, usage: JsxUsage, cfg: UiAuditConfig): ClassifiedItem | null => {
  // Нативные
  if (!usage.import && INTRINSIC_HTML.has(usage.element)) {
    if (!isInteractiveIntrinsic(usage.element)) return null;
    return { file, component: usage.element, type: COMPONENT_TYPES.LOCAL, count: usage.count, label: usage.label };
  }

  // Импортируемые
  if (usage.import) {
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
    // Прочие импортируемые (локальные/сторонние) — включаем как LOCAL (кандидаты на обёртки)
    return {
      file,
      component: usage.element,
      type: COMPONENT_TYPES.LOCAL,
      sourceModule: usage.import.source,
      count: usage.count,
      label: usage.label,
    };
  }

  // Остальное — мимо
  return null;
};
