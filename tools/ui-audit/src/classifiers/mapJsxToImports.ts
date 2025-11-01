import { INTRINSIC_HTML } from '../domain/constants';

import type { FileScan, ImportInfo } from '../domain/model';

export type JsxUsage = {
  element: string;
  count: number;
  import?: ImportInfo | null;
};

export const mapJsxToImports = (scan: FileScan): JsxUsage[] => {
  const counter = new Map<string, number>();
  for (const el of scan.jsxElements) counter.set(el, (counter.get(el) ?? 0) + 1);

  const byLocal = new Map<string, ImportInfo>();
  for (const im of scan.imports) byLocal.set(im.localName, im);

  const result: JsxUsage[] = [];
  for (const [el, count] of counter.entries()) {
    if (INTRINSIC_HTML.has(el)) {
      result.push({ element: el, count, import: null });
      continue;
    }
    const im = byLocal.get(el) ?? null;
    result.push({ element: el, count, import: im });
  }
  return result;
};
