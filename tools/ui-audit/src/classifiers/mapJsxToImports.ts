import { INTRINSIC_HTML, isInteractiveIntrinsic } from '../domain/constants';

import type { FileScan, ImportInfo } from '../domain/model';

export type JsxUsage = { element: string; count: number; import?: ImportInfo | null; label?: string };

export const mapJsxToImports = (scan: FileScan): JsxUsage[] => {
  const counter = new Map<string, number>();
  for (const el of scan.jsxElements) counter.set(el, (counter.get(el) ?? 0) + 1);

  const byLocal = new Map<string, ImportInfo>();
  for (const im of scan.imports) byLocal.set(im.localName, im);

  const result: JsxUsage[] = [];
  const labelMap: Record<string, string> = scan.labelMap ?? {};

  for (const [el, count] of counter.entries()) {
    if (INTRINSIC_HTML.has(el)) {
      if (!isInteractiveIntrinsic(el)) continue; // пропускаем div/span/…
      result.push({ element: el, count, import: null, label: labelMap[el] });
      continue;
    }

    const base = el.includes('.') ? el.split('.')[0] : el; // Form.Item → Form
    const im = byLocal.get(base) ?? null;
    result.push({ element: el, count, import: im, label: labelMap[el] });
  }
  return result;
};
