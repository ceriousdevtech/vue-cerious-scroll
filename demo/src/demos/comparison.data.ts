/** See react demo's comparison.data.ts — same shape and behavior. */

import { rand } from '../lib/random';

export type Scenario =
  | 'dynamic-height'
  | 'expanding'
  | 'async-images'
  | 'millions'
  | 'continuous-updates'
  | 'spreadsheet';

export interface CmpRow {
  id: number;
  title: string;
  text: string;
  baseHeight: number;
  scale: number;
  expanded: boolean;
  hasImage: boolean;
  imageLoaded: boolean;
  hot: number;
  isSheet?: boolean;
  cells?: string[];
}

const TITLES = [
  'Quarterly report', 'Server uptime', 'Pull request merged', 'Build #4218',
  'Deploy succeeded', 'Latency spike', 'New comment', 'Cache invalidated',
  'Auth event', 'Memory pressure', 'Queue drained', 'User signed up',
];
const TEXT_FRAGS = [
  'lorem ipsum dolor sit amet consectetur adipiscing elit',
  'sed do eiusmod tempor incididunt ut labore et dolore magna',
  'duis aute irure dolor in reprehenderit in voluptate velit esse',
  'excepteur sint occaecat cupidatat non proident sunt in culpa',
];

export function baseHeightFor(i: number): number {
  return [56, 72, 96, 64, 120][i % 5];
}

const DYNAMIC_SCALES = [3, 5, 8, 10, 12, 15, 18, 6];

export function imageRowHeight(loaded: boolean): number {
  return loaded ? 160 : 0;
}

export function makeRowDatasource(total: number, scenario?: Scenario) {
  const overrides = new Map<number, Partial<CmpRow>>();
  const subscribers = new Set<() => void>();
  const imageRequested = new Set<number>();
  let notifyScheduled = false;
  const notify = (): void => {
    if (notifyScheduled) return;
    notifyScheduled = true;
    queueMicrotask(() => {
      notifyScheduled = false;
      subscribers.forEach((cb) => cb());
    });
  };

  if (scenario === 'dynamic-height') {
    for (let i = 7; i < total; i += 22) {
      const scale = DYNAMIC_SCALES[((i / 22) | 0) % DYNAMIC_SCALES.length];
      overrides.set(i, { scale });
    }
  }

  const getRow = (i: number): CmpRow => {
    const baseHeight = baseHeightFor(i);
    const hasImage = scenario === 'async-images';
    if (scenario === 'spreadsheet') {
      const cells: string[] = new Array(60);
      for (let c = 0; c < 60; c++) {
        const v = (i * 13 + c * 7) % 1000;
        cells[c] = c === 0 ? `R${i}` : `${v}.${(v * 3) % 100}`;
      }
      const base: CmpRow = {
        id: i,
        title: '',
        text: '',
        baseHeight: 36,
        scale: 1,
        expanded: false,
        hasImage: false,
        imageLoaded: false,
        hot: 0,
        isSheet: true,
        cells,
      };
      const ov = overrides.get(i);
      return ov ? { ...base, ...ov } : base;
    }
    const base: CmpRow = {
      id: i,
      title: TITLES[i % TITLES.length],
      text: TEXT_FRAGS[i % TEXT_FRAGS.length] + ' #' + i,
      baseHeight,
      scale: 1,
      expanded: false,
      hasImage,
      imageLoaded: false,
      hot: 0,
    };
    const ov = overrides.get(i);
    const row = ov ? { ...base, ...ov } : base;

    if (hasImage && !row.imageLoaded && !imageRequested.has(i)) {
      imageRequested.add(i);
      const delay = 200 + (i % 9) * 90;
      setTimeout(() => {
        const prev = overrides.get(i) ?? {};
        overrides.set(i, { ...prev, imageLoaded: true });
        notify();
      }, delay);
    }
    return row;
  };

  const setOverride = (i: number, patch: Partial<CmpRow>): void => {
    overrides.set(i, { ...(overrides.get(i) ?? {}), ...patch });
  };

  const rowHeight = (i: number): number => {
    const r = getRow(i);
    if (r.isSheet) return r.expanded ? 36 + 240 : 36;
    const base = Math.round(r.baseHeight * r.scale);
    if (r.expanded) return base + 200;
    return r.hasImage ? base + imageRowHeight(r.imageLoaded) : base;
  };

  const subscribe = (cb: () => void): (() => void) => {
    subscribers.add(cb);
    return () => {
      subscribers.delete(cb);
    };
  };

  return { total, getRow, setOverride, rowHeight, subscribe };
}

export type RowDatasource = ReturnType<typeof makeRowDatasource>;

export const SCENARIOS: { id: Scenario; label: string; desc: string }[] = [
  {
    id: 'dynamic-height',
    label: '1. Dynamic height',
    desc: 'Mixed row heights including rows that are 500–1800px tall (larger than the viewport). TanStack caches its initial estimateSize and the scrollbar drifts as you scroll past the giants — Cerious sees the change live.',
  },
  {
    id: 'expanding',
    label: '2. Expanding rows',
    desc: 'Click any row to expand/collapse. TanStack uses cached estimateSize unless every row registers with measureElement; Cerious reflows automatically.',
  },
  {
    id: 'async-images',
    label: '3. Async images',
    desc: 'Every row carries an image that loads asynchronously, growing the row by 160px when it lands. Cached estimateSize lags every load; Cerious tracks each one live.',
  },
  {
    id: 'millions',
    label: '4. Millions of rows',
    desc: '5,000,000 rows. TanStack must paint a spacer of getTotalSize() px, but browsers cap any element\'s scrollHeight at ~33.5M px — so the list silently clamps near row 411,000. Cerious\'s sibling-driver scrollbar reaches all 5M.',
  },
  {
    id: 'continuous-updates',
    label: '5. Continuous updates',
    desc: 'Mutate 50 random rows per tick. Watch the scrollbar drift on the left as cached estimates lag the truth.',
  },
  {
    id: 'spreadsheet',
    label: '6. Spreadsheet 🔥',
    desc: '50,000 rows × 60 cells with native horizontal scroll inside each row. Click any row to expand a 240px detail panel. TanStack\'s estimateSize cache never learns the new height — you must register every row with measureElement (extra wiring) and still call .measure() after the toggle. Cerious reflows on its own.',
  },
];

export function pickIndices(total: number, n: number, seed: number): number[] {
  const out: number[] = [];
  for (let k = 0; k < n; k++) out.push(Math.floor(rand(seed + k, 0) * total));
  return out;
}
