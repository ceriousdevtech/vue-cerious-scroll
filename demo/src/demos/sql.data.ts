/**
 * Deterministic SQL result-set data. Shared across React, Vue, and Angular demos.
 */
import { pick, rand, randInt } from '../lib/random';

export const SQL_TOTAL = 200_000;

const CUSTOMERS = ['Acme Co', 'Globex', 'Initech', 'Umbrella', 'Stark Ind', 'Wayne Ent', 'Soylent', 'Hooli', 'Pied Piper', 'Wonka'];
const PRODUCTS = ['Enterprise Plan', 'Pro Seat', 'API Credits', 'Storage 1TB', 'Support Pack', 'Add-on: SSO', 'Training', 'Migration'];
const STATUSES = ['paid', 'pending', 'refunded', 'failed'] as const;

export type SqlStatus = (typeof STATUSES)[number];

export interface SqlRow {
  index: number;
  id: number;
  customer: string;
  product: string;
  amount: number;
  status: SqlStatus;
  date: string;
}

export const SQL_COLUMNS = ['id', 'customer', 'product', 'amount', 'status', 'date'] as const;
export const SQL_TEMPLATE = '90px 1fr 1fr 130px 110px 130px';

export const SQL_QUERY = `SELECT id, customer, product, amount, status, created_at
FROM   orders
WHERE  amount > 0
ORDER  BY created_at DESC;`;

export function makeResult(index: number): SqlRow {
  const id = 100000 + index;
  const amount = Math.round((rand(index, 1) * 4800 + 19) * 100) / 100;
  const daysAgo = randInt(index, 0, 720, 2);
  const date = new Date(Date.UTC(2026, 0, 1) - daysAgo * 86_400_000).toISOString().slice(0, 10);
  return {
    index,
    id,
    customer: pick(CUSTOMERS, index, 3),
    product: pick(PRODUCTS, index, 4),
    amount,
    status: STATUSES[index % STATUSES.length],
    date,
  };
}

export function sqlStatusClass(status: SqlStatus): string {
  return `sql-${status}`;
}
