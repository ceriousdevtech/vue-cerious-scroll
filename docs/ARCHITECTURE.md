# vue-cerious-scroll Architecture

**Copyright (c) 2024-2026 Cerious DevTech LLC. All rights reserved.**

## Table of Contents

1. [Overview](#overview)
2. [Component Hierarchy](#component-hierarchy)
3. [DOM Structure](#dom-structure)
4. [Render Pipeline](#render-pipeline)
5. [Height Measurement Strategy](#height-measurement-strategy)
6. [Per-Row Reactive Effect Scopes](#per-row-reactive-effect-scopes)
7. [Lifecycle and Engine Recreation](#lifecycle-and-engine-recreation)
8. [Reactivity Model](#reactivity-model)
9. [Change Detection Boundaries](#change-detection-boundaries)
10. [Key Design Decisions](#key-design-decisions)

---

## Overview

`vue-cerious-scroll` is a thin Vue 3 binding over the `@ceriousdevtech/cerious-scroll` engine. Its job is to bridge two rendering models:

- **CeriousScroll engine** — imperative, DOM-first, synchronous height measurement, incremental rendering
- **Vue 3** — reactive, virtual-DOM diffing, synchronous `render()` API, Composition API effect system

Vue's synchronous `render(vnode, el)` function makes the integration more natural than in React. There is no need for a two-phase static/live render — Vue commits DOM immediately, so the engine can measure real heights right away. The main complexity is the per-row reactive effect system that keeps row content live without leaking memory across thousands of scroll events.

---

## Component Hierarchy

```
<CeriousScroll> (cerious-scroll.ts — defineComponent)
  └── useCeriousScroll() (use-cerious-scroll.ts)
        ├── CeriousScrollEngine     (from @ceriousdevtech/cerious-scroll)
        ├── ensureContentElement()  (content-element.ts)
        ├── subscribeViewportChange() (viewport-change.ts)
        └── Per-row: effectScope + watchEffect → Vue render() into mount nodes
```

`<CeriousScroll>` is a thin `defineComponent` wrapper — it calls `useCeriousScroll`, wires props/slots/emits, and exposes the imperative API via `expose`. All logic lives in `useCeriousScroll`.

---

## DOM Structure

```
<div ref="containerRef"   [data-cerious-scroll-content parent]
     style="position:relative; overflow:hidden">
  │
  ├── <div data-cerious-scroll-content>   ← ensureContentElement()
  │     ├── <div>  [engine row container, index 0]
  │     │     └── <div data-cerious-scroll-row="0">  ← mount node
  │     │           └── [Vue render() commits here]
  │     ├── <div>  [engine row container, index 1]
  │     │     └── <div data-cerious-scroll-row="1">
  │     │           └── [Vue render() commits here]
  │     └── ...
  │
  └── <div data-cerious-native-scrollbar>  ← managed by engine (if enabled)
```

The `data-cerious-scroll-content` element separates row DOM from the native scrollbar. The engine clears row containers with `textContent = ''` during recycling — without this separation the scrollbar element would be wiped on each render pass.

Each row gets an inner **mount node** (`data-cerious-scroll-row`). Vue's `render(vnode, mount)` owns the mount node's lifecycle. This decouples Vue's vnode tree from the engine's container recycling.

---

## Render Pipeline

A single render pass:

```
useCeriousScroll.render()
  │
  ├── 1. Build ElementRenderer callback
  │     └── For each row the engine needs:
  │           a. createElement('div') → mount node
  │           b. mount.setAttribute(ROW_ATTR, String(index))
  │           c. el.appendChild(mount)
  │           d. mountReactiveRow(index, mount) → stop handle
  │              ↳ Creates effectScope + watchEffect (flush:'sync')
  │              ↳ Calls renderItem(getItem(index), index) → VNode
  │              ↳ render(vnode, mount) — synchronous DOM commit
  │           e. rows.set(index, { el, mount, stop })
  │
  ├── 2. instance.renderViewport(height, contentEl, renderer)
  │     └── Engine calls renderer per row, reads offsetHeight after each
  │         ↳ mount's DOM is already committed (Vue render is synchronous)
  │
  ├── 3. Prune stale rows
  │     └── For each row NOT in instance.getRenderedIndices():
  │           entry.stop()         — stop reactive effect scope
  │           render(null, mount)  — unmount Vue tree
  │           mount.remove()       — detach from DOM
  │           rows.delete(index)
  │
  └── 4. opts.onMeasuredViewport?.(range)
```

---

## Height Measurement Strategy

Vue's `render(vnode, el)` is **synchronous** — it commits DOM nodes before returning. This means the engine's `offsetHeight` read after the `ElementRenderer` callback returns always sees real heights. No static-HTML pre-render phase is needed (unlike the React wrapper).

| Framework | Render API | Synchronous? | Measurement strategy |
|---|---|---|---|
| Vue 3 | `render(vnode, el)` | Yes | Direct — engine reads `offsetHeight` after callback returns |
| React | `createPortal` / `flushSync` | No (portals async) | Two-phase: static HTML for measurement, live portals for interactivity |

---

## Per-Row Reactive Effect Scopes

Each rendered row owns a **dedicated `effectScope`** containing one `watchEffect` with `flush: 'sync'`. This is what makes row content reactive — if `renderItem` or the scoped slot closes over a `ref`, `computed`, or any other reactive dependency, the row re-renders automatically when that dependency changes.

```
rows Map<index, RowEntry>
  └── RowEntry { el, mount, stop }
        └── stop = effectScope(true).run(() =>
              watchEffect(() => render(h(Fragment, [renderItem(...)]), mount), { flush: 'sync' })
            )
```

**Why per-row scopes instead of a single shared scope?**

`watchEffect` inside a scope accumulates in the scope's internal `effects` array. Stopping a single `watchEffect` removes it from the **reactive system** (it no longer runs), but it does **not** remove it from the scope's `effects` array. Over thousands of scroll events, a shared scope would accumulate thousands of stopped-but-still-referenced effects, growing without bound.

A dedicated per-row scope is fully stopped with `scope.stop()` when the row leaves the viewport, which removes the scope and all its effects from memory entirely. Nothing accumulates.

**`flush: 'sync'`** — the initial run (and subsequent reactive re-runs) are synchronous. This is required so that:
1. The engine can read the real `offsetHeight` immediately during the render pass.
2. External reactive state changes (e.g. a selection `ref` toggled) update the row's DOM synchronously, allowing the engine's content observer to pick up any resulting height change in the same tick.

---

## Lifecycle and Engine Recreation

```
onMounted()
  └── init(container)
        ├── ensureContentElement()
        ├── new CeriousScrollEngine(...)   [runOutsideAngular analogue: no special zone needed in Vue]
        ├── Restore savedPos if present
        ├── subscribeViewportChange(...)
        └── requestAnimationFrame → render()

watch([totalElements, items.length])
  └── recreate()
        ├── teardown(true)   ← saves scroll position
        └── init(container)  ← new engine, restores position

onBeforeUnmount()
  └── teardown(false)        ← does not save position (component is leaving)
```

**Engine recreation** happens when the effective item count changes. The `ViewportRenderer` inside the engine stores a copy of `totalElements` at construction — patching the public property alone leaves the renderer's internal bound stale, producing phantom renders at out-of-bounds indices.

**Scroll position** is saved to `savedPos` before `teardown` so a data-size change restores the user's position in the new engine.

---

## Reactivity Model

`useCeriousScroll` accepts `MaybeRefOrGetter<T>` for `totalElements`, `items`, and `autoRender`. This means callers can pass:
- A plain value: `{ totalElements: 100 }`
- A `ref`: `{ totalElements: myRef }`
- A getter: `{ totalElements: () => props.totalElements }`

`toValue()` is used to unwrap these everywhere inside the composable.

**Watching for recreation triggers:**

```typescript
watch(
  [() => toValue(opts.totalElements), () => toValue(opts.items)?.length],
  ([newTotal, newLen], [oldTotal, oldLen]) => {
    const resolvedNew = newTotal ?? newLen ?? null;
    const resolvedOld = oldTotal ?? oldLen ?? null;
    if (resolvedNew !== resolvedOld) recreate();
    else if (host) { render(); }  // same count, new data reference
  }
);
```

**Items identity change (same count):** triggers a re-render without recreation. Row content updates via the reactive `watchEffect` in each row scope — if `renderItem` reads `items[index]`, it re-runs automatically when `items` changes.

---

## Change Detection Boundaries

| Event | Behavior |
|---|---|
| Scroll (wheel/touch/keyboard) | Engine fires `onScroll` → `render()` — Vue's render is sync |
| Container resize | Engine's `ResizeController` fires `onScroll` → same path |
| Row content resize | Engine's `ContentObserverManager` detects, updates cache, fires `onScroll` |
| Reactive state change in `renderItem` | `watchEffect(flush:'sync')` re-runs the row immediately |
| `items` identity change (same count) | `watch` triggers re-render; existing row scopes pick up via reactivity |
| `items.length` change | `watch` triggers `recreate()` |
| `renderItem` prop change | New function captured by the row's closure on next `watchEffect` run |

---

## Key Design Decisions

### Vue `render()` vs Teleport

Teleport (`<Teleport to="...">`) requires a known target selector and mounts in the next tick. Vue's imperative `render(vnode, el)` is synchronous and targets an exact DOM node — exactly what the engine's incremental measurement loop needs.

### Inner Mount Nodes vs Direct Engine Containers

The engine recycles its row containers by clearing them with `textContent = ''`. Mounting Vue's vnode tree directly into engine containers would silently unmount the Vue tree during recycling. Inner mount nodes (`data-cerious-scroll-row`) decouple Vue's ownership from engine container management.

### `appContext` Propagation

The composable captures `getCurrentInstance()?.appContext` at call time and attaches it to every rendered vnode:

```typescript
const appContext = getCurrentInstance()?.appContext;
// ...
const vnode = h(Fragment, children);
vnode.appContext = ctx;
renderVNode(vnode, mount);
```

Without this, globally registered components, directives, and installed plugins would not resolve inside row content.

### No Wrapper-Side ResizeObserver

Container resize is handled by the engine's own `ResizeController`. Adding a second observer in the wrapper would double-render on every resize event.
