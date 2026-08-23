# Changelog

All notable changes to vue-cerious-scroll will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.2] - 2026-08-23

### Fixed
- Raised `@ceriousdevtech/cerious-scroll` to `^1.1.2`, which repairs importing this package in plain Node. Core 1.1.1 shipped an extensionless re-export in `dist/types/index.js`; Node's ESM resolver does not add file extensions, so any import of this wrapper failed with `ERR_MODULE_NOT_FOUND`. The wrapper's own bundle was never at fault — it inherited the failure through the dependency. The previous `^1.1.1` range still permitted the broken version, so the floor is raised rather than relying on resolution picking the newer release.

## [1.1.1] - 2026-08-23

### Added
- Masonry real-content demo: network images, composed Vue card components, and a per-card carousel over 50,000 items. Demonstrates the three constraints recycled cards impose — media space reserved from intrinsic dimensions, card height enforced rather than estimated, and per-card UI state held outside component state and keyed by card index so it survives a card leaving the window.
- Demo image handling shows the practices that matter with virtualization: no `loading="lazy"` (the window is already the lazy loader), an instant placeholder colour behind each reserved box, a bounded low-priority prefetch window, and bucketed request widths so a resizing CDN can cache them.

### Changed
- Updated `@ceriousdevtech/cerious-scroll` to `^1.1.1`.

## [1.1.0] - 2026-08-22

### Added
- Declarative canonical and dynamic Masonry support through the existing `#item` slot or `render-item` prop.
- Dynamic-height probe rendering with short-lived Vue trees that are disposed after synchronous measurement.
- `jumpToItem(index, screenOffset?)` on the composable result and exposed component API.
- `CeriousScrollOptions` support for wrapper-owned Masonry rendering, canonical/dynamic demo routes, and regression coverage for both modes.

### Changed
- Updated `@ceriousdevtech/cerious-scroll` to `^1.1.0` and re-exported the new Masonry and height-provider types.
- Masonry card-count changes recreate card-derived segment state; list and table count changes continue updating in place.

## [1.0.7] - 2026-06-24

### Fixed
- **`provide()` values from the component using `<CeriousScroll>` now reach `inject()` inside rows** ([#1](https://github.com/ceriousdevtech/vue-cerious-scroll/issues/1)). Rows (and the table header) are rendered as detached vnode trees via Vue's `render()`, so injection resolved only against the app context's `provides` — app-level/plugin provides worked, but local `provide()` on the owning component did not. The wrapper now renders rows with the owning component instance's `provides` (which prototype-chains to the app provides), so component-level, plugin, and app-level provide/inject all work inside virtualized rows. When the owner provides nothing, behavior is unchanged.

### Changed
- Updated the core engine dependency to `@ceriousdevtech/cerious-scroll@^1.0.8` (native-scrollbar drag rendering is now coalesced to one render per frame, with no per-row layout thrash on fast drags).

## [1.0.6] - 2026-06-11

### Changed
- Updated the core engine dependency to `@ceriousdevtech/cerious-scroll@^1.0.7`, which fixes a scrollbar regression where dragging the thumb to the top could stop a few rows short of row 0 (a stale echo-suppression marker in the native scrollbar). No changes to the Vue wrapper's API.

## [1.0.5] - 2026-06-08

### Added
- **Table mode support** (`:options="{ layout: 'table' }"`). Rows render as real `<td>` cells into the engine's `<tr>`. Each row renders into its own `display: contents` wrapper, isolating Vue's renderer from the engine's `<tr>` recycling (so a fast scroll can't tear nodes out from under Vue) while the cells still lay out as the row's columns.
- **`#header` slot**. Declarative header (a `<tr>` of `<th>`s) rendered into the engine's `<thead>` in its own reactive effect — same `<table>` as the rows, so columns align natively, and interactive headers (sort state, etc.) update on their own.

### Dependencies
- Bumped `@ceriousdevtech/cerious-scroll` to `^1.0.6`: native table layout, `table.autoSizeColumns` (auto-sized but stable columns), trackpad-only wheel inertia, overlay-scrollbar gutter fix, and exact bottom snap.

## [1.0.4] - 2026-06-04

### Dependencies
- Bumped `@ceriousdevtech/cerious-scroll` to `^1.0.5`. Consumers get the new wheel input classifier (trackpad / free-scroll mice apply input immediately, ratcheted wheel notches still ease smoothly), the new `wheel.wheelBehavior` option (`'auto' | 'immediate' | 'smooth'`), and a fix for horizontal wheel forwarding in layouts where `overflow-x: auto` lives on an ancestor of `[data-cerious-scroll-content]`.

## [1.0.3] - 2026-06-03

### Dependencies
- Bumped peer dependency `@ceriousdevtech/cerious-scroll` to `^1.0.4`. Consumers get smooth wheel scrolling (eased over ~150ms, configurable via `wheel: { smooth }`) and the engine now reads viewport height from `[data-cerious-scroll-content]` so wrappers that put a horizontal scrollbar on the inner element get the last row clearance for free.

### Changed
- The inner content element is now styled `overflow-y: clip; overflow-x: auto` so consumers can opt into a horizontal scrollbar on the rows axis without a stray vertical bar appearing.

## [1.0.2] - 2026-06-03

### Added
- `<CeriousScroll>` now renders its default slot inside the engine container, alongside the engine's scrollbar strip. Combined with a user-supplied `<div data-cerious-scroll-content />`, this lets apps wrap rows in custom DOM (e.g. an `overflow-x: auto` wrapper with a sticky header) without breaking the engine's mobile scrollbar pinning.

### Dependencies
- Bumped peer dependency `@ceriousdevtech/cerious-scroll` to `^1.0.3` to pick up horizontal flick momentum and the custom scrollbar thumb.

## [1.0.1] - 2026-06-01

### Changed
- Verified compatibility with `@ceriousdevtech/cerious-scroll` 1.0.2

### Dependencies
- Peer dependency `@ceriousdevtech/cerious-scroll` tested against `^1.0.2` (range `^1.0.1` already satisfies this)

---

## [1.0.0] - 2026-02-02

### Added
- Initial release of `@ceriousdevtech/vue-cerious-scroll`
- `<CeriousScroll>` component — drop-in virtual scroll list for Vue 3.3+
- `useCeriousScroll` composable for headless usage with custom container elements
- Synchronous `render()` rendering for each row — rows run with the app's `appContext` so globally registered components, directives, and plugins work normally
- Synchronous height measurement (no estimated heights, no correction passes)
- Full TypeScript support with exported prop and composable types
- Peer dependency on `@ceriousdevtech/cerious-scroll` core engine
