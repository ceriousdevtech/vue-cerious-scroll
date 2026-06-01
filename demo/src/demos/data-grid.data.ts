/**
 * Deterministic data + sort/filter helpers for the Data Grid demo.
 * Shared verbatim across the React, Vue, and Angular demos.
 */
import { pick, rand, randInt } from '../lib/random';

export const GRID_TOTAL = 100_000;

const FIRST = [
  'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda',
  'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica',
];
const LAST = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Wilson', 'Anderson', 'Thomas', 'Taylor',
];
const DEPARTMENTS = ['Engineering', 'Sales', 'Marketing', 'Support', 'Finance', 'HR', 'Operations', 'Product'];
const STATUSES = ['Active', 'Pending', 'Inactive'] as const;
const REGIONS = ['North America', 'Europe', 'Asia Pacific', 'Latin America', 'Middle East', 'Africa'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export type GridStatus = (typeof STATUSES)[number];

export interface GridRow {
  index: number;
  id: string;
  name: string;
  email: string;
  department: string;
  status: GridStatus;
  region: string;
  revenue: number;
  score: number;
  date: string;
  rawDate: number;
}

export function makeRow(index: number): GridRow {
  const first = pick(FIRST, index, 1);
  const last = pick(LAST, index, 2);
  const name = `${first} ${last}`;
  const email = `${first.toLowerCase()}.${last.toLowerCase()}${Math.floor(index / 100)}@company.com`;
  const revenue = Math.round((rand(index, 3) * 120000 - 20000) * 100) / 100;
  const score = Math.round(rand(index, 4) * 1000) / 10;
  const daysAgo = randInt(index, 0, 365, 5);
  const rawDate = Date.UTC(2025, 11, 31) - daysAgo * 86_400_000;
  const d = new Date(rawDate);
  // Manual format (Intl.toLocaleDateString is ~100× slower and this runs in hot
  // filter/sort loops over the whole dataset).
  const date = `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
  return {
    index,
    id: `ID-${String(index).padStart(7, '0')}`,
    name,
    email,
    department: pick(DEPARTMENTS, index, 6),
    status: STATUSES[index % 3],
    region: pick(REGIONS, index, 7),
    revenue,
    score,
    date,
    rawDate,
  };
}

export type GridColumn =
  | 'index' | 'id' | 'name' | 'email' | 'department' | 'status' | 'region' | 'revenue' | 'score' | 'date';

export type SortDir = 'asc' | 'desc';

export const GRID_COLUMNS: Array<{ key: GridColumn; label: string; sortable: boolean }> = [
  { key: 'index', label: '#', sortable: false },
  { key: 'id', label: 'ID', sortable: true },
  { key: 'name', label: 'Name', sortable: true },
  { key: 'email', label: 'Email', sortable: true },
  { key: 'department', label: 'Department', sortable: true },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'region', label: 'Region', sortable: true },
  { key: 'revenue', label: 'Revenue', sortable: true },
  { key: 'score', label: 'Score', sortable: true },
  { key: 'date', label: 'Date', sortable: true },
];

export const GRID_TEMPLATE_COLUMNS =
  '60px 130px 160px 230px 130px 110px 150px 130px 90px 120px';

function matches(row: GridRow, query: string): boolean {
  return (
    row.id.toLowerCase().includes(query) ||
    row.name.toLowerCase().includes(query) ||
    row.email.toLowerCase().includes(query) ||
    row.department.toLowerCase().includes(query)
  );
}

function sortValue(row: GridRow, col: GridColumn): number | string {
  if (col === 'revenue' || col === 'score') return row[col];
  if (col === 'date') return row.rawDate;
  if (col === 'index') return row.index;
  return row[col];
}

/**
 * Build the visible display order: filter by `query`, then optionally sort by a
 * column. Returns an array of *source* row indices.
 */
export function buildOrder(
  query: string,
  sortCol: GridColumn | null,
  sortDir: SortDir,
): number[] {
  const q = query.trim().toLowerCase();
  const order: number[] = [];
  for (let i = 0; i < GRID_TOTAL; i++) {
    if (!q || matches(makeRow(i), q)) order.push(i);
  }
  if (sortCol) {
    // Precompute each row's sort key ONCE (one makeRow per row) rather than
    // re-deriving rows inside the comparator (which would be O(n log n) makeRow
    // calls — enough to freeze the tab on 100k rows).
    const keyed = order.map((i) => ({ i, k: sortValue(makeRow(i), sortCol) }));
    keyed.sort((a, b) => {
      const cmp = a.k < b.k ? -1 : a.k > b.k ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return keyed.map((e) => e.i);
  }
  return order;
}

export function statusClass(status: GridStatus): string {
  return status === 'Active'
    ? 'status-active'
    : status === 'Pending'
      ? 'status-pending'
      : 'status-inactive';
}
