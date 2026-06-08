/**
 * Deterministic data + column model for the Native Table demo.
 * Shared verbatim across the React, Vue, and Angular demos.
 */
import { pick, randInt } from '../lib/random';

export const TABLE_TOTAL = 100_000;

const FIRST = [
  'Ada', 'Linus', 'Grace', 'Alan', 'Margaret', 'Dennis', 'Barbara', 'Ken', 'Radia', 'Tim',
];
const LAST = [
  'Lovelace', 'Torvalds', 'Hopper', 'Turing', 'Hamilton', 'Ritchie', 'Liskov', 'Thompson', 'Perlman', 'Berners-Lee',
];
const STATUSES = ['active', 'idle', 'offline'] as const;

export type TableStatus = (typeof STATUSES)[number];

export interface TableColumn {
  key: string;
  label: string;
  /** CSS width, or '' to let `table-layout: fixed` distribute the remainder. */
  width: string;
  cls: string;
}

/** Shared column model — drives the external <thead>, the body <colgroup>, and cells. */
export const TABLE_COLUMNS: readonly TableColumn[] = [
  { key: 'id', label: 'ID', width: '110px', cls: '' },
  { key: 'name', label: 'NAME', width: '', cls: '' },
  { key: 'status', label: 'STATUS', width: '110px', cls: '' },
  { key: 'email', label: 'EMAIL', width: '', cls: '' },
  { key: 'score', label: 'SCORE', width: '100px', cls: 'num' },
];

/** Column widths only, for `options.table.columnWidths`. */
export const TABLE_COLUMN_WIDTHS: readonly string[] = TABLE_COLUMNS.map((c) => c.width);

export interface TableRow {
  index: number;
  id: string;
  name: string;
  status: TableStatus;
  email: string;
  score: number;
}

export function makeRow(index: number): TableRow {
  const first = pick(FIRST, index, 1);
  const last = pick(LAST, index, 2);
  return {
    index,
    id: `#${index.toLocaleString()}`,
    name: `${first} ${last}`,
    status: pick(STATUSES, index, 3),
    email: `${first}.${last}`.toLowerCase() + '@example.com',
    score: randInt(index, 0, 9999, 4),
  };
}

export function statusLabel(s: TableStatus): string {
  return s === 'active' ? 'Active' : s === 'idle' ? 'Idle' : 'Offline';
}
