<script setup lang="ts">
/**
 * Performance benchmark for the Vue wrapper.
 *
 * Unlike the vanilla build, which drives the engine directly, this measures the
 * <CeriousScroll> component: every row is a VNode rendered by Vue, so the
 * numbers include Vue's own render work. The control group is the same rows
 * rendered with a plain v-for and no virtualiser, which is the comparison a Vue
 * developer is actually choosing between.
 */
import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch, type VNode } from 'vue';
import { CeriousScroll } from '@ceriousdevtech/vue-cerious-scroll';

import {
  BASELINE_NOTE,
  collectEnv,
  compactRows,
  downloadFile,
  driveScroll,
  heapMB,
  measureJumps,
  mean,
  ms,
  nextFrame,
  nf,
  percentile,
  reduceCase,
  sleep,
  sortNum,
  stamp,
  toCsv,
  toJson,
  toMarkdown,
  type AbortFlag,
  type BaselineResult,
  type CaseResult,
  type EnvInfo,
  type ScrollSurface,
  type SweepConfig,
} from './benchmark.harness';
import { enhanceSelect } from './benchmark.dropdown';
import { drawBaseline, drawComplexity, drawScaling, drawTimeline } from './benchmark.charts';
import { SWEEP_KEYS, TEMPLATES, TEMPLATE_GROUPS, templateFootprint } from './benchmark.templates';
import { METHOD_HTML } from './benchmark.method';
import './benchmark.css';

const SIZES = [1000, 10000, 100000, 1000000, 10000000];
/** Refuse to build a control group past this many estimated DOM nodes. */
const BASELINE_NODE_CEILING = 2_000_000;
const BACKGROUND_MSG =
  'This tab is in the background. Browsers suspend animation frames for hidden tabs, ' +
  'so nothing can be measured. Bring the page to the front and press Run again.';

type Mode = 'scale' | 'complexity';
type View = 'table' | 'timeline' | 'chart' | 'baseline';

/* ------------------------------------------------------------------ state */

const scroll = ref<InstanceType<typeof CeriousScroll> | null>(null);
const hostRef = ref<HTMLElement | null>(null);
const baselineHostRef = ref<HTMLElement | null>(null);
let renderCalls = 0;

const specTotal = ref(50_000);
const specTemplate = ref('mixed');
const specNonce = ref(0);
const baselineSpec = ref<{ total: number; template: string } | null>(null);

const mode = ref<Mode>('scale');
const view = ref<View>('table');
const template = ref('mixed');
const durationMs = ref(4000);
const velocity = ref(60);
const reps = ref(5);
const sizes = ref<number[]>([1000, 10000, 100000, 1000000]);
const wantBaseline = ref(true);
const cxSize = ref(1_000_000);
const cxDuration = ref(3000);
const cxTemplates = ref<string[]>([...SWEEP_KEYS]);

const env = ref<EnvInfo | null>(null);
const scaleRows = ref<CaseResult[]>([]);
const scaleConfig = ref<SweepConfig | null>(null);
const cxRows = ref<CaseResult[]>([]);
const baselineRows = ref<BaselineResult[]>([]);
const selected = ref(0);
const cxSelected = ref(0);

const running = ref(false);
const status = ref('Idle. Press Run to start.');
const progress = ref(0);
const stageLabel = ref('idle');
const stageLive = ref(false);
const abort = ref<AbortFlag>({ aborted: false });
const hiddenAbort = ref(false);

const timelineCanvas = ref<HTMLCanvasElement | null>(null);
const scalingCanvas = ref<HTMLCanvasElement | null>(null);
const complexityCanvas = ref<HTMLCanvasElement | null>(null);
const baselineCanvas = ref<HTMLCanvasElement | null>(null);

const budget = computed(() => env.value?.frameBudgetMs ?? 16.7);

/**
 * Functional row component: counts invocations, then defers to the template.
 *
 * The props MUST be declared. Without a props option Vue hands a functional
 * component its raw attrs, so a kebab-case `:template-key` never becomes
 * `props.templateKey` and the template lookup returns undefined.
 */
const RowRenderer = Object.assign(
  (props: { index: number; templateKey: string }): VNode => {
    renderCalls++;
    return TEMPLATES[props.templateKey].render(props.index);
  },
  { props: { index: Number, templateKey: String } },
);

/* ---------------------------------------------------------------- surface */

const contentEl = (): HTMLElement | null =>
  hostRef.value?.querySelector<HTMLElement>('[data-cerious-scroll-content]') ?? null;

/** The wrapper component, presented to the harness as a ScrollSurface. */
const wrapperSurface: ScrollSurface = {
  scroll: (delta) => {
    const s = scroll.value?.scroller;
    if (s) s.scroll(delta, hostRef.value?.clientHeight ?? 0);
  },
  // render() runs the engine's viewport pass and commits row content through
  // Vue's synchronous render(), so this call carries the framework cost.
  paint: () => {
    scroll.value?.render();
  },
  percentage: () => {
    try {
      return scroll.value?.scroller?.calculateScrollPercentage() ?? 0;
    } catch {
      return 0;
    }
  },
  jumpTo: (index) => {
    scroll.value?.jumpToElement(index);
    void hostRef.value?.offsetHeight;
  },
  nodes: () => contentEl()?.querySelectorAll('*').length ?? 0,
  rows: () => contentEl()?.children.length ?? 0,
  medianRowHeight: () => {
    const el = contentEl();
    if (!el) return NaN;
    const hs = Array.from(el.children)
      .map((n) => (n as HTMLElement).offsetHeight)
      .filter((h) => h > 0);
    return hs.length ? percentile(sortNum(hs), 50) : NaN;
  },
  renderCalls: () => renderCalls,
  resetRenderCalls: () => {
    renderCalls = 0;
  },
};

/* ------------------------------------------------------------ measurement */

