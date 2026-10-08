# ODD — UX Table & Scroll Consistency

- **Feature:** Unify the page shell and every data table under one model: full-page (global) scroll,
  sticky opaque headers, automatic infinite scroll (no buttons) and a visible record count.
- **Branch:** `feat/ux-table-consistency` (base: `origin/staging` @ `71bd3ac`, post-PR #51 / v1.15.0+Fase 7)
- **Started:** 2026-10-08
- **Route:** delegated direct (one writer per slice); parent owns tracking docs and review orchestration
- **Delivery strategy:** `single-pr` (user choice, 2026-10-08). All slices commit on the tracker branch
  `feat/ux-table-consistency`; one PR to `staging` at the end. Avoids the Fase 4/6 chained-PR topology bug.
- **RDD:** on (global). Assessment + native review apply per work unit; reviewed boundary advances on
  acknowledgement.
- **Runner:** `pnpm test` (Vitest). Checks: `pnpm lint`, `pnpm type-check`, `pnpm test`, `pnpm build`.

## Objective

Make History and Reports look and behave like the rest of the app, and give every table the same loading
model: the page (document) scrolls, the table header sticks under the app chrome and is opaque, rows load
automatically as the user scrolls, and the table always shows how many records it holds.

## Problem (current-tree evidence — 2026-10-08 read-only map)

- **History is the only enclosed table.** `TimeLogsTable.tsx:731` wraps the table in
  `<div ref={scrollRef} className="rounded-md border overflow-auto" style={{ maxHeight: '70vh' }}>` — a
  local scroll container. It also virtualizes with `@tanstack/react-virtual` (`:393-400`,
  `getScrollElement: () => scrollRef.current`). Result: the table looks like a small panel inside an
  otherwise full-width page, and two scroll contexts coexist (document + inner box).
- **Scroll bug.** Because the shell scrolls the document (`App.tsx:33,43`, `min-h-screen`/`flex-1`, no
  `h-screen`/`overflow-hidden`) while the table has its own `70vh` scroller, an extra page scrollbar appears
  and, on document scroll, the virtualizer's window is computed against a shifted inner container
  (no `overscroll-contain`/scroll lock) so the visible row band collapses — "the whole view disappears".
- **Reports headers are not sticky.** `ReportsPage.tsx:416`, `:564` use `border-b bg-muted/50` (semi
  transparent, no `sticky`). Loading is manual: `useIncrementalRows` starts at 20 and a **"Show more"**
  button (`ReportsPage.tsx:546-556`, `:623-633`, `:727-737`, key `reports.showMore`) reveals more.
- **Catalog already has the target behaviour, but still enclosed.** `DataTable.tsx:178` uses
  `<div className="rounded-md border max-h-[60vh] overflow-auto">`; auto-load is a container **scroll
  listener** (`DataTable.tsx:112-145`, 100px threshold) calling `useTable.loadMoreRows`; count footer at
  `:232-246` (`table.showingRows` / `table.resultsOf` / `table.scrollForMore`); sticky **opaque** header
  `TableHeader className="sticky top-0 bg-background z-10"` (`:180`).
- **Width is not the problem.** All pages share `App.tsx:43` `<main className="mx-auto w-full max-w-7xl
  flex-1 px-4 py-6">`. Register/Reports/Settings fill it because none has an inner fixed-height scroller;
  History/Reports(Catalog) differ because of their enclosures.
- **Counts:** History shows a count only when a filter is active (`TimeLogsTable.tsx:722-727`); Reports shows
  only the whole filtered total (`ReportsPage.tsx:353-355`), no per-table count.

## Scope

**In:** remove per-table scroll enclosures (global page scroll); sticky opaque table headers aligned under
the app chrome; one shared automatic infinite-scroll mechanism (IntersectionObserver) replacing the button
and the container scroll listener; a visible per-table record count everywhere; fix the History scroll bug;
re-align `ui/table.tsx` so sticky works outside an `overflow` container; update i18n, tests and docs.

**Out:** changing the shell width (`max-w-7xl` stays — Register/Reports/Settings already use it and the user
likes them); new palette/brand; E2E/visual tests; server-side pagination (data is fetched whole and windowed
client-side, as today); `WorkTimeForm` calculation logic.

## Design decisions

- **D-1 · Global scroll, no enclosures.** Remove the fixed-height/`overflow-auto` wrappers around tables:
  `TimeLogsTable.tsx:731` (`70vh`) and `DataTable.tsx:178` (`60vh`). Change the `ui/table.tsx:7` `Table`
  wrapper from `overflow-auto` to `overflow-visible` so a sticky header can stick to the viewport.
- **D-2 · Sticky opaque header.** Header sticks below the app chrome. AppBar reserves `h-8` (32px, `App.tsx:37`)
  and NavBar is `sticky top-8` with `h-14` (`NavBar.tsx:33-34`) ⇒ content offset = **5.5rem (88px)**. Use
  `sticky top-[5.5rem] z-10 bg-background` (opaque; no `/50` alpha, no `backdrop-blur`). Applies to
  `TimeLogsTable` thead (`:733`), the Reports raw-table headers (`:416`, `:564`, `:639`) and
  `DataTable` (`:180`).
- **D-3 · One automatic infinite-scroll mechanism.** New shared hook `useInfiniteScroll`
  (`IntersectionObserver` on a sentinel at the end of the tbody, `rootMargin: '200px'`) triggering a
  `loadMore` callback while `hasMore`. It replaces: the "Show more" buttons in Reports, the container
  scroll listener in `DataTable`, and the virtualization in `TimeLogsTable`. Row windowing is unified on
  `useIncrementalRows` (`visibleCount`/`hasMore`/`showMore`/`reset`); `useTable` drops its own
  `visibleRowCount`/`loadMoreRows`/`hasMoreRows` and keeps `totalRows`.
- **D-4 · Record count on every table.** Reuse `table.showingRows` / `table.resultsOf` /
  `table.scrollForMore` (already in `en.ts:62-65`). History shows it always (not only when filtered);
  Reports shows it per table.
- **D-5 · History bug fix.** D-1 + D-3 remove the nested scroll and the virtualizer measuring against a
  shifted inner container, which is the reported "second scrollbar + view disappears" behaviour.
- **D-6 · Virtualization removed from History.** Replaced by D-3's incremental slicing so the mechanism is
  identical everywhere. Tradeoff: more DOM mounts than windowing for very large histories; loading stays
  incremental (bounded by user scroll). Revisit with `useWindowVirtualizer` only if perf regresses.
  The `@tanstack/react-virtual` package stays installed for now (removing it is a follow-up, not this PR).

## Tasks

- [x] **T1 · Shared foundation** — ✅ 2026-10-08, commits `afed6dd` (doc), `365906c` (hook + `TableRowCount`
  + tests). `useInfiniteScroll` (IntersectionObserver callback-ref) and `TableRowCount` (extracted from
  DataTable). Additive, no view change. Suite 79 files / 611 tests green. Acceptance met.
- [ ] **T2 · History (`TimeLogsTable`)** — global scroll (drop the `70vh` box), drop virtualization →
  incremental slicing + `useInfiniteScroll`, sticky opaque header (`top-[5.5rem]`), always-on count; fix the
  scroll bug. Acceptance: page scrolls, header sticks opaque, rows load on scroll, count visible.
- [ ] **T3 · Reports (`ReportsPage`)** — sticky opaque headers on the three tables, replace "Show more" with
  automatic load, add per-table count. Acceptance: no click needed; header sticks.
- [ ] **T4 · Catalog (`DataTable` + `useTable` + `ui/table`)** — drop the `60vh` box, `Table` wrapper
  `overflow-visible`, sticky header offset, swap to the shared hook + `useIncrementalRows`, keep the count.
  Acceptance: same behaviour as T2/T3, no regression in Catalog filters.
- [ ] **T5 · Closure** — i18n cleanup, docs, full gates (`pnpm lint`, `pnpm type-check`, `pnpm test`,
  `pnpm build`) and manual smoke. Acceptance: all checks green.

## Authorized files

- `src/renderer/hooks/useInfiniteScroll.ts` (new)
- `src/renderer/hooks/useIncrementalRows.ts`
- `src/renderer/hooks/useTable.tsx`
- `src/renderer/components/ui/table.tsx`
- `src/renderer/components/ui/table-row-count.tsx` (new)
- `src/renderer/components/TimeLogsTable.tsx`
- `src/renderer/components/DataTable.tsx`
- `src/renderer/pages/ReportsPage.tsx`
- `src/renderer/pages/HistoryPage.tsx`
- `src/renderer/locales/en.ts`, `src/renderer/locales/es.ts`
- `src/tests/renderer/**` (table/scroll/reports/virtual tests)
- `docs/UX-ROADMAP.md`
- `odd/tasks/ux-table-consistency.md`

## Checks

```pwsh
pnpm lint
pnpm type-check
pnpm test
pnpm build
```

Task-specific: infinite scroll fires only while `hasMore` and never re-fires after the end; count reflects
the rendered/filtered set; sticky header offset (5.5rem) correct; no nested scrollbars; History no longer
mounts all rows at once by default.

## Review (RDD on)

- **T1 (foundation)** — base `origin/staging`, range through `365906c` (5 paths / 465 lines): risk `medium`,
  `review_due_reason = slice_budget_reached`. Consent granted; lens `review-reliability`; lineage
  `review-435962cf9bf10d61`. Result **approved**; acknowledgement burned authority.
  - **R3-REARM-LOOP (WARNING, inferential, introduced)** — the intersection callback calls `loadMore` then
    re-observes, so an async `loadMore` could re-fire once per frame. **Accepted for now:** every consumer
    here advances the row window synchronously (`useIncrementalRows`/`useTable`), so the loop is bounded by
    content growth and ends at `hasMore === false`. Revisit if a consumer ever loads asynchronously.
  - **R3-SWAP-LEAK (SUGGESTION, deterministic, introduced)** — on a node swap the previous observer is only
    unobserved, not disconnected. **Deferred:** React detaches via `null` first (which disconnects), so the
    swap branch is rarely hit; harden when T2 touches the hook.
  - **R3-HASMORE-REARM (SUGGESTION, inferential, introduced)** — no re-observe when `hasMore` flips
    false→true while the sentinel stays visible. **Deferred:** consumers should mount the sentinel
    conditionally on `hasMore` (remount re-observes); document this contract in the hook.
  - **R3-NO-IO-FALLBACK (SUGGESTION, inferential, introduced)** — no fallback when `IntersectionObserver` is
    undefined. **Deferred:** Electron/Chromium always provides it; not a supported environment.

## Delivery

- Strategy: `single-pr`. Slices commit on `feat/ux-table-consistency`; one PR to `staging` when all slices
  are green. Content is expected to exceed ~400 authored lines → one PR with work-unit commits (squash on
  delivery if desired), per the user's explicit preference.

## Progress log

- 2026-10-08 — User authorized the work: unify tables (global scroll, sticky opaque header, auto infinite
  scroll, record count) and fix the History scroll bug; chose full unification including Catalog. Branch
  `feat/ux-table-consistency` created from `origin/staging` (`71bd3ac`). Read-only map done (CodeGraph +
  delegated explorer). Task plan created.
- 2026-10-08 — **T1 done:** `useInfiniteScroll` + `TableRowCount` + tests (`afed6dd`, `365906c`). Native
  review **approved** (RDD on; assess `slice_budget_reached`, medium), lineage `review-435962cf9bf10d61`,
  authority burned; 4 advisory findings recorded (see Review). Suite 79 files / 611 tests green.
