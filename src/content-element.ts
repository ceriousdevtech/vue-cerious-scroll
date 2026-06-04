/**
 * DOM helpers shared by the Vue bindings.
 *
 * Copyright (c) 2024-2026 Cerious DevTech LLC. All rights reserved.
 */

/** Attribute marking the dedicated content element rows are rendered into. */
export const CONTENT_ATTR = 'data-cerious-scroll-content';

/** Attribute marking the inner mount node Vue renders each row into. */
export const ROW_ATTR = 'data-cerious-scroll-row';

/**
 * Ensure a dedicated, recyclable content element exists inside `container`.
 *
 * CeriousScroll renders/recycles row containers (clearing them with
 * `textContent`/`innerHTML`) inside this element, while the native scrollbar
 * and event listeners stay attached to the outer `container`. Keeping them
 * separate prevents the scrollbar DOM from being wiped during rendering.
 */
export function ensureContentElement(container: HTMLElement): HTMLElement {
  const existing = container.querySelector<HTMLElement>(`[${CONTENT_ATTR}]`);
  if (existing) return existing;

  const el = document.createElement('div');
  el.setAttribute(CONTENT_ATTR, '');
  el.style.position = 'relative';
  el.style.width = '100%';
  el.style.height = '100%';
  // overflow-y: clip + overflow-x: auto: clip vertical row overflow (engine
  // owns vertical) and let the inner element own the native horizontal
  // scrollbar when consumer content (e.g. wide spreadsheet) overflows.
  // Horizontal scroll must NOT move to the outer container or the cerious
  // sibling-driver vertical scrollbar (`position: absolute; right: 0` inside
  // the outer) would translate with the content. The engine reads its
  // viewport height from this element so the bottom row stays clear of the
  // h-scrollbar gutter when it appears.
  el.style.overflowY = 'clip';
  el.style.overflowX = 'auto';
  container.appendChild(el);
  return el;
}
