/**
 * Deterministic data for the "Native Table · wild dynamic heights" demo.
 *
 * Every row is a real <tr>, but each one carries DRAMATICALLY different content
 * — one-liners next to walls of text, long lists, code blocks, tall banners and
 * wrapping tag clouds — so the engine's per-row measurement (never estimated)
 * is stress-tested. All content is a pure function of the row index, so the
 * engine re-derives identical heights on every re-render.
 *
 * Pure TS / framework-agnostic: the React, Vue and Angular demos all build their
 * cells from these structures (each renders the union per its own template).
 */
import { rand, randInt, pick } from '../lib/random';

export const HEIGHTS_TOTAL = 100_000;

export interface HeightsColumn {
  key: string;
  label: string;
  /** CSS width; '' lets `table-layout: fixed` distribute the remainder. */
  width: string;
  cls: string;
}

export const HEIGHTS_COLUMNS: readonly HeightsColumn[] = [
  { key: 'id', label: 'ID', width: '96px', cls: 'col-id' },
  { key: 'kind', label: 'KIND', width: '110px', cls: 'col-kind' },
  { key: 'body', label: 'CONTENT', width: '', cls: 'col-body' },
  { key: 'meta', label: 'META', width: '110px', cls: 'col-meta' },
];

export const HEIGHTS_COLUMN_WIDTHS: readonly string[] = HEIGHTS_COLUMNS.map((c) => c.width);

export type HeightsKind = 'line' | 'para' | 'wall' | 'list' | 'code' | 'banner' | 'tags';

const KINDS: { key: HeightsKind; label: string; cls: string }[] = [
  { key: 'line', label: 'one-line', cls: 'kind-line' },
  { key: 'para', label: 'paragraph', cls: 'kind-para' },
  { key: 'wall', label: 'wall', cls: 'kind-wall' },
  { key: 'list', label: 'list', cls: 'kind-list' },
  { key: 'code', label: 'code', cls: 'kind-code' },
  { key: 'banner', label: 'banner', cls: 'kind-banner' },
  { key: 'tags', label: 'tags', cls: 'kind-tags' },
];

const WORDS =
  ('lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor ' +
    'incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud ' +
    'exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure ' +
    'reprehenderit voluptate velit esse cillum fugiat nulla pariatur excepteur sint ' +
    'occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est ' +
    'laborum virtual scrolling measures every row precisely').split(' ');

function words(index: number, salt: number, n: number): string {
  const out: string[] = [];
  for (let k = 0; k < n; k++) out.push(pick(WORDS, index, salt + k * 13 + 1));
  const s = out.join(' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const TITLES = [
  'Incident report', 'Release note', 'User feedback', 'Spec draft', 'Migration plan',
  'Postmortem', 'Design review', 'Changelog entry', 'Support ticket', 'RFC',
  'Audit finding', 'Bug repro', 'Performance note', 'Onboarding doc',
];
const TAGS = [
  'urgent', 'backend', 'frontend', 'a11y', 'perf', 'flaky', 'regression', 'docs',
  'security', 'ux', 'infra', 'mobile', 'i18n', 'analytics', 'wontfix', 'good-first-issue',
  'needs-repro', 'breaking', 'enhancement', 'p0', 'p1', 'p2',
];
const OWNERS = ['ada', 'linus', 'grace', 'alan', 'margaret', 'dennis', 'barbara', 'ken'];

export interface BannerColor { bg: string; bd: string; fg: string; }
const BANNER_COLORS: BannerColor[] = [
  { bg: 'rgba(31,111,235,.12)', bd: 'rgba(31,111,235,.5)', fg: '#6cb6ff' },
  { bg: 'rgba(35,134,54,.12)', bd: 'rgba(63,185,80,.5)', fg: '#56d364' },
  { bg: 'rgba(207,34,46,.12)', bd: 'rgba(248,81,73,.5)', fg: '#ff7b72' },
  { bg: 'rgba(163,113,247,.12)', bd: 'rgba(163,113,247,.5)', fg: '#d2a8ff' },
  { bg: 'rgba(219,109,40,.12)', bd: 'rgba(240,136,62,.5)', fg: '#f0883e' },
];

export interface HeightsRow {
  index: number;
  id: string;
  kind: HeightsKind;
  kindLabel: string;
  kindCls: string;
  owner: string;
  version: string;
  title: string;
  paragraphs: string[]; // line / para / wall
  listItems: string[];  // list
  codeLines: string[];  // code (plain text lines)
  bannerPx: number;     // banner
  bannerText: string;
  bannerColor: BannerColor;
  tags: string[];       // tags
}

/** Build a row purely from its index — the wild, repeatable height per row. */
export function makeHeightsRow(index: number): HeightsRow {
  const kind = KINDS[Math.floor(rand(index, 1) * KINDS.length)];
  const title = `${pick(TITLES, index, 2)} #${index.toLocaleString()}`;
  const row: HeightsRow = {
    index,
    id: `#${index.toLocaleString()}`,
    kind: kind.key,
    kindLabel: kind.label,
    kindCls: kind.cls,
    owner: pick(OWNERS, index, 3),
    version: `${randInt(index, 1, 9, 4)}.${randInt(index, 0, 20, 5)}`,
    title,
    paragraphs: [],
    listItems: [],
    codeLines: [],
    bannerPx: 0,
    bannerText: '',
    bannerColor: BANNER_COLORS[0],
    tags: [],
  };

  switch (kind.key) {
    case 'line':
      row.paragraphs = [words(index, 5, randInt(index, 4, 9, 6)) + '.'];
      break;
    case 'para': {
      const n = randInt(index, 1, 3, 7);
      for (let p = 0; p < n; p++) row.paragraphs.push(words(index, 20 + p * 7, randInt(index, 18, 46, 21 + p)) + '.');
      break;
    }
    case 'wall': {
      const n = randInt(index, 3, 7, 8); // the tall one
      for (let p = 0; p < n; p++) row.paragraphs.push(words(index, 40 + p * 11, randInt(index, 40, 90, 41 + p)) + '.');
      break;
    }
    case 'list': {
      const n = randInt(index, 3, 16, 9);
      for (let k = 0; k < n; k++) row.listItems.push(words(index, 60 + k * 5, randInt(index, 3, 12, 61 + k)));
      break;
    }
    case 'code': {
      const n = randInt(index, 3, 18, 10);
      row.codeLines.push(`// ${pick(TITLES, index, 11).toLowerCase()}`);
      for (let k = 0; k < n; k++) {
        row.codeLines.push(
          `const ${pick(WORDS, index, 70 + k)}${k} = compute("${pick(WORDS, index, 80 + k)}", ${randInt(index, 1, 999, 90 + k)});`,
        );
      }
      break;
    }
    case 'banner': {
      row.bannerPx = randInt(index, 60, 320, 12);
      row.bannerColor = pick(BANNER_COLORS, index, 13);
      row.bannerText = `${words(index, 14, randInt(index, 2, 6, 15))} · ${row.bannerPx}px`;
      break;
    }
    case 'tags': {
      const n = randInt(index, 4, 24, 16);
      for (let k = 0; k < n; k++) row.tags.push(pick(TAGS, index, 100 + k));
      break;
    }
  }
  return row;
}
