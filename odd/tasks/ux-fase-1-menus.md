# ODD — UX Fase 1: Sistema de menús

- **Rama:** `feat/ux-fase-1-menus` (base `origin/staging`, incluye `docs/UX-ROADMAP.md`)
- **Roadmap:** [`docs/UX-ROADMAP.md`](../../docs/UX-ROADMAP.md) §Fase 1 · §6.2
- **Estado:** `[x]` completado (commit de work unit en esta rama)
- **Runner de tests:** `pnpm test` (Vitest) · verificación: `pnpm test`, `pnpm lint`, `pnpm type-check`

## Objetivo

Eliminar la duplicidad de menús: quitar por completo el menú decorativo del renderer
(File/Edit/View/Help con 14 acciones no-op) y reemplazar el menú nativo de Electron
(no configurado, invisible con `frame:false`, con aceleradores no intencionales) por
un **menú de aplicación mínimo y explícito** con roles reales.

## Problema

- `AppBar.tsx:32-81` arma un menú File/Edit/View/Help donde **14 de 17 acciones** son `() => {}`.
- No hay ninguna llamada a `Menu.setApplicationMenu`/`Menu.buildFromTemplate` en `src/`: con
  `frame:false` queda el menú default de Electron (invisible) con aceleradores no intencionales,
  y en macOS faltaría el menú de aplicación requerido.
- Decisión de producto §6.2: eliminar el menú del renderer + menú nativo mínimo explícito.

## Alcance

**Dentro:**
- Eliminar `MenuBar.tsx`, `MenuHandler.tsx`, `MenuItem.tsx`, `src/types/menu.ts`.
- Rework de `AppBar.tsx`: quitar la barra de menú; mover "Buscar actualizaciones" y "Acerca de"
  a un botón compacto (dropdown) en la titlebar; quitar DevTools del renderer.
- `src/main/menu.ts` (nuevo): builder puro del template del menú nativo (roles reales).
- `src/main/index.ts`: instalar el menú con `Menu.setApplicationMenu`.
- Limpiar las keys i18n de menú que quedan sin uso (en/es).
- Documentar los atajos nativos en el README (UX-104).

**Fuera (deliberado):**
- No tocar `src/main/preload.ts` ni los handlers IPC (evita romper el conteo de handlers en tests).
- No tocar labels de accesibilidad de los controles de ventana (UX-601, Fase 6).
- Sin responsive móvil ni cambios de layout más allá del AppBar.

## Tareas

- [x] **T1 · AppBar sin menú + botón compacto de Ayuda** (UX-101)
  - Test-first: `src/tests/renderer/appBar.test.tsx` (RED) — no se renderiza "File"/"Edit"/"View";
    existe botón de Ayuda; "Check for updates" llama a `window.Main.checkForUpdates`.
  - Quitar `import MenuBar`, el array `menuItems`, el `<MenuBar>`, la función `toggleDevTools` y el uso de `ToggleDevTools`.
  - Agregar un `DropdownMenu` (primitiva existente `ui/dropdown-menu`) con `HelpCircle` (lucide),
    `aria-label` = `t('menu.help.help')`, items: "Check for updates" (mantiene `sessionStorage.setItem('manualUpdateCheck','1')` + `window.Main.checkForUpdates?.()`) y "About" (abre el diálogo existente).
  - Borrar `MenuBar.tsx`, `MenuHandler.tsx`, `MenuItem.tsx`, `src/types/menu.ts`.
  - Aceptación: cero ítems `() => {}`; sin barra File/Edit/View.

- [x] **T2 · Menú nativo mínimo y explícito** (UX-102)
  - Test-first: `src/tests/main/menu.test.ts` (RED) — `buildApplicationMenuTemplate(isMac, isDev)`:
    prod no incluye `reload`/`forceReload`/`toggleDevTools`; dev sí; siempre incluye `editMenu`;
    `appMenu` solo en mac.
  - `src/main/menu.ts`: `buildApplicationMenuTemplate(isMac: boolean, isDev: boolean): MenuItemConstructorOptions[]`
    (import **type-only** de electron para que el test corra sin electron en runtime).
  - `src/main/index.ts`: `Menu.setApplicationMenu(Menu.buildFromTemplate(buildApplicationMenuTemplate(process.platform === 'darwin', isDev)))` dentro de `app.whenReady()`.
  - Aceptación: aceleradores intencionales (edición, zoom, fullscreen; reload/DevTools solo en dev).

