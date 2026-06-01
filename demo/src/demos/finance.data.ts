/**
 * Deterministic stock-ticker data + a live price model.
 * Shared across React, Vue, and Angular demos.
 */
import { pick, rand } from '../lib/random';

export const FIN_TOTAL = 5_000;

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const SECTORS = ['Tech', 'Energy', 'Health', 'Finance', 'Retail', 'Auto', 'Media', 'Industrial'];
const SUFFIX = ['Inc', 'Corp', 'Labs', 'Group', 'Holdings', 'Systems', 'Partners'];
const ROOTS = ['Apex', 'Nova', 'Quantum', 'Vertex', 'Helio', 'Cobalt', 'Orbit', 'Pulse', 'Atlas', 'Lumen', 'Forge', 'Drift'];

export interface Stock {
  index: number;
  symbol: string;
  name: string;
  sector: string;
  base: number;
}

export function makeStock(index: number): Stock {
  const a = LETTERS[(index * 7) % 26];
  const b = LETTERS[(index * 13) % 26];
  const c = LETTERS[(index * 17) % 26];
  const symbol = `${a}${b}${c}${index % 9}`;
  return {
    index,
    symbol,
    name: `${pick(ROOTS, index, 1)} ${pick(SUFFIX, index, 2)}`,
    sector: pick(SECTORS, index, 3),
    base: Math.round((rand(index, 4) * 480 + 12) * 100) / 100,
  };
}

/** A fixed 24-point sparkline (0..1 values) derived from the index. */
export function sparkSeries(index: number): number[] {
  const out: number[] = [];
  for (let k = 0; k < 24; k++) out.push(rand(index, 100 + k));
  return out;
}

/** Build an SVG polyline `points` string for a 0..1 series in a w×h box. */
export function sparkPoints(series: number[], w: number, h: number): string {
  const step = w / (series.length - 1);
  return series.map((v, i) => `${(i * step).toFixed(1)},${(h - v * h).toFixed(1)}`).join(' ');
}

/** Create the initial live price vector (prices start at base). */
export function initialPrices(): number[] {
  const out = new Array<number>(FIN_TOTAL);
  for (let i = 0; i < FIN_TOTAL; i++) out[i] = makeStock(i).base;
  return out;
}

/** Nudge every price by a small random walk; returns a fresh array. */
export function tickPrices(prices: number[]): number[] {
  const next = prices.slice();
  for (let i = 0; i < next.length; i++) {
    const drift = (Math.random() - 0.5) * 0.02;
    next[i] = Math.max(1, Math.round(next[i] * (1 + drift) * 100) / 100);
  }
  return next;
}
