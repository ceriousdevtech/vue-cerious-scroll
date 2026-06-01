/**
 * Deterministic system-log data. Shared across React, Vue, and Angular demos.
 */
import { pick, randInt } from '../lib/random';

export const LOG_TOTAL = 200_000;

export type LogLevel = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
export const LOG_LEVELS: LogLevel[] = ['ERROR', 'WARN', 'INFO', 'DEBUG'];

export interface LogEntry {
  index: number;
  level: LogLevel;
  time: string;
  service: string;
  message: string;
}

const SERVICES = ['api-gateway', 'auth-svc', 'db-pool', 'cache', 'worker', 'scheduler', 'payments', 'mailer'];

const TEMPLATES: Array<{ level: LogLevel; t: string }> = [
  { level: 'INFO', t: 'User authentication successful for user_{id}' },
  { level: 'INFO', t: 'Database connection established to postgres://prod-db-{id}' },
  { level: 'INFO', t: 'HTTP GET /api/users/{id} responded with 200' },
  { level: 'WARN', t: 'High memory usage detected: {value}% of available RAM' },
  { level: 'WARN', t: 'Slow query detected: SELECT * FROM users took {value}ms' },
  { level: 'ERROR', t: 'Failed to connect to Redis cache: connection timeout' },
  { level: 'ERROR', t: 'Unhandled exception in UserService: NullPointerException at line {id}' },
  { level: 'ERROR', t: 'Transaction rolled back: constraint violation on user_email' },
  { level: 'DEBUG', t: 'Processing batch #{id} with {value} items' },
  { level: 'DEBUG', t: 'Cache hit for key "user_profile_{id}"' },
  { level: 'INFO', t: 'Scheduled task "DataSync" started' },
  { level: 'WARN', t: 'Rate limit approaching for API key {id}' },
  { level: 'ERROR', t: 'Payment failed: insufficient funds for txn {id}' },
  { level: 'INFO', t: 'Email sent successfully to user@example-{id}.com' },
  { level: 'DEBUG', t: 'WebSocket connection {id} heartbeat received' },
];

export function makeLog(index: number): LogEntry {
  const tpl = TEMPLATES[index % TEMPLATES.length];
  const message = tpl.t
    .replace('{id}', String(index))
    .replace('{value}', String(randInt(index, 10, 99, 3)));
  const ts = new Date(Date.UTC(2026, 0, 1) - (LOG_TOTAL - index) * 1000);
  const time =
    ts.toISOString().slice(11, 19) + '.' + String(randInt(index, 0, 999, 4)).padStart(3, '0');
  return { index, level: tpl.level, time, service: pick(SERVICES, index, 5), message };
}

export function buildLogOrder(active: ReadonlySet<LogLevel>, query: string): number[] {
  const q = query.trim().toLowerCase();
  const out: number[] = [];
  for (let i = 0; i < LOG_TOTAL; i++) {
    const log = makeLog(i);
    if (!active.has(log.level)) continue;
    if (q && !log.message.toLowerCase().includes(q) && !log.service.includes(q)) continue;
    out.push(i);
  }
  return out;
}
