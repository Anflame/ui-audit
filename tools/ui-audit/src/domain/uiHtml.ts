export const INTERACTIVE_HTML = new Set(['input', 'select', 'textarea', 'button']);

export const isInteractiveIntrinsic = (tag: string): boolean => INTERACTIVE_HTML.has(tag);

export const isCamelCaseComponent = (name: string): boolean => /^(?:[A-Z][A-Za-z0-9]*)$/.test(name);

export const isRelativeModule = (spec: string): boolean => spec.startsWith('./') || spec.startsWith('../');
