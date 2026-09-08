/**
 * Framework-agnostic measurement core for the benchmark demo.
 *
 * Nothing in this file touches React. It talks to a `ScrollSurface`, which the
 * page implements once for the wrapper component and once for a plain
 * "every row mounted" control group. That keeps the two strictly comparable:
 * identical timing, identical warm-up, identical reduction.
 *
 * The vanilla build of this benchmark measures the engine directly. This one
 * deliberately measures the WRAPPER, so the numbers include Vue's own
 * rendering. Vue commits row content through a synchronous `render(vnode, el)`, so timing around `surface.paint()` captures that work.
 */

/* ------------------------------------------------------------------ types */

/** The two things the harness needs to be able to do to a scroll surface. */
export interface ScrollSurface {
  /** Apply a pixel delta. */
  scroll(deltaY: number): void;
  /** Commit rows. Must be synchronous, or the measurement is meaningless. */
  paint(): void;
  /** Current scroll position as 0..100, used to bounce at either end. */
  percentage(): number;
  /** Jump to a dataset index and commit. */
  jumpTo(index: number): void;
  /** Elements resident inside the scroll surface right now. */
  nodes(): number;
  /** Row containers resident right now. */
  rows(): number;
  /** Median measured height of the resident rows. */
  medianRowHeight(): number;
  /** Renderer invocations since the last reset, if the surface counts them. */
  renderCalls?(): number;
  resetRenderCalls?(): void;
}

export interface EnvInfo {
  browser: string;
  platform: string;
  cores: number | null;
  deviceMemoryGB: number | null;
  dpr: number;
  viewport: string;
  surface: string;
  refreshHz: number;
  frameBudgetMs: number;
  heapApi: boolean;
  library: string;
  wrapper: string;
  timestamp: string;
}

export interface SweepConfig {
  templateKey: string;
  templateLabel: string;
  scrollSampleMs: number;
  velocityPxPerFrame: number;
  mountReps: number;
  jumpSamples: number;
  baseline: boolean;
}

export interface CaseResult {
  total: number;
  template: string;
  templateLabel: string;
  nodesPerRow: number;
  rowHeightPx: number;
  mountMs: number;
  mountSamples: number[];
  frameWorkP50: number;
  frameWorkP95: number;
  frameWorkMax: number;
  fps: number;
  frameIntervalP50: number;
  frameIntervalP95: number;
  worstFrameMs: number;
  jankPct: number;
  frameCount: number;
  renderCalls: number;
  rendersPerFrame: number;
  usPerRender: number;
  jumpP50: number;
  jumpP95: number;
  jumpMax: number;
  domNodes: number;
  domRows: number;
  heapMB: number;
  series: { intervals: number[]; work: number[] };
}

export type BaselineStatus = 'ok' | 'refused' | 'timeout';

export interface BaselineResult {
  total: number;
  template: string;
  nodesPerRow: number;
  estimatedNodes: number;
  status: BaselineStatus;
  note?: string;
  mountMs?: number;
  rowsMounted?: number;
  fps?: number;
  frameIntervalP50?: number;
  frameIntervalP95?: number;
  worstFrameMs?: number;
  jankPct?: number;
  frameCount?: number;
  jumpP50?: number;
  jumpP95?: number;
  domNodes?: number;
  domRows?: number;
  heapMB?: number;
}

/* ------------------------------------------------------------------ utils */

export const nf = new Intl.NumberFormat('en-US');
export const nextFrame = (): Promise<number> =>
  new Promise((resolve) => requestAnimationFrame(resolve));
export const sleep = (msDelay: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, msDelay));

