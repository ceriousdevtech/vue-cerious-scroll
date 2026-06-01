/**
 * Tiny deterministic PRNG helpers so demo data is stable across renders/reloads
 * (the engine re-derives rows by index, so generators must be pure functions of
 * the index — never `Math.random()` at render time).
 */

/** Mulberry32 PRNG seeded from a 32-bit integer. Returns a [0,1) generator. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable pseudo-random number in [0,1) derived purely from `index` (+ salt). */
export function rand(index: number, salt = 0): number {
  return mulberry32((index + 1) * 2654435761 + salt * 40503)();
}

/** Stable pick from an array, keyed by `index`. */
export function pick<T>(arr: readonly T[], index: number, salt = 0): T {
  return arr[Math.floor(rand(index, salt) * arr.length)];
}

/** Stable integer in [min, max], keyed by `index`. */
export function randInt(index: number, min: number, max: number, salt = 0): number {
  return min + Math.floor(rand(index, salt) * (max - min + 1));
}