- [x] **T3 · Limpieza de keys i18n de menú** (soporte UX-101)
  - Quitar `menu.file.*`, `menu.edit.*`, `menu.view.*` y `menu.help.documentation`/`menu.help.versionLabel`
    de `en.ts` y `es.ts`; conservar `menu.help.help/checkForUpdates/about/aboutDialogTitle/aboutDesc/builtWith`.
  - Aceptación: sin keys huérfanas; en/es espejados.

- [x] **T4 · Documentar atajos** (UX-104)
  - README: sección "Atajos de teclado" con los aceleradores reales del menú nativo (edición, zoom,
    fullscreen; reload/DevTools solo en desarrollo).
  - Aceptación: todo atajo listado coincide con el comportamiento real.

## Criterios de aceptación (global)

1. `pnpm test`, `pnpm lint`, `pnpm type-check` en verde (salvo errores preexistentes documentados).
2. No existe menú renderer ni ítems sin acción.
3. Menú nativo instalado con roles reales y dev-only para reload/DevTools.
4. README documenta los atajos.

## Evidencia / progreso

- **TDD (RED→GREEN):** tests nuevos `src/tests/main/menu.test.ts` y `src/tests/renderer/appBar.test.tsx`
  escritos antes; RED observado (módulo `menu` inexistente / nodos File·Edit·View presentes), luego GREEN.
- **`pnpm test`:** 41 archivos, **294 tests** en verde (incluye 9 nuevos).
- **`pnpm lint`:** exit 0 — 0 errores, 82 warnings preexistentes (ninguno nuevo).
- **`pnpm type-check`:** exit 0 (tsc limpio).
- **Spot-check del orchestrator:** `pnpm test src/tests/main/menu.test.ts src/tests/renderer/appBar.test.tsx`
  → `Test Files 2 passed (2) · Tests 9 passed (9)`.
- **Grep:** sin referencias a las keys i18n eliminadas, sin imports de los módulos borrados, sin
  `ToggleDevTools` en el renderer.
- **Archivos:** `src/main/menu.ts` (nuevo), `src/renderer/components/AppBar.tsx` (rework),
  `src/main/index.ts` (instala el menú), locales en/es (trim), `README.md` (atajos); borrados
  `MenuBar/MenuHandler/MenuItem.tsx` y `src/types/menu.ts`.

## Siguiente paso

Review nativa del work unit (RDD on) y, si aprueba, PR a `staging`.

## Follow-up post-merge (PR #24)

- **Rama:** `chore/ux-fase-1-followup` (base `origin/staging` tras el merge `66d5210`).
- **R3-001 (WARNING) — resuelto como falso positivo, con cobertura añadida.**
  El review marcó "activación por teclado no garantizada/no probada" para los
  `DropdownMenuItem` con `onClick`. Verificado contra el código de Radix
  (`@radix-ui/react-menu@2.1.24`): en `onKeyDown` para Enter/Space el ítem hace
  `event.currentTarget.click()`, por lo que `onClick` **sí** dispara. El foco tras
  abrir con mouse queda en el content (`role=menu`), no en el ítem; la ruta real
  de teclado es `ArrowDown` (enfoca) → `Enter`/`Space`. Se migró igualmente a la
  API documentada `onSelect` (menos frágil ante cambios internos de Radix) y se
  agregaron dos tests que prueban la activación por teclado.
- **R3-002 (SUGGESTION) — guard añadido.** `src/tests/renderer/i18nMenuKeys.test.ts`
  escanea el código del renderer y falla si vuelve a referenciarse una key de menú
  eliminada (`menu.file/edit/view.*`, `menu.help.documentation`, `menu.help.versionLabel`).
- **Roadmap:** tildados UX-101, UX-102 y UX-104 (entregados en PR #24); UX-103 marcado
  como no aplicable (menú renderer eliminado).
- **Verificación:** `pnpm test` 42 archivos / **297 tests** en verde; `pnpm lint` 0 errores
  (82 warnings preexistentes); `pnpm type-check` limpio.
