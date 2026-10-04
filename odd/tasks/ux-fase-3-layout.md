# ODD — UX Fase 3: Layout, ventana y responsive

- **Rama:** `feat/ux-fase-3-layout` (base `origin/staging`; PR #25 ya mergeado — `0511872`). La rama contiene solo los commits de Fase 3.
- **Roadmap:** [`docs/UX-ROADMAP.md`](../../docs/UX-ROADMAP.md) §Fase 3 (UX-301..UX-307)
- **Estado:** `[x]` tareas T1–T4 completas (UX-301..UX-307); **pendiente: PR a `staging`**. Review nativa: `medium` / `under_budget`, sin transacción.
- **Runner de tests:** `pnpm test` (Vitest) · verificación: `pnpm test`, `pnpm lint`, `pnpm type-check`
- **Estrategia de entrega:** `single-pr` a `staging` (pronóstico ~190 líneas autoradas, por debajo del presupuesto de review ~400).

## Objetivo

El shell deja de romperse en tamaños chicos: la ventana no puede achicarse a un tamaño que rompa el
layout, el AppBar/NavBar no dejan huecos ni se solapan, los anchos del nav y del contenido coinciden,
el NavBar entra a 900px y las tablas no fuerzan scroll horizontal en el tamaño mínimo.

## Decisión de producto (UX-301) — RESUELTA

- **Tamaño mínimo de ventana:** `minWidth: 900`, `minHeight: 600`, con default de arranque
  `1000 × 640` (el default actual es 800×600, por debajo del mínimo). Decidido con el usuario
  (2026-10-04), opción recomendada.

## Problema (mapeo read-only, evidencia path:line)

- `src/main/index.ts:54-68`: `new BrowserWindow` **sin** `minWidth`/`minHeight`; defaults
  `const height = 600`, `const width = 800` (`:18-19`). La ventana se puede achicar a antojo.
- `src/renderer/App.tsx:31`: reserva `h-14` (56px) para el AppBar, pero tras Fase 1 el AppBar mide
  `h-8` (32px) (`AppBar.tsx:35`) → **hueco de 24px**, no solape. `NavBar.tsx:32` usa `sticky top-14`
  (56px): coincide con lo reservado, no con la altura real.
- `App.tsx:37` `container mx-auto p-6` vs `NavBar.tsx:33` `max-w-7xl mx-auto` → anchos máximos y
  padding horizontal distintos (bordes desalineados). `App.tsx:29` sin `min-h-screen`.
- `NavBar.tsx:35` h1 de marca + `:36-53` 5 links con label + cluster derecho → a 900px (< `lg`)
  no entra holgado.
- `TimeLogsTable.tsx`: tabla con `min-w-[960px]` y toolbars sin wrap → scroll horizontal a 900.
- `AppBar.tsx:10,23-26`: `isMaximize` es estado local toggled por el botón; **no** escucha
  `maximize`/`unmaximize` reales (doble-click en la titlebar desincroniza el icono).

## Alcance

**Dentro:**
- `minWidth`/`minHeight` de la ventana y nuevo default de arranque.
- Reserva de altura del AppBar + `top-*` del NavBar según la altura real (32px).
- Ancho máximo compartido nav/contenido; `min-h-screen` + `flex-1`; fondo consistente.
- NavBar usable a 900px (compactar labels debajo del breakpoint, con nombre accesible).
- Toolbars/cards y `min-w` de tablas para no forzar scroll a 900.
- Icono Maximize/restore sincronizado con el estado real de la ventana.

**Fuera (deliberado):**
- Quitar el `<h1>` de marca del NavBar y jerarquía de encabezados (UX-004, Fase 0).
- Cualquier cambio de flujo/feedback (Fase 4), accesibilidad profunda (Fase 5), i18n (Fase 6).
- Tests E2E visuales (no existen en el repo) — el remanente es "pendiente de ojo".

## Tareas

- [x] **T1 · Tamaño mínimo de ventana** (UX-301)
  - `src/main/index.ts`: `minWidth: 900`, `minHeight: 600` en `BrowserWindow`; defaults `width = 1000`, `height = 640`.
  - Test-first: excepción justificada — `BrowserWindow` no es instanciable en Vitest; la verificación
    es manual (la ventana no baja de 900×600) y se documenta.
  - Aceptación: `minWidth`/`minHeight` presentes; default ≥ mínimo.

- [x] **T2 · Shell: reserva, ancho compartido y responsive** (UX-302, UX-303, UX-304, UX-307)
  - `App.tsx`: reservar la altura real del AppBar (`h-8`); `min-h-screen` en el root; contenido
    `flex-1` con el mismo ancho máximo y padding que el nav (`max-w-7xl mx-auto px-4 py-6`).
  - `NavBar.tsx`: `sticky top-8`; labels de los links ocultas debajo de `lg` (icon-only) con
    `aria-label`, para entrar a 900px sin recorte ni overflow.
  - Aceptación: sin hueco AppBar/NavBar; bordes nav/contenido alineados; a 900px sin overflow horizontal.
  - Test-first: excepción justificada — cambios de clases presentacionales sin test determinista
    (se deja "pendiente de ojo" + verificación manual a 900px).

- [x] **T3 · Toolbars y tablas a 900px** (UX-305)
  - Toolbars con wrap; revisar `min-w-[960px]` de `TimeLogsTable` y anchos fijos de entradas en
    `WorkTimeForm`/`TasksTable`.
  - Aceptación: usable sin scroll horizontal forzado en 900px.
  - Test-first: excepción justificada (presentacional; sin harness de render).

- [x] **T4 · Icono Maximize sincronizado** (UX-306)
  - `windowIpc.ts`: emitir `window:maximized` (bool) en `maximize`/`unmaximize`; `ipcMain.handle('window:isMaximized')`.
  - `preload.ts`: `isMaximized(): Promise<boolean>`; suscripción vía `on/off`.
  - `AppBar.tsx`: estado derivado del evento + query inicial; cleanup en unmount.
  - Test-first: `appBar.test.tsx` — RED = el icono no refleja el estado emitido; GREEN tras suscribir.
  - Aceptación: el icono refleja el estado real, incluido doble-click en la titlebar.

## Criterios de aceptación (global)

1. `pnpm test`, `pnpm lint`, `pnpm type-check` en verde (salvo warnings preexistentes).
2. Ventana: no baja de 900×600; default 1000×640.
3. Shell: sin hueco/solape AppBar/NavBar; bordes nav/contenido alineados.
4. A 900px: NavBar sin recorte/overflow; tablas sin scroll horizontal forzado.
5. Icono Maximize refleja el estado real.

## Evidencia / progreso

- **T1** — commit `feat(layout): enforce 900x600 window minimum (UX-301)`.
  - `src/main/index.ts`: `minWidth: 900`, `minHeight: 600`; defaults `width = 1000`, `height = 640`.
  - Test-first: excepción justificada — `BrowserWindow` no es instanciable en Vitest.
  - **`pnpm type-check`:** exit 0. **Pendiente de ojo:** la ventana no baja de 900×600 (manual).

- **T2** — commit `fix(layout): align shell height and widths, responsive navbar (UX-302..304, UX-307)`.
  - **Ruta:** direct inline (edición mecánica ya-entendida sobre archivos en contexto; sin investigación nueva).
  - `App.tsx`: root `flex min-h-screen flex-col bg-background`; reserva del AppBar `h-8` (altura real);
    contenido `mx-auto w-full max-w-7xl flex-1 px-4 py-6` (mismo ancho/padding que el nav).
  - `NavBar.tsx`: `sticky top-8` (antes `top-14`); labels de los links ocultas debajo de `lg`
    (`<span className="hidden lg:inline">`) con `aria-label`/`title` para el nombre accesible;
    username con `max-w-[12rem] truncate` para no desbordar a 900px.
  - Test-first: excepción justificada — clases presentacionales, sin test determinista.
  - **`pnpm type-check`:** exit 0. **`pnpm lint`:** 0 errores, 83 warnings (baseline).
  - **Pendiente de ojo:** sin hueco AppBar/NavBar; sin overflow a 900px (manual).

- **T3** — commit `fix(layout): wrap table toolbars and lower TimeLogs min width (UX-305)`.
  - **Ruta:** delegated direct (1 writer). Trigger: requería inspeccionar los internals de 4 componentes de tabla.
  - `ui/table-toolbar.tsx`: `TableToolbar` con `flex-wrap`; `TableToolbarSearch` con `min-w-0` (el search cede antes que el cluster de acciones). Compartido por las cuatro tablas.
  - `TimeLogsTable.tsx`: `min-w-[960px]` → `min-w-[840px]` (contenido útil a 900px ≈ 868px). El virtualizer mide filas dinámicamente, así que el `min-w` era piso de legibilidad, no requisito de virtualización.
  - **Revisados sin cambios:** `TasksTable` (grid ya responsive), `WorkTimeForm` (entry grid ya `flex flex-wrap` con anchos <200px), `TypeTasksTable`/`DataTable` (heredan el toolbar).
  - Test-first: excepción justificada (presentacional, sin harness de render).
  - **`pnpm type-check`:** exit 0. **`pnpm lint`:** 0 errores, 83 warnings. **`pnpm exec vitest run src/tests/renderer`:** 31 archivos, 156 tests verdes.
  - **Pendiente de ojo:** a 900px sin scroll horizontal en las cuatro tablas (manual).

- **T4** — commit `feat(window): sync AppBar maximize icon with real window state (UX-306)`.
  - **Ruta:** delegated direct (1 writer). Trigger: IPC nuevo + test determinista RED→GREEN.
  - `windowIpc.ts`: `window:maximized` emitido en `maximize`/`unmaximize` (guard `isDestroyed`); `ipcMain.handle('window:isMaximized')` con `removeHandler` defensivo (createWindow se re-ejecuta en macOS `activate`).
  - `preload.ts`: `isMaximized()` expuesto; el bridge `on/off` ya cubría el evento.
  - `AppBar.tsx`: estado derivado de la query inicial + suscripción con cleanup; `handleToggle` ya no invierte de forma optimista.
  - **TDD (RED→GREEN):** 4 tests nuevos; RED = 4 fallos (`Unable to find role="button" name "Restore"`, `onMock` 0 llamadas, flip optimista); GREEN = 10/10.
  - **`pnpm exec vitest run src/tests/renderer/appBar.test.tsx`:** 10/10. **`pnpm type-check`:** exit 0. **`pnpm lint`:** 0 errores, 83 warnings.
  - **Pendiente de ojo:** doble-click en la titlebar frameless (manual, sin E2E).

- **Gate de fase (tras T1–T4)** — `pnpm test`: 51 archivos, **378 tests** verdes (4 nuevos); `pnpm lint`: 0 errores, 83 warnings (baseline); `pnpm type-check`: exit 0.

## Review nativa (RDD on) — evaluación Fase 3

- **Assess:** `medium` / `under_budget` (10 paths / 269 líneas cambiadas vs. boundary `23fde1c`; presupuesto ~400) → `review_due: false`, sin transacción. Razón de riesgo: `executable_change` (`src/main/index.ts`). El slice queda por debajo del presupuesto; no dispara review por sí solo.
