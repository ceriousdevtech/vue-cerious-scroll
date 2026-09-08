/**
 * Row templates for the benchmark, written as Vue render functions.
 *
 * This matters: the vanilla build of this benchmark constructs rows with
 * `document.createElement`, which measures the engine alone. Here every row is
 * a VNode rendered by Vue through the wrapper, so the reported per-frame cost
 * includes Vue's own render work. That is the number a Vue user actually pays.
 *
 * Every template builds from local DOM only — no network images, no remote
 * fonts — so a run stays deterministic and works offline.
 */
import { Fragment, h, render, type VNode } from 'vue';

import { hash, nf } from './benchmark.harness';

const PALETTE = ['#78f3d2', '#8cb7ff', '#c9a2ff', '#f2c66d', '#ff9f9f', '#8ee6a0'];

const TITLES = [
  'Deploy succeeded',
  'Latency spike detected',
  'Cache invalidated',
  'Pull request merged',
  'Queue drained',
  'Auth token refreshed',
  'Index rebuilt',
  'Snapshot uploaded',
];
const SYMBOLS = ['ACME', 'GLBX', 'NRTH', 'VECT', 'QNTM', 'HELX', 'ORBT', 'PLSR'];
const REGIONS = ['us-east-1', 'eu-west-2', 'ap-south-1', 'sa-east-1'];
const OWNERS = ['A. Okafor', 'M. Duarte', 'S. Kaur', 'J. Lindqvist', 'R. Osei'];

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

/* ------------------------------------------------- fixed-height templates */

function simpleRow(index: number, height: number): VNode {
  const color = PALETTE[index % PALETTE.length];
  return h('div', { class: 'bx-row', style: { height: `${height}px` } }, [
    h('span', { class: 'bx-row__i' }, `#${nf.format(index)}`),
    h('span', {
      class: 'bx-row__bar',
      style: { background: color, width: `${25 + (index % 65)}%` },
    }),
    h('span', { class: 'bx-row__h' }, `${height}px`),
  ]);
}

/* ------------------------------------------------------ measured templates */

function richCard(index: number): VNode {
  const color = PALETTE[index % PALETTE.length];
  const lines = 1 + Math.floor(hash(index, 11) * 4);
  const tagCount = 1 + Math.floor(hash(index, 31) * 3);
  return h('div', { class: 'bx-card' }, [
    h('div', { class: 'bx-card__av', style: { background: color } }, TITLES[index % TITLES.length][0]),
    h('div', { class: 'bx-card__body' }, [
      h('div', { class: 'bx-card__title' }, `${TITLES[index % TITLES.length]} · #${nf.format(index)}`),
      ...range(lines).map((i) =>
        h('div', {
          key: i,
          class: 'bx-card__line',
          style: { width: `${52 + Math.floor(hash(index, 20 + i) * 46)}%` },
        }),
      ),
      h(
        'div',
        { class: 'bx-card__tags' },
        range(tagCount).map((i) =>
          h('span', { key: i, class: 'bx-card__tag' }, ['prod', 'edge', 'db', 'api', 'worker', 'cdn'][(index + i) % 6]),
        ),
      ),
    ]),
  ]);
}

function gridRow(index: number): VNode {
  const state =
    index % 7 === 0 ? ['warn', 'review'] : index % 3 === 0 ? ['off', 'idle'] : ['ok', 'active'];
  const delta = (hash(index, 51) - 0.5) * 12;
  return h('div', { class: 'bx-grid' }, [
    h('span', { class: 'bx-grid__c bx-grid__c--id' }, `#${nf.format(index)}`),
    h('span', { class: 'bx-grid__c bx-grid__c--sym' }, SYMBOLS[index % SYMBOLS.length]),
    ...range(6).map((c) =>
      h('span', { key: c, class: 'bx-grid__c' }, (10 + hash(index, 40 + c) * 9990).toFixed(2)),
    ),
    h('span', { class: `bx-badge bx-badge--${state[0]}` }, state[1]),
    h(
      'span',
      { class: `bx-grid__c bx-delta bx-delta--${delta >= 0 ? 'up' : 'down'}` },
      `${delta >= 0 ? '▲ ' : '▼ '}${Math.abs(delta).toFixed(2)}%`,
    ),
    h(
      'div',
      { class: 'bx-spark' },
      range(12).map((b) => h('i', { key: b, style: { height: `${18 + hash(index, 60 + b) * 82}%` } })),
    ),
  ]);
}

