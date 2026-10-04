# UX Fase 0 — Information architecture, operational home and naming

- **Feature:** UX Fase 0 of [`docs/UX-ROADMAP.md`](../../docs/UX-ROADMAP.md)
- **Branch:** `feat/ux-fase-0-ia` (base: `origin/staging` @ PR #26 merge)
- **Started:** 2026-10-04
- **Route:** delegated direct (one writer) — 2+ non-trivial files, §Mandatory Delegation Triggers (Writer trigger)
- **Delivery strategy:** `ask-on-risk` (default). Forecast ≈ 450 authored changed lines (additions + deletions,
  including the Home monthly/weekly removal). If the running count reaches ~400 at a work-unit commit, ask once
  before the next commit whether to chain PRs.
- **RDD:** on (decided by global). Assessment + native review apply per work unit.

## Objective

Establish the product's information architecture before touching UI consistency: settle the primary action,
the definitive section map, the naming glossary, heading hierarchy and landmarks — so Phases 4/5/6 have a stable
shell to build on.

## Problem (from the roadmap audit)

- The landing is a dashboard and the primary flow (register time) sits behind a click.
- 5 top-level routes with no grouping; catalogs (tasks/types) grouped by tabs but disconnected.
- Section names contradict: nav "Work Time"/"Registro" vs page "Time Registration"; ambiguous action verbs.
- Brand "TW Time Register" duplicated (titlebar + NavBar `<h1>` + About); two `<h1>` per screen.
- No `<main>` landmark; `<nav>` has no accessible name.

## Resolved product decisions (user-approved)

1. **Primary action / landing (UX-001):** keep `/` as landing and turn it into an **operational home**
   ("Foco operativo"): hero primary "Register time" (1 click) + active-timer chip; then **Quick Stats** and
   **Today's Log**. The **Monthly/Weekly** blocks are **removed from Home** (they already live in Reports).
2. **Section map (UX-002):** six first-level sections →
   `Inicio · Registrar · Historial · Reportes · Catálogo · Ajustes`
   (`Home · Register · History · Reports · Catalog · Settings`).
3. **Menus/other decisions:** already resolved in Phases 1/3 (renderer menu removed; window min 900×600;
   inline edit per data shape).

## Naming glossary (UX-003) — one name per section, one verb per action

| Concept | ES | EN |
|---|---|---|
| Section Inicio | `Inicio` | `Home` |
| Section Registrar | `Registrar` | `Register` |
| Section Historial | `Historial` | `History` |
| Section Reportes | `Reportes` | `Reports` |
| Section Catálogo | `Catálogo` | `Catalog` |
| Section Ajustes | `Ajustes` | `Settings` |
| Page title / home | `Inicio` | `Home` |
| Page title / register | `Registrar tiempo` | `Register time` |
| Action: primary submit | `Guardar` (keep current copy) | `Save` |
| Action: add row | `Agregar entrada` | `Add entry` |

Rule: the brand "TW Time Register" stays **only** in the AppBar titlebar (`<span>`, not a heading) and About.
No "Registro"/"Time Registration"/"Start Registering" synonyms.

## Scope

**In:** routes + nav shell, new History page, Catalog page (tasks+types), operational Home, single `<h1>` per
route, `<main>`/`<nav>` landmarks, locale copy for the above, test updates.

**Out (later phases):** submit pending/undo/confirmation (Fase 4), full a11y labels/combobox/focus (Fase 5),
i18n dead-string sweep (Fase 6), visual redesign. Home's silent-error handling stays as-is (Fase 4 / UXBUG-06).

## Tasks

- [x] **T1 · UX-002 — Section map & routes**
  - `src/renderer/App.tsx`: add lazy `HistoryPage` + `CatalogPage`; routes `/` Home, `/worktime` Register,
    `/history` **(new)**, `/reports`, `/catalog` (rename of `/tasks`), `/settings`.
  - `src/renderer/components/NavBar.tsx`: `navItems` → 6 items in order
    `Inicio · Registrar · Historial · Reportes · Catálogo · Ajustes` (keys below).
  - `src/renderer/pages/HistoryPage.tsx` **(new)**: `<h1>` `history.title` + `<TimeLogsTable />`.
  - `src/renderer/pages/CatalogPage.tsx` **(new, replaces `TasksPage.tsx`)**: `<h1>` `catalog` title,
    2 tabs → Tareas (`<TasksTable/>`) + Tipos (`<TypeTasksTable/>`); the logs tab is removed.
  - Delete `src/renderer/pages/TasksPage.tsx`.
  - HomePage secondary link: `/tasks` → `/catalog`.
  - **Acceptance:** nav shows exactly 6 first-level sections; `/history` and `/catalog` resolve; no logs tab.

- [x] **T2 · UX-001 — Operational Home ("Foco operativo")**
  - `src/renderer/pages/HomePage.tsx`: header keeps a single `<h1>`; replace the two CTA cards with a hero:
    primary Button "Register time" → `/worktime` + `ActiveTimerChip`; keep **Quick Stats** and **Today's Log**;
    **remove** the Monthly and Weekly sections and their now-unused state/effect (`monthEntries`, `weekEntries`,
    `loadMonthlyData`).
  - `src/renderer/hooks/useActiveTimer.ts` **(new)**: read `localStorage['wt_activeTimer']`
    (`{ index, startedAt }`, persisted by `WorkTimeForm` at `:841`, cleared at `:859/:868/:1268`), tick elapsed
    each second, return `{ startedAt: Date | null, elapsedMs }`.
  - `src/renderer/components/ActiveTimerChip.tsx` **(new)**: render nothing when no timer; otherwise show running
    state + elapsed + a link to `/worktime`.
  - **Acceptance:** from the landing, register time is ≤ 1 click; a running timer is visible on Home.

- [x] **T3 · UX-003 — Naming glossary applied**
  - Locales `src/renderer/locales/en.ts` + `es.ts` (keep en/es mirrored):
    - `nav.workTime` → **`nav.register`** (`Register` / `Registrar`)
    - `nav.tasks` → **`nav.catalog`** (`Catalog` / `Catálogo`)
    - add **`nav.history`** (`History` / `Historial`)
    - `nav.home` `Home`/`Inicio`, `nav.reports` `Reports`/`Reportes`, `nav.settings` `Settings`/`Ajustes`
    - add **`nav.primary`** = `Primary navigation` / `Navegación principal` (nav aria-label)
    - `home.title` → `Home` / `Inicio` (drop brand duplication); keep `home.subtitle`
    - `workTimeForm.title` → `Register time` / `Registrar tiempo`
    - `tasks.pageTitle` → `Catalog` / `Catálogo`; update `tasks.pageSubtitle`
    - add **`history.title`/`history.subtitle`**
    - add Home hero/timer keys (`home.viewHistory`, `home.timerRunning`) and remove now-unused
      `home.timeRegistration*`, `home.taskManagement*`, `home.viewTasks`
    - remove `tasks.tabTimeLogs`
  - **Acceptance:** no synonym for the same section/action; en/es mirrored.

- [x] **T4 · UX-004 — Branding & heading hierarchy**
  - Remove the brand `<h1>TW Time Register</h1>` from `NavBar.tsx:35` (AppBar titlebar keeps the brand).
  - Exactly one `<h1>` per route (verify Home, Register, History, Catalog, Reports, Settings).
  - **Acceptance:** one `<h1>` per route; no brand heading in the nav.

- [x] **T5 · UX-005 — Landmarks**
  - `App.tsx`: content wrapper becomes `<main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">`.
  - `NavBar.tsx`: `<nav aria-label={t('nav.primary')}>`.
  - **Acceptance:** `<main>` wraps page content; `<nav>` has an accessible name.

## Authorized files

- `src/renderer/App.tsx`
- `src/renderer/components/NavBar.tsx`
- `src/renderer/components/ActiveTimerChip.tsx` *(new)*
- `src/renderer/hooks/useActiveTimer.ts` *(new)*
- `src/renderer/pages/HomePage.tsx`
- `src/renderer/pages/HistoryPage.tsx` *(new)*
- `src/renderer/pages/CatalogPage.tsx` *(new)*
- `src/renderer/pages/TasksPage.tsx` *(delete)*
- `src/renderer/locales/en.ts`, `src/renderer/locales/es.ts`
- `src/tests/renderer/i18nRouter.test.tsx`

## Checks

```pwsh
npm run lint
npm run type-check
npm run test
npm run build
```

IA spot checks: one `<h1>` per route; register ≤ 1 click from `/`; nav has 6 items; `/history` + `/catalog`
resolve; running timer shows on Home.

## Progress log

- 2026-10-04 — Decisions 1/2 + Home composition approved by user; task doc created; branch `feat/ux-fase-0-ia`.
- 2026-10-04 — T1–T5 implemented (delegated writer). Commands green: lint, type-check, `npm run test`
  (384 passed), build. TDD where runnable (RED→GREEN for `useActiveTimer` + nav).
- 2026-10-04 — Work-unit commit `85bd5d7`. RDD assess: medium, `review_due_reason = slice_budget_reached`.
  Native review (lens `review-reliability`, lineage `review-8329f5952c57dce2`): **approved**; acknowledgement
  burned authority.

## Non-blocking review advisories (separate later work)

- **R3-1** — `useActiveTimer` snapshots `wt_activeTimer` once (no storage/focus re-read); stale only if storage
  is cleared while Home stays mounted (normal flow remounts Home).
- **R3-2** — `ActiveTimerChip` has no direct component test (null path, elapsed formatting, link).
- **R3-3** — `navIa.test.tsx` asserts link text/count but not link targets/routes.
- **R3-4** — the old `/tasks` URL now matches no route (no redirect/catch-all); the missing catch-all is
  base-only, the newly dead URL is introduced here.

## Follow-up before PR (advisory closure + docs)

- **Authorized:** user, 2026-10-04 ("cerremos esos puntos pendientes antes del PR").
- **Route:** delegated direct (one writer) for code + tests; parent for tracking docs.
- **Trigger:** 2+ non-trivial files (`useActiveTimer.ts`, `App.tsx`, 3 test files) → Writer trigger.
- **Note:** closing advisories creates new commits → a new candidate for the RDD assess (does not reuse the
  already-acknowledged review of `85bd5d7`).

- [ ] **T6 · Close review advisories R3-1..R3-4**
  - **R3-1 (behavior):** `src/renderer/hooks/useActiveTimer.ts` re-reads `wt_activeTimer` on `storage` and
    `focus`/`visibilitychange`, not just once on mount. Test: change storage + fire the event → `startedAt`
    updates.
  - **R3-2 (test):** new `ActiveTimerChip` test — null path renders nothing; running path shows elapsed and
    links to `/worktime`.
  - **R3-3 (test):** `src/tests/renderer/navIa.test.tsx` asserts the six link `href`s
    (`/`, `/worktime`, `/history`, `/reports`, `/catalog`, `/settings`), not just text/count.
  - **R3-4 (behavior):** add `/tasks` → `/catalog` redirect (`<Navigate replace />`) in `src/renderer/App.tsx`;
    cover it deterministically if the App/router harness allows, otherwise report why not.
  - **Acceptance:** lint, type-check, test and build green; each advisory demonstrably closed or reported.

- [ ] **T7 · Docs: Fase 0 done + Reports debt**
  - `docs/UX-ROADMAP.md`: mark UX-001..UX-005 `[x]` with date/branch; refresh §Estado general; add a Reports
    backlog section (month/week presets, sent-vs-local minutes, weekly day bars) recording the gap left by
    removing the Home monthly/weekly blocks.

## Next step

Run T6 + T7, commit the follow-up as a work unit, and let delivery (push + PR to `staging`) remain the user's
decision.
