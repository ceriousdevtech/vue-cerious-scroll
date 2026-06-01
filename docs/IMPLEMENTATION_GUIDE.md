# vue-cerious-scroll Implementation Guide

**Copyright (c) 2024-2026 Cerious DevTech LLC. All rights reserved.**

---

## Table of Contents

1. [How the Composable Works Internally](#how-the-composable-works-internally)
2. [Modifying the Render Pipeline](#modifying-the-render-pipeline)
3. [Adding New Imperative Methods](#adding-new-imperative-methods)
4. [Props That Recreate the Engine vs Props That Don't](#props-that-recreate-the-engine-vs-props-that-dont)
5. [Testing](#testing)
6. [Common Pitfalls](#common-pitfalls)
7. [Build and Release](#build-and-release)

---

## How the Composable Works Internally

`useCeriousScroll` owns the full lifecycle of one `CeriousScrollEngine` instance. Here is what happens from mount to unmount:

### Mount (`onMounted` → `init`)

1. `ensureContentElement(container)` creates (or finds) a `data-cerious-scroll-content` child inside the container. This is the rendering target passed to the engine — separate from the native scrollbar DOM so the engine's `textContent` clearing never wipes the scrollbar.
2. `new CeriousScrollEngine(container, total, mergedOptions)` is called. `mergedOptions` wraps the user's `onScroll` callback so the composable's `render()` is triggered after every scroll event.
3. `subscribeViewportChange(container, ...)` attaches a DOM event listener and forwards the payload to `onViewportChange`.
4. `requestAnimationFrame(() => render())` schedules the first render pass.

### Render Pass

The `render()` function:

1. Calls `instance.renderViewport(height, contentEl, renderer)`.
2. The `renderer` callback is invoked by the engine once per row:
   - Creates a mount node `<div data-cerious-scroll-row="N">`.
   - Calls `mountReactiveRow(index, mount)` which runs Vue's `render(vnode, mount)` synchronously — the DOM is committed before the callback returns.
   - Stores `{ el, mount, stop }` in the `rows` Map.
3. After `renderViewport` returns, pruning runs: rows not in `getRenderedIndices()` are unmounted and removed.
4. `opts.onMeasuredViewport?.(range)` is called.

### Per-Row Lifecycle (`mountReactiveRow`)

```typescript
const scope = effectScope(true);
scope.run(() =>
  watchEffect(
    () => {
      const vnode = h(Fragment, [opts.renderItem(getItem(index), index)]);
      vnode.appContext = appContext ?? null;
      renderVNode(vnode, mount);
    },
    { flush: 'sync' }
  )
);
return () => scope.stop();
```

- `effectScope(true)` creates a detached scope (not tied to the component's lifecycle — the composable manages teardown explicitly).
- `watchEffect(..., { flush: 'sync' })` runs immediately (synchronously) when the scope is created, and re-runs synchronously whenever any reactive dependency it reads changes.
- `scope.stop()` fully disposes the scope and removes it from the reactive system with no residue.

### Unmount (`onBeforeUnmount` → `teardown(false)`)

1. All rows are unmounted via `unmountRow` (stops scope, `renderVNode(null, mount)`, `mount.remove()`).
2. `rows.clear()`.
3. `contentEl.textContent = ''`.
4. `scroller.detachScrollbar(container)`.
5. `scroller.dispose()`.
6. `host = null`, `scroller.value = null`.

### Engine Recreation (item count change)

`watch([totalElements, items.length])` fires. If the resolved count changed:
1. `teardown(true)` — saves scroll position to `savedPos`.
2. `init(container)` — new engine, restores position from `savedPos`.

---

## Modifying the Render Pipeline

The render pipeline lives in the `render()` function inside `useCeriousScroll`. It is a plain function (no dependency array — all state is in closure variables).

**Adding a pre-render hook:**

```typescript
const render = (): MeasuredViewportRange | null => {
  if (!host) return null;
  opts.onBeforeRender?.();   // add this
  const { scroller: instance, contentEl, container } = host;
  // ...rest of existing render body
};
```

**Customizing how rows are mounted:** `mountReactiveRow` is a standalone inner function. To change how the vnode is built (e.g. wrapping every row in a provider component), modify the closure:

```typescript
const mountReactiveRow = (index: number, mount: HTMLElement): (() => void) => {
  const ctx = appContext ?? null;
  const scope = effectScope(true);
  scope.run(() =>
    watchEffect(
      () => {
        // Wrap in a provider:
        const rowContent = opts.renderItem(getItem(index), index);
        const vnode = h(MyProvider, { value: providerValue }, () => rowContent);
        vnode.appContext = ctx;
        renderVNode(vnode, mount);
      },
      { flush: 'sync' },
    ),
  );
  return () => scope.stop();
};
```

---

## Adding New Imperative Methods

The imperative API is defined in `UseCeriousScrollResult` and exposed via `expose()` in the component.

**Steps to add a method** (example: `scrollToTop`):

1. Add to `useCeriousScroll`:

```typescript
// Inside useCeriousScroll, alongside jumpToElement etc.
const scrollToTop = (): MeasuredViewportRange | null => {
  if (!host) return null;
  host.scroller.reset();
  return render();
};

// Add to UseCeriousScrollResult interface
scrollToTop: () => MeasuredViewportRange | null;

// Return it
return { containerRef, scroller, render, jumpToElement, scrollToPercentage, reset, recalculate, scrollToTop };
```

2. Expose it from the component:

```typescript
// cerious-scroll.ts, inside setup()
expose({
  scroller: api.scroller,
  render: api.render,
  // ...existing
  scrollToTop: api.scrollToTop,
});
```

---

## Props That Recreate the Engine vs Props That Don't

| Prop / input | Change behavior |
|---|---|
| `totalElements` / `items.length` | **Recreates engine** — `watch` fires `recreate()` |
| `items` (same length, new reference) | Re-renders — existing row `watchEffect`s re-run via reactivity |
| `getItem` (new reference) | Re-renders — but only if rows read it reactively (plain function, not reactive) |
| `renderItem` (new reference) | Picked up on next `watchEffect` run — no recreation |
| `options` | Read once at creation — **no effect**; remount (`:key`) to change engine options |
| `autoRender` | `MaybeRefOrGetter` — changing it takes effect on the next scroll event |
| `onViewportChange` / `onMeasuredViewport` / `onReady` | Direct closures — always fresh, no recreation |

---

## Testing

Tests live in `test/cerious-scroll.test.ts`. The suite uses Vitest + `@vue/test-utils`.

**Running tests:**

```bash
npm test          # watch mode
npm run test:run  # CI / single pass
```

**Key testing patterns:**

```typescript
// Mount with a fixed-height container wrapper
const wrapper = mount(CeriousScroll, {
  props: {
    items,
    style: { height: '400px' },
  },
  slots: {
    item: ({ item, index }) => h('div', { style: 'height:40px' }, `${index}`),
  },
});

// Access the imperative API
const scrollRef = wrapper.vm;
scrollRef.jumpToElement(50);
await nextTick();
```

**Mocking the engine:**

```typescript
vi.mock('@ceriousdevtech/cerious-scroll', () => ({
  CeriousScroll: vi.fn().mockImplementation(() => ({
    renderViewport: vi.fn(() => ({ startElement: 0, endElement: 10 })),
    getRenderedIndices: vi.fn(() => []),
    currentElement: 0,
    scrollOffset: 0,
    dispose: vi.fn(),
    detachScrollbar: vi.fn(),
  })),
}));
```

---

## Common Pitfalls

### `options` changes after mount have no effect

Options are consumed at engine creation. To apply new engine options, use `:key` to force a remount:

```vue
<CeriousScroll :key="optionVersion" :options="options" ... />
```

### `recalculate()` is expensive — use it only for bulk height changes

`recalculate()` clears the height cache and re-measures every visible row synchronously. Use it only when every row's height changes at once (e.g. a font-size or density switch). For routine item edits, the engine's `ResizeObserver` handles incidental height changes automatically.

### Reactive state in `renderItem` must be Vue reactive

Row content only auto-updates when `renderItem` reads Vue reactive data (`ref`, `reactive`, `computed`). Reading a plain JavaScript variable — even if it changes — will not trigger a re-render. Pass data as props, or use `ref`/`computed` so Vue's reactivity system tracks the dependency.

### The container must have an explicit height

Without a CSS height, `container.clientHeight` is 0 and `renderViewport` renders 0 elements. Set height via `:style="{ height: '400px' }"`, a class, or a bounded flex/grid parent.

### `getItem` is not reactive

`getItem` is a plain function reference. If your item data lives outside Vue's reactivity system (e.g. a plain array or an external store), changing item data will not automatically re-render rows. Either use the `items` prop (reactive-friendly), or call `render()` manually after mutating external data.

---

## Build and Release

```bash
# Library build (outputs to dist/)
npm run build

# Demo dev server (http://localhost:5173)
npm run demo

# Demo production build (outputs to demo/dist/)
npm run demo:build

# Demo build for GitHub Pages (base path required)
npm run demo:build -- --base=/vue-cerious-scroll/
```

The library is built with Vite in library mode. `vite-plugin-dts` generates `.d.ts` files. Entry point is `src/index.ts`.

The demo (`demo/`) imports the library by package name via a Vite alias pointing to `src/`, so local source changes are reflected live without a build step.