function mediaCard(index: number): VNode {
  const c1 = PALETTE[index % PALETTE.length];
  const c2 = PALETTE[(index + 3) % PALETTE.length];
  const secs = 30 + Math.floor(hash(index, 6) * 5400);
  const score = 1 + Math.floor(hash(index, 16) * 5);
  return h('div', { class: 'bx-media' }, [
    h(
      'div',
      {
        class: 'bx-media__thumb',
        style: { background: `linear-gradient(${Math.floor(hash(index, 5) * 360)}deg, ${c1}, ${c2})` },
      },
      [
        h('div', { class: 'bx-media__play' }, '▶'),
        h('div', { class: 'bx-media__dur' }, `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`),
      ],
    ),
    h('div', { class: 'bx-media__body' }, [
      h('div', { class: 'bx-media__title' }, `${TITLES[index % TITLES.length]} · segment ${nf.format(index)}`),
      h(
        'div',
        { class: 'bx-media__meta' },
        `${REGIONS[index % REGIONS.length]} · ${nf.format(120 + Math.floor(hash(index, 8) * 900000))} views · ${1 + Math.floor(hash(index, 9) * 30)}d ago`,
      ),
      h('div', { class: 'bx-media__meta' }, [
        h('span', `Captured by ${OWNERS[index % OWNERS.length]}. `),
        h('span', `Retention ${1 + Math.floor(hash(index, 15) * 12)} months.`),
      ]),
      h('div', { class: 'bx-media__row' }, [
        h(
          'div',
          { class: 'bx-stars' },
          range(5).map((s) => h('span', { key: s, class: s < score ? 'is-on' : undefined }, '★')),
        ),
        h('span', { class: 'bx-media__meta' }, `${score}.0 · ${nf.format(20 + Math.floor(hash(index, 17) * 4000))} ratings`),
      ]),
      h('div', { class: 'bx-track' }, [h('span', { style: { width: `${10 + hash(index, 18) * 88}%` } })]),
      h('div', { class: 'bx-media__row' }, [
        h(
          'div',
          { class: 'bx-avatars' },
          range(3).map((a) =>
            h('span', { key: a, style: { background: PALETTE[(index + a) % PALETTE.length] } }, OWNERS[(index + a) % OWNERS.length][0]),
          ),
        ),
        h('button', { type: 'button', class: 'bx-btn' }, 'Open'),
        h('button', { type: 'button', class: 'bx-btn' }, 'Share'),
      ]),
    ]),
  ]);
}

