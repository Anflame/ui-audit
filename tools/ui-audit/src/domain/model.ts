export type UiAuditLibraries = { [group: string]: string[] };

export interface UiAuditConfig {
  projectName: string;
  routerFiles?: string[];
  srcRoots: string[];
  aliases?: Record<string, string | string[]>;
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
  labelMap?: Record<string, string>; // elementName -> first non-empty title/label literal
  interactiveIntrinsics?: string[]; // интринсики, которые считаем интерактивными из-за роли/обработчиков
};
