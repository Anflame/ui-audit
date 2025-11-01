export type UiAuditLibraries = {
  [group: string]: string[];
};

export interface UiAuditConfig {
  projectName: string;
  routerFiles?: string[];
  srcRoots: string[];
  aliases?: Record<string, string>;
  libraries: UiAuditLibraries;
  options?: Record<string, unknown>;
}

export type ImportInfo = {
  localName: string;
  importedName?: string;
  source: string;
};

export type FileScan = {
  file: string;
  imports: ImportInfo[];
  jsxElements: string[];
};
