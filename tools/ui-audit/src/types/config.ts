export type UiAuditLibraries = {
  [group: string]: string[];
};

export type UiAuditOptions = {
  splitAntIcons?: boolean;
  countIcons?: boolean;
  stripUrlPrefix?: boolean;
};

export interface UiAuditConfig {
  projectName: string;
  routerFiles?: string[];
  srcRoots: string[];
  aliases?: Record<string, string>;
  libraries: UiAuditLibraries;
  options?: UiAuditOptions;
}
