/**
 * Canvas drawing for the benchmark. Plain DOM and 2D context, no framework, so
 * this file is identical across the vanilla, React, Vue and Angular builds.
 */
import {
  compactRows,
  nf,
  percentile,
  sortNum,
  type BaselineResult,
  type CaseResult,
} from './benchmark.harness';

interface Plot {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
}

/** Returns null when the canvas is hidden and therefore has no width to size against. */
function prepCanvas(canvas: HTMLCanvasElement | null): Plot | null {
  if (!canvas) return null;
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  if (!w) return null;
  const h = canvas.clientHeight || 230;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
  return { ctx, w, h };
}

function emptyChart(p: Plot, message: string): void {
  p.ctx.fillStyle = 'rgba(167,177,194,.55)';
  p.ctx.font = '12px Inter, system-ui, sans-serif';
  p.ctx.textAlign = 'center';
  p.ctx.fillText(message, p.w / 2, p.h / 2);
  p.ctx.textAlign = 'left';
}

interface Pad { l: number; r: number; t: number; b: number }

function axes(p: Plot, pad: Pad, yMax: number, yLabel?: string): void {
  const { ctx, w, h } = p;
  ctx.strokeStyle = 'rgba(255,255,255,.10)';
  ctx.fillStyle = 'rgba(167,177,194,.75)';
  ctx.lineWidth = 1;
  const ticks = 4;
  for (let i = 0; i <= ticks; i++) {
    const y = pad.t + ((h - pad.t - pad.b) * i) / ticks;
    ctx.beginPath();
    ctx.moveTo(pad.l, y + 0.5);
    ctx.lineTo(w - pad.r, y + 0.5);
    ctx.stroke();
    const v = yMax * (1 - i / ticks);
    // Keep enough decimals to separate ticks when the whole scale is sub-ms.
    const dp = yMax < 1 ? 2 : yMax < 10 ? 1 : 0;
    ctx.textAlign = 'right';
    ctx.fillText(v.toFixed(dp), pad.l - 6, y + 3);
  }
  if (yLabel) {
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(167,177,194,.6)';
    ctx.fillText(yLabel, pad.l, pad.t - 6);
  }
}

/**
 * Frame-by-frame timeline. On a healthy run the interval trace sits exactly ON
 * the budget, because the browser paces frames to the refresh rate, so the
 * region above it is shaded rather than relying on a line that would be buried
 * underneath the trace.
 */
