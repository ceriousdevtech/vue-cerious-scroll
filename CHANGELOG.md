# Changelog

All notable changes to vue-cerious-scroll will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
