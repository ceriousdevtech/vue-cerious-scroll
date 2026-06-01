/**
 * @ceriousdevtech/vue-cerious-scroll
 *
 * Vue 3 bindings for the CeriousScroll virtual scrolling engine.
 *
 * Copyright (c) 2024-2026 Cerious DevTech LLC. All rights reserved.
 */

export { CeriousScroll } from './cerious-scroll';

export { useCeriousScroll } from './use-cerious-scroll';
export type {
  UseCeriousScrollOptions,
  UseCeriousScrollResult,
} from './use-cerious-scroll';

export type { CeriousViewportChangeDetail } from './viewport-change';

// Re-export the underlying engine (aliased to avoid clashing with the Vue
// <CeriousScroll> component) plus its public types, for advanced usage.
export { CeriousScroll as CeriousScrollEngine } from '@ceriousdevtech/cerious-scroll';
export type {
  CeriousScrollOptions,
  KeyboardNavigationOptions,
  TouchNavigationOptions,
  WheelNavigationOptions,
  ElementRenderer,
  ElementHeightCalculator,
  ScrollResult,
  MeasuredViewportRange,
} from '@ceriousdevtech/cerious-scroll';
