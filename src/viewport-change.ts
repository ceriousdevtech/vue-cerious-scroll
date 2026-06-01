/**
 * Viewport-change event bridging for the Vue bindings.
 *
 * Copyright (c) 2024-2026 Cerious DevTech LLC. All rights reserved.
 */

import type { ScrollResult } from '@ceriousdevtech/cerious-scroll';

/**
 * Normalized payload for viewport changes emitted by CeriousScroll.
 *
 * Mirrors the `cerious-viewport-change` CustomEvent dispatched on wheel/touch/
 * keyboard navigation, and normalizes the native scrollbar's `viewport-change`
 * event into the same shape.
 */
export interface CeriousViewportChangeDetail {
  /** Scroll percentage from 0..100. */
  percentage: number;
  /** Current top-most element index tracked by CeriousScroll. */
  currentElement: number;
  /** Pixel offset within `currentElement`. */
  scrollOffset: number;
  /** Scroll operation result (element + offset). */
  result: ScrollResult;
}

interface NativeScrollbarDetail {
  percentage: number;
  element: number;
  scrollOffset: number;
}

/**
 * Subscribe to both viewport-change events emitted by CeriousScroll and invoke
 * `callback` with a normalized {@link CeriousViewportChangeDetail}.
 *
 * @returns An unsubscribe function.
 */
export function subscribeViewportChange(
  container: HTMLElement,
  callback: (detail: CeriousViewportChangeDetail) => void,
): () => void {
  const onCerious = (evt: Event): void => {
    const detail = (evt as CustomEvent<CeriousViewportChangeDetail>).detail;
    if (!detail) return;
    // The engine reuses (mutates) a single detail object across wheel events as
    // a GC optimization, so the reference never changes. Copy it into a fresh
    // object before handing it off, otherwise Vue's reactivity (and React's
    // setState) bails on the unchanged reference and the value appears frozen.
    callback({
      percentage: detail.percentage,
      currentElement: detail.currentElement,
      scrollOffset: detail.scrollOffset,
      result: { element: detail.result.element, offset: detail.result.offset },
    });
  };

  const onScrollbar = (evt: Event): void => {
    const detail = (evt as CustomEvent<NativeScrollbarDetail>).detail;
    if (!detail) return;
    callback({
      percentage: detail.percentage,
      currentElement: detail.element,
      scrollOffset: detail.scrollOffset,
      result: { element: detail.element, offset: detail.scrollOffset },
    });
  };

  container.addEventListener('cerious-viewport-change', onCerious);
  container.addEventListener('viewport-change', onScrollbar);

  return () => {
    container.removeEventListener('cerious-viewport-change', onCerious);
    container.removeEventListener('viewport-change', onScrollbar);
  };
}