function chartRow(index: number): VNode {
  const W = 300;
  const H = 64;
  const N = 28;
  const pts: string[] = [];
  for (let i = 0; i < N; i++) {
    const x = (W * i) / (N - 1);
    const y = 6 + hash(index, 70 + i) * (H - 14);
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  const last = pts[pts.length - 1].split(',');
  return h('div', { class: 'bx-chart' }, [
    h('div', { class: 'bx-chart__head' }, [
      h('b', `${SYMBOLS[index % SYMBOLS.length]} · series ${nf.format(index)}`),
      h('span', `${(hash(index, 12) * 100).toFixed(2)} avg`),
    ]),
    h('svg', { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none' }, [
      ...[1, 2, 3].map((g) =>
        h('line', {
          key: `g${g}`,
          x1: 0, x2: W, y1: (H / 4) * g, y2: (H / 4) * g,
          stroke: 'rgba(255,255,255,.08)', 'stroke-width': 1,
        }),
      ),
      ...range(N).map((i) => {
        const x = (W * i) / (N - 1);
        const bh = hash(index, 90 + i) * 18;
        return h('rect', { key: `r${i}`, x: x - 2, y: H - 4 - bh, width: 4, height: bh, fill: 'rgba(140,183,255,.35)' });
      }),
      h('path', { d: `M0,${H} L${pts.join(' L')} L${W},${H} Z`, fill: 'rgba(120,243,210,.12)' }),
      h('polyline', { points: pts.join(' '), fill: 'none', stroke: '#78f3d2', 'stroke-width': 1.5, 'stroke-linejoin': 'round' }),
      h('circle', { cx: last[0], cy: last[1], r: 2.5, fill: '#78f3d2' }),
    ]),
  ]);
}

function formRow(index: number): VNode {
  return h('div', { class: 'bx-form' }, [
    h('span', { class: 'bx-form__label' }, `row.${nf.format(index)}`),
    h('input', {
      type: 'text',
      'aria-label': 'identifier',
      value: `${SYMBOLS[index % SYMBOLS.length]}-${1000 + (index % 8999)}`,
    }),
    h(
      'select',
      { 'aria-label': 'region' },
      range(6).map((o) =>
        h('option', { key: o, selected: o === index % 6 }, `${REGIONS[o % REGIONS.length]}${o > 3 ? '-b' : ''}`),
      ),
    ),
    ...['sync', 'audit', 'alerts'].map((name, k) =>
      h('label', { key: name, class: 'bx-form__check' }, [
        h('input', { type: 'checkbox', checked: hash(index, 100 + k) > 0.5 }),
        name,
      ]),
    ),
    h('input', { type: 'range', 'aria-label': 'weight', value: Math.floor(hash(index, 13) * 100) }),
    h('button', { type: 'button', class: 'bx-btn' }, 'Apply'),
  ]);
}

const DEEP_LEVELS = 16;
const DEEP_TAGS = [
  'section', 'header', 'div', 'ul', 'li', 'article', 'figure', 'span',
  'p', 'em', 'small', 'label', 'nav', 'aside', 'main', 'footer',
];

/**
 * Sixteen elements nested inside one another. Every other template makes a row
 * expensive by adding siblings; this one adds ancestors, so both Vue's tree
 * walk and the browser's style resolution descend sixteen levels for a single
 * row. The per-level labels are plain text, not elements, so depth is the only
 * variable that moved.
 */
function nestedRow(index: number): VNode {
  let tree: VNode = h(
    'div',
    { class: 'bx-deep__leaf' },
    `${OWNERS[index % OWNERS.length]} · payload at depth ${DEEP_LEVELS}`,
  );
  for (let d = DEEP_LEVELS - 1; d >= 0; d--) {
    tree = h('div', { class: 'bx-deep__lvl' }, [`<${DEEP_TAGS[d]}>`, tree]);
  }
  return h('div', { class: 'bx-deep' }, [
    h('div', { class: 'bx-deep__head' }, [
      h('span', { class: 'bx-deep__chip' }, `${DEEP_LEVELS} levels deep`),
      h('b', `node[${nf.format(index)}]`),
      h('span', { class: 'bx-deep__note' }, 'each line is a real element wrapping the one below it'),
    ]),
    tree,
  ]);
}

function sinkRow(index: number): VNode {
  const color = PALETTE[index % PALETTE.length];
  return h('div', { class: 'bx-sink' }, [
    h('div', { class: 'bx-sink__head' }, [
      h('div', { class: 'bx-sink__icon', style: { background: color } }, [
        h('svg', { viewBox: '0 0 24 24' }, [
          h('path', {
            d: 'M4 18 L9 9 L14 14 L20 5',
            fill: 'none', stroke: '#061019', 'stroke-width': 2.5,
            'stroke-linecap': 'round', 'stroke-linejoin': 'round',
          }),
        ]),
      ]),
      h('div', { class: 'bx-sink__titles' }, [
        h('div', { class: 'bx-sink__title' }, `${TITLES[index % TITLES.length]} · ${nf.format(index)}`),
        h('div', { class: 'bx-sink__sub' }, `${OWNERS[index % OWNERS.length]} · updated ${1 + Math.floor(hash(index, 19) * 59)}m ago`),
      ]),
      h('span', { class: 'bx-badge bx-badge--ok' }, REGIONS[index % REGIONS.length]),
      h('button', { type: 'button', class: 'bx-btn' }, '⋯'),
    ]),
    h(
      'div',
      { class: 'bx-sink__stats' },
      ['p50', 'p95', 'errors', 'rps', 'cpu', 'queue'].map((k, i) =>
        h('div', { key: k, class: 'bx-sink__stat' }, [
          h('i', k),
          h('b', (hash(index, 110 + i) * 400).toFixed(1)),
        ]),
      ),
    ),
    h(
      'div',
      { class: 'bx-spark', style: { height: '26px' } },
      range(20).map((b) =>
        h('i', {
          key: b,
          style: {
            height: `${14 + hash(index, 130 + b) * 86}%`,
            background: b % 4 === 0 ? 'rgba(120,243,210,.6)' : 'rgba(140,183,255,.45)',
          },
        }),
      ),
    ),
    h('div', { class: 'bx-track', style: { marginTop: '10px' } }, [
      h('span', { style: { width: `${12 + hash(index, 14) * 86}%` } }),
    ]),
    h('div', { class: 'bx-sink__foot' }, [
      ...['prod', 'edge', 'db', 'api', 'cache', 'worker'].map((t, i) =>
        h('span', { key: t, class: `bx-badge bx-badge--${i === 0 ? 'ok' : i === 1 ? 'warn' : 'off'}` }, t),
      ),
      h('button', { type: 'button', class: 'bx-btn' }, 'Inspect'),
      h('button', { type: 'button', class: 'bx-btn' }, 'Mute'),
    ]),
  ]);
}

/* ------------------------------------------------------------- registry */

export interface RowTemplate {
  label: string;
  /** Grouping and wording mirror the vanilla benchmark exactly. */
  group: string;
  optionLabel: string;
  note: string;
  render: (index: number) => VNode;
}

export const TEMPLATES: Record<string, RowTemplate> = {
  uniform: {
    label: 'Uniform 44px',
    group: 'Synthetic, fixed heights',
    optionLabel: 'Uniform 44px rows',
    note: 'Control case: one fixed height, so there is nothing to measure and nothing to vary.',
    render: (i) => simpleRow(i, 44),
  },
  mixed: {
    label: 'Mixed 44/64/104px',
    group: 'Synthetic, fixed heights',
    optionLabel: 'Mixed 44 / 64 / 104px',
    note: 'Three repeating heights, so the engine can no longer assume a constant row height.',
    render: (i) => simpleRow(i, [44, 64, 104][i % 3]),
  },
  wild: {
    label: 'Wild 32-420px',
    group: 'Synthetic, fixed heights',
    optionLabel: 'Wild, 32 to 420px',
    note: 'Heights scattered from 32px to 420px with no pattern, forcing a real measurement on every row.',
    render: (i) => simpleRow(i, 32 + Math.floor(hash(i, 7) * 388)),
  },
  rich: {
    label: 'Rich cards',
    group: 'Realistic, height measured from the DOM',
    optionLabel: 'Rich cards (avatar, text, tags)',
    note: 'The everyday card: avatar, title, a few text lines and tags. Height comes from the content.',
    render: richCard,
  },
  grid: {
    label: 'Dense data grid',
    group: 'Realistic, height measured from the DOM',
    optionLabel: 'Dense data grid (12 columns, sparkline)',
    note: 'Twelve columns of tabular numbers plus a badge, a delta and a sparkline. Many siblings per row.',
    render: gridRow,
  },
  media: {
    label: 'Media cards',
    group: 'Realistic, height measured from the DOM',
    optionLabel: 'Media cards (thumbnail, rating, avatars)',
    note: 'Aspect-ratio thumbnail with overlay chrome, star rating, progress, avatar stack and buttons.',
    render: mediaCard,
  },
  chart: {
    label: 'Inline SVG charts',
    group: 'Realistic, height measured from the DOM',
    optionLabel: 'Inline SVG charts (path, bars, gridlines)',
    note: 'A real inline SVG per row: gridlines, 28 bars, a filled area path, a polyline and an end marker.',
    render: chartRow,
  },
  form: {
    label: 'Native form controls',
    group: 'Stress, deliberately expensive DOM',
    optionLabel: 'Native form controls (input, select, range)',
    note: 'Genuine widgets: text input, six-option select, checkboxes, range and button. Expensive to lay out.',
    render: formRow,
  },
  nested: {
    label: 'Deep tree (16 levels)',
    group: 'Stress, deliberately expensive DOM',
    optionLabel: 'Deep tree, 16 levels of nesting',
    note: 'The depth test: 16 elements wrapping one another. Adds ancestors rather than siblings, so Vue and the browser both descend 16 levels for one row.',
    render: nestedRow,
  },
  sink: {
    label: 'Kitchen sink',
    group: 'Stress, deliberately expensive DOM',
    optionLabel: 'Kitchen sink (gradients, shadows, transform)',
    note: 'Everything at once: gradients, drop shadows, a transform, an SVG glyph, a stat grid and six badges.',
    render: sinkRow,
  },
};

export const TEMPLATE_KEYS = Object.keys(TEMPLATES);

/** Ordered optgroups, so the select reads the same as the vanilla page. */
export const TEMPLATE_GROUPS: { label: string; keys: string[] }[] = [
  "Synthetic, fixed heights",
  "Realistic, height measured from the DOM",
  "Stress, deliberately expensive DOM",
].map((label) => ({ label, keys: TEMPLATE_KEYS.filter((k) => TEMPLATES[k].group === label) }));
export const SWEEP_KEYS = ['mixed', 'rich', 'grid', 'media', 'chart', 'form', 'nested', 'sink'];

const footprintCache = new Map<string, number>();

/**
 * Count the elements a template produces for one row. Measured, not asserted:
 * five rows are rendered into a detached container and the elements counted.
 */
export function templateFootprint(key: string): number {
  const cached = footprintCache.get(key);
  if (cached !== undefined) return cached;

  const probe = document.createElement('div');
  let nodes = 0;
  for (let i = 0; i < 5; i++) {
    render(h(Fragment, [TEMPLATES[key].render(i)]), probe);
    nodes += probe.querySelectorAll('*').length;
  }
  render(null, probe);
  const result = Math.round(nodes / 5);
  footprintCache.set(key, result);
  return result;
}
