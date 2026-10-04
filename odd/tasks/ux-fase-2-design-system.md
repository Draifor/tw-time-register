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

- [x] **T2 · Migrar paleta cruda a tokens** (UX-201)
  - Reemplazar por `success/warning/info/destructive/muted-*` en: `useTasks.tsx`,
    `lib/progressUtils.ts`, `AppBar.tsx`, `pages/HomePage.tsx`, `pages/ReportsPage.tsx`,
    `pages/SettingsPage.tsx`, `components/NavBar.tsx`, `LiveTimer.tsx`, `TotalTimeDay.tsx`,
    `WorkTimeForm.tsx`, `TimeLogsTable.tsx`, `TaskCommentDialog.tsx`, diálogos Pull/Import.
  - Aceptación: grep sin `bg-slate-*`/`text-emerald-*`/`text-amber-*`/`text-red-*`/`text-green-*`
    fuera de `index.css`.

- [x] **T3 · Primitivas en vez de controles caseros** (UX-202)
  - Switches caseros → `Switch`. Dropdowns propios de `TaskCommentDialog.tsx:227-327` →
    `DropdownMenu`/`Combobox`. `<select>` nativo de `TasksTable.tsx:172-187` → `Select`.
  - Aceptación: sin `peer-checked:*` en vetos de switch ni dropdowns posicionados a mano.

- [x] **T4 · Unificar las cuatro tablas + StatusBadge** (UX-204, UX-203)
  - Extraer `ui/empty-state.tsx` (empty/error) y toolbar `TableToolbar`/`TableToolbarSearch`.
  - Traducir el copy hardcodeado de `DataTable.tsx` (en/es) → namespace `table.*`.
  - Usar `StatusBadge` en `TimeLogsTable` (reemplaza los dos bloques duplicados).
  - Edición inline **por forma de dato** (RESUELTA): fila en `TimeLogsTable`, celda en `DataTable` (§Decisiones).
  - Aceptación: un toolbar y un empty-state reutilizados; sin copy inglés hardcodeado.

- [x] **T5 · Contraste y tipografía** (UX-205)
   - Ajustar `NavBar` (amber/emerald), `LiveTimer` (red), `TotalTimeDay`, `HomePage:610-617`.
   - Aceptación: texto normal ≥4.5:1 en los focos listados (verificado con cálculo de contraste y guard determinista).

## Criterios de aceptación (global)

1. `pnpm test`, `pnpm lint`, `pnpm type-check` en verde (salvo warnings preexistentes).
2. Grep sin paleta cruda fuera de `index.css`/tokens.
3. Primitivas compartidas usadas en las cuatro tablas; sin switches/dropdowns caseros.
4. Focos de contraste listados ≥4.5:1.

## Decisiones