async function measureCase(
  total: number,
  templateKey: string,
  cfg: { durationMs: number; velocity: number; reps: number; jumpSamples: number },
  environment: EnvInfo,
  label: string,
  base: number,
  span: number,
): Promise<CaseResult | null> {
  const flag = abort.value;
  const at = (f: number) => (progress.value = base + span * f);

  stageLabel.value = `${label} · mount ×${cfg.reps}`;
  stageLive.value = true;
  status.value = `${label}: measuring mount…`;
  at(0.05);
  const mountTimes: number[] = [];
  for (let r = 0; r < cfg.reps && !flag.aborted; r++) {
    const t0 = performance.now();
    specTotal.value = total;
    specTemplate.value = templateKey;
    specNonce.value++;
    // Remount is keyed, so wait for the wrapper to paint its first viewport.
    await nextFrame();
    await nextFrame();
    mountTimes.push(performance.now() - t0);
  }
  if (flag.aborted) return null;

  stageLabel.value = `${label} · warm-up`;
  status.value = `${label}: warming up…`;
  at(0.2);
  await driveScroll(wrapperSurface, Math.min(700, cfg.durationMs / 2), cfg.velocity, false, flag);

  const heapBefore = heapMB();
  const rowHeightPx = wrapperSurface.medianRowHeight();

  stageLabel.value = `${label} · sustained scroll @ ${cfg.velocity} px/frame`;
  status.value = `${label}: sustained scroll for ${cfg.durationMs / 1000}s…`;
  at(0.3);
  wrapperSurface.resetRenderCalls?.();
  const res = await driveScroll(wrapperSurface, cfg.durationMs, cfg.velocity, true, flag);
  const calls = wrapperSurface.renderCalls?.() ?? 0;
  if (flag.aborted) return null;

  const domNodes = wrapperSurface.nodes();
  const domRows = wrapperSurface.rows();

  stageLabel.value = `${label} · random access ×${cfg.jumpSamples}`;
  status.value = `${label}: random-access seeks…`;
  at(0.75);
  const jumpTimes = await measureJumps(wrapperSurface, total, cfg.jumpSamples, flag);

  status.value = `${label}: done.`;
  at(1);

  const heapAfter = heapMB();
  return reduceCase({
    total,
    template: templateKey,
    templateLabel: TEMPLATES[templateKey].label,
    nodesPerRow: templateFootprint(templateKey),
    rowHeightPx,
    mountTimes,
    intervals: res.intervals,
    work: res.work,
    jumpTimes,
    renderCalls: calls,
    domNodes,
    domRows,
    heapMB: Number.isFinite(heapAfter) ? heapAfter : heapBefore,
    frameBudgetMs: environment.frameBudgetMs,
  });
}

/** The unvirtualized control group: every row rendered with a plain v-for. */
async function measureBaselineCase(
  total: number,
  templateKey: string,
  cfg: { durationMs: number; velocity: number; jumpSamples: number },
  environment: EnvInfo,
  label: string,
): Promise<BaselineResult> {
  const flag = abort.value;
  const nodesPerRow = templateFootprint(templateKey);
  const estimatedNodes = total * (nodesPerRow + 1);
  const base: BaselineResult = { total, template: templateKey, nodesPerRow, estimatedNodes, status: 'ok' };

  if (estimatedNodes > BASELINE_NODE_CEILING) {
    status.value = `${label}: unvirtualized baseline refused, ${nf.format(estimatedNodes)} nodes would exhaust the tab.`;
    return {
      ...base,
      status: 'refused',
      note:
        `Would need about ${nf.format(estimatedNodes)} DOM nodes, and Vue would have to render ` +
        'every one. Not attempted: the tab would run out of memory.',
    };
  }

  stageLabel.value = `${label} · unvirtualized · rendering every row`;
  stageLive.value = true;
  status.value = `${label}: rendering every row without a virtualiser…`;
  await nextFrame();

  const t0 = performance.now();
  baselineSpec.value = { total, template: templateKey };
  // Two frames: one for Vue to flush the v-for, one for layout to settle.
  await nextFrame();
  await nextFrame();
  const host = baselineHostRef.value;
  void host?.offsetHeight;
  const mountMs = performance.now() - t0;

  const list = host?.firstElementChild as HTMLElement | null;
  const surface: ScrollSurface = {
    scroll: (delta) => {
      if (host) host.scrollTop += delta;
    },
    paint: () => {},
    percentage: () => {
      if (!host) return 100;
      const range = host.scrollHeight - host.clientHeight;
      return range > 0 ? (host.scrollTop / range) * 100 : 100;
    },
    jumpTo: (index) => {
      const child = list?.children[Math.min(index, (list?.children.length ?? 1) - 1)] as HTMLElement | undefined;
      if (child && host) host.scrollTop = child.offsetTop;
      void host?.offsetHeight;
    },
    nodes: () => list?.querySelectorAll('*').length ?? 0,
    rows: () => list?.children.length ?? 0,
    medianRowHeight: () => NaN,
  };

  await driveScroll(surface, Math.min(700, cfg.durationMs / 2), cfg.velocity, false, flag);
  stageLabel.value = `${label} · unvirtualized · sustained scroll`;
  status.value = `${label}: scrolling the unvirtualized baseline…`;
  const { intervals } = await driveScroll(surface, cfg.durationMs, cfg.velocity, true, flag);
  const domNodes = surface.nodes();
  const domRows = surface.rows();
  const jumpTimes = await measureJumps(surface, total, cfg.jumpSamples, flag);

  const iv = sortNum(intervals);
  const jt = sortNum(jumpTimes);
  const janked = intervals.filter((v) => v > environment.frameBudgetMs * 1.5).length;
  const heap = heapMB();
  baselineSpec.value = null;
  await nextFrame();

  return {
    ...base,
    status: 'ok',
    mountMs,
    rowsMounted: domRows,
    fps: intervals.length ? 1000 / mean(intervals) : NaN,
    frameIntervalP50: percentile(iv, 50),
    frameIntervalP95: percentile(iv, 95),
    worstFrameMs: iv.length ? iv[iv.length - 1] : NaN,
    jankPct: intervals.length ? (janked / intervals.length) * 100 : NaN,
    frameCount: intervals.length,
    jumpP50: percentile(jt, 50),
    jumpP95: percentile(jt, 95),
    domNodes,
    domRows,
    heapMB: heap,
  };
}

