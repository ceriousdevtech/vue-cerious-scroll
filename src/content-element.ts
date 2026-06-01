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
  el.style.overflow = 'hidden';
  container.appendChild(el);
  return el;
}