- **Entrega:** `single-pr` + `size:exception` a `staging` (precedente PR #13).
- **Switch:** sin Radix; `<button role="switch">` (evita dependencia + gate de lockfile).
- **AppBar (barra de título):** theme-adaptive — `bg-card text-card-foreground border-b border-border`,
  hover de botones `hover:bg-accent`, botón cerrar `hover:bg-destructive hover:text-destructive-foreground`.
  Decisión del usuario (seguir el tema), no tokens de chrome dedicados.
- **T4 edición inline:** RESUELTA (2026-10-04) — **una implementación compartida por forma de dato**:
  edición **por fila** en `TimeLogsTable` (campos acoplados + duración derivada) y edición **por celda**
  en los catálogos (`TasksTable`/`TypeTasksTable` vía `DataTable`). Ambas salen de una misma capa `ui/`,
  sin reinvención por tabla. No se fuerza un único paradigma para las cuatro.
- **T5 tokens (doble rol surface/text):** RESUELTA (2026-10-04) — cada token semántico se usa sobre todo
  como **texto** (`text-{token}` sobre fondo neutro o `bg-{token}/10`), no como superficie sólida. Por eso
  se calibran los valores para AA **como texto** y el `-foreground` pareado sigue cumpliendo sobre la
  superficie sólida. En `.dark`, `destructive` adopta la convención ya vigente para `success/warning/info`
  (token claro + `-foreground` oscuro), en vez de ser el único token oscuro con foreground claro.
  `--muted-foreground` light se oscurece levemente (`46.9%` → `44%`) para pasar sobre `bg-muted`.

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

- **T2** — commit `refactor(ux): migrate raw palette to semantic tokens (UX-201)`.
  - **TDD:** excepción justificada — migración presentacional de class strings; ningún test
    determinista asertaba esas clases (verificado). Sin tests inventados.
  - **Archivos (16):** `AppBar`, `ImportCSVTasksDialog`, `ImportTasksDialog`, `LiveTimer`, `NavBar`,
    `PullFromTWDialog`, `PullTaskDialog`, `TaskCommentDialog`, `TimeLogsTable`, `TotalTimeDay`,
    `WorkTimeForm`, `hooks/useTasks`, `lib/progressUtils`, `pages/HomePage`, `pages/ReportsPage`,
    `pages/SettingsPage`.
  - **Extra (fuera del regex de aceptación, dentro de UX-201):** `ImportCSVTasksDialog` `text-orange-500`
    → `text-warning`; `WorkTimeForm` switch `peer-checked:bg-orange-500` → `peer-checked:bg-primary`.
  - **Grep aceptación:** 0 matches. **Grep ampliado (cualquier hue crudo):** 0 matches fuera de `index.css`.
  - **`pnpm test`:** 44 archivos, **307 tests** verdes. **`pnpm lint`:** 0 errores, 83 warnings
    (preexistentes). **`pnpm type-check`:** exit 0.
  - **Review nativa (assess):** `medium` / `under_budget` (271 líneas cambiadas vs. boundary 73d944a;
    budget ~400). Sin transacción aún — el slice sigue pendiente y se revisará al llegar al budget
    (o en el próximo commit de alto riesgo).

- **T3** — commit `refactor(ux): use Switch/Select/DropdownMenu primitives instead of handmade controls (UX-202)`.
  - **`ui/switch.tsx` (review finding R3-SWITCH-PROP-OVERRIDE):** `{...props}` ahora se esparce ANTES de
    `type/role/aria-checked/data-state` (el contrato gana en runtime) y el tipo se angostó con
    `Omit<..., 'onChange' | 'type' | 'role' | 'aria-checked'>` (no-override en TypeScript).
  - **Switches:** `WorkTimeForm` `afterLunch`/`isBillable` → `Controller` + `Switch` (se elimina el
    `register` del `EntryCard`); `TimeLogsTable` billable → `Switch` con `aria-label`. Clic en el `Label`
    de texto sigue togleando (activación nativa de `<label>` sobre `<button>`, cubierta por test).
  - **Dropdowns:** `TaskCommentDialog` template picker → `DropdownMenu` + `DropdownMenuItem`; notify
    picker multi-select con búsqueda → `DropdownMenu` controlado + `DropdownMenuCheckboxItem`
    (`onSelect preventDefault` mantiene abierto y `onCheckedChange` dispara; el input de búsqueda
    detiene el `keydown` para no chocar con el typeahead de Radix). Se eliminan `templateRef`,
    `notifyRef`, `templateOpen` y el efecto de outside-click manual.
  - **`<select>` → `Select`:** `TasksTable` tipo de tarea usa Radix `Select` con `SelectValue placeholder`;
    `id="new-task-type"` y el borde de error preservados.
  - **`InsertDivider`:** `<button>` casero → `Button variant="outline"` con clases de paridad visual.
  - **TDD (RED→GREEN):** tests nuevos antes; RED = override de contrato en `Switch` y ausencia de
    `role="switch"` en `WorkTimeForm` (3 fallos); luego GREEN. El memo PERF-202 sigue verde.
  - **Archivos:** `ui/switch.tsx`, `WorkTimeForm.tsx`, `TimeLogsTable.tsx`, `TasksTable.tsx`,
    `TaskCommentDialog.tsx`; tests `switch.test.tsx` (editado) y `workTimeFormSwitches.test.tsx` (nuevo).
  - **Grep aceptación:** `peer-checked` 0 matches; `absolute z-50` en `TaskCommentDialog` 0; `<select>`
    en `TasksTable` 0.
  - **`pnpm test`:** 45 archivos, **310 tests** verdes. **`pnpm lint`:** 0 errores, 83 warnings
    (baseline). **`pnpm type-check`:** exit 0.
  - **Excepción de test justificada:** `TimeLogsTable`/`TasksTable`/`TaskCommentDialog` no tienen harness
    determinista propio (tabla virtualizada / portal Radix); swaps presentacionales a primitivas ya
    cubiertas, sin tests frágiles inventados.
  - **Pendiente de ojo:** paridad visual de `InsertDivider` y ancho de los menús (no hay E2E de render).

- **T4** — commit `refactor(ux): unify table toolbars and empty-states, translate DataTable copy (UX-203, UX-204)`.
  - **Ruta:** delegated direct (1 writer). Trigger: 2+ archivos no triviales (4 componentes + 2 locales + 3 tests).
  - **TDD (RED→GREEN):** tests nuevos antes (`emptyState` 5, `tableToolbar` 6, `tableI18nGuard` 4); RED =
    "Failed to resolve import" en las primitivas + 10 literales ingleses detectados en `DataTable.tsx`; luego GREEN.
  - **Nuevas primitivas:** `ui/empty-state.tsx` (`EmptyState`/`ErrorState`), `ui/table-toolbar.tsx`
    (`TableToolbar`/`TableToolbarSearch`).
  - **Adopción:** `TableToolbar` en las cuatro tablas (DataTable, TimeLogsTable, TasksTable, TypeTasksTable);
    `StatusBadge` reemplaza los dos bloques duplicados de `TimeLogsTable`; `EmptyState`/`ErrorState` compartidos
    en DataTable + TimeLogsTable.
  - **i18n:** namespace `table.*` (12 keys) en `en.ts`/`es.ts` con paridad; `DataTable` sin literales ingleses.
  - **Loading sin cambios:** `SkeletonTable` y los skeletons quedan como estaban (la virtualización de
    `TimeLogsTable` y el scroll infinito de `DataTable` dependen de ellos) — desvío justificado del
    "(empty/error/loading)" del plan.
  - **Grep aceptación:** literales ingleses removidos → 0 matches; paleta cruda en archivos editados → 0 matches.
  - **`pnpm test`:** 48 archivos, **325 tests** verdes (15 nuevos). **`pnpm lint`:** 0 errores, 83 warnings
    (baseline). **`pnpm type-check`:** exit 0. Gate re-ejecutado por el parent (spot check), no solo por el writer.
  - **Pendiente de ojo:** paridad visual (spacing del toolbar, `EmptyState py-12` vs `py-16` previo en
    `TimeLogsTable`, icono de búsqueda nuevo en `DataTable`); no hay E2E de render.
   - **Fuera de T4:** `Sync ${pendingCount}` en `TimeLogsTable` sigue hardcodeado (pre-existente; no estaba en
     la lista de copy de T4).

- **T5** — commit `fix(ux): enforce AA contrast on semantic tokens and guard it (UX-205)`.
   - **Ruta:** delegated direct (1 writer). Trigger: archivo de test nuevo no trivial + cambio de tokens.
   - **TDD (RED→GREEN):** guard `src/tests/renderer/contrastTokens.test.ts` **escrito y corrido antes** del cambio.
     RED = **21 aserciones en rojo**: `success` light 2.59, `warning` light 3.16, `destructive` light 3.76,
     `info` en `bg-info/10` 4.49, `muted-foreground` light sobre `bg-muted` 4.34, y `destructive` dark 2.00.
     Luego GREEN.
   - **Guard:** parsea `:root`/`.dark` de `index.css` resuelto por `import.meta.url` (no `process.cwd()`,
     evita el hallazgo R3-GUARD-CWD), calcula WCAG (luminancia relativa + ratio) y `blend` alpha para el
     modelo `bg-{token}/10`; afirma ≥4.5 para token-como-texto (bg/card/muted/badge), `-foreground` sobre
     superficie sólida y `muted-foreground` sobre muted. 42 tests.
   - **Tokens ajustados (`index.css`), light:** `destructive 0 84.2% 60.2%→0 74% 42%`,
     `success 160 84% 39%→24%`, `warning 32 95% 44%→30%`, `info 221 83% 53%→45%`,
     `muted-foreground 215.4 16.3% 46.9%→44%`. **dark:** `destructive 0 62.8% 30.6%→0 91% 71%` y
     `destructive-foreground 210 40% 98%→222 47% 11%` (convención success/warning/info dark).
   - **Ratios verificados (mín. del set token-como-texto):** light destructivo 5.41, success 5.22,
     warning 5.27, info 5.81; dark destructivo 5.32; `muted-foreground` light sobre muted 4.81.
     Pares `-foreground` sobre sólido: 5.76–6.50 (light), 6.50–10.56 (dark).
   - **`pnpm test`:** 49 archivos, **367 tests** verdes (42 nuevos). **`pnpm lint`:** 0 errores, 83 warnings
     (baseline). **`pnpm type-check`:** exit 0. Guard re-ejecutado por el parent (spot check):
     `pnpm exec vitest run src/tests/renderer/contrastTokens.test.ts` → 42/42.
   - **Nota de proceso:** `pnpm test -- <filtro>` de este repo reenvía `--` literal a `vitest run` y corre
     toda la suite; para un archivo puntual usar `pnpm exec vitest run <path>`.
   - **Fuera de T5 (deuda detectada, no tocada):** dots de estado con hex crudo inline
     (`#ef4444`/`#f59e0b`/`#10b981`/`#a1a1aa`) en `HomePage.tsx:467-479,591-603`,
     `ReportsPage.tsx:340-351,359-365`, `TimeLogsTable.tsx:121-128`, `ui/combobox.tsx:228-234`.
     Son el mismo paleta cruda que T2 debía eliminar (el grep de aceptación solo miraba clases).
     Candidato a follow-up small task (UX-201 remanente).
   - **Review nativa (assess):** `medium` / `under_budget` (197 líneas cambiadas vs. boundary `6900332`;
     budget ~400) → `review_due: false`, sin transacción. El slice T5 queda por debajo del budget y no
     dispara review por sí solo (mismo criterio que T2).

## Review nativa (RDD on) — slice T1

- **Lineage:** `review-439b39e1d244269a`, 1 lente (`review-reliability`), riesgo medium,
  **aprobado** y authority quemada. Candidato: 11 paths / 480 líneas (follow-up Fase 1 + T1).
- **Wrinkle de runtime:** `gentle-ai review` tipa por defecto `agent: claude-code` (no detecta
  `OPENCODE=1`). El comando que devuelve `review assess` **omite** `--agent`, así que la primera
  transacción quedó mal tipada (collect sin `provider_task`). Se corrigió re-ejecutando el
  preflight canónico con `--agent=opencode`; el mismo lineage se re-ofreció (`replayed`) y el
  collect ya trajo el `provider_task`. **Siempre pasar `--agent=opencode`.**
- **Hallazgos advisory (no bloqueantes — trabajo posterior, NO re-review de este candidato):**
  - `R3-SWITCH-PROP-OVERRIDE` (WARNING): en `ui/switch.tsx:30-44` `{...props}` se esparce después
    de `type/role/aria-*`, permitiendo override del contrato accesible. Resolver en T3 (al cablear
    el Switch) omitiendo esos atributos del tipo o esparciendo primero.
  - `R3-BADGE-VARIANT-COVERAGE` (SUGGESTION): faltan asserts de `warning/info/secondary/outline`.
  - `R3-I18N-GUARD-LITERAL-ONLY` (SUGGESTION): el guard solo matchea keys literales y usa `process.cwd()`.

## Review nativa (RDD on) — slice T2+T3

- **Lineage:** `review-8561b95cead7d5c2`, 1 lente (`review-reliability`), riesgo medium,
  **aprobado** y authority quemada (target `sha256:cb5e9e42…0788`; base de la transacción
  `2025f117…7534`). Candidato: 21 paths / 753 líneas (T2 palette + T3 primitivas + follow-up Fase 1 + T1).
- **Cierre del advisory de T1:** `R3-SWITCH-PROP-OVERRIDE` resuelto en `ui/switch.tsx` (spread order +
  `Omit`) y cubierto por `switch.test.tsx` (caso de props hostiles).
- **Hallazgos advisory (no bloqueantes — trabajo posterior, NO re-review de este candidato):**
  - `R3-001` (WARNING, **pre-existing**, carry-over): en `TaskCommentDialog.tsx:114-125` el loader de
    notify no maneja el rechazo de `fetchTWPeopleForTask`; el guard `loadingPeople` podría quedar trabado.
    Mismo comportamiento que el handler anterior al refactor.
  - `R3-002` (WARNING, introduced): sin tests deterministas para los pickers Radix de
    `TaskCommentDialog`, el `Select` de `TasksTable` ni el toggle de `TimeLogsTable`.
  - `R3-003` (SUGGESTION, introduced): `workTimeFormSwitches.test.tsx:101-113` consulta el `document`
    global en vez del `container` de `render()`; endurecer con `within(container)`.

## Review nativa (RDD on) — slice T4

- **Lineage:** `review-4bab417793659aec`, 1 lente (`review-reliability`), riesgo medium,
  **aprobado** y authority quemada (`authority: burned`). Candidato: 13 paths / 596 líneas
  (T4: 2 primitivas nuevas + 4 tablas + 2 locales + 3 tests + docs de decisión).
- **Disparo:** `review_due: true` / `slice_budget_reached` (596 > budget ~400); base `29ef53a`.
- **Hallazgos advisory (no bloqueantes — trabajo posterior, NO re-review de este candidato):**
  - `R3-GUARD-CWD` (WARNING, introduced): `tableI18nGuard.test.ts:32` resuelve cada fuente desde
    `process.cwd()`; corrido desde otro directorio (o con otro `vitest root`) el guard lanza en vez de
    escanear y no verifica nada. Mismo patrón que `R3-I18N-GUARD-LITERAL-ONLY` (T1). Endurecer resolviendo
    desde `import.meta.url`/`__dirname`.
  - `R3-GUARD-DENYLIST` (SUGGESTION, introduced): el guard solo afirma ausencia de 10 literales; no afirma
    que las keys `table.*` existan y resuelvan en ambos locales. Agregar un assert de existencia/paridad de keys.
  - `R3-SEARCH-WIDTH` (SUGGESTION, introduced): `TableToolbarSearch` fija `max-w-sm`; al adoptarlo,
    `TimeLogsTable` pasa de `flex-1` sin tope a un ancho acotado. Confirmar si es deseado o exponer el ancho.
  - `R3-CLEAR-LABEL` (SUGGESTION, introduced): el botón de limpiar deriva su nombre accesible solo de
    `clearLabel`; con `showClear` sin label queda sin nombre. El test ejercita ese caso sin fijar el nombre.