export function drawTimeline(
  canvas: HTMLCanvasElement | null,
  row: CaseResult | null,
  frameBudgetMs: number,
): void {
  const p = prepCanvas(canvas);
  if (!p) return;
  if (!row || !row.series.intervals.length) {
    emptyChart(p, 'No run selected yet. Run a sweep, then pick a row in the Table tab.');
    return;
  }
  const pad: Pad = { l: 34, r: 10, t: 16, b: 18 };
  const { ctx } = p;
  const iv = row.series.intervals;
  const wk = row.series.work;

  const cap = Math.max(percentile(sortNum(iv), 99), frameBudgetMs * 2);
  const yMax = Math.ceil(cap * 1.15);
  const plotW = p.w - pad.l - pad.r;
  const plotH = p.h - pad.t - pad.b;
  const x = (i: number) => pad.l + (plotW * i) / Math.max(1, iv.length - 1);
  const y = (v: number) => pad.t + plotH * (1 - Math.min(v, yMax) / yMax);

  axes(p, pad, yMax, 'ms per frame');

  const budgetY = y(frameBudgetMs);
  ctx.fillStyle = 'rgba(242,198,109,.07)';
  ctx.fillRect(pad.l, pad.t, plotW, Math.max(0, budgetY - pad.t));

  const series = (data: number[], color: string, fill?: string) => {
    ctx.beginPath();
    data.forEach((v, i) => (i === 0 ? ctx.moveTo(x(i), y(v)) : ctx.lineTo(x(i), y(v))));
    if (fill) {
      ctx.lineTo(x(data.length - 1), pad.t + plotH);
      ctx.lineTo(x(0), pad.t + plotH);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
    } else {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.25;
      ctx.stroke();
    }
  };
  series(wk, '#8cb7ff', 'rgba(140,183,255,.20)');
  series(wk, '#8cb7ff');
  series(iv, '#78f3d2');

  // Budget line last, over a halo, so it is never buried under the traces.
  ctx.strokeStyle = 'rgba(8,11,18,.75)';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(pad.l, budgetY);
  ctx.lineTo(p.w - pad.r, budgetY);
  ctx.stroke();
  ctx.strokeStyle = '#f2c66d';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(pad.l, budgetY);
  ctx.lineTo(p.w - pad.r, budgetY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineWidth = 1;

  ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
  if (budgetY - pad.t > 26) {
    ctx.fillStyle = 'rgba(242,198,109,.7)';
    ctx.textAlign = 'right';
    ctx.fillText('missed frames', p.w - pad.r - 8, pad.t + 14);
  }
  ctx.fillStyle = 'rgba(167,177,194,.7)';
  ctx.textAlign = 'right';
  ctx.fillText(`${nf.format(iv.length)} frames`, p.w - pad.r, p.h - 5);
  ctx.textAlign = 'left';
  ctx.fillText(`budget ${frameBudgetMs.toFixed(1)} ms`, pad.l, p.h - 5);
}

/** Cost against dataset size, log x. Flat lines mean cost is size-independent. */
export function drawScaling(canvas: HTMLCanvasElement | null, rows: CaseResult[]): void {
  const p = prepCanvas(canvas);
  if (!p) return;
  if (!rows.length) {
    emptyChart(p, 'No scale sweep yet. Run one from step 2.');
    return;
  }
  const pad: Pad = { l: 34, r: 10, t: 16, b: 24 };
  const { ctx } = p;
  const series: [keyof CaseResult, string][] = [
    ['frameWorkP50', '#78f3d2'],
    ['mountMs', '#8cb7ff'],
    ['jumpP95', '#c9a2ff'],
  ];
  let yMax = 0;
  series.forEach(([key]) =>
    rows.forEach((r) => {
      const v = r[key] as number;
      if (Number.isFinite(v)) yMax = Math.max(yMax, v);
    }),
  );
  yMax = Math.max(yMax * 1.2, 1);

  const plotW = p.w - pad.l - pad.r;
  const plotH = p.h - pad.t - pad.b;
  const logs = rows.map((r) => Math.log10(r.total));
  const lMin = Math.min(...logs);
  const lMax = Math.max(...logs);
  const x = (i: number) =>
    lMax === lMin ? pad.l + plotW / 2 : pad.l + (plotW * (logs[i] - lMin)) / (lMax - lMin);
  const y = (v: number) => pad.t + plotH * (1 - Math.min(v, yMax) / yMax);

  axes(p, pad, yMax, 'ms');
  series.forEach(([key, color]) => {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    rows.forEach((r, i) => {
      const v = r[key] as number;
      return i === 0 ? ctx.moveTo(x(i), y(v)) : ctx.lineTo(x(i), y(v));
    });
    ctx.stroke();
    rows.forEach((r, i) => {
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.arc(x(i), y(r[key] as number), 3, 0, Math.PI * 2);
      ctx.fill();
    });
  });
  ctx.fillStyle = 'rgba(167,177,194,.75)';
  ctx.textAlign = 'center';
  rows.forEach((r, i) => ctx.fillText(compactRows(r.total), x(i), p.h - 7));
}

/** Frame cost and per-row build cost against DOM nodes per row (two y scales). */
export function drawComplexity(canvas: HTMLCanvasElement | null, input: CaseResult[]): void {
  const p = prepCanvas(canvas);
  if (!p) return;
  const rows = input.slice().sort((a, b) => a.nodesPerRow - b.nodesPerRow);
  if (!rows.length) {
    emptyChart(p, 'No complexity sweep yet. Run one from step 2.');
    return;
  }
  const pad: Pad = { l: 34, r: 34, t: 16, b: 28 };
  const { ctx } = p;
  const plotW = p.w - pad.l - pad.r;
  const plotH = p.h - pad.t - pad.b;
  const nMin = rows[0].nodesPerRow;
  const nMax = rows[rows.length - 1].nodesPerRow;
  const x = (n: number) =>
    nMax === nMin ? pad.l + plotW / 2 : pad.l + (plotW * (n - nMin)) / (nMax - nMin);

  let msMax = 0;
  let usMax = 0;
  rows.forEach((r) => {
    if (Number.isFinite(r.frameWorkP50)) msMax = Math.max(msMax, r.frameWorkP50);
    if (Number.isFinite(r.usPerRender)) usMax = Math.max(usMax, r.usPerRender);
  });
  msMax = Math.max(msMax * 1.25, 0.5);
  usMax = Math.max(usMax * 1.25, 10);

  axes(p, pad, msMax, 'ms per frame');
  ctx.fillStyle = 'rgba(201,162,255,.8)';
  ctx.textAlign = 'left';
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + (plotH * i) / 4;
    ctx.fillText((usMax * (1 - i / 4)).toFixed(0), p.w - pad.r + 5, y + 3);
  }
  ctx.fillText('µs', p.w - pad.r + 5, pad.t - 6);

  const line = (key: 'frameWorkP50' | 'usPerRender', max: number, color: string) => {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    rows.forEach((r, i) => {
      const py = pad.t + plotH * (1 - Math.min(r[key], max) / max);
      return i === 0 ? ctx.moveTo(x(r.nodesPerRow), py) : ctx.lineTo(x(r.nodesPerRow), py);
    });
    ctx.stroke();
    rows.forEach((r) => {
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.arc(x(r.nodesPerRow), pad.t + plotH * (1 - Math.min(r[key], max) / max), 3, 0, Math.PI * 2);
      ctx.fill();
    });
  };
  line('frameWorkP50', msMax, '#78f3d2');
  line('usPerRender', usMax, '#c9a2ff');

  ctx.fillStyle = 'rgba(167,177,194,.75)';
  ctx.textAlign = 'center';
  rows.forEach((r) => ctx.fillText(String(r.nodesPerRow), x(r.nodesPerRow), p.h - 14));
  ctx.fillText('DOM nodes per row', pad.l + plotW / 2, p.h - 2);
}

