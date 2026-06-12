/**
 * Deterministic data for the "Native Table · prepend & scroll anchoring" demo.
 *
 * A live telemetry feed / chat-history backfill: new, variable-height rows are
 * injected at the TOP of the stream. Content is addressed by a stable monotonic
 * `seq` (NOT by row index), so a row's content/height never changes when its
 * index shifts on prepend. The demo component maps index -> seq = topSeq - index
 * (index 0 = newest = topSeq).
 *
 * Pure TS / framework-agnostic — shared by the React, Vue and Angular demos.
 */
import { rand, randInt, pick } from '../lib/random';

export const STREAM_TOTAL = 2_000;

export interface StreamColumn { key: string; label: string; width: string; cls: string; }
export const STREAM_COLUMNS: readonly StreamColumn[] = [
  { key: 'time', label: 'TIME', width: '104px', cls: 'col-time' },
  { key: 'level', label: 'LEVEL', width: '92px', cls: 'col-level' },
  { key: 'event', label: 'EVENT', width: '', cls: 'col-event' },
  { key: 'seq', label: 'SEQ', width: '104px', cls: 'col-seq' },
];
export const STREAM_COLUMN_WIDTHS: readonly string[] = STREAM_COLUMNS.map((c) => c.width);

export type EventKind = 'metric' | 'event' | 'list' | 'trace' | 'json';
export type Level = 'info' | 'warn' | 'error' | 'debug';

const KINDS: EventKind[] = ['metric', 'event', 'list', 'trace', 'json'];
const LEVELS: Level[] = ['info', 'info', 'debug', 'warn', 'error'];
const SERVICES = [
  'api-gateway', 'auth-svc', 'billing', 'ingest', 'scheduler', 'edge-cache',
  'search', 'notifier', 'media-tx', 'graph-db',
];
const WORDS =
  ('connection retry timeout handshake payload buffer flush queue worker thread heartbeat ' +
    'latency throughput cache miss evict gc pause socket reset backoff jitter replica leader ' +
    'election quorum commit offset partition consumer lag rebalance').split(' ');

function words(seq: number, salt: number, n: number): string {
  const out: string[] = [];
  for (let k = 0; k < n; k++) out.push(pick(WORDS, seq, salt + k * 7 + 1));
  const s = out.join(' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Manual HH:MM:SS (no toLocaleTimeString in the hot path). seq = seconds since
// a fixed epoch, so the newest seq reads as the most recent clock time.
const EPOCH = 9 * 3600 + 30 * 60; // 09:30:00 at seq 0
const p2 = (n: number) => (n < 10 ? '0' + n : '' + n);
export function clockFor(seq: number): string {
  const t = EPOCH + seq;
  return `${p2(Math.floor(t / 3600) % 24)}:${p2(Math.floor(t / 60) % 60)}:${p2(t % 60)}`;
}

export interface StreamEvent {
  seq: number;
  kind: EventKind;
  level: Level;
  clock: string;
  service: string;
  title: string;
  text: string;        // event
  metricLine: string;  // metric
  listItems: string[]; // list
  traceLines: string[];// trace
  jsonLines: string[]; // json
}

/** Build an event purely from its stable seq. */
export function makeEvent(seq: number): StreamEvent {
  const kind = KINDS[Math.floor(rand(seq, 1) * KINDS.length)];
  const service = pick(SERVICES, seq, 2);
  const level: Level = kind === 'trace' ? 'error' : pick(LEVELS, seq, 14);
  const ev: StreamEvent = {
    seq, kind, level, clock: clockFor(seq), service,
    title: '', text: '', metricLine: '', listItems: [], traceLines: [], jsonLines: [],
  };

  switch (kind) {
    case 'metric':
      ev.metricLine = `cpu ${randInt(seq, 1, 99, 3)}% · mem ${(randInt(seq, 1, 64, 4) / 8).toFixed(1)}GB · p99 ${randInt(seq, 2, 800, 5)}ms`;
      break;
    case 'event':
      ev.title = service;
      ev.text = words(seq, 6, randInt(seq, 6, 22, 7)) + '.';
      break;
    case 'list': {
      const n = randInt(seq, 3, 12, 8);
      ev.title = `${service} · batch (${n})`;
      for (let k = 0; k < n; k++) ev.listItems.push(words(seq, 20 + k, randInt(seq, 3, 9, 30 + k)));
      break;
    }
    case 'trace': {
      const n = randInt(seq, 3, 14, 9);
      ev.title = `${service} crashed`;
      ev.traceLines.push(`${pick(['TimeoutError', 'ECONNRESET', 'NullPointer', 'AssertionError'], seq, 10)}: ${words(seq, 11, randInt(seq, 3, 8, 12))}`);
      for (let k = 0; k < n; k++) ev.traceLines.push(`  at ${service}.${pick(WORDS, seq, 40 + k)} (${service}:${randInt(seq, 10, 990, 50 + k)})`);
      break;
    }
    case 'json': {
      const n = randInt(seq, 3, 10, 13);
      ev.title = `${service} · payload`;
      ev.jsonLines.push('{');
      for (let k = 0; k < n; k++) ev.jsonLines.push(`  "${pick(WORDS, seq, 60 + k)}": "${pick(WORDS, seq, 70 + k)}"${k < n - 1 ? ',' : ''}`);
      ev.jsonLines.push('}');
      break;
    }
  }
  return ev;
}

export function levelLabel(l: Level): string { return l; }
