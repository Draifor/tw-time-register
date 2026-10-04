# ODD — UX Fase 2: Design system y consistencia visual

- **Rama:** `feat/ux-fase-2-design-system` (base `origin/staging`; incluye el follow-up de Fase 1: commits `ba59888`, `43785ed`, `2224e8f`)
- **Roadmap:** [`docs/UX-ROADMAP.md`](../../docs/UX-ROADMAP.md) §Fase 2 (UX-201..UX-205)
- **Estado:** `[~]` en progreso
- **Runner de tests:** `pnpm test` (Vitest) · verificación: `pnpm test`, `pnpm lint`, `pnpm type-check`
- **Estrategia de entrega:** `single-pr` a `staging` con `size:exception` (precedente de Fase 2 de Performance, PR #13). Pronóstico: >400 líneas autoradas → un solo PR con excepción de tamaño, no encadenado.

## Objetivo

Una sola fuente de verdad visual: reemplazar la paleta cruda de Tailwind por tokens
semánticos, extraer las primitivas que hoy se reinventan (switch, badge de estado,
toolbar/empty-state) y unificar las cuatro tablas. Base: `src/renderer/index.css`
(tokens shadcn) + `src/renderer/components/ui`.

## Problema (mapeo read-only, evidencia path:line)

- **18 archivos** del renderer usan paleta cruda: `emerald/amber/red/green/blue/yellow-*`
  y `slate-*`. No existen tokens `success`/`warning`/`info`.
- **No existe `ui/switch.tsx`** (el roadmap asumía que sí). Hay 3 switches hechos a mano
  (`WorkTimeForm.tsx:448-459,471-482`, `TimeLogsTable.tsx:763-771`). `@radix-ui/react-switch`
  **no** está instalado.
- **Badge de estado duplicado** byte a byte: `TimeLogsTable.tsx:185-198` vs `:775-788`.
- **Cuatro tablas** con toolbars/empty-states propios y dos paradigmas de edición
  (`TimeLogsTable` fila; `DataTable` celda). `DataTable` tiene copy hardcodeado en inglés.
- **Contraste:** `NavBar.tsx:116` `text-amber-500` (~2.1:1), `:66/:159` `text-emerald-600`
  (~3.9:1), `LiveTimer.tsx:54` `text-red-500` (~3.9:1), `TotalTimeDay.tsx:131-135`.

## Alcance

**Dentro:**
- Tokens semánticos `success`/`warning`/`info` (+ foreground) en `index.css` (light+dark).
- Nuevas primitivas: `ui/status-badge.tsx`, `ui/switch.tsx` (sin dependencia nueva), y en T4
  `ui/empty-state.tsx` + toolbar compartido.
- Migrar paleta cruda a tokens en los 18 archivos.
- Reemplazar controles caseros por primitivas.
- Extraer `StatusBadge`; unificar spacing/iconos de tablas y forms.
- Unificar tablas (toolbar + empty/error/loading + traducción de `DataTable`).
- Repaso de contraste AA de los focos listados.

**Fuera (deliberado):**
- i18n de strings no relacionados con tablas (Fase 6).
- Accesibilidad profunda de combobox/labels (Fase 5); solo lo estrictamente necesario.
- Layout/ventana responsive (Fase 3).
- Reescritura de lógica de `WorkTimeForm` (solo presentación).

## Tareas

- [x] **T1 · Tokens semánticos + primitivas base** (UX-201 fundación, UX-203)
  - Test-first: `src/tests/renderer/statusBadge.test.tsx`, `src/tests/renderer/switch.test.tsx`.
  - `index.css`: agregar `--success/--warning/--info` (+`-foreground`) en `:root` y `.dark`,
    y mapearlos en `@theme inline`.
  - `ui/status-badge.tsx`: cva con variantes `success|warning|destructive|info|default|secondary|outline`.
  - `ui/switch.tsx`: `<button role="switch" aria-checked>` accesible, sin Radix (evita dep/lockfile).
  - Aceptación: tokens resuelven; componentes con semántica accesible.

- [ ] **T2 · Migrar paleta cruda a tokens** (UX-201)
  - Reemplazar por `success/warning/info/destructive/muted-*` en: `useTasks.tsx`,
    `lib/progressUtils.ts`, `AppBar.tsx`, `pages/HomePage.tsx`, `pages/ReportsPage.tsx`,
    `pages/SettingsPage.tsx`, `components/NavBar.tsx`, `LiveTimer.tsx`, `TotalTimeDay.tsx`,
    `WorkTimeForm.tsx`, `TimeLogsTable.tsx`, `TaskCommentDialog.tsx`, diálogos Pull/Import.
  - Aceptación: grep sin `bg-slate-*`/`text-emerald-*`/`text-amber-*`/`text-red-*`/`text-green-*`
    fuera de `index.css`.

- [ ] **T3 · Primitivas en vez de controles caseros** (UX-202)
  - Switches caseros → `Switch`. Dropdowns propios de `TaskCommentDialog.tsx:227-327` →
    `DropdownMenu`/`Combobox`. `<select>` nativo de `TasksTable.tsx:172-187` → `Select`.
  - Aceptación: sin `peer-checked:*` en vetos de switch ni dropdowns posicionados a mano.

- [ ] **T4 · Unificar las cuatro tablas + StatusBadge** (UX-204, UX-203)
  - Extraer `ui/empty-state.tsx` (empty/error/loading) y toolbar `TableToolbar`.
  - Traducir el copy hardcodeado de `DataTable.tsx` (en/es).
  - Usar `StatusBadge` en `TimeLogsTable` (reemplaza los dos bloques duplicados).
  - Un paradigma único de edición inline — **decisión de producto pendiente** (§Decisiones).
  - Aceptación: un toolbar y un empty-state reutilizados; sin copy inglés hardcodeado.

- [ ] **T5 · Contraste y tipografía** (UX-205)
  - Ajustar `NavBar` (amber/emerald), `LiveTimer` (red), `TotalTimeDay`, `HomePage:610-617`.
  - Aceptación: texto normal ≥4.5:1 en los focos listados (verificado con cálculo de contraste).

## Criterios de aceptación (global)

1. `pnpm test`, `pnpm lint`, `pnpm type-check` en verde (salvo warnings preexistentes).
2. Grep sin paleta cruda fuera de `index.css`/tokens.
3. Primitivas compartidas usadas en las cuatro tablas; sin switches/dropdowns caseros.
4. Focos de contraste listados ≥4.5:1.

## Decisiones

- **Entrega:** `single-pr` + `size:exception` a `staging` (precedente PR #13).
- **Switch:** sin Radix; `<button role="switch">` (evita dependencia + gate de lockfile).
- **T4 edición inline:** PENDIENTE — ver §Decisiones abiertas del roadmap; se resolverá con el usuario
  antes de T4.

## Evidencia / progreso

_(se completa por tarea)_

- **T1** — commit `feat(ux): add semantic tokens and status-badge/switch primitives`.
  - **TDD (RED→GREEN):** tests nuevos escritos antes; RED = "Failed to resolve import"
    (`status-badge`/`switch` inexistentes), luego GREEN.
  - **`pnpm test`:** 44 archivos, **307 tests** en verde (10 nuevos).
  - **`pnpm lint`:** exit 0 — 0 errores, 83 warnings (1 nuevo no bloqueante `no-forward-ref`,
    consistente con el resto de `ui/*`).
  - **`pnpm type-check`:** exit 0.
  - **Archivos:** `index.css` (tokens), `ui/status-badge.tsx` (nuevo), `ui/switch.tsx` (nuevo),
    tests `statusBadge.test.tsx`/`switch.test.tsx` (nuevos).