/** Small deterministic hash, so generated row content is stable across runs. */
export function hash(index: number, salt = 1): number {
  let h = (index * 374761393 + salt * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

export const sortNum = (values: number[]): number[] =>
  values.slice().sort((a, b) => a - b);

export function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return NaN;
  const i = (sorted.length - 1) * (p / 100);
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

export const mean = (values: number[]): number =>
  values.reduce((sum, v) => sum + v, 0) / (values.length || 1);

export const ms = (value: number | undefined, digits = 2): string =>
  Number.isFinite(value as number) ? (value as number).toFixed(digits) : '—';

export function compactRows(n: number): string {
  if (n >= 1e6) return `${n / 1e6}M`;
  if (n >= 1e3) return `${n / 1e3}K`;
  return String(n);
}

interface PerfWithMemory extends Performance {
  memory?: { usedJSHeapSize: number };
}

export function heapMB(): number {
  const mem = (performance as PerfWithMemory).memory;
  return mem ? mem.usedJSHeapSize / 1048576 : NaN;
}

/* ------------------------------------------------------------ environment */

/**
 * Sample idle animation frames and take the median. Reporting "60 FPS" as a
 * pass on a 240 Hz panel would be wrong by a factor of four, so the frame
 * budget every other number is judged against comes from here.
 */
export async function measureRefreshRate(sampleMs = 700): Promise<number> {
  const gaps: number[] = [];
  let last = await nextFrame();
  const start = last;
  while (last - start < sampleMs) {
    const now = await nextFrame();
    gaps.push(now - last);
    last = now;
  }
  const median = percentile(sortNum(gaps), 50);
  const hz = median > 0 ? Math.round(1000 / median) : 60;
  // Snap to a real panel rate so a noisy sample does not read "58 Hz".
  const snaps = [60, 75, 90, 120, 144, 165, 240];
  const near = snaps.find((s) => Math.abs(s - hz) <= Math.max(3, s * 0.06));
  return near ?? hz;
}

interface NavigatorWithHints extends Navigator {
  deviceMemory?: number;
  userAgentData?: { brands?: { brand: string; version: string }[]; platform?: string };
}

export async function collectEnv(surfaceEl: HTMLElement | null): Promise<EnvInfo> {
  const nav = navigator as NavigatorWithHints;
  const uaData = nav.userAgentData;
  let browser = '';
  if (uaData?.brands?.length) {
    const brands = uaData.brands.filter((b) => !/Not.?A.?Brand/i.test(b.brand));
    const brand = brands[brands.length - 1] ?? uaData.brands[0];
    browser = `${brand.brand} ${brand.version}`;
  } else {
    const m = navigator.userAgent.match(/(Firefox|Edg|Chrome|Version)\/([\d.]+)/);
    browser = m ? `${m[1] === 'Version' ? 'Safari' : m[1]} ${m[2].split('.')[0]}` : 'Unknown';
  }
  const refreshHz = await measureRefreshRate();
  return {
    browser,
    platform: uaData?.platform ?? navigator.platform ?? 'Unknown',
    cores: navigator.hardwareConcurrency ?? null,
    deviceMemoryGB: nav.deviceMemory ?? null,
    dpr: window.devicePixelRatio || 1,
    viewport: `${window.innerWidth}×${window.innerHeight}`,
    surface: surfaceEl
      ? `${Math.round(surfaceEl.clientWidth)}×${Math.round(surfaceEl.clientHeight)}`
      : 'unknown',
    refreshHz,
    frameBudgetMs: 1000 / refreshHz,
    heapApi: !!(performance as PerfWithMemory).memory,
    library: '@ceriousdevtech/cerious-scroll',
    wrapper: '@ceriousdevtech/vue-cerious-scroll',
    timestamp: new Date().toISOString(),
  };
}

/* --------------------------------------------------------------- drivers */

export interface AbortFlag {
  aborted: boolean;
}

/**
 * Drive a surface with a fixed pixel delta once per animation frame, bouncing
 * at either end of the dataset. Records two things per frame: the wall-clock
 * interval (which carries browser layout, paint and compositing) and the JS
 * time our own work took.
 */
export async function driveScroll(
  surface: ScrollSurface,
  durationMs: number,
  velocity: number,
  collect: boolean,
  abort: AbortFlag,
): Promise<{ intervals: number[]; work: number[] }> {
  const intervals: number[] = [];
  const work: number[] = [];
  let direction = 1;
  let last = await nextFrame();
  const start = last;

  for (;;) {
    if (abort.aborted) break;
    const w0 = performance.now();
    surface.scroll(direction * velocity);
    surface.paint();
    const w1 = performance.now();

    const now = await nextFrame();
    if (collect) {
      intervals.push(now - last);
      work.push(w1 - w0);
    }
    last = now;

    const pct = surface.percentage();
    if (pct >= 99.5) direction = -1;
    else if (pct <= 0.5) direction = 1;

    if (now - start >= durationMs) break;
  }
  return { intervals, work };
}

export async function measureJumps(
  surface: ScrollSurface,
  total: number,
  count: number,
  abort: AbortFlag,
): Promise<number[]> {
  const times: number[] = [];
  for (let k = 0; k < count && !abort.aborted; k++) {
    await nextFrame();
    const target = Math.floor(hash(k, 97) * total);
    const t0 = performance.now();
    surface.jumpTo(target);
    times.push(performance.now() - t0);
  }
  return times;
}

/* -------------------------------------------------------------- reducers */

export function reduceCase(input: {
  total: number;
  template: string;
  templateLabel: string;
  nodesPerRow: number;
  rowHeightPx: number;
  mountTimes: number[];
  intervals: number[];
  work: number[];
  jumpTimes: number[];
  renderCalls: number;
  domNodes: number;
  domRows: number;
  heapMB: number;
  frameBudgetMs: number;
}): CaseResult {
  const iv = sortNum(input.intervals);
  const wk = sortNum(input.work);
  const jt = sortNum(input.jumpTimes);
  const janked = input.intervals.filter((v) => v > input.frameBudgetMs * 1.5).length;
  const totalWork = input.work.reduce((a, b) => a + b, 0);
  const frameCount = input.intervals.length;

  return {
    total: input.total,
    template: input.template,
    templateLabel: input.templateLabel,
    nodesPerRow: input.nodesPerRow,
    rowHeightPx: input.rowHeightPx,
    mountMs: percentile(sortNum(input.mountTimes), 50),
    mountSamples: input.mountTimes.map((v) => +v.toFixed(3)),
    frameWorkP50: percentile(wk, 50),
    frameWorkP95: percentile(wk, 95),
    frameWorkMax: wk.length ? wk[wk.length - 1] : NaN,
    fps: frameCount ? 1000 / mean(input.intervals) : NaN,
    frameIntervalP50: percentile(iv, 50),
    frameIntervalP95: percentile(iv, 95),
    worstFrameMs: iv.length ? iv[iv.length - 1] : NaN,
    jankPct: frameCount ? (janked / frameCount) * 100 : NaN,
    frameCount,
    renderCalls: input.renderCalls,
    rendersPerFrame: frameCount ? input.renderCalls / frameCount : NaN,
    usPerRender: input.renderCalls ? (totalWork * 1000) / input.renderCalls : NaN,
    jumpP50: percentile(jt, 50),
    jumpP95: percentile(jt, 95),
    jumpMax: jt.length ? jt[jt.length - 1] : NaN,
    domNodes: input.domNodes,
    domRows: input.domRows,
    heapMB: input.heapMB,
    series: {
      intervals: input.intervals.map((v) => +v.toFixed(3)),
      work: input.work.map((v) => +v.toFixed(3)),
    },
  };
}

/* --------------------------------------------------------------- exports */

export interface ExportPayload {
  env: EnvInfo | null;
  scaleSweep: { config: SweepConfig; rows: CaseResult[] } | null;
  complexitySweep: { datasetSize: number; rows: CaseResult[] } | null;
  unvirtualizedBaseline: {
    note: string;
    nodeCeiling: number;
    buildBudgetMs: number;
    rows: BaselineResult[];
  } | null;
}

export const BASELINE_NOTE =
  'Control group: every row rendered with plain framework markup, no virtualiser. ' +
  'Frame work is not comparable (the control does almost no JS per frame; the ' +
  'browser pays at layout and paint), so compare frame intervals, mount time and ' +
  'resident DOM nodes.';

export function toJson(payload: ExportPayload): string {
  return JSON.stringify(payload, null, 2);
}

export function toCsv(payload: ExportPayload): string {
  const e = payload.env;
  const head = [
    '# cerious-scroll benchmark (Vue wrapper)',
    `# generated,${e?.timestamp ?? ''}`,
    `# browser,${e?.browser ?? ''}`,
    `# platform,${e?.platform ?? ''}`,
    `# cores,${e?.cores ?? ''}`,
    `# refresh_hz,${e?.refreshHz ?? ''}`,
    `# frame_budget_ms,${e?.frameBudgetMs.toFixed(2) ?? ''}`,
    `# surface_px,${e?.surface ?? ''}`,
    `# wrapper,${e?.wrapper ?? ''}`,
  ].join('\n');

  const caseCols: [string, (r: CaseResult) => string | number][] = [
    ['rows', (r) => r.total],
    ['template', (r) => JSON.stringify(r.templateLabel)],
    ['nodes_per_row', (r) => r.nodesPerRow],
    ['mount_ms_median', (r) => ms(r.mountMs, 3)],
    ['frame_work_p50_ms', (r) => ms(r.frameWorkP50, 3)],
    ['frame_work_p95_ms', (r) => ms(r.frameWorkP95, 3)],
    ['fps_mean', (r) => ms(r.fps, 1)],
    ['frame_interval_p50_ms', (r) => ms(r.frameIntervalP50, 2)],
    ['worst_frame_ms', (r) => ms(r.worstFrameMs, 2)],
    ['jank_pct', (r) => ms(r.jankPct, 2)],
    ['renders_per_frame', (r) => ms(r.rendersPerFrame, 3)],
    ['us_per_render', (r) => ms(r.usPerRender, 1)],
    ['jump_p95_ms', (r) => ms(r.jumpP95, 3)],
    ['dom_nodes', (r) => r.domNodes],
    ['dom_rows', (r) => r.domRows],
    ['heap_mb', (r) => (Number.isFinite(r.heapMB) ? ms(r.heapMB, 2) : '')],
  ];

  const section = (title: string, rows: CaseResult[]): string =>
    `\n# ${title}\n` +
    [caseCols.map((c) => c[0]).join(',')]
      .concat(rows.map((r) => caseCols.map((c) => c[1](r)).join(',')))
      .join('\n') +
    '\n';

  let out = head + '\n';
  if (payload.scaleSweep?.rows.length) {
    out += section('scale sweep (dataset size)', payload.scaleSweep.rows);
  }
  if (payload.complexitySweep?.rows.length) {
    out += section(
      `complexity sweep at ${payload.complexitySweep.datasetSize} rows`,
      payload.complexitySweep.rows,
    );
  }
  if (payload.unvirtualizedBaseline?.rows.length) {
    out +=
      '\n# unvirtualized baseline (control group)\n' +
      'rows,status,mount_ms,frame_interval_p50_ms,jank_pct,dom_nodes,estimated_nodes,note\n' +
      payload.unvirtualizedBaseline.rows
        .map((b) =>
          [
            b.total,
            b.status,
            Number.isFinite(b.mountMs) ? ms(b.mountMs, 1) : '',
            Number.isFinite(b.frameIntervalP50) ? ms(b.frameIntervalP50, 2) : '',
            Number.isFinite(b.jankPct) ? ms(b.jankPct, 2) : '',
            b.domNodes ?? '',
            b.estimatedNodes,
            JSON.stringify(b.note ?? ''),
          ].join(','),
        )
        .join('\n') +
      '\n';
  }
  return out;
}

export function toMarkdown(payload: ExportPayload): string {
  const e = payload.env;
  let out =
    `**cerious-scroll benchmark · Vue wrapper** · ${e?.browser ?? '?'} on ${e?.platform ?? '?'}` +
    ` · ${e?.cores ?? '?'} cores · ${e?.refreshHz ?? '?'} Hz ` +
    `(${e?.frameBudgetMs.toFixed(1) ?? '?'} ms budget)\n`;

  const table = (title: string, firstCol: string, rows: CaseResult[], label: (r: CaseResult) => string) =>
    `\n**${title}**\n\n` +
    `| ${firstCol} | Mount | Frame p50 | Frame p95 | FPS | Jank | Renders/frame | Per row | DOM nodes |\n` +
    '| :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |\n' +
    rows
      .map(
        (r) =>
          `| ${label(r)} | ${ms(r.mountMs)} ms | ${ms(r.frameWorkP50)} ms | ${ms(r.frameWorkP95)} ms` +
          ` | ${Number.isFinite(r.fps) ? Math.round(r.fps) : '—'} | ${ms(r.jankPct, 1)}%` +
          ` | ${ms(r.rendersPerFrame, 2)} | ${ms(r.usPerRender, 0)} µs | ${nf.format(r.domNodes)} |`,
      )
      .join('\n') +
    '\n';

  if (payload.scaleSweep?.rows.length) {
    out += table('Scale sweep', 'Rows', payload.scaleSweep.rows, (r) => nf.format(r.total));
  }
  if (payload.complexitySweep?.rows.length) {
    out += table(
      `Complexity sweep at ${nf.format(payload.complexitySweep.datasetSize)} rows`,
      'Row template',
      payload.complexitySweep.rows,
      (r) => r.templateLabel,
    );
  }
  if (payload.unvirtualizedBaseline?.rows.length) {
    const virt = payload.scaleSweep?.rows ?? [];
    out +=
      '\n**Unvirtualized baseline** (every row rendered with plain markup). Frame work is not ' +
      'comparable between the two, so the frame column is the wall-clock interval.\n\n' +
      '| Rows | Mount, wrapper | Mount, unvirtualized | Frame, wrapper | Frame, unvirtualized | Nodes, wrapper | Nodes, unvirtualized |\n' +
      '| ---: | ---: | ---: | ---: | ---: | ---: | ---: |\n' +
      payload.unvirtualizedBaseline.rows
        .map((b) => {
          const v = virt.find((x) => x.total === b.total);
          if (b.status !== 'ok') {
            return (
              `| ${nf.format(b.total)} | ${v ? `${ms(v.mountMs)} ms` : '—'}` +
              ` | **${b.status === 'refused' ? 'cannot be built' : 'never finished'}** | — | —` +
              ` | ${v ? nf.format(v.domNodes) : '—'} | ~${nf.format(b.estimatedNodes)} (est.) |`
            );
          }
          return (
            `| ${nf.format(b.total)} | ${v ? `${ms(v.mountMs)} ms` : '—'} | ${ms(b.mountMs, 1)} ms` +
            ` | ${v ? `${ms(v.frameIntervalP50, 1)} ms` : '—'} | ${ms(b.frameIntervalP50, 1)} ms` +
            ` | ${v ? nf.format(v.domNodes) : '—'} | ${nf.format(b.domNodes ?? 0)} |`
          );
        })
        .join('\n') +
      '\n';
  }
  return out;
}

export function downloadFile(name: string, text: string, mime: string): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function stamp(): string {
  return `cerious-scroll-vue-benchmark-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}`;
}
