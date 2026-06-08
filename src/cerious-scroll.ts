/**
 * <CeriousScroll> - declarative Vue 3 component for @ceriousdevtech/cerious-scroll.
 *
 * Copyright (c) 2024-2026 Cerious DevTech LLC. All rights reserved.
 */

import { defineComponent, h, type PropType, type VNodeChild } from 'vue';
import type {
  CeriousScrollOptions,
  MeasuredViewportRange,
} from '@ceriousdevtech/cerious-scroll';

import { useCeriousScroll } from './use-cerious-scroll';
import type { CeriousViewportChangeDetail } from './viewport-change';

/**
 * High-performance virtual scroll list. Provide `items` (or `total-elements` +
 * `get-item`) and either an `#item` scoped slot or a `render-item` prop; give
 * the container a height (e.g. `:style="{ height: '400px' }"`).
 *
 * Imperative methods (`render`, `jumpToElement`, `scrollToPercentage`, `reset`,
 * `recalculate`) and the underlying `scroller` are available via a template ref.
 *
 * ```vue
 * <CeriousScroll :items="items" :style="{ height: '400px' }">
 *   <template #item="{ item, index }">
 *     <div class="row">{{ index }} — {{ item.name }}</div>
 *   </template>
 * </CeriousScroll>
 * ```
 */
export const CeriousScroll = defineComponent({
  name: 'CeriousScroll',
  props: {
    /** Total item count. Falls back to `items.length` when omitted. */
    totalElements: { type: Number as PropType<number | null>, default: null },
    /** Optional items array (passed to the row template as `item`). */
    items: { type: Array as unknown as PropType<readonly unknown[] | null>, default: null },
    /** Optional lazy getter for very large/sparse datasets (alternative to `items`). */
    getItem: { type: Function as PropType<(index: number) => unknown>, default: undefined },
    /** Render prop alternative to the `#item` scoped slot. */
    renderItem: {
      type: Function as PropType<(item: unknown, index: number) => VNodeChild>,
      default: undefined,
    },
    /** Options forwarded to `new CeriousScroll(...)` (read once, at creation). */
    options: { type: Object as PropType<CeriousScrollOptions>, default: undefined },
    /** Automatically render after scroll/resize/data changes. Default: `true`. */
    autoRender: { type: Boolean, default: true },
  },
  emits: {
    /** Normalized viewport-change payload (wheel/touch/keyboard/scrollbar). */
    'viewport-change': (_detail: CeriousViewportChangeDetail) => true,
    /** Measured range after each render pass. */
    'measured-viewport': (_range: MeasuredViewportRange) => true,
    /** Emitted once the underlying engine instance is ready (and after recreation). */
    ready: (_scroller: unknown) => true,
  },
  setup(props, { slots, emit, expose }) {
    const renderItem = (item: unknown, index: number): VNodeChild => {
      if (props.renderItem) return props.renderItem(item, index);
      return slots.item?.({ item, index });
    };

    const api = useCeriousScroll<unknown>({
      totalElements: () => props.totalElements,
      items: () => props.items,
      getItem: props.getItem ? (index: number) => props.getItem!(index) : undefined,
      renderItem,
      // Table mode: declarative header. Render the `#header` slot (a <tr> of
      // <th>s) into the engine's <thead>. `undefined` when no slot is provided.
      renderHeader: slots.header ? () => slots.header!() : undefined,
      // Engine options are consumed at creation; reading the prop once matches
      // that contract (remount via `:key` to apply new engine options).
      options: props.options,
      autoRender: () => props.autoRender,
      onViewportChange: (detail) => emit('viewport-change', detail),
      onMeasuredViewport: (range) => emit('measured-viewport', range),
      onReady: (scroller) => emit('ready', scroller),
    });

    expose({
      /** The underlying engine instance (`null` before mount). */
      scroller: api.scroller,
      render: api.render,
      jumpToElement: api.jumpToElement,
      scrollToPercentage: api.scrollToPercentage,
      reset: api.reset,
      recalculate: api.recalculate,
    });

    return () =>
      h(
        'div',
        {
          ref: api.containerRef,
          // User-supplied class/style/attrs fall through and merge onto this root.
          style: { position: 'relative', overflow: 'hidden' },
        },
        slots.default?.(),
      );
  },
});
