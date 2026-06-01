/**
 * Vitest/jsdom setup.
 *
 * jsdom performs no layout, so element heights are always 0 — which would make
 * CeriousScroll's measurement-driven renderer (which fills the viewport by
 * accumulating measured heights) never terminate. We provide deterministic,
 * non-zero measurements: row containers report 30px, everything else 300px.
 */

Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
  configurable: true,
  get(this: HTMLElement) {
    return this.hasAttribute('data-element-index') ? 30 : 300;
  },
});

Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
  configurable: true,
  get() {
    return 300;
  },
});

if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 0) as unknown as number) as typeof requestAnimationFrame;
  globalThis.cancelAnimationFrame = ((id: number) =>
    clearTimeout(id)) as typeof cancelAnimationFrame;
}
