# @ceriousdevtech/vue-cerious-scroll

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Vue 3 bindings for [Cerious Scroll™](https://www.npmjs.com/package/@ceriousdevtech/cerious-scroll)** — high-performance virtual scrolling with **O(1) memory**, consistent **60 FPS+**, and **native variable-height support with no height estimation**.

Rows are rendered into the engine's own measured containers via Vue's synchronous `render()`, so every row's real height is measured (never estimated) — exactly the guarantee that makes CeriousScroll precise. Rows are rendered with your app's `appContext`, so **globally registered components, directives, and installed plugins work normally** inside each row.

---

## Installation

```bash
npm install @ceriousdevtech/vue-cerious-scroll @ceriousdevtech/cerious-scroll
```

`vue` (>= 3.3) is a peer dependency.

---

## Demo

A runnable demo lives in `demo/` (100,000 rows, fixed/variable-height toggle,
imperative jump-to-row, and live viewport stats). From the repo root:

```bash
npm install
npm run demo        # dev server with HMR
npm run demo:build  # production build to demo/dist
```

The demo imports the wrapper by its package name, aliased to the library source,
so edits to `src/` are reflected live.

---

## Quick start (component)

Give the container a height; provide `items` and an `#item` scoped slot.

```vue
<script setup lang="ts">
import { CeriousScroll } from '@ceriousdevtech/vue-cerious-scroll';

const items = Array.from({ length: 1_000_000 }, (_, i) => ({ id: i, name: `Item ${i}` }));
</script>

<template>
  <CeriousScroll :items="items" :style="{ height: '480px' }">
    <template #item="{ item, index }">
      <div class="row">{{ index }} — {{ item.name }}</div>
    </template>
  </CeriousScroll>
</template>
```

Variable heights need no configuration — just render rows of whatever height; the
engine measures each one.

### Without a full array (huge / sparse data)

```vue
<CeriousScroll
  :total-elements="100_000_000"
  :get-item="(index) => loadRow(index)"
  :style="{ height: '600px' }"
>
  <template #item="{ item, index }">
    <Row :data="item" :index="index" />
  </template>
</CeriousScroll>
```

---

## Composable

`useCeriousScroll` gives you full control. Attach `containerRef` to your scroll
element; the composable renders the rows imperatively into the engine's measured
containers.

```vue
<script setup lang="ts">
import { h } from 'vue';
import { useCeriousScroll } from '@ceriousdevtech/vue-cerious-scroll';

const { containerRef } = useCeriousScroll({
  items,
  renderItem: (item, index) => h('div', { class: 'row' }, `${index} — ${item.name}`),
});
</script>

<template>
  <div ref="containerRef" style="height: 480px; position: relative; overflow: hidden" />
</template>
```

> `renderItem` returns a Vue `VNodeChild` (use `h(...)`, or render JSX/TSX).

---

## Component props

| Prop | Type | Description |
| --- | --- | --- |
| `items` | `readonly TItem[]` | Optional data array. `totalElements` defaults to `items.length`. |
| `totalElements` | `number` | Total item count. Required if `items` is omitted. |
| `getItem` | `(index) => TItem` | Lazy item getter for large/sparse datasets. |
| `renderItem` | `(item, index) => VNodeChild` | Render prop alternative to the `#item` scoped slot. |
| `options` | `CeriousScrollOptions` | Engine options (keyboard/touch/wheel/scrollbar/etc.). Read once at creation. |
| `autoRender` | `boolean` | Re-render on scroll/resize/data changes. Default `true`. |

The row is provided by the **`#item` scoped slot** (`{ item, index }`) or the
`render-item` prop. Apply `class` / `style` directly to the component — they fall
through onto the scroll container (set a height!).

### Events

| Event | Payload | Description |
| --- | --- | --- |
| `viewport-change` | `CeriousViewportChangeDetail` | Normalized viewport-change (wheel/touch/keyboard/scrollbar). |
| `measured-viewport` | `MeasuredViewportRange` | Measured range after each render pass. |
| `ready` | `CeriousScrollEngine` | The underlying engine instance, once ready. |

### Imperative API (via template `ref`)

```ts
const scroll = ref<InstanceType<typeof CeriousScroll> | null>(null);
// scroll.value?.jumpToElement(500);
// scroll.value?.scrollToPercentage(50);
// scroll.value?.reset();
// scroll.value?.render();
// scroll.value?.recalculate(); // drop cached heights + re-measure (see Notes)
// scroll.value?.scroller;      // the raw engine
```

---

## Notes

- **No height estimation.** Rows are committed with Vue's synchronous `render()`
  so the engine measures real `offsetHeight`. Later size changes are picked up by
  the engine's built-in `ResizeObserver`.
- **`options` are read at creation.** Changing `options` after mount has no
  effect; remount (e.g. with a `:key`) to apply new engine options.
- **Changing the item count** recreates the engine internally (scroll position
  is preserved). Mutating items without changing the count just re-renders the
  content in place (cheap; Vue patches each row, so focus/selection survive) — it
  does **not** discard cached heights, so editable grids that produce a new
  `items` array on every edit don't trigger a full viewport re-measure.
- **If every rendered row's height changes at once** (e.g. a density/layout
  switch) the cached heights become stale and rows can misalign until the next
  scroll. Call `recalculate()` (on the template `ref`, or from the composable
  result) right after the change to drop the height cache and re-measure. Don't
  call it on routine edits — a single cell edit keeps its row's size, and the
  engine's built-in `ResizeObserver` picks up any incidental resize on its own.

---

## License

Licensed by **Cerious DevTech LLC** under the **MIT License** (see `LICENSE-MIT`).

📧 info@ceriousdevtech.com
