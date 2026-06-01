/**
 * Deterministic pseudo-source-code + a tiny tokenizer for the Code Viewer demo.
 * Shared across React, Vue, and Angular demos.
 */

export const CODE_TOTAL = 100_000;

/** A believable block of TypeScript, cycled to fill the file. */
const SNIPPET: string[] = [
  '// Virtualized rendering keeps memory flat regardless of dataset size.',
  'export function renderViewport(height: number, rows: Row[]): Range {',
  '  const visible: number[] = [];',
  '  let offset = 0;',
  '  for (let i = startIndex; i < rows.length; i++) {',
  '    const el = pool.acquire(i);',
  '    el.style.top = offset + "px";',
  '    const measured = measure(el);',
  '    cache.set(i, measured);',
  '    offset += measured;',
  '    visible.push(i);',
  '    if (offset > height) break;',
  '  }',
  '  return { start: startIndex, end: visible.at(-1) ?? 0, visible };',
  '}',
  '',
  'class PerformanceCache {',
  '  private heights = new Map<number, number>();',
  '  constructor(private readonly total: number) {}',
  '  get(index: number): number | undefined {',
  '    return this.heights.get(index);',
  '  }',
  '  set(index: number, value: number): void {',
  '    this.heights.set(index, value);',
  '  }',
  '  clear(): void {',
  '    this.heights.clear();',
  '  }',
  '}',
  '',
  'const scroller = new CeriousScroll(container, 1000000, options);',
  'await scroller.ready();',
  'if (offset >= total && !done) {',
  '  emit("reached-end", { index: total - 1 });',
  '}',
  '',
];

export interface CodeLine {
  index: number;
  raw: string;
}

export function makeLine(index: number): CodeLine {
  return { index, raw: SNIPPET[index % SNIPPET.length] };
}

export type TokenType = 'comment' | 'keyword' | 'string' | 'number' | 'fn' | 'punct' | 'plain';
export interface Token {
  text: string;
  type: TokenType;
}

const KEYWORDS = new Set([
  'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'await', 'async',
  'import', 'from', 'export', 'class', 'new', 'interface', 'type', 'of', 'in', 'void', 'this',
  'private', 'public', 'readonly', 'constructor', 'number', 'string', 'boolean',
]);

const TOKEN_RE = /(\s+|\/\/.*$|'[^']*'|`[^`]*`|"[^"]*"|\b\d+\b|\b[A-Za-z_$][\w$]*\b|[^\w\s])/g;

/** Cheap regex tokenizer — good enough to colour the visible lines. */
export function tokenize(raw: string): Token[] {
  if (raw.trimStart().startsWith('//')) return [{ text: raw, type: 'comment' }];
  const parts = raw.match(TOKEN_RE) ?? [];
  const out: Token[] = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (/^\s+$/.test(p)) out.push({ text: p, type: 'plain' });
    else if (/^['"`]/.test(p)) out.push({ text: p, type: 'string' });
    else if (/^\d+$/.test(p)) out.push({ text: p, type: 'number' });
    else if (/^[A-Za-z_$]/.test(p)) {
      const next = parts[i + 1];
      if (KEYWORDS.has(p)) out.push({ text: p, type: 'keyword' });
      else if (next === '(') out.push({ text: p, type: 'fn' });
      else out.push({ text: p, type: 'plain' });
    } else out.push({ text: p, type: 'punct' });
  }
  return out;
}

export function firstMatch(query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return -1;
  for (let i = 0; i < CODE_TOTAL; i++) {
    if (makeLine(i).raw.toLowerCase().includes(q)) return i;
  }
  return -1;
}