/* ------------------------------------------------------------------- runs */

function guardHidden(): boolean {
  if (document.visibilityState === 'hidden') {
    status.value = BACKGROUND_MSG;
    return true;
  }
  return false;
}

async function runScaleSweep(): Promise<void> {
  if (running.value || !sizes.value.length || guardHidden()) return;
  mode.value = 'scale';
  abort.value = { aborted: false };
  hiddenAbort.value = false;
  running.value = true;
  baselineRows.value = [];
  status.value = 'Calibrating display…';
  progress.value = 1;

  const environment = env.value ?? (await collectEnv(hostRef.value));
  env.value = environment;

  const cfg: SweepConfig = {
    templateKey: template.value,
    templateLabel: TEMPLATES[template.value].label,
    scrollSampleMs: durationMs.value,
    velocityPxPerFrame: velocity.value,
    mountReps: reps.value,
    jumpSamples: 40,
    baseline: wantBaseline.value,
  };
  scaleConfig.value = cfg;
  const collected: CaseResult[] = [];
  const collectedBaseline: BaselineResult[] = [];
  const list = [...sizes.value].sort((a, b) => a - b);
  const perSize = 100 / list.length;

  for (let i = 0; i < list.length && !abort.value.aborted; i++) {
    const total = list[i];
    const label = `${nf.format(total)} rows`;
    const row = await measureCase(
      total, template.value,
      { durationMs: durationMs.value, velocity: velocity.value, reps: reps.value, jumpSamples: 40 },
      environment, label, i * perSize, perSize,
    );
    if (!row) break;
    collected.push(row);
    scaleRows.value = [...collected];

    if (wantBaseline.value && !abort.value.aborted) {
      const b = await measureBaselineCase(
        total, template.value,
        { durationMs: durationMs.value, velocity: velocity.value, jumpSamples: 30 },
        environment, label,
      );
      collectedBaseline.push(b);
      baselineRows.value = [...collectedBaseline];
    }
    await sleep(80);
  }

  running.value = false;
  stageLive.value = false;
  const lastTotal = collected.at(-1)?.total ?? 50_000;
  specTotal.value = lastTotal;
  specNonce.value++;
  stageLabel.value = `${abort.value.aborted ? 'stopped' : 'complete'} · ${nf.format(lastTotal)} rows · scroll me`;
  status.value = hiddenAbort.value
    ? `Stopped after ${collected.length} of ${list.length} sizes: the tab was backgrounded mid-run.`
    : abort.value.aborted
      ? `Stopped after ${collected.length} of ${list.length} sizes.`
      : `Complete. ${collected.length} dataset size${collected.length === 1 ? '' : 's'} measured with the "${TEMPLATES[template.value].label}" template.`;
  progress.value = 100;
}

async function runComplexitySweep(): Promise<void> {
  if (running.value || !cxTemplates.value.length || guardHidden()) return;
  mode.value = 'complexity';
  abort.value = { aborted: false };
  hiddenAbort.value = false;
  running.value = true;
  status.value = 'Calibrating display…';
  progress.value = 1;

  const environment = env.value ?? (await collectEnv(hostRef.value));
  env.value = environment;

  const collected: CaseResult[] = [];
  const keys = SWEEP_KEYS.filter((k) => cxTemplates.value.includes(k));
  const span = 100 / keys.length;
  for (let i = 0; i < keys.length && !abort.value.aborted; i++) {
    const key = keys[i];
    const row = await measureCase(
      cxSize.value, key,
      { durationMs: cxDuration.value, velocity: velocity.value, reps: 3, jumpSamples: 30 },
      environment, TEMPLATES[key].label, i * span, span,
    );
    if (!row) break;
    collected.push(row);
    cxRows.value = [...collected];
    await sleep(80);
  }

  running.value = false;
  stageLive.value = false;
  const heaviest = collected.reduce((a, b) => (b.nodesPerRow > a.nodesPerRow ? b : a), collected[0]);
  if (heaviest) {
    specTotal.value = cxSize.value;
    specTemplate.value = heaviest.template;
    specNonce.value++;
    stageLabel.value = `${heaviest.templateLabel} · ${nf.format(cxSize.value)} rows · scroll me`;
  }
  status.value = abort.value.aborted
    ? `Stopped after ${collected.length} of ${keys.length} templates.`
    : `Complete. ${collected.length} row template${collected.length === 1 ? '' : 's'} measured at ${nf.format(cxSize.value)} rows.`;
  progress.value = 100;
}

/* ---------------------------------------------------------------- effects */

function onVisibility(): void {
  if (!running.value || document.visibilityState !== 'hidden') return;
  abort.value.aborted = true;
  hiddenAbort.value = true;
  status.value = 'Stopping: the tab went into the background, so the remaining frames would be meaningless.';
}

const activeRows = computed(() => (mode.value === 'scale' ? scaleRows.value : cxRows.value));
const timelineRow = computed(() =>
  mode.value === 'scale' ? (scaleRows.value[selected.value] ?? null) : (cxRows.value[cxSelected.value] ?? null),
);

/** A hidden canvas has no width to size against, so redraw on every change. */
function redraw(): void {
  if (view.value === 'timeline') drawTimeline(timelineCanvas.value, timelineRow.value, budget.value);
  else if (view.value === 'chart') {
    if (mode.value === 'scale') drawScaling(scalingCanvas.value, scaleRows.value);
    else drawComplexity(complexityCanvas.value, cxRows.value);
  } else if (view.value === 'baseline') {
    drawBaseline(baselineCanvas.value, baselineRows.value, scaleRows.value);
  }
}

watch([view, mode, timelineRow, scaleRows, cxRows, baselineRows], () => {
  void Promise.resolve().then(redraw);
});

/**
 * Same DOM listbox the vanilla page uses, so the control is identical on every
 * platform. Re-run when the mode switches, since that swaps the whole config
 * block for a different set of selects.
 */
