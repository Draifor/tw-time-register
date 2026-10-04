# ODD — UX Fase 3: Layout, ventana y responsive

- **Rama:** `feat/ux-fase-3-layout` (base `feat/ux-fase-2-design-system` / PR #25 — **stacked**: Fase 3 toca `AppBar`/`NavBar`/tablas que Fase 2 modificó. Al mergear #25, rebasar sobre `staging`).
- **Roadmap:** [`docs/UX-ROADMAP.md`](../../docs/UX-ROADMAP.md) §Fase 3 (UX-301..UX-307)
- **Estado:** en progreso
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

- [ ] **T2 · Shell: reserva, ancho compartido y responsive** (UX-302, UX-303, UX-304, UX-307)
  - `App.tsx`: reservar la altura real del AppBar (`h-8`); `min-h-screen` en el root; contenido
    `flex-1` con el mismo ancho máximo y padding que el nav (`max-w-7xl mx-auto px-4 py-6`).
  - `NavBar.tsx`: `sticky top-8`; labels de los links ocultas debajo de `lg` (icon-only) con
    `aria-label`, para entrar a 900px sin recorte ni overflow.
  - Aceptación: sin hueco AppBar/NavBar; bordes nav/contenido alineados; a 900px sin overflow horizontal.
  - Test-first: excepción justificada — cambios de clases presentacionales sin test determinista
    (se deja "pendiente de ojo" + verificación manual a 900px).

- [ ] **T3 · Toolbars y tablas a 900px** (UX-305)
  - Toolbars con wrap; revisar `min-w-[960px]` de `TimeLogsTable` y anchos fijos de entradas en
    `WorkTimeForm`/`TasksTable`.
  - Aceptación: usable sin scroll horizontal forzado en 900px.
  - Test-first: excepción justificada (presentacional; sin harness de render).

- [ ] **T4 · Icono Maximize sincronizado** (UX-306)
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
