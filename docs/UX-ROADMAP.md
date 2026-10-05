# Roadmap de UI/UX y Arquitectura de Información — TW Time Register

> Auditoría profunda de experiencia de usuario, organización de secciones, menús, layout,
> consistencia visual, accesibilidad e i18n del renderer (y de la ventana Electron).
> Documento de trabajo: define hallazgos, acciones y criterios de aceptación para ejecutarlos por fases.
> Mismo formato que [`PERFORMANCE-ROADMAP.md`](PERFORMANCE-ROADMAP.md).

- **Fecha de la auditoría:** 2026-10-04
- **Versión auditada:** v1.13.0
- **Alcance:** `src/renderer/**`, `src/main/index.ts`, `src/main/ipc/windowIpc.ts`, `src/main/preload.ts`, `src/renderer/index.css`
- **Estado general:** `En progreso` — Fases 0–6 implementadas (PR #24, #25, #26, rama `feat/ux-fase-0-ia`, PR #28/#37, rama `feat/ux-fase-5-a11y` y cadena `feat/ux-fase-6-i18n-cleanup`); el backlog de Reportes (Fase 7) pendiente
- **Método:** lectura directa del código + dos mapeos read-only (shell/navegación y componentes de features) con evidencia `archivo:línea`, y spot-checks puntuales de los hallazgos de mayor impacto
- **Nota:** este documento **no autoriza** implementación; define qué hacer y en qué orden. La Fase 0 requiere decisiones de producto tuyas antes de tocar código.

---

## 1. Resumen ejecutivo

La app creció feature por feature y hoy tiene **features sólidas con una capa de producto sin consolidar**. La funcionalidad está; lo que falta es una arquitectura de información, un sistema de menús real y un design system coherente. No hay nada roto de gravedad, pero hay mucha **deuda de UX acumulada** que hace que la app se sienta más "conjunto de pantallas" que "producto".

Los 8 focos de mayor impacto:

1. **Duplicidad de menús y menú muerto.** El menú nativo de Electron nunca se configura (queda el menú default, invisible con `frame:false`, con aceleradores no documentados) y el menú del renderer es en gran parte decorativo: **14 de sus 17 acciones son `() => {}`**.
2. **La acción primaria no es el centro.** Al abrir la app se llega a un dashboard (`/`), no a **registrar tiempo** (`/worktime`), que es el objetivo del producto. La sección se llama "Work Time"/"Registro" en el nav y "Time Registration" en la página.
3. **Identidad duplicada.** "TW Time Register" aparece en la titlebar, en el `<h1>` del NavBar y en el About; cada página emite además su propio `<h1>` → **dos `<h1>` por pantalla**.
4. **Sin design system real.** Colores crudos de Tailwind (`bg-slate-800`, `text-emerald-600`, `bg-red-100`, amber) en vez de tokens semánticos; toggles y dropdowns hechos a mano cuando ya existen `Switch`/`DropdownMenu`; spacing, iconos y badges inconsistentes.
5. **Cuatro tablas distintas.** `TimeLogsTable`, `TasksTable`, `TypeTasksTable` y `DataTable` tienen cuatro toolbars, cuatro estados vacíos y dos paradigmas de edición inline; el de `DataTable` está hardcodeado en inglés.
6. **Deuda de accesibilidad (WCAG 2.2 AA).** Menús no operables por teclado ni anunciados, `htmlFor` que apunta a inputs sin `id`, botones icon-only sin nombre accesible, diálogos sin `DialogDescription`, estado por color.
7. **Layout/ventana.** No hay `minWidth`/`minHeight` (la ventana se puede achicar a antojo), el AppBar mide ~60px pero reserva 56px (solape con el NavBar), `container` vs `max-w-7xl` desalineados, y overflow horizontal a <900px.
8. **Estados y feedback.** Errores que se tragan en silencio (Home), submit sin estado pending en el flujo principal, borrar entrada sin confirmación ni undo, wizards sin indicador de paso, y un botón **"Debug API"** visible para el usuario.

Además hay **copy y jerga inconsistentes** (Register vs Save) y **strings hardcodeados en inglés** que quedaron fuera de i18n.

---

## 2. Diagnóstico: arquitectura de información y los dos menús

### 2.1 Secciones actuales

| Ruta | Sección (nav) | Página | Rol real |
|---|---|---|---|
| `/` | Home | `HomePage` | Dashboard: 2 CTAs, Quick Stats, Monthly, Weekly, Today's Log |
| `/worktime` | Work Time / Registro | `WorkTimeForm` | **Flujo primario**: registrar tiempo + timer |
| `/tasks` | Tasks | `TasksPage` | 3 tabs: logs / tasks / types |
| `/reports` | Reports | `ReportsPage` | Horas por tarea y por día |
| `/settings` | Settings | `SettingsPage` | 7 cards: idioma, TeamWork, horario, días, festivos, plantillas, BD |

Hoy hay **5 rutas de primer nivel** sin agrupación ni jerarquía, con `Home` como landing. `TasksPage` ya agrupa 3 vistas por tabs, así que **el patrón de agrupar existe pero no se aplicó al resto**.

### 2.2 Los dos menús (duplicidad)

**Menú nativo de Electron — no existe como tal.**
- No hay ninguna llamada a `Menu.setApplicationMenu`, `Menu.buildFromTemplate`, `globalShortcut` ni `accelerator` en `src/` (verificado por grep).
- Con `frame: false` (`src/main/index.ts:59`) la barra de menú nativa no se dibuja, pero el **menú default de Electron sigue activo** a nivel de aceleradores (reload, DevTools, zoom, fullscreen, quit/close) — comportamiento invisible y no documentado para el usuario.
- En macOS esto además es un problema: una app sin menú de aplicación explícito se comporta mal (falta el menú mínimo requerido).

**Menú del renderer — decorativo.**
- `AppBar.tsx:32-81` → `MenuBar.tsx` → `MenuHandler.tsx` → `MenuItem.tsx`.
- Solo **3 acciones reales**: Toggle DevTools (`AppBar.tsx:61`), Check for updates (`:72-76`), About (`:78`).
- **14 no-ops** (`action: () => {}`): File → New/Open/Save/Export (+ PDF/HTML), Edit → Undo/Redo/Cut/Copy/Paste, View → Zoom+/Zoom−/Full Screen.
- No tiene semántica de menú: `MenuHandler.tsx:26-33` es un `<button>` sin `role`, `aria-haspopup` ni `aria-expanded`; los submenús abren **solo por CSS `group-hover`** (`MenuItem.tsx:23`) → inalcanzables por teclado; varios menús pueden quedar abiertos a la vez (estado `isOpen` independiente por componente).
- Foco invisible: `focus:outline-hidden` sin `ring` (`MenuHandler.tsx:28`, `MenuItem.tsx:17`).

> **Conclusión:** hay dos "menús" y ninguno cumple su función. El nativo es invisible/no intencional; el del renderer es una maqueta. Fase 1 resuelve esto.

---

## 3. Leyenda

**Severidad:** 🔴 Alta · 🟡 Media · ⚪ Baja

**Estado:** `[ ]` pendiente · `[~]` en progreso · `[x]` hecho · `[!]` bloqueado

> Las referencias de línea corresponden al estado del código en la fecha de auditoría; pueden desplazarse con los cambios.

---

## 4. Hallazgos transversales (bugs de UX/correctitud)

| ID | Hallazgo | Ubicación | Detalle |
|---|---|---|---|
| UXBUG-01 | Menú renderer mayormente muerto | `AppBar.tsx:36-64` | 14/17 acciones son `() => {}`; engaña al usuario. |
| UXBUG-02 | Menú sin teclado ni ARIA | `MenuHandler.tsx:26-33`, `MenuItem.tsx:22-34` | Sin `role=menu`, `aria-expanded`, flechas, Escape ni `Enter`; submenús hover-only. |
| UXBUG-03 | Sin `minWidth`/`minHeight` de ventana | `src/main/index.ts:53-67` | La ventana se puede reducir por debajo de 800×600 y el layout se rompe. |
| UXBUG-04 | Solape AppBar/NavBar | `App.tsx:31` (`h-14`), `AppBar.tsx:84-85`, `NavBar.tsx:32` (`top-14`) | El AppBar (~32px título + ~28px menú ≈ 60px) excede los 56px reservados. |
| UXBUG-05 | Dos `<h1>` por página | `NavBar.tsx:35` + cada página | NavBar emite un `<h1>` global y la página otro → jerarquía rota. |
| UXBUG-06 | Errores silenciosos en Home | `HomePage.tsx:56,68,85` | `catch {}` sin UI de error → fallas se ven como "cero datos". |
| UXBUG-07 | Submit sin pending/doble-submit | `WorkTimeForm.tsx:529-539,1360` | El flujo primario no deshabilita el botón ni muestra spinner (a diferencia del resto). |
| UXBUG-08 | Borrar entrada sin confirmación ni undo | `WorkTimeForm.tsx:290-299`, `:1271-1283` | El atajo `Ctrl+Escape` también borra la última sin red de seguridad. |
| UXBUG-09 | Botón "Debug API" en UI de usuario | `PullFromTWDialog.tsx:325-364` | Panel de JSON crudo expuesto en producción. |
| UXBUG-10 | Labels sin asociación programática | `WorkTimeForm.tsx:307,317,381,405` | `htmlFor` apunta a `Combobox`/`InputTime` que no renderizan `id`. |
| UXBUG-11 | Toggles/dropdowns hechos a mano | `WorkTimeForm.tsx:448-482`, `TaskCommentDialog.tsx:226-327` | Reinventan `Switch`/`DropdownMenu` y pierden semántica y teclado. |
| UXBUG-12 | Estado por color solamente | `TimeLogsTable.tsx:118-126`, `combobox.tsx:227-235` | No hay texto/icono alternativo para daltonismo ni lectores. |
| UXBUG-13 | Formatos de hora mezclados | `WorkTimeForm.tsx:400` (`H:i`) vs `:414,433` (`h:i K`) | 24h y 12h en el mismo formulario; `time-picker.tsx:61` usa `H:i`. |
| UXBUG-14 | Diálogos sin `DialogDescription` | `PullFromTWDialog.tsx:240`, `ImportTasksDialog.tsx:300`, `DeleteEntryDialog.tsx:35` | Advertencia de a11y de Radix; falta contexto para lectores. |
| UXBUG-15 | Diálogos en curso descartables por overlay/ESC | `PullFromTWDialog.tsx:231`, `ImportTasksDialog.tsx:291` | Se puede cerrar una operación en vuelo (solo el botón Cancel está deshabilitado). |

---

## 5. Fases y tareas

### Fase 0 — Arquitectura de información y decisiones de producto
> Objetivo: definir **qué secciones existen y cuál es la acción primaria** antes de tocar UI. Todo lo demás depende de esto. Requiere tu decisión (ver §6).

- [x] **UX-001 · 🔴 Hacer de "Registrar tiempo" el centro del producto** — ✅ 2026-10-04, rama `feat/ux-fase-0-ia` (opción b: Home operativo)
  - **Ubicación:** `App.tsx:43-49`, `NavBar.tsx:23-29`, `HomePage.tsx`
  - **Problema:** el landing es un dashboard; el flujo primario vive detrás de un CTA.
  - **Acción:** elegir una de las dos estrategias (§6, Decisión 1) y aplicarla: **(a)** que `/worktime` sea la ruta inicial y el dashboard pase a un secundario, o **(b)** mantener el dashboard pero convertirlo en un verdadero "home" operativo con la acción de registrar siempre a un click y el timer visible.
  - **Aceptación:** desde el arranque, registrar tiempo requiere como máximo **1 click**.

- [x] **UX-002 · 🔴 Definir el mapa de secciones definitivo** — ✅ 2026-10-04, rama `feat/ux-fase-0-ia` (6 secciones)
  - **Ubicación:** `App.tsx:43-49`, `NavBar.tsx:23-29`, `TasksPage.tsx:15-42`
  - **Problema:** 5 ítems de primer nivel sin agrupación; catálogos (tasks/types) ya agrupados por tabs pero desconectados del resto.
  - **Acción:** proponer un mapa (p. ej. `Registrar` · `Historial` · `Reportes` · `Catálogo` (tareas+tipos) · `Ajustes`, con Home/dashboard integrado o como inicio). Definir qué es sección y qué es tab.
  - **Aceptación:** un mapa de IA escrito y aprobado; el nav refleja solo secciones de primer nivel.

- [x] **UX-003 · 🔴 Unificar nombres de sección y jerga** — ✅ 2026-10-04, rama `feat/ux-fase-0-ia` (glosario aplicado)
  - **Ubicación:** `en.ts:122`, `es.ts:122`, `en.ts:458`, `WorkTimeForm.tsx:1342-1363`
  - **Problema:** "Work Time"/"Registro" (nav) vs "Time Registration" (página); "Add Entry" + "Register" como acciones; "Register" no se usa en ningún otro lado.
  - **Acción:** glosario de copy (una sección = un nombre; una acción = un verbo) y aplicarlo.
  - **Aceptación:** sin sinónimos para la misma sección/acción en la app.

- [x] **UX-004 · 🟡 Branding único y jerarquía de encabezados** — ✅ 2026-10-04, rama `feat/ux-fase-0-ia` (un `<h1>` por ruta)
  - **Ubicación:** `AppBar.tsx:85-88,122`, `NavBar.tsx:35`, páginas (`HomePage.tsx:237`, `TasksPage.tsx:15`, `ReportsPage.tsx:192`, `SettingsPage.tsx:382`, `WorkTimeForm.tsx:1294`)
  - **Acción:** quitar el `<h1>` de marca del NavBar; AppBar solo logo/ícono; **un solo `<h1>` por página**; `CardTitle`/`CardHeader` como `h2`/`h3` reales.
  - **Aceptación:** 1 `<h1>` por ruta y jerarquía h1→h2→h3 sin saltos.

- [x] **UX-005 · 🟡 Landmarks y estructura semántica** — ✅ 2026-10-04, rama `feat/ux-fase-0-ia` (`<main>` + `<nav aria-label>`)
  - **Ubicación:** `App.tsx:37` (div de contenido), `NavBar.tsx:36` (nav sin nombre)
  - **Acción:** envolver el contenido en `<main>`; `aria-label` en `<nav>`; considerar skip-link.
  - **Aceptación:** landmarks presentes en todas las rutas.

---

### Fase 1 — Sistema de menús (elimina la duplicidad)
> Objetivo: que exista **un** modelo de menú claro, intencional, accesible y documentado.

- [x] **UX-101 · 🔴 Decidir el destino del menú del renderer** — ✅ 2026-10-04, PR #24 (opción a: menú renderer eliminado; acciones útiles a un dropdown compacto)
  - **Ubicación:** `AppBar.tsx:32-81`, `MenuBar.tsx`, `MenuHandler.tsx`, `MenuItem.tsx`
  - **Acción:** según §6 Decisión 2: **(a)** eliminar el menú completo y mover sus 3 acciones útiles a un botón/engranaje o a Ajustes; **(b)** conservarlo como menú real (solo acciones vivas); o **(c)** reemplazarlo por un menú nativo real.
  - **Aceptación:** cero ítems `() => {}` visibles en la app.

- [x] **UX-102 · 🔴 Menú nativo de Electron explícito y documentado** — ✅ 2026-10-04, PR #24 (`src/main/menu.ts` con roles reales; reload/DevTools solo en dev)
  - **Ubicación:** `src/main/index.ts` (no hay `Menu`)
  - **Acción:** construir un `Menu` mínimo con roles reales (reload, DevTools, zoom, fullscreen, quit/close) o `Menu.setApplicationMenu(null)` si se decide que no haya menú; en macOS proveer el menú de aplicación requerido.
  - **Aceptación:** aceleradores intencionales y listados en el README; comportamiento consistente en Windows/macOS.

- [ ] **UX-103 · 🔴 Menú accesible (si se conserva en renderer)** — *No aplica: el menú del renderer se eliminó (UX-101 opción a).*
  - **Ubicación:** `MenuHandler.tsx:26-33`, `MenuItem.tsx:22-34`
  - **Acción:** `role="menu"/"menuitem"`, `aria-haspopup`, `aria-expanded`, navegación con flechas/Home/End/Escape/Enter, foco visible (`ring`), un solo menú abierto. Evaluar usar `DropdownMenu`/`Menubar` de Radix (ya en dependencias) en vez del componente casero.
  - **Aceptación:** menú 100% operable solo con teclado y anunciado por lector de pantalla.

- [x] **UX-104 · 🟡 Atajos reales y documentados** — ✅ 2026-10-04, PR #24 (README "Atajos de teclado" con los aceleradores reales)
  - **Ubicación:** `AppBar.tsx:61-64`, `useKeyboardShortcuts.ts`
  - **Acción:** exponer/alinear atajos (DevTools, zoom, fullscreen) con los roles nativos y mostrarlos en la UI (p. ej. junto al ítem).
  - **Aceptación:** todo atajo visible o documentado coincide con el comportamiento real.

---

### Fase 2 — Design system y consistencia visual
> Objetivo: una sola fuente de verdad visual. Base: `index.css` (tokens shadcn) + `components/ui`.

- [x] **UX-201 · 🔴 Migrar colores crudos a tokens semánticos** — ✅ 2026-10-04, PR #25
  - **Ubicación:** `AppBar.tsx:85` (`bg-slate-800`), `MenuHandler.tsx:28-29`, `LiveTimer.tsx:54` (`text-red-500`), `TotalTimeDay.tsx:131-135`, `TimeLogsTable.tsx:186,193,776,783`, `NavBar.tsx:66,115-116`, `WorkTimeForm.tsx:359-362`, diálogos Pull/Import
  - **Acción:** reemplazar por `background/foreground/card/muted/destructive/success` (agregar tokens `success`/`warning` si faltan en `index.css`); badges de estado como variantes de un componente único.
  - **Aceptación:** grep sin `bg-slate-800`, `text-red-500`, `emerald-*`, `amber-*` fuera de `index.css`/tokens.

- [x] **UX-202 · 🟡 Usar primitivas en vez de controles caseros** — ✅ 2026-10-04, PR #25
  - **Ubicación:** `WorkTimeForm.tsx:448-482` (switch), `TaskCommentDialog.tsx:226-327` (dropdowns)
  - **Acción:** `Switch` (o `role="switch"`), `DropdownMenu`/`Select`; `InsertDivider` con `Button`.
  - **Aceptación:** sin `<input type=checkbox>` con estilos `peer` ni dropdowns propios.

- [x] **UX-203 · 🟡 Componente de estado/badge y patrones únicos** — ✅ 2026-10-04, PR #25
  - **Ubicación:** `TimeLogsTable.tsx:185-198` y `:775-788` (badge duplicado), `TasksTable.tsx:131` vs `WorkTimeForm.tsx:1343,1361`
  - **Acción:** extraer `StatusBadge`; unificar spacing (`gap-*` sobre `space-y-*`), tamaño de iconos, `Button variant/size`.
  - **Aceptación:** un componente de badge; spacing consistente en tablas y forms.

- [x] **UX-204 · 🔴 Unificar las cuatro tablas** — ✅ 2026-10-04, PR #25
  - **Ubicación:** `TimeLogsTable.tsx:577-673`, `TasksTable.tsx:103-141`, `TypeTasksTable.tsx:60-73`, `DataTable.tsx:210-226`
  - **Acción:** `TableToolbar` + `EmptyState` compartidos; una implementación compartida de edición inline **por forma de dato** (fila para `TimeLogsTable`, celda para catálogos vía `DataTable`), no un único paradigma forzado; traducir los estados de `DataTable`.
  - **Aceptación:** un toolbar y un empty-state reutilizados; sin copy hardcodeado en inglés.

- [x] **UX-205 · 🟡 Repaso de contraste y tipografía** — ✅ 2026-10-04, PR #25
  - **Ubicación:** `NavBar.tsx:66` (`emerald-600`), `:116` (`amber-500`), `HomePage.tsx:610-617`
  - **Acción:** medir y ajustar a AA (≥4.5:1 en texto normal); fijar escala tipográfica y radios.
  - **Aceptación:** todos los textos normales ≥4.5:1 (verificado).

---

### Fase 3 — Layout, ventana y responsive
> Objetivo: el shell deja de romperse en tamaños chicos y todo encaja.

- [x] **UX-301 · 🔴 Tamaño mínimo de ventana (o responsive real)** — ✅ 2026-10-04, PR #26 (mínimo 900×600; default 1000×640)
  - **Ubicación:** `src/main/index.ts:53-67`
  - **Acción:** `minWidth: 900, minHeight: 600` (ajustable) o hacer el layout realmente adaptable.
  - **Aceptación:** la ventana no se puede reducir a un tamaño que rompa el layout.

- [x] **UX-302 · 🟡 Corregir solape AppBar/NavBar** — ✅ 2026-10-04, PR #26 (reserva h-8 real; NavBar top-8)
  - **Ubicación:** `App.tsx:31`, `AppBar.tsx:84-85`, `NavBar.tsx:32`
  - **Acción:** reservar la altura real del AppBar (medir y fijar, o hacerlo auto), ajustar `top-*` del NavBar.
  - **Aceptación:** sin superposición ni salto de 4px en ningún zoom.

- [x] **UX-303 · 🟡 Alinear anchos y scaffold** — ✅ 2026-10-04, PR #26 (max-w-7xl compartido; min-h-screen + flex-1)
  - **Ubicación:** `App.tsx:37` (`container`), `NavBar.tsx:33` (`max-w-7xl`)
  - **Acción:** un único ancho máximo compartido; `min-h-screen` + `flex-1` en el contenido; opcional footer.
  - **Aceptación:** bordes de NavBar y contenido alineados.

- [x] **UX-304 · 🟡 NavBar responsive** — ✅ 2026-10-04, PR #26 (icon-only < lg con aria-label)
  - **Ubicación:** `NavBar.tsx:33-54`
  - **Acción:** permitir wrap/overflow o colapsar a un menú compacto por debajo del breakpoint.
  - **Aceptación:** a 900px no hay recorte ni overflow horizontal.

- [x] **UX-305 · 🟡 Toolbars y cards a 800px** — ✅ 2026-10-04, PR #26 (toolbar wrap; TimeLogs min-w 840)
  - **Ubicación:** `TimeLogsTable.tsx:581-620,677` (`min-w-[960px]`), `TasksTable.tsx:103-140`, `WorkTimeForm.tsx:305-438`
  - **Acción:** toolbars con wrap; revisar `min-w` y anchos fijos de entradas.
  - **Aceptación:** usable y sin scroll horizontal forzado en el tamaño mínimo.

- [x] **UX-306 · ⚪ Sincronizar icono Maximize** — ✅ 2026-10-04, PR #26 (evento window:maximized + isMaximized)
  - **Ubicación:** `AppBar.tsx:10,23-26`
  - **Acción:** escuchar `maximize`/`unmaximize` (o consultar estado real) en vez de estado local.
  - **Aceptación:** el icono refleja siempre el estado real (incluido doble-click en la barra).

- [x] **UX-307 · ⚪ Scaffold mínimo** — ✅ 2026-10-04, PR #26 (min-h-screen + fondo consistente)
  - **Ubicación:** `App.tsx:29`
  - **Acción:** `min-h-screen`; fondo consistente en pantallas cortas.
  - **Aceptación:** sin "banda" de fondo distinto en páginas cortas.

---

### Fase 4 — Flujos, feedback y estados
> Objetivo: que el usuario siempre sepa qué pasa y no pueda romper cosas por accidente.

- [x] **UX-401 · 🔴 Submit robusto en WorkTimeForm**
  - **Ubicación:** `WorkTimeForm.tsx:529-539,1360`
  - **Acción:** `isSubmitting` → `disabled` + spinner; evitar doble submit; evaluar barra de acción sticky / movimiento del CTA principal.
  - **Aceptación:** doble click no crea duplicados; el botón refleja el estado.

- [x] **UX-402 · 🔴 Confirmación + undo al borrar**
  - **Ubicación:** `WorkTimeForm.tsx:290-299,1271-1283`
  - **Acción:** `AlertDialog` de confirmación (o toast con "Deshacer") para borrar entrada y para el atajo masivo.
  - **Aceptación:** ninguna entrada se pierde por un click/tecla accidental.

- [x] **UX-403 · 🔴 Estados vacío/carga/error consistentes y traducidos**
  - **Ubicación:** `HomePage.tsx:56,68,85`, `DataTable.tsx:82-100,109`, `TimeLogsTable.tsx:567-574`
  - **Acción:** componente `EmptyState`/`ErrorState`/`LoadingState` compartido; Home debe mostrar error real, no ceros.
  - **Aceptación:** toda vista con datos tiene los 3 estados, traducidos.

- [x] **UX-404 · 🟡 Wizards con indicador de paso y cierre seguro**
  - **Ubicación:** `PullFromTWDialog.tsx:256-549`, `ImportTasksDialog.tsx:307-605,291`, `PullTaskDialog.tsx`
  - **Acción:** stepper visible; bloquear overlay/ESC durante operación en vuelo; foco inicial en el primer control.
  - **Aceptación:** el usuario sabe en qué paso está y no puede cerrar a mitad de una operación destructiva.

- [x] **UX-405 · 🔴 Quitar "Debug API" de la UI**
  - **Ubicación:** `PullFromTWDialog.tsx:325-364`
  - **Acción:** eliminar o mover detrás de un flag de desarrollo.
  - **Aceptación:** el panel no existe en builds de producción.

- [x] **UX-406 · 🟡 Flujos destructivos con AlertDialog**
  - **Ubicación:** `DeleteEntryDialog.tsx:33`
  - **Acción:** usar `AlertDialog` (role `alertdialog`, foco inicial en confirmar).
  - **Aceptación:** todo borrado usa `AlertDialog`.

- [x] **UX-407 · 🟡 Formatos de hora y pickers unificados**
  - **Ubicación:** `WorkTimeForm.tsx:400,414,433`, `time-picker.tsx:61`, `TimeLogsTable.tsx:640-655`, `PullFromTWDialog.tsx:297`
  - **Acción:** elegir 12h o 24h y aplicarlo en toda la app; usar `InputDate`/`TimePicker` en todos lados (quitar `<input type="date">` sueltos).
  - **Aceptación:** un solo formato y un solo picker de fecha/hora.

- [x] **UX-408 · 🟡 Validación con semántica y required consistente**
  - **Ubicación:** `WorkTimeForm.tsx:313,378,421`, `TasksTable.tsx:151,170`, `TypeTasksTable.tsx:82`
  - **Acción:** `aria-invalid`/`aria-describedby`; mensajes i18n (no hardcodeados); `*` de requerido donde aplique.
  - **Aceptación:** errores anunciados y consistentes.

- [x] **UX-409 · ⚪ Feedback optimista donde aplique**
  - **Ubicación:** `TimeLogsTable.tsx:406,475`, `WorkTimeForm.tsx:1072-1077`
  - **Acción:** evaluación caso a caso; mantener invalidación pero mejorar percepción.
  - **Aceptación:** acciones frecuentes se sienten instantáneas sin desincronizar datos.

---

### Fase 5 — Accesibilidad (WCAG 2.2 AA)
> Objetivo: app operable por teclado y por lector de pantalla. Complementa Fase 1/2 (no lo repite).

- [x] **UX-501 · 🔴 Asociación label ↔ control** — ✅ 2026-10-04, Fase 5 slice 1 (los controles custom ya reenviaban `id`; se cerraron los gaps de `TimeLogsTable`, `PullFromTWDialog` y `PullTaskDialog`)
  - **Ubicación:** `WorkTimeForm.tsx`, `combobox.tsx`, `input-time.tsx`, `input-date.tsx`, `TimeLogsTable.tsx`, `PullFromTWDialog.tsx`
  - **Acción:** exponer `id` en los controles custom o usar `aria-labelledby` / `role="group"`.
  - **Aceptación:** cada label anuncia su control. ✅

- [x] **UX-502 · 🔴 Nombres accesibles en botones icon-only** — ✅ 2026-10-04, Fase 5 slice 1
  - **Ubicación:** `WorkTimeForm.tsx`, `TimeLogsTable.tsx`, `SettingsPage.tsx`, `PullTaskDialog.tsx`, `PullFromTWDialog.tsx`
  - **Acción:** `aria-label` (i18n) en cada botón solo-icono; Tooltip no aporta nombre.
  - **Aceptación:** cero botones sin nombre accesible. ✅

- [x] **UX-503 · 🟡 Combobox completo** — ✅ 2026-10-04, Fase 5 slice 3
  - **Ubicación:** `combobox.tsx`
  - **Acción:** `id` de listbox, `aria-controls`/`aria-activedescendant`, Home/End, type-ahead y anuncio del resaltado (`aria-live`).
  - **Aceptación:** navegable y anunciado según patrón ARIA combobox. ✅

- [x] **UX-504 · 🟡 Estado no solo por color** — ✅ 2026-10-04, Fase 5 slice 3
  - **Ubicación:** `TimeLogsTable.tsx`, `combobox.tsx`
  - **Acción:** texto/icono/`sr-only` además del color en los puntos de progreso.
  - **Aceptación:** el estado es distinguible sin color. ✅

- [x] **UX-505 · 🟡 Diálogos con descripción y foco** — ✅ 2026-10-04, Fase 5 slice 2
  - **Ubicación:** `PullFromTWDialog.tsx`, `ImportTasksDialog.tsx`, `PullTaskDialog.tsx`, `TaskCommentDialog.tsx`, `ImportCSVTasksDialog.tsx`
  - **Acción:** `DialogDescription` en todos; foco inicial correcto.
  - **Aceptación:** sin warnings de Radix y con foco gestionado. ✅

- [x] **UX-506 · 🟡 Foco visible y contraste** — ✅ 2026-10-04, Fase 5 slice 2
  - **Ubicación:** `useTasks.tsx`, `useTypeTasks.tsx`, `SwitchDarkMode.tsx`, `index.css`
  - **Acción:** `focus-visible:ring` donde faltaba; nombre accesible en el switch de tema; baseline `:focus-visible` y `prefers-reduced-motion`.
  - **Aceptación:** foco siempre visible; contraste AA; movimiento reducido a pedido. ✅

- [x] **UX-507 · ⚪ Semántica de tablas y dropzone** — ✅ 2026-10-04, Fase 5 slice 4
  - **Ubicación:** `ui/table.tsx`, `TimeLogsTable.tsx`, `ReportsPage.tsx`, `ImportCSVTasksDialog.tsx`
  - **Acción:** `scope="col"` en headers; dropzone activable por teclado (Enter/Space) y por drag & drop.
  - **Aceptación:** tablas navegables y dropzone operable por teclado. ✅

---

### Fase 6 — i18n y limpieza de copy
> Objetivo: cero texto sin traducir y sin residuos muertos.

- [x] **UX-601 · 🟡 Eliminar strings hardcodeados** — ✅ 2026-10-05, rama feat/ux-fase-6-02-i18n-strings
  - **Ubicación:** `AppBar.tsx:87,88,94,101,108,42-43`, `DataTable.tsx:88,109`, `SettingsPage.tsx:166,431,443,462,476`, `SwitchDarkMode.tsx:15,18`, `SelectLanguage.tsx:63`
  - **Acción:** mover a `en.ts`/`es.ts` (incluye aria-labels de ventana y ProductName).
  - **Aceptación:** sin literales de UI fuera de locales (salvo nombres propios).

- [x] **UX-602 · ⚪ Corregir y completar locales** — ✅ 2026-10-05, rama feat/ux-fase-6-03-locales
  - **Ubicación:** `es.ts:441-443` (devtools/zoom en inglés), `es.ts:398` vs `en.ts:398`, `menu.help.versionLabel` sin uso
  - **Acción:** traducir pendientes, corregir divergencias, eliminar keys sin uso.
  - **Aceptación:** `en`/`es` espejados y sin keys huérfanas.

- [x] **UX-603 · ⚪ Limpiar dead code de UI** — ✅ 2026-10-05, rama feat/ux-fase-6-01-dead-code
  - **Ubicación:** `SettingsPage.tsx:65-71` (`DAYS_OF_WEEK.label/labelEs` sin uso), `TypeTasksTable.tsx:126` (`onPersist` no-op), `TasksTable.tsx:253-262` (`onAddRow` sin pasar), `DynamicForm.tsx`/`FormField.tsx` (aparentemente sin uso)
  - **Acción:** eliminar o completar; confirmar si `DynamicForm`/`FormField` se usan.
  - **Aceptación:** sin props/campos muertos ni componentes huérfanos.

- [x] **UX-604 · ⚪ Unificar copy de acciones** — ✅ 2026-10-05, rama feat/ux-fase-6-04-action-copy
  - **Ubicación:** global
  - **Acción:** aplicar el glosario de UX-003 a todos los botones/toasts/errores.
  - **Aceptación:** un verbo por acción en toda la app.

---

### Fase 7 — Reportes (backlog)
> Objetivo: recuperar y superar lo que el dashboard ofrecía antes de UX Fase 0, y hacer fáciles los cortes
> semanal/mensual desde Reportes.
>
> **Contexto:** UX Fase 0 quitó de Home las tarjetas Monthly/Weekly (`HomePage.tsx`, commit `85bd5d7`) con el
> rationale "ya viven en Reports". Eso es parcial: `ReportsPage.tsx` permite reconstruir un rango con
> `dateFrom`/`dateTo`, pero pierde los presets mes/semana, el desglose por **minutos** enviados vs locales
> (hoy "Sent to TW" cuenta entradas) y la barra semanal por día.

- [ ] **UX-701 · 🔴 Reportes: presets de rango (mes/semana)**
  - **Acción:** presets "Este mes" / "Esta semana" / "Mes anterior" + rango custom; recordar el último rango.
  - **Aceptación:** ver un mes o una semana es 1 click.

- [ ] **UX-702 · 🟡 Reportes: horas enviadas vs locales**
  - **Acción:** desglose por minutos enviados/locales (por tarea y por día) y su ratio, además del total.
  - **Aceptación:** las horas enviadas vs locales se leen sin cruzar tablas.

- [ ] **UX-703 · 🟡 Reportes: vista semanal por día**
  - **Acción:** agrupación por semana con barras por día, total semanal y estado de envío.
  - **Aceptación:** el avance de la semana se lee de un vistazo.

---

## 6. Decisiones abiertas (requieren tu input)

Antes de implementar la Fase 0:

1. **Acción primaria / landing**
   - **(a)** `/worktime` es la ruta inicial; el dashboard pasa a ser secundario.
   - **(b)** El dashboard sigue siendo Home, pero se rediseña como "home operativo" (timer + registrar + resumen) y el dashboard actual se simplifica.
   - **Resuelto (2026-10-04):** opción **(b)** — Home operativo con registrar a 1 click, `ActiveTimerChip` y Quick Stats + Today's Log; los bloques Monthly/Weekly salen de Home (ver Fase 7).

2. **Menús**
   - **(a)** Eliminar el menú del renderer y redistribuir sus 3 acciones (engranaje/settings).
   - **(b)** Conservar un menú del renderer pero real y accesible (solo acciones vivas).
   - **(c)** Reemplazar por un menú nativo real de Electron (pierde el look integrado con la titlebar custom).

3. **Mapa de secciones** (UX-002): ¿cuántos ítems de primer nivel y cuáles? ¿`Catálogo` = Tasks + Types?
   - **Resuelto (2026-10-04):** 6 secciones — `Inicio · Registrar · Historial · Reportes · Catálogo · Ajustes`; `Catálogo` = Tasks + Types (tabs).

4. **Tamaño mínimo de ventana** (UX-301): ¿fijamos `minWidth` (p. ej. 900px) o priorizamos un layout adaptable a ventanas chicas?

5. **Edición inline de tablas** (UX-204): ¿un único paradigma (celda o fila) o uno por forma de dato?
   - **Resuelto (2026-10-04):** implementación compartida por forma de dato — fila para `TimeLogsTable`, celda para catálogos.

---

## 7. Orden de ejecución sugerido

| # | Fase | Foco | Riesgo |
|---|---|---|---|
| 1 | Fase 0 | Decisiones de IA/landing/nombres | Bajo (decisión) |
| 2 | Fase 1 | Sistema de menús (elimina duplicidad) | Bajo/Medio |
| 3 | Fase 2 | Design system y consistencia | Medio |
| 4 | Fase 3 | Layout, ventana y responsive | Bajo |
| 5 | Fase 4 | Flujos, feedback y estados | Medio |
| 6 | Fase 5 | Accesibilidad AA | Medio |
| 7 | Fase 6 | i18n y limpieza | Bajo |

> La Fase 1 y la Fase 5 (menús) se solapan: si se decide conservar menú en renderer, UX-103 debe hacerse junto con UX-101/102.

---

## 8. Verificación

Antes de cerrar cada fase:

```pwsh
npm run test          # suite vitest
npm run lint          # eslint
npm run type-check    # tsc
npm run build         # vite build + plugin electron
```

Chequeos específicos:
- **IA:** un solo `<h1>` por ruta; navegación primaria a registrar ≤1 click (manual).
- **Menús:** cero ítems sin efecto; menú operable solo con teclado (Tab/flechas/Escape/Enter).
- **Design system:** grep sin paleta cruda (`bg-slate-*`, `text-emerald-*`, `text-amber-*`, `text-red-*`) fuera de tokens.
- **Layout:** a `minWidth`×`minHeight` no hay overflow horizontal ni solape AppBar/NavBar.
- **A11y:** labels asociados (DevTools/aXe), botones icon-only con nombre, contraste AA medido.
- **i18n:** cambiar a EN y ES no deja texto sin traducir en el shell ni en errores.

---

## 9. Fuera de alcance (por ahora)

- Rediseño visual de marca (logo, paleta corporativa nueva) — este roadmap ordena y sistematiza, no rebrandea.
- Migración a `electron-vite` / multi-plataforma (ver README v2.0.0).
- Tests E2E visuales/regresión de UI (Playwright) — deseable, pero es una iniciativa aparte.
- Reescritura de `WorkTimeForm` (lógica de cálculo) — solo se toca la capa de presentación/feedback.

---

## 10. Cómo mantener este documento

- Al completar una tarea, cambiar `[ ]` → `[x]` y anotar la fecha/PR.
- Si un hallazgo se descarta, moverlo a §9 con la justificación.
- Nuevos hallazgos de UI/UX: agregar con el siguiente ID de la fase correspondiente (o `UXBUG-` en §4).
- Las decisiones de §6 se resuelven con el usuario y se registran debajo de cada pregunta.