function enhanceDropdowns(): void {
  document
    .querySelectorAll<HTMLSelectElement>('.ctl select:not(.dd__native)')
    .forEach(enhanceSelect);
}
watch(mode, () => void nextTick().then(enhanceDropdowns));

/**
 * Mount the live surface with whatever template is selected, so you can see what
 * you picked before spending a run on it. Matches the vanilla page.
 */
watch(template, (key) => {
  if (running.value) return;
  specTotal.value = 50_000;
  specTemplate.value = key;
  specNonce.value++;
  stageLabel.value = `${TEMPLATES[key].label} · 50,000 rows · scroll me`;
});

onMounted(() => {
  void nextTick().then(enhanceDropdowns);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('resize', redraw);
  void collectEnv(hostRef.value).then((e) => (env.value = e));
});
onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisibility);
  window.removeEventListener('resize', redraw);
});

/* ---------------------------------------------------------------- export */

const hasResults = computed(() => scaleRows.value.length > 0 || cxRows.value.length > 0);

function payload() {
  return {
    env: env.value,
    scaleSweep:
      scaleConfig.value && scaleRows.value.length
        ? { config: scaleConfig.value, rows: scaleRows.value }
        : null,
    complexitySweep: cxRows.value.length ? { datasetSize: cxSize.value, rows: cxRows.value } : null,
    unvirtualizedBaseline: baselineRows.value.length
      ? { note: BASELINE_NOTE, nodeCeiling: BASELINE_NODE_CEILING, buildBudgetMs: 0, rows: baselineRows.value }
      : null,
  };
}

async function copy(text: string, filename: string, mime: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    status.value = 'Copied to clipboard.';
  } catch {
    // Clipboard access can be denied outright; hand the results over as a file
    // rather than losing them.
    downloadFile(filename, text, mime);
    status.value = 'Clipboard blocked, downloaded instead.';
  }
}

/* --------------------------------------------------------------- helpers */

const cls = (value: number, good: number, warn: number) =>
  !Number.isFinite(value) ? 'muted' : value <= good ? 'g' : value <= warn ? 'w' : 'b';
const ratio = (a: number, b: number) =>
  Number.isFinite(a) && Number.isFinite(b) && a > 0 ? b / a : null;
const ratioLabel = (r: number | null) => (r === null ? '' : r >= 100 ? `${Math.round(r)}×` : `${r.toFixed(1)}×`);

function toggleSize(n: number): void {
  sizes.value = sizes.value.includes(n) ? sizes.value.filter((v) => v !== n) : [...sizes.value, n];
}
function toggleCxTemplate(k: string): void {
  cxTemplates.value = cxTemplates.value.includes(k)
    ? cxTemplates.value.filter((v) => v !== k)
    : [...cxTemplates.value, k];
}

const tiles = computed(() => {
  if (mode.value === 'scale') {
    const rows = scaleRows.value;
    if (!rows.length) return null;
    const biggest = rows[rows.length - 1];
    const spread = rows.map((r) => r.domNodes);
    const domMin = Math.min(...spread);
    const domMax = Math.max(...spread);
    const list = [
      { k: 'Largest dataset', v: compactRows(biggest.total), unit: '', sub: `${nf.format(biggest.total)} rows navigable`, hero: true },
      { k: 'Frame cost', v: ms(biggest.frameWorkP50), unit: 'ms', sub: `p95 ${ms(biggest.frameWorkP95)} ms · budget ${budget.value.toFixed(1)} ms`, hero: false },
      { k: 'Sustained FPS', v: String(Math.round(biggest.fps)), unit: 'fps', sub: `${nf.format(biggest.frameCount)} frames · ${ms(biggest.jankPct, 1)}% janked`, hero: false },
      { k: 'Random seek', v: ms(biggest.jumpP95), unit: 'ms', sub: 'p95 over 40 seeks', hero: false },
      { k: 'DOM nodes', v: nf.format(biggest.domNodes), unit: '', sub: domMin === domMax ? 'constant across every size' : `${nf.format(domMin)} to ${nf.format(domMax)}`, hero: false },
      { k: 'JS heap', v: Number.isFinite(biggest.heapMB) ? ms(biggest.heapMB, 1) : 'n/a', unit: Number.isFinite(biggest.heapMB) ? 'MB' : '', sub: Number.isFinite(biggest.heapMB) ? 'whole page, post-run' : 'Chromium only', hero: false },
    ];
    const failed = baselineRows.value.filter((b) => b.status !== 'ok');
    if (failed.length) {
      const first = failed.reduce((a, b) => (b.total < a.total ? b : a), failed[0]);
      list.push({ k: 'Baseline fails at', v: compactRows(first.total), unit: 'rows', sub: `unvirtualized needs ~${nf.format(first.estimatedNodes)} nodes`, hero: false });
    }
    return list;
  }
  const rows = cxRows.value;
  if (!rows.length) return null;
  const heaviest = rows.reduce((a, b) => (b.nodesPerRow > a.nodesPerRow ? b : a), rows[0]);
  const lightest = rows.reduce((a, b) => (b.nodesPerRow < a.nodesPerRow ? b : a), rows[0]);
  const worst = rows.reduce((a, b) => (b.frameWorkP50 > a.frameWorkP50 ? b : a), rows[0]);
  const peak = rows.reduce((a, b) => (b.rendersPerFrame > a.rendersPerFrame ? b : a), rows[0]);
  const climb = lightest.usPerRender > 0 ? heaviest.usPerRender / lightest.usPerRender : NaN;
  return [
    { k: 'Heaviest row', v: nf.format(heaviest.nodesPerRow), unit: 'nodes/row', sub: `${heaviest.templateLabel} at ${compactRows(heaviest.total)} rows`, hero: true },
    { k: 'Frame cost', v: ms(heaviest.frameWorkP50), unit: 'ms', sub: `p95 ${ms(heaviest.frameWorkP95)} ms · budget ${budget.value.toFixed(1)} ms`, hero: false },
    { k: 'Worst frame cost', v: ms(worst.frameWorkP50), unit: 'ms', sub: `on ${worst.templateLabel}`, hero: false },
    { k: 'Build cost climb', v: Number.isFinite(climb) ? climb.toFixed(1) : '—', unit: '×', sub: `${ms(lightest.usPerRender, 0)} µs to ${ms(heaviest.usPerRender, 0)} µs per row`, hero: false },
    { k: 'Renders / frame', v: ms(peak.rendersPerFrame), unit: '', sub: `peak, on ${peak.templateLabel}`, hero: false },
    { k: 'Live nodes', v: nf.format(heaviest.domNodes), unit: '', sub: `${nf.format(heaviest.domRows)} rows at ${compactRows(heaviest.total)}`, hero: false },
  ];
});

