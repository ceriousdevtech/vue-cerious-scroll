/**
 * useCeriousScroll - Vue 3 composable binding for @ceriousdevtech/cerious-scroll.
 *
 * Copyright (c) 2024-2026 Cerious DevTech LLC. All rights reserved.
 */

import {
  Fragment,
  effectScope,
  getCurrentInstance,
  h,
  isVNode,
  onBeforeUnmount,
  onMounted,
  ref,
  render as renderVNode,
  shallowRef,
  toValue,
  watch,
  watchEffect,
  type AppContext,
  type MaybeRefOrGetter,
  type Ref,
  type VNodeChild,
} from 'vue';
import {
  CeriousScroll as CeriousScrollEngine,
  type CeriousScrollOptions,
  type ElementRenderer,
  type MeasuredViewportRange,
} from '@ceriousdevtech/cerious-scroll';

import { ROW_ATTR, ensureContentElement } from './content-element';
import {
  subscribeViewportChange,
  type CeriousViewportChangeDetail,
} from './viewport-change';

export interface UseCeriousScrollOptions<TItem = unknown> {
  /** Total number of items. Falls back to `items.length` when omitted. */
  totalElements?: MaybeRefOrGetter<number | null | undefined>;
  /** Optional items array (passed to `renderItem` as the first argument). */
  items?: MaybeRefOrGetter<readonly TItem[] | null | undefined>;
  /** Optional getter for very large/sparse datasets (alternative to `items`). */
  getItem?: (index: number) => TItem;
  /** Renders a single row to a Vue VNode. `item` is `undefined` with no data source. */
  renderItem: (item: TItem, index: number) => VNodeChild;
  /**
   * Table mode only: renders the header (a `<tr>` of `<th>`s) into the engine's
   * `<thead>`. Reactive — re-renders when its dependencies change.
   */
  renderHeader?: () => VNodeChild;
  /** Options forwarded to `new CeriousScroll(...)` (read once, at creation). */
  options?: CeriousScrollOptions;
  /** Automatically render after scroll/resize/data changes. Default: `true`. */
  autoRender?: MaybeRefOrGetter<boolean | undefined>;
  /** Invoked with the normalized viewport-change payload. */
  onViewportChange?: (detail: CeriousViewportChangeDetail) => void;
  /** Invoked with the measured range after each render pass. */
  onMeasuredViewport?: (range: MeasuredViewportRange) => void;
  /** Invoked once the underlying engine instance is ready (and after recreation). */
  onReady?: (scroller: CeriousScrollEngine) => void;
}

export interface UseCeriousScrollResult {
  /** Attach to the scroll container element (`<div :ref="containerRef">`). */
  containerRef: Ref<HTMLElement | null>;
  /** The underlying engine instance (`null` before mount / after unmount). */
  scroller: Ref<CeriousScrollEngine | null>;
  /** Imperatively trigger a render pass. */
  render: () => MeasuredViewportRange | null;
  /** Jump to an element index, then render. */
  jumpToElement: (index: number) => MeasuredViewportRange | null;
  /** Scroll to a percentage (0..100), then render. */
  scrollToPercentage: (percentage: number) => MeasuredViewportRange | null;
  /** Reset to the top, then render. */
  reset: () => MeasuredViewportRange | null;
  /**
   * Discard all cached row heights and re-measure the viewport.
   *
   * Call this only when the heights of rows you've *already rendered* may have
   * changed without their indices changing — e.g. a global font/density change,
   * or swapping every row to a different layout. This forces a synchronous
   * re-measure (one `offsetHeight` read per visible row), so do NOT call it on
   * routine edits: a single cell edit doesn't need it (its row keeps its size,
   * and the engine's ResizeObserver picks up any incidental resize on its own).
   */
  recalculate: () => MeasuredViewportRange | null;
}

interface RowEntry {
  el: HTMLElement;
  // Our own wrapper <div> (a `display: contents` wrapper in table mode).
  mount: HTMLElement;
  /** Stops the row's reactive render effect. */
  stop: () => void;
}

