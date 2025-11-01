import type { UiAuditConfig } from '../domain/model';

export type LibraryGroup = 'antd' | 'ksnm-common-ui' | 'other';

export const classifyByLibrary = (moduleName: string, cfg: UiAuditConfig): LibraryGroup => {
  const map = cfg.libraries ?? {};
  for (const [group, list] of Object.entries(map)) {
    if (list.some((m) => moduleName === m || moduleName.startsWith(`${m}/`))) {
      return group === 'ksnm-common-ui' ? 'ksnm-common-ui' : group === 'antd' ? 'antd' : 'other';
    }
  }
  return 'other';
};