const envRows = computed<[string, string][]>(() => {
  const e = env.value;
  if (!e) return [];
  return [
    ['Browser', e.browser],
    ['Platform', e.platform],
    ['Logical cores', e.cores ? String(e.cores) : 'not exposed'],
    ['Device memory', e.deviceMemoryGB ? `${e.deviceMemoryGB} GB` : 'not exposed'],
    ['Device pixel ratio', `${e.dpr}\u00d7`],
    ['Window', `${e.viewport} px`],
    ['Scroll surface', `${e.surface} px`],
    ['Measured refresh rate', `${e.refreshHz} Hz`],
    ['Frame budget', `${e.frameBudgetMs.toFixed(1)} ms`],
    ['Heap API', e.heapApi ? 'available (Chromium)' : 'unavailable in this browser'],
    ['Wrapper', e.wrapper],
  ];
});

const views = computed<View[]>(() =>
  mode.value === 'scale' ? ['table', 'timeline', 'chart', 'baseline'] : ['table', 'timeline', 'chart'],
);
const viewLabel = (v: View) =>
  v === 'table' ? 'Table' : v === 'timeline' ? 'Frame timeline' : v === 'chart' ? 'Cost curve' : 'vs. baseline';

</script>

<template>
  <div class="bench">
    <section class="bench__hero">
      <span class="tagline">Live benchmark</span>
      <h1>Vue wrapper performance benchmark</h1>
      <p>
        Measured in <em>your</em> browser when you press Run. Nothing here is pre-recorded. Unlike the
        vanilla benchmark, which drives the engine directly, this one measures the
        <code>&lt;CeriousScroll&gt;</code> component: every row is a VNode rendered by Vue, so the
        numbers include Vue's own render work. The control group is the same rows rendered with a plain
        <code>v-for</code> and no virtualiser.
      </p>
      <div v-if="env" class="envstrip">
        <span><b>{{ env.browser }}</b></span>
        <span><b>{{ env.platform }}</b></span>
        <span>cores <b>{{ env.cores ?? '?' }}</b></span>
        <span>refresh <b>{{ env.refreshHz }} Hz</b></span>
        <span>budget <b>{{ env.frameBudgetMs.toFixed(1) }} ms</b></span>
        <span>surface <b>{{ env.surface }}</b></span>
      </div>
    </section>

    <div class="modebar">
      <div class="modeswitch" role="tablist">
        <button type="button" role="tab" :disabled="running" :class="{ 'is-active': mode === 'scale' }" @click="mode = 'scale'">
          <b>Scale sweep</b>
          <span>Hold the row still, grow the dataset from 1K to 10M</span>
        </button>
        <button type="button" role="tab" :disabled="running" :class="{ 'is-active': mode === 'complexity' }" @click="mode = 'complexity'">
          <b>Complexity sweep</b>
          <span>Hold the dataset still, grow the row from 4 to 61 nodes</span>
        </button>
      </div>
    </div>

    <!-- ------------------------------------------------------- step 1 -->
    <section class="step">
      <header class="step__head">
        <span class="step__num">1</span>
        <div>
          <h2>Configure</h2>
          <p v-if="mode === 'scale'">
            Pick one row template and the dataset sizes to walk through. If the wrapper is doing its
            job, every number in the results stays flat as the row count climbs.
          </p>
          <p v-else>
            Pick one dataset size and the row templates to walk through, from a four-node row up to a
            sixty-node panel. This is what separates engine cost from Vue's render cost.
          </p>
        </div>
      </header>

      <div v-if="mode === 'scale'" class="step__body">
        <div class="ctl-grid">
          <div class="ctl">
            <span>Row template</span>
            <select v-model="template">
              <optgroup v-for="g in TEMPLATE_GROUPS" :key="g.label" :label="g.label">
                <option v-for="k in g.keys" :key="k" :value="k">{{ TEMPLATES[k].optionLabel }}</option>
              </optgroup>
            </select>
          </div>
          <div class="ctl">
            <span>Scroll sample per size</span>
            <select v-model.number="durationMs">
              <option :value="2000">2 seconds (fast)</option>
              <option :value="4000">4 seconds (default)</option>
              <option :value="8000">8 seconds (thorough)</option>
            </select>
          </div>
          <div class="ctl">
            <span>Fling velocity</span>
            <select v-model.number="velocity">
              <option :value="24">Reading pace, 24 px/frame</option>
              <option :value="60">Fast scroll, 60 px/frame</option>
              <option :value="160">Hard fling, 160 px/frame</option>
            </select>
          </div>
          <div class="ctl">
            <span>Mount repetitions</span>
            <select v-model.number="reps">
              <option :value="3">3 (median)</option>
              <option :value="5">5 (median)</option>
              <option :value="9">9 (median)</option>
            </select>
          </div>
        </div>
        <p class="ctl-note">{{ TEMPLATES[template].note }}</p>

        <label class="switch">
          <input type="checkbox" v-model="wantBaseline" />
          <span>
            <b>Also measure an unvirtualized baseline</b>
            Renders every row with a plain <code>v-for</code>, the way you would without a virtualiser,
            so the numbers above have a control group. Refused above two million DOM nodes, and the
            refusal is reported rather than hidden.
          </span>
        </label>

        <div class="ctl" style="margin-top: 18px">
          <span>Dataset sizes</span>
          <div class="chips">
            <label v-for="n in SIZES" :key="n" class="chip" :class="{ 'is-on': sizes.includes(n) }">
              <input type="checkbox" :checked="sizes.includes(n)" @change="toggleSize(n)" />
              {{ nf.format(n) }}
            </label>
          </div>
        </div>
      </div>

      <div v-else class="step__body">
        <div class="ctl-grid">
          <div class="ctl">
            <span>Dataset size</span>
            <select v-model.number="cxSize">
              <option :value="10000">10,000 rows</option>
              <option :value="100000">100,000 rows</option>
              <option :value="1000000">1,000,000 rows</option>
              <option :value="10000000">10,000,000 rows</option>
            </select>
          </div>
          <div class="ctl">
            <span>Scroll sample per template</span>
            <select v-model.number="cxDuration">
              <option :value="1500">1.5 seconds (fast)</option>
              <option :value="3000">3 seconds (default)</option>
              <option :value="6000">6 seconds (thorough)</option>
            </select>
          </div>
        </div>
        <div class="ctl" style="margin-top: 18px">
          <span>Row templates <small>node counts are measured, not claimed</small></span>
          <div class="chips">
            <label
              v-for="k in SWEEP_KEYS"
              :key="k"
              class="chip"
              :class="{ 'is-on': cxTemplates.includes(k) }"
              :title="TEMPLATES[k].note"
            >
              <input type="checkbox" :checked="cxTemplates.includes(k)" @change="toggleCxTemplate(k)" />
              {{ TEMPLATES[k].label }}
              <span style="color: var(--muted); font-size: 0.76rem"> · {{ templateFootprint(k) }} nodes</span>
            </label>
          </div>
        </div>
      </div>
    </section>

    <!-- ------------------------------------------------------- step 2 -->
    <section class="step">
      <header class="step__head">
        <span class="step__num">2</span>
        <div>
          <h2>Run</h2>
          <p>
            The surface below is the <code>&lt;CeriousScroll&gt;</code> component under test. It stays
            visible and interactive the whole time, so you can watch each phase happen and grab it
            yourself once the run finishes.
          </p>
        </div>
      </header>
      <div class="step__body">
        <div class="run-bar">
          <button
            class="btn btn--primary"
            type="button"
            :disabled="running"
            @click="mode === 'scale' ? runScaleSweep() : runComplexitySweep()"
          >
            ▶ Run {{ mode === 'scale' ? 'scale' : 'complexity' }} sweep
          </button>
          <button class="btn" type="button" :disabled="!running" @click="abort.aborted = true; status = 'Stopping after the current phase…'">
            Stop
          </button>
          <div class="progress"><div class="progress__fill" :style="{ width: `${progress}%` }" /></div>
          <span class="run-status">{{ status }}</span>
        </div>

        <div class="stage">
          <div class="stage__badge">
            <span class="dot" :class="{ 'is-live': stageLive }" />
            <span>{{ stageLabel }}</span>
          </div>
          <div class="bx-host" ref="hostRef">
            <CeriousScroll
              :key="specNonce"
              ref="scroll"
              :total-elements="specTotal"
              :get-item="(index: number) => index"
              :options="{ keyboard: { enabled: false }, wheel: { enabled: true }, touch: { enabled: true } }"
              style="position: absolute; inset: 0"
            >
              <template #item="{ item: index }">
                <RowRenderer :index="index" :template-key="specTemplate" />
              </template>
            </CeriousScroll>
          </div>
          <div v-if="baselineSpec" class="bx-baseline-host" ref="baselineHostRef">
            <div>
              <div v-for="i in baselineSpec.total" :key="i">
                <RowRenderer :index="i - 1" :template-key="baselineSpec.template" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ------------------------------------------------------- step 3 -->
    <section class="step">
      <header class="step__head">
        <span class="step__num">3</span>
        <div>
          <h2>Results</h2>
          <p>
            {{
              activeRows.length
                ? `${mode === 'scale' ? TEMPLATES[template].label : `${nf.format(cxSize)} rows`} · ${env?.refreshHz ?? '?'} Hz display`
                : 'Nothing measured yet. Run the sweep above and the numbers land here.'
            }}
          </p>
        </div>
      </header>
      <div class="step__body">
        <div class="tiles">
          <template v-if="tiles">
            <div v-for="t in tiles" :key="t.k" class="tile" :class="{ 'tile--hero': t.hero }">
              <div class="tile__k">{{ t.k }}</div>
              <div class="tile__v">{{ t.v }}<small v-if="t.unit">{{ t.unit }}</small></div>
              <div class="tile__sub">{{ t.sub }}</div>
            </div>
          </template>
          <div v-else class="empty">Waiting for a run.</div>
        </div>

        <div class="subtabs" role="tablist">
          <button
            v-for="v in views"
            :key="v"
            type="button"
            role="tab"
            class="subtab"
            :class="{ 'is-active': view === v }"
            @click="view = v"
          >
            {{ viewLabel(v) }}
          </button>
        </div>

        <div v-if="view === 'table'">
          <div class="result-block">
            <h3 class="result-block__title">
              {{ mode === 'scale' ? 'Every dataset size' : 'Every row template' }}
            </h3>
            <div class="table-scroll">
              <table v-if="mode === 'scale'" class="bench-table">
                <thead>
                  <tr>
                    <th>Rows</th>
                    <th title="Time to construct the component and paint the first viewport">Mount</th>
                    <th title="Median JS time per animation frame: engine math plus Vue's render">Frame p50</th>
                    <th title="95th-percentile per-frame JS time">Frame p95</th>
                    <th title="Frames per second observed during the sustained scroll">FPS</th>
                    <th title="Longest single frame interval during the run">Worst frame</th>
                    <th title="Share of frames that missed the display budget">Jank</th>
                    <th title="95th-percentile time to jump to a random index and repaint">Jump p95</th>
                    <th title="DOM elements resident inside the scroll surface at steady state">DOM nodes</th>
                    <th title="Chromium-only JS heap reading after the run">Heap</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(r, i) in scaleRows"
                    :key="r.total"
                    :class="{ 'is-sel': i === selected }"
                    @click="selected = i"
                  >
                    <td class="size">{{ nf.format(r.total) }}</td>
                    <td :class="cls(r.mountMs, 8, 25)">{{ ms(r.mountMs) }} ms</td>
                    <td :class="cls(r.frameWorkP50, budget * 0.5, budget)">{{ ms(r.frameWorkP50) }} ms</td>
                    <td :class="cls(r.frameWorkP95, budget * 0.75, budget * 1.5)">{{ ms(r.frameWorkP95) }} ms</td>
                    <td>{{ Number.isFinite(r.fps) ? Math.round(r.fps) : '—' }}</td>
                    <td :class="cls(r.worstFrameMs, budget * 2, budget * 4)">{{ ms(r.worstFrameMs, 1) }} ms</td>
                    <td :class="cls(r.jankPct, 1, 5)">{{ ms(r.jankPct, 1) }}%</td>
                    <td :class="cls(r.jumpP95, 4, 16)">{{ ms(r.jumpP95) }} ms</td>
                    <td>{{ nf.format(r.domNodes) }}<span class="muted"> / {{ nf.format(r.domRows) }} rows</span></td>
                    <td class="muted">{{ Number.isFinite(r.heapMB) ? ms(r.heapMB, 1) + ' MB' : 'n/a' }}</td>
                  </tr>
                  <tr v-if="!scaleRows.length">
                    <td :colspan="10" class="empty">No scale sweep has been run yet.</td>
                  </tr>
                </tbody>
              </table>

              <table v-else class="bench-table">
                <thead>
                  <tr>
                    <th>Row template</th>
                    <th title="DOM elements the template creates for a single row">Nodes / row</th>
                    <th title="Median row height as measured from the DOM by the engine">Row height</th>
                    <th title="Time to construct the component and paint the first viewport">Mount</th>
                    <th title="Median JS time per animation frame: engine math plus Vue's render">Frame p50</th>
                    <th title="95th-percentile per-frame JS time">Frame p95</th>
                    <th>FPS</th>
                    <th title="Share of frames that missed the display budget">Jank</th>
                    <th title="Renderer invocations per frame: the rows that actually entered the viewport">Renders / frame</th>
                    <th title="Average JS time attributable to building one row">Per row</th>
                    <th title="DOM elements resident in the scroll surface at steady state">Live nodes</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(r, i) in cxRows"
                    :key="r.template"
                    :class="{ 'is-sel': i === cxSelected }"
                    @click="cxSelected = i"
                  >
                    <td class="size">{{ r.templateLabel }}</td>
                    <td>{{ nf.format(r.nodesPerRow) }}</td>
                    <td class="muted">{{ Number.isFinite(r.rowHeightPx) ? Math.round(r.rowHeightPx) + ' px' : '—' }}</td>
                    <td :class="cls(r.mountMs, 8, 25)">{{ ms(r.mountMs) }} ms</td>
                    <td :class="cls(r.frameWorkP50, budget * 0.5, budget)">{{ ms(r.frameWorkP50) }} ms</td>
                    <td :class="cls(r.frameWorkP95, budget * 0.75, budget * 1.5)">{{ ms(r.frameWorkP95) }} ms</td>
                    <td>{{ Number.isFinite(r.fps) ? Math.round(r.fps) : '—' }}</td>
                    <td :class="cls(r.jankPct, 1, 5)">{{ ms(r.jankPct, 1) }}%</td>
                    <td class="muted">{{ ms(r.rendersPerFrame) }}</td>
                    <td>{{ ms(r.usPerRender, 0) }} µs</td>
                    <td class="muted">{{ nf.format(r.domNodes) }} / {{ nf.format(r.domRows) }} rows</td>
                  </tr>
                  <tr v-if="!cxRows.length">
                    <td :colspan="11" class="empty">No complexity sweep has been run yet.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <p class="table-note">Click any row to select it. The Frame timeline tab follows your selection.</p>
        </div>

        <div v-else-if="view === 'timeline'" class="chart-box">
          <h3>
            {{ timelineRow ? `Frame timeline · ${timelineRow.templateLabel} · ${nf.format(timelineRow.total)} rows` : 'Frame timeline' }}
          </h3>
          <p>
            Every animation frame of the selected run, in order. Green is the wall-clock gap between
            frames, blue is the JS Vue and the engine spent together, and the dashed line is the display
            budget. On a healthy run the green trace sits <em>on</em> the budget: the browser paces
            frames to the refresh rate, so matching it is the best result available. What matters is the
            shaded band above, where missed frames appear.
          </p>
          <canvas ref="timelineCanvas" />
          <div class="legend">
            <span><i style="background: #78f3d2" />Frame interval</span>
            <span><i style="background: #8cb7ff" />JS work per frame</span>
            <span><i style="background: #f2c66d" />Display budget (shaded above = missed)</span>
          </div>
        </div>

        <div v-else-if="view === 'chart'" class="chart-box">
          <h3>{{ mode === 'scale' ? 'Cost against dataset size' : 'Cost against row complexity' }}</h3>
          <p>
            {{
              mode === 'scale'
                ? 'The dataset grows by orders of magnitude on a log scale. Flat lines mean cost is independent of row count.'
                : 'Per-frame JS cost plotted against the number of DOM nodes each row template creates.'
            }}
          </p>
          <canvas v-if="mode === 'scale'" ref="scalingCanvas" />
          <canvas v-else ref="complexityCanvas" />
          <div class="legend">
            <span><i style="background: #78f3d2" />Frame p50 (ms)</span>
            <template v-if="mode === 'scale'">
              <span><i style="background: #8cb7ff" />Mount (ms)</span>
              <span><i style="background: #c9a2ff" />Jump p95 (ms)</span>
            </template>
            <span v-else><i style="background: #c9a2ff" />Per-row build cost (µs)</span>
          </div>
        </div>

        <div v-else-if="view === 'baseline'">
          <p class="view-lead">
            The same harness, run against the same rows rendered with a plain <code>v-for</code> and no
            virtualiser. Frame <em>work</em> is not compared here: the unvirtualized list does almost no
            JavaScript per frame because Vue already built the whole tree and the browser pays at layout
            and paint instead. So the honest comparison is the wall-clock <em>frame interval</em>, plus
            what it costs to render and how much DOM stays resident.
          </p>
          <div class="table-scroll">
            <table class="bench-table bench-table--cmp">
              <thead>
                <tr>
                  <th>Rows</th>
                  <th>Mount<small>wrapper → unvirtualized</small></th>
                  <th>Frame interval<small>wrapper → unvirtualized</small></th>
                  <th>DOM nodes<small>wrapper → unvirtualized</small></th>
                </tr>
              </thead>
              <tbody>
                <template v-for="b in baselineRows" :key="b.total">
                  <tr v-if="b.status !== 'ok'">
                    <td class="size">{{ nf.format(b.total) }}</td>
                    <td class="cmp">
                      <span class="cmp__v">{{ scaleRows.find((x) => x.total === b.total) ? `${ms(scaleRows.find((x) => x.total === b.total)!.mountMs)} ms` : '—' }}</span>
                      <span class="cmp__sep">→</span>
                      <span class="verdict verdict--refused">cannot be built</span>
                    </td>
                    <td class="verdict-note" :colspan="2">{{ b.note }}</td>
                  </tr>
                  <tr v-else>
                    <td class="size">{{ nf.format(b.total) }}</td>
                    <td class="cmp">
                      <span class="cmp__v">{{ scaleRows.find((x) => x.total === b.total) ? `${ms(scaleRows.find((x) => x.total === b.total)!.mountMs)} ms` : '—' }}</span>
                      <span class="cmp__sep">→</span>
                      <span class="cmp__n">{{ ms(b.mountMs, 1) }} ms</span>
                      <span
                        v-if="scaleRows.find((x) => x.total === b.total)"
                        class="cmp__r"
                        :class="{ 'cmp__r--big': (ratio(scaleRows.find((x) => x.total === b.total)!.mountMs, b.mountMs!) ?? 0) >= 10 }"
                      >{{ ratioLabel(ratio(scaleRows.find((x) => x.total === b.total)!.mountMs, b.mountMs!)) }}</span>
                    </td>
                    <td class="cmp">
                      <span class="cmp__v">{{ scaleRows.find((x) => x.total === b.total) ? `${ms(scaleRows.find((x) => x.total === b.total)!.frameIntervalP50, 1)} ms` : '—' }}</span>
                      <span class="cmp__sep">→</span>
                      <span class="cmp__n">{{ ms(b.frameIntervalP50, 1) }} ms</span>
                      <span class="cmp__r" :class="{ 'cmp__r--bad': (b.jankPct ?? 0) >= 5 }">{{ ms(b.jankPct, 0) }}% jank</span>
                    </td>
                    <td class="cmp">
                      <span class="cmp__v">{{ scaleRows.find((x) => x.total === b.total) ? nf.format(scaleRows.find((x) => x.total === b.total)!.domNodes) : '—' }}</span>
                      <span class="cmp__sep">→</span>
                      <span class="cmp__n">{{ nf.format(b.domNodes ?? 0) }}</span>
                      <span
                        v-if="scaleRows.find((x) => x.total === b.total)"
                        class="cmp__r cmp__r--big"
                      >{{ ratioLabel(ratio(scaleRows.find((x) => x.total === b.total)!.domNodes, b.domNodes ?? 0)) }}</span>
                    </td>
                  </tr>
                </template>
                <tr v-if="!baselineRows.length">
                  <td :colspan="4" class="empty">
                    No baseline measured yet. Enable it in step 1 and run the scale sweep.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="chart-box">
            <h3>Resident DOM nodes, both approaches</h3>
            <p>Log scale on both axes. One line stays flat; the other tracks the dataset until it cannot be built at all.</p>
            <canvas ref="baselineCanvas" />
            <div class="legend">
              <span><i style="background: #78f3d2" />with the wrapper</span>
              <span><i style="background: #ff8d8d" />unvirtualized</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ------------------------------------------------------- step 4 -->
    <section class="step">
      <header class="step__head">
        <span class="step__num">4</span>
        <div>
          <h2>Export</h2>
          <p>
            Every export carries the full environment block alongside the numbers from both sweeps. A
            result should never be quoted without the machine that produced it.
          </p>
        </div>
      </header>
      <div class="step__body">
        <div class="export-bar">
          <button class="btn btn--sm" type="button" :disabled="!hasResults" @click="copy(toMarkdown(payload()), `${stamp()}.md`, 'text/markdown')">Copy Markdown</button>
          <button class="btn btn--sm" type="button" :disabled="!hasResults" @click="copy(toJson(payload()), `${stamp()}.json`, 'application/json')">Copy JSON</button>
          <button class="btn btn--sm" type="button" :disabled="!hasResults" @click="downloadFile(`${stamp()}.json`, toJson(payload()), 'application/json')">Download JSON</button>
          <button class="btn btn--sm" type="button" :disabled="!hasResults" @click="downloadFile(`${stamp()}.csv`, toCsv(payload()), 'text/csv')">Download CSV</button>
        </div>
      </div>
    </section>

    <!-- ------------------------------------------------------- method -->
    <section class="panel panel--method">
      <h2 class="panel__title">
        How it works <small>what is measured, and what it is not</small>
      </h2>
      <div class="method">
        <!-- Static, author-written copy shared verbatim with the vanilla page
             and the other wrappers, so the four cannot drift apart. -->
        <div v-html="METHOD_HTML" />
        <details class="env-details">
          <summary>Full environment readout</summary>
          <div class="kv">
            <div v-for="row in envRows" :key="row[0]">
              <span class="k">{{ row[0] }}</span>
              <span class="v">{{ row[1] }}</span>
            </div>
          </div>
        </details>
      </div>
    </section>
  </div>
</template>