interface Host {
  scroller: CeriousScrollEngine;
  contentEl: HTMLElement;
  container: HTMLElement;
  unsubscribe: () => void;
}

function resolveTotal(
  total: number | null | undefined,
  len: number | null | undefined,
): number {
  const candidate =
    typeof total === 'number' ? total : typeof len === 'number' ? len : undefined;
  if (candidate === undefined || Number.isNaN(candidate)) {
    throw new Error('useCeriousScroll: provide `totalElements` or `items`.');
  }
  // CeriousScroll requires totalElements >= 1.
  return Math.max(1, Math.floor(candidate));
}

/**
 * Bind a CeriousScroll engine to a container and render rows with Vue.
 *
 * Each row is rendered into an inner mount node (which lives inside the engine's
 * recyclable container) via Vue's synchronous `render(vnode, el)`, so the engine
 * measures the row's real height — no estimation. Because rendering is
 * synchronous, no `flushSync`-style escape hatch is needed.
 *
 * Rows are rendered with the host component's `appContext`, so globally
 * registered components, directives, and installed plugins are available inside
 * each row.
 */
export function useCeriousScroll<TItem = unknown>(
  opts: UseCeriousScrollOptions<TItem>,
): UseCeriousScrollResult {
  const appContext: AppContext | undefined = getCurrentInstance()?.appContext;

  const containerRef = ref<HTMLElement | null>(null);
  const scroller = shallowRef<CeriousScrollEngine | null>(null);

  let host: Host | null = null;
  const rows = new Map<number, RowEntry>();
  let savedPos: { currentElement: number; scrollOffset: number } | null = null;

  // In table mode the engine's row element is a real <tr>. We still render into
  // our own inner mount (isolated from the engine's <tr> recycling), but make
  // that mount `display: contents` so its <td>s lay out as the row's cells.
  // Engine options are read once at creation, so this is stable for the instance.
  const tableMode = opts.options?.layout === 'table';

  // Table-mode declarative header: render the `renderHeader` vnode into the
  // engine's <thead> (captured via the table.header hook) in its own reactive
  // effect, so an interactive header (sort state, etc.) updates on its own.
  let headerStop: (() => void) | null = null;
  const mountHeader = (thead: HTMLElement): void => {
    if (!opts.renderHeader) return;
    headerStop?.();
    const ctx = appContext ?? null;
    const scope = effectScope(true);
    scope.run(() =>
      watchEffect(
        () => {
          const content = opts.renderHeader!();
          const children: VNodeChild[] = Array.isArray(content) ? content : [content];
          for (const child of children) if (isVNode(child)) child.appContext = ctx;
          const vnode = h(Fragment, children);
          vnode.appContext = ctx;
          renderVNode(vnode, thead);
        },
        { flush: 'sync' },
      ),
    );
    headerStop = () => scope.stop();
  };

  // Each rendered row gets its own reactive render effect (below) so that a
  // `renderItem`/slot which reads external reactive state (selection, expand
  // flags, live data, the `items` array) re-renders automatically — just like
  // React re-renders on state change and Angular via change detection. The
  // engine's content observer then reflows on any resulting height change.
  //
  // Each row owns a *dedicated* detached effect scope that is fully stopped when
  // the row is recycled out of the viewport. A single shared scope would be
  // simpler, but stopping an individual `watchEffect` does NOT remove it from
  // its scope's internal `effects` array — so over a long scroll (thousands of
  // rows mounted/unmounted) that array would grow without bound. A per-row scope
  // is released in its entirety on unmount, so nothing accumulates.

  const isAutoRender = (): boolean => toValue(opts.autoRender) ?? true;

  const getItem = (index: number): TItem => {
    if (opts.getItem) return opts.getItem(index);
    const items = toValue(opts.items);
    return (items ? items[index] : undefined) as TItem;
  };

  // Render this row's content into its mount node and re-render it whenever any
  // reactive dependency it reads (the row item, or external state the
  // `renderItem`/slot closes over) changes. Returns a stop handle. The first run
  // is synchronous (`flush: 'sync'`), so the engine measures a real height right
  // after the renderer returns; later runs are synchronous too, so an external
  // state change updates the DOM immediately and the engine's content observer
  // can pick up any height change. Vue diffs against the previous vnode on the
  // mount, so re-renders preserve DOM state (focus, selection, open dropdowns).
  const mountReactiveRow = (index: number, mount: HTMLElement): (() => void) => {
    const ctx = appContext ?? null;
    const scope = effectScope(true);
    scope.run(() =>
      watchEffect(
        () => {
          const content = opts.renderItem(getItem(index), index);
          // Scoped slots return an array of VNodes; a render prop may return a
          // single VNode, an array, a string, etc. Normalize to a Fragment so
          // `render()` always gets one root vnode (no extra wrapper element).
          // Attach the host's appContext so globally-registered components /
          // directives / installed plugins resolve inside the row.
          const children: VNodeChild[] = Array.isArray(content) ? content : [content];
          for (const child of children) {
            if (isVNode(child)) child.appContext = ctx;
          }
          const vnode = h(Fragment, children);
          vnode.appContext = ctx;
          renderVNode(vnode, mount);
        },
        { flush: 'sync' },
      ),
    );
    // Stopping the scope disposes the row's effect and removes it entirely (no
    // residue accumulates across the lifetime of the scroller).
    return () => scope.stop();
  };

  const unmountRow = (entry: RowEntry): void => {
    // Stop the reactive effect, tear down the Vue render tree, detach the mount.
    // The mount is always our own element (a <div>, `display: contents` in table
    // mode), so this is safe even after the engine has recycled the host <tr>.
    entry.stop();
    renderVNode(null, entry.mount);
    entry.mount.remove();
  };

  const render = (): MeasuredViewportRange | null => {
    if (!host) return null;
    const { scroller: instance, contentEl, container } = host;
    const height = container.clientHeight || container.offsetHeight || 0;

    const renderer: ElementRenderer = (index, el) => {
      // The engine hands us a freshly-cleaned container. In div mode we render
      // into a dedicated inner mount so the engine's own DOM recycling
      // (textContent/innerHTML clearing) never tears nodes out from under Vue. In
      // table mode the engine's element is the <tr> itself and the row's <td>s
      // must render straight into it. Vue's `render()` mounts synchronously, so
      // the engine measures a real height.
      // Always render into a dedicated inner mount that Vue fully owns, so the
      // engine's DOM recycling (textContent/innerHTML clearing, <tr> reuse across
      // indices) never tears nodes out from under Vue. In table mode the engine's
      // element is a real <tr>; the mount is a `display: contents` wrapper so its
      // <td> children still lay out as the row's cells while staying isolated.
      const mount = document.createElement('div');
      if (tableMode) mount.style.display = 'contents';
      mount.setAttribute(ROW_ATTR, String(index));
      el.appendChild(mount);
      const stop = mountReactiveRow(index, mount);
      rows.set(index, { el, mount, stop });
    };

    const range = instance.renderViewport(height, contentEl, renderer);

    // Drop rows the engine no longer renders and unmount their Vue trees.
    const active = new Set(instance.getRenderedIndices());
    rows.forEach((entry, index) => {
      if (!active.has(index)) {
        unmountRow(entry);
        rows.delete(index);
      }
    });

    opts.onMeasuredViewport?.(range);
    return range;
  };

  const teardown = (rememberPosition: boolean): void => {
    if (!host) return;
    const current = host;
    host = null;

    current.unsubscribe();

    if (rememberPosition) {
      savedPos = {
        currentElement: current.scroller.currentElement,
        scrollOffset: current.scroller.scrollOffset,
      };
    }

    // Unmount all row Vue trees (and the header) before disposing the engine.
    rows.forEach((entry) => unmountRow(entry));
    rows.clear();
    headerStop?.();
    headerStop = null;

    current.contentEl.textContent = '';
    current.scroller.detachScrollbar(current.container);
    current.scroller.dispose();

    scroller.value = null;
  };

  const init = (container: HTMLElement): void => {
    const contentEl = ensureContentElement(container);
    const userOptions = opts.options ?? {};
    const userOnScroll = userOptions.onScroll;
    const mergedOptions: CeriousScrollOptions = {
      ...userOptions,
      onScroll: () => {
        userOnScroll?.();
        if (isAutoRender()) render();
      },
    };

    // Table mode: capture the engine-created <thead> and render the declarative
    // header into it (also running any user-provided header hook).
    if (tableMode && opts.renderHeader) {
      const userHeader = userOptions.table?.header;
      mergedOptions.table = {
        ...userOptions.table,
        header: (thead) => {
          userHeader?.(thead);
          mountHeader(thead);
        },
      };
    }

    const total = resolveTotal(toValue(opts.totalElements), toValue(opts.items)?.length ?? null);
    const instance = new CeriousScrollEngine(container, total, mergedOptions);

    // Restore scroll position across recreations (data-size changes).
    if (savedPos) {
      instance.currentElement = Math.min(savedPos.currentElement, total - 1);
      instance.scrollOffset = savedPos.scrollOffset;
      savedPos = null;
    }

    const unsubscribe = subscribeViewportChange(container, (detail) => {
      opts.onViewportChange?.(detail);
    });

    // Container resize (re-render, re-anchor, scrollbar re-sync) is handled by
    // the engine itself: its ResizeController observes the container and calls
    // back through the merged `onScroll` above. No wrapper-side observer needed.

    host = { scroller: instance, contentEl, container, unsubscribe };
    scroller.value = instance;

    opts.onReady?.(instance);

    if (isAutoRender()) {
      requestAnimationFrame(() => render());
    }
  };

  const recreate = (): void => {
    teardown(true);
    const container = containerRef.value;
    if (container) init(container);
  };

  onMounted(() => {
    const container = containerRef.value;
    if (container) init(container);
  });

  onBeforeUnmount(() => {
    // teardown() unmounts every row, and each row stops its own effect scope, so
    // there is no shared scope left to dispose here.
    teardown(false);
  });

  // React to a change in the item *count*: recreate the engine (the index→item
  // mapping may have shifted, so cached heights are untrustworthy). A same-count
  // data change needs nothing here — each row's reactive effect re-renders on
  // its own (it reads `items`/`getItem`), and the engine's content observer
  // reflows if any height changed.
  watch(
    () => [toValue(opts.totalElements), toValue(opts.items)] as const,
    () => {
      if (!host) return;
      const total = resolveTotal(toValue(opts.totalElements), toValue(opts.items)?.length ?? null);
      if (host.scroller.totalElements !== total) {
        recreate();
      }
    },
  );

  const jumpToElement = (index: number): MeasuredViewportRange | null => {
    if (!host) return null;
    host.scroller.jumpToElement(index);
    return render();
  };

  const scrollToPercentage = (percentage: number): MeasuredViewportRange | null => {
    if (!host) return null;
    host.scroller.handleScrollPercentage(percentage);
    return render();
  };

  const reset = (): MeasuredViewportRange | null => {
    if (!host) return null;
    host.scroller.reset();
    return render();
  };

  const recalculate = (): MeasuredViewportRange | null => {
    if (!host) return null;
    // Rows re-render themselves reactively, and the engine's content observer
    // reflows on any in-place height change, so this is rarely needed. It remains
    // as an explicit "drop every cached height and re-measure from scratch"
    // escape hatch: the engine re-measures and re-caches the rendered rows during
    // the pass and refreshes the scroll percentage.
    host.scroller.clearAllCaches();
    return render();
  };

  return {
    containerRef,
    scroller,
    render,
    jumpToElement,
    scrollToPercentage,
    reset,
    recalculate,
  };
}