/**
 * Resident DOM nodes for both engines, log-log. Sizes the control group could
 * not build are drawn as a hollow marker on their estimated count, so a refusal
 * still appears on the curve instead of vanishing from it.
 */
export function drawBaseline(
  canvas: HTMLCanvasElement | null,
  baseline: BaselineResult[],
  virt: CaseResult[],
): void {
  const p = prepCanvas(canvas);
  if (!p) return;
  if (!baseline.length) {
    emptyChart(p, 'No baseline measured yet. Enable it in step 1 and run the scale sweep.');
    return;
  }
  const pad: Pad = { l: 52, r: 14, t: 16, b: 30 };
  const { ctx } = p;
  const points = baseline
    .map((b) => {
      const v = virt.find((x2) => x2.total === b.total);
      return {
        total: b.total,
        virt: v ? v.domNodes : NaN,
        plain: b.status === 'ok' ? (b.domNodes ?? 0) : b.estimatedNodes,
        real: b.status === 'ok',
      };
    })
    .filter((pt) => Number.isFinite(pt.virt) || Number.isFinite(pt.plain));
  if (!points.length) {
    emptyChart(p, 'Not enough data to plot.');
    return;
  }

  const plotW = p.w - pad.l - pad.r;
  const plotH = p.h - pad.t - pad.b;
  const xs = points.map((pt) => Math.log10(pt.total));
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const x = (i: number) =>
    xMax === xMin ? pad.l + plotW / 2 : pad.l + (plotW * (xs[i] - xMin)) / (xMax - xMin);

  let yTop = 1;
  points.forEach((pt) => {
    yTop = Math.max(yTop, pt.virt || 1, pt.plain || 1);
  });
  const yMaxLog = Math.ceil(Math.log10(yTop));
  const y = (v: number) => pad.t + plotH * (1 - Math.log10(Math.max(v, 1)) / yMaxLog);

  ctx.strokeStyle = 'rgba(255,255,255,.10)';
  ctx.fillStyle = 'rgba(167,177,194,.75)';
  ctx.lineWidth = 1;
  for (let d = 0; d <= yMaxLog; d++) {
    const yy = y(Math.pow(10, d));
    ctx.beginPath();
    ctx.moveTo(pad.l, yy + 0.5);
    ctx.lineTo(p.w - pad.r, yy + 0.5);
    ctx.stroke();
    ctx.textAlign = 'right';
    ctx.fillText(compactRows(Math.pow(10, d)), pad.l - 6, yy + 3);
  }
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(167,177,194,.6)';
  ctx.fillText('resident DOM nodes', pad.l, pad.t - 6);

  const series = (key: 'virt' | 'plain', color: string) => {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    points.forEach((pt, i) => (i === 0 ? ctx.moveTo(x(i), y(pt[key])) : ctx.lineTo(x(i), y(pt[key]))));
    ctx.stroke();
    points.forEach((pt, i) => {
      ctx.beginPath();
      ctx.arc(x(i), y(pt[key]), 3.5, 0, Math.PI * 2);
      if (key === 'plain' && !pt.real) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        ctx.fillStyle = color;
        ctx.fill();
      }
    });
  };
  series('virt', '#78f3d2');
  series('plain', '#ff8d8d');

  ctx.fillStyle = 'rgba(167,177,194,.75)';
  ctx.textAlign = 'center';
  points.forEach((pt, i) => ctx.fillText(compactRows(pt.total), x(i), p.h - 14));
  ctx.fillText('dataset size', pad.l + plotW / 2, p.h - 2);

  if (points.some((pt) => !pt.real)) {
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,141,141,.8)';
    ctx.fillText('hollow = estimated, could not be built', p.w - pad.r, pad.t - 6);
  }
}
