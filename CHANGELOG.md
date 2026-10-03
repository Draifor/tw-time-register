# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.12.0] - 2026-10-03

### Added

- **Gate de release (R4)**: el workflow de release ejecuta `scripts/verify-release-assets.ps1` tras publicar y falla el job si el tag resolvió a más de un release de GitHub o si alguna de las tres URLs del updater (`latest.yml`, el instalador `.exe` y su `.blockmap`) no responde HTTP 200 con el tamaño que reporta la API. Es de solo lectura y no republica; se añadió a raíz del release duplicado que expuso `v1.11.0` (`c221ec2`; `scripts/verify-release-assets.ps1`, `.github/workflows/release.yml`)

### Changed

- **Tailwind CSS 4**: el renderer pasa de 3.4.18 a 4.3.3 con el plugin `@tailwindcss/vite` y `@import "tailwindcss"`; la capa de tokens shadcn se porta a CSS-first (`@theme` / `@theme inline`), se eliminan `tailwind.config.js`, `postcss.config.js` y `autoprefixer`, `tailwindcss-animate` se reemplaza por `tw-animate-css` 1.4.0 y se aplican los renombres de clase de v4 (`shadow-sm`→`shadow-xs`, `outline-none`→`outline-hidden`, `backdrop-blur-sm`→`backdrop-blur-xs`). La variante `dark:` deja de ser CSS muerto —queda ligada a la clase `.dark`— y la pila de fuente Inter, que nunca se aplicaba, entra en efecto (`8be00df`, `c5ab008`, `e94d03c`, `5995f81`; `odd/tasks/tailwind-4.md`)
- **Vite 8 (Rolldown)**: el bundler sube a 8.3.2 con `@vitejs/plugin-react` 6.1.1 y `vite-plugin-electron-renderer` 1.0.0; las tres claves `rollupOptions` de `vite.config.ts` pasan a `rolldownOptions` para que el plugin de Electron no descarte el `external` que mantiene fuera del bundle a `electron` y `better-sqlite3` (`e65b75a`; `odd/tasks/vite-8.md`)
- **Vitest 5**: `vitest`, `@vitest/coverage-v8` y `@vitest/ui` suben a 5.0.3; jest-dom se importa por `@testing-library/jest-dom/vitest` y `updater.test.ts` carga un módulo fresco por test para convivir con el nuevo default `clearMocks: true` (`6c313e8`; `odd/tasks/vitest-5.md`)
- **TypeScript 7 en paralelo a la API de TS 6**: el CLI `tsc` pasa a 7.0.2 (alias `@typescript/native`) mientras el nombre `typescript` queda resolviendo al paquete de API TS 6 (`@typescript/typescript6` 6.0.2) que `typescript-eslint` necesita; se elimina `moduleResolution: "node10"` de `src/main/tsconfig.json` porque TS 7 lo removió. El bundle despachado no cambia: lo produce Vite/Rolldown, no `tsc` (`cf363bb`; `odd/tasks/typescript-7.md`)
- **ESLint 10 + @eslint-react**: `eslint` sube a 10.12.0, `@eslint/js` a 10.0.1 y `typescript-eslint` a 8.71.0; `eslint-plugin-react` y `eslint-plugin-react-hooks` —incompatibles con ESLint 10 a nivel de peer y de runtime— se reemplazan por `@eslint-react/eslint-plugin` 5.23.5, que porta `rules-of-hooks` (error) y `exhaustive-deps` (warn). Se registra una pérdida de cobertura: dos reglas (`react/function-component-definition` y `react/jsx-filename-extension`) no tienen equivalente en `@eslint-react` (`05d6128`, `93bbc9f`; `odd/tasks/eslint-10.md`)
- **Rendimiento (Fase 2, PERF-201..PERF-207)**: el timer en vivo se aísla en `<LiveTimer/>` para que la app no re-renderice el formulario cada segundo, cada entrada pasa a un `EntryCard` memoizado con handlers estables, las tablas y reportes resuelven tareas con lookups `Map` O(1), `Combobox` conserva la búsqueda ante re-renders del padre (BUG-07), el payload del borrador se serializa dentro del debounce en vez de en cada tecla y los atajos de teclado registran su listener una sola vez. La suite crece de 196 a 203 tests (`a2e9a5d`, `e0f60f9`, `a4e73dc`, `0d723f5`, `5bbf832`; `odd/tasks/performance-fase-2.md`, `docs/PERFORMANCE-ROADMAP.md`)

**React Compiler** (track G) se evaluó con un spike medido sobre las dos vías de integración de `@vitejs/plugin-react` 6 y se descartó como un no-go medido: el compilador omite `WorkTimeForm` —el componente que motivaba el track— y 52 de las 132 funciones candidatas del renderer, a cambio de +4.4% a +5.6% de bundle. No hubo cambio de build (`odd/tasks/react-compiler.md`)

## [1.11.0] - 2026-09-28

### Added

- **Actualizaciones silenciosas (estilo VS Code)**: al pulsar "Actualizar" la app instala sin el asistente NSIS (`/S --force-run`) y **relanza** en la versión nueva; si se cierra la app con una actualización ya descargada, instala en silencio (`/S`) y **no** relanza, para no reabrir una app que el usuario acaba de cerrar. El upgrade respeta la carpeta elegida en la instalación original, porque el instalador lee `InstallLocation` del registro. Detalle y evidencia en `odd/tasks/silent-updates.md` (`e84042e`)

### Changed

- **React 19**: `react` y `react-dom` pasan de 18.3.1 a 19.3.0, junto con sus tipos y el resto de las dependencias del renderer acopladas a esa versión — `react-router-dom` 7, `i18next` 26 + `react-i18next` 17, `react-hook-form` 7.89, `@tanstack/react-query` 5.104, `lucide-react` 1.48, las nueve de Radix y las menores seguras. Ninguna API propia de la app cambió (`23b361f`, `005d89e`; `odd/tasks/react-19.md`)
- **`react-flatpickr` 4.0.11**: los tres call sites (`input-date`, `input-time`, `time-picker`) se reescriben al patrón que v4 exige — objeto de opciones estable, handler registrado dentro de `options`, valor aplicado con `setDate` y el input sin controlar — porque v4 destruye y recrea la instancia cada vez que cambia la identidad de las opciones (`34577dc`)
- **Cobertura**: la suite pasa de 183 a **196** tests — input de fecha, los tres pickers bajo `React.StrictMode`, el instalado silencioso, el rango completo de i18n + router y el foco del input real al fallar la validación

### Fixed

- **Campo de fecha duplicado en React 19**: React 19 borraba el `type="hidden"` que flatpickr fija de forma imperativa en el input original, en el commit donde cambia `value`; el input que flatpickr quiere ocultar quedaba visible y el formulario mostraba dos filas de fecha. Se declara `type="hidden"` para que el modelo de React coincida con la intención de flatpickr (`c0ececd`)
- **Pickers vacíos al montar bajo `React.StrictMode`**: v4 renderiza dos veces con el mismo objeto de props, borraba `onCreate` de su propia copia y la instancia terminaba destruida y recreada sin publicar el reemplazo, así que la fecha y la duración aparecían vacías aunque el valor estuviera intacto en el formulario. Los tres pickers publican la instancia desde `onReady` y aplican el valor vigente (`c3f800f`)
- **Foco al fallar la validación**: en v4 el `ref` resuelve a un handle cuyo getter todavía es `undefined` al montarse, así que el guard de react-hook-form lo ignoraba en silencio y `shouldFocusError` no hacía nada. Los pickers ahora registran su input real (`0060f55`)
- **`Control` de react-hook-form 7.89**: dos call sites de `WorkTimeForm` pasan a usar el `typedControl` que el archivo ya tenía, porque la variancia de `Control<TFieldValues>` endureció el tipo (`005d89e`)
- **Higiene de dependencias**: se elimina `@types/react-router-dom` —que arrastraba un `@types/react@18` duplicado en el lockfile— y se mueve `@types/babel__core` a `devDependencies` (`005d89e`)
- **Test de franja horaria**: se fija el reloj para que el test del próximo slot disponible deje de fallar los fines de semana (`8ea759e`)

## [1.10.0] - 2026-09-27

*Entrada registrada retroactivamente el 2026-09-28: la release se publicó sin entrada en este CHANGELOG. Se reconstruyó del rango `v1.9.0..v1.10.0`.*

### Added

- **Gate del build publicado**: hook `afterPack` que sondea el módulo nativo empaquetado y aborta el build durante el empaquetado, antes de que exista un instalador, de modo que el artefacto publicado es exactamente el build que el probe inspeccionó (`cf33b90`, `deef356`, `0137e4d`)

### Changed

- **Electron 30 → 44**, `better-sqlite3` 13 y `electron-builder` 26 (`63c9666`; `odd/tasks/electron-30-to-44.md`)
- **`vite-plugin-electron` 1.x** y su arreglo del spawn en desarrollo (`45f56a1`)
- **Higiene de empaquetado**: se eliminan `electron-is-dev` y entradas muertas, y el tooling de build pasa a `devDependencies` (`0215900`, `ed07d9d`)

### Fixed

- **Puente de preload**: IPC asegurado, remoción real de listeners y handlers del updater de un solo uso (`a464f33`)
- **Rendimiento de datos**: índices, PRAGMAs, cache de statements y primitiva transaccional; lotes transaccionales, agregación index-friendly y lookup de slots en consulta constante (`8eb0de9`, `99b0ceb`)
- **Renderer**: claves de cache e invalidaciones estables en las queries y en el guardado de WorkTime (`026f841`); casing de archivos de componentes corregido para que `tsc` resuelva en filesystems case-sensitive (`5cec756`)
- **Diálogos de backup**: se recuerda la última carpeta usada al exportar e importar (`de2af27`)

## [1.9.0] - 2026-09-23

### Added

- **Insertar entradas en cualquier posición (WorkTimeForm)**: divisores con hover entre entradas (y al inicio/final) para insertar una fila en cualquier punto sin arrastrar desde abajo; las entradas siguientes reajustan sus horas automáticamente
- **Progreso proyectado en WorkTimeForm**: el badge y el dropdown de tareas ahora incluyen los minutos del borrador sin guardar (y el timer activo), mostrando si se excederá la estimación antes de guardar
- **Horas máximas fraccionarias en Ajustes**: se permite configurar el máximo de horas por día con decimales
- **Auto-scroll al arrastrar entradas**: las entradas hacen scroll automático al acercar el cursor a los bordes del viewport durante el drag & drop
- **Roadmap de Rendimiento** (`docs/PERFORMANCE-ROADMAP.md`): auditoría completa de rendimiento y plan de optimización por fases

### Changed

- **TimeLogsTable**: los nombres de tarea y las descripciones ahora envuelven el texto para mostrarse completos; el nombre de la tarea es un enlace que abre la tarea en TW y su tooltip muestra el nombre completo y la URL

### Fixed

- **Decimales en el progreso**: se redondean los minutos fraccionarios en el agregado SQL, `formatDuration`, `formatMinutesToHHMM` y las etiquetas de progreso; los anchos de las barras de progreso usan enteros
- **Tests**: cobertura del redondeo de minutos fraccionarios en los formateadores

## [1.8.0] - 2026-05-11

### Added

- **Progress Visualization in HomePage**: Daily view and weekly report now display progress bars with color-coded status indicators (green/orange/red) next to each task name, showing estimated time vs logged time
- **Reports Page Enhancements**: New "Est. Time" and "Progress" columns in "By Task" tab with status badges ("On time", "Margin Xh Xm", "+Xh Xm overtime")
- **WorkTimeForm Progress Tooltip**: When selecting a task in the combobox, a colored badge shows "Progress: Xh Xm / Xh Xm (X%) — Margin: Xh Xm" to help decide time registration
- **TimeLogsTable Progress Indicators**: Color dots (green/orange/red) next to task names indicating accumulated progress status at the time of each entry
- **Progress Utilities Module**: Shared `progressUtils.ts` with `getTaskProgressInfo()`, `getStatusBarColor()`, and `formatMinutesToHHMM()` for consistent progress calculations across the app

### Changed

- **Combobox Component**: Extended with `showProgress` prop to display color indicators for tasks with estimated time
- **Weekly Report in HomePage**: Now shows individual task progress against estimated time rather than proportion of weekly total
- **Daily View in HomePage**: Progress bars now compare against task estimated time instead of daily max hours

### Translated

- New i18n keys: `colEstimated`, `colProgress`, `onTime`, `margin`, `progressInfo` in both English and Spanish

## [1.7.0] - 2026-05-11

### Added

- **Weekly Report Section**: Summary of time logged in the last 7 days with task breakdown
- **Estimated Time Field**: Tasks now support an estimated time field (HH:MM format) with inline editing in the Tasks table
- **Progress Column**: Visual progress bar in Tasks table showing logged vs estimated time with color-coded status
- **Draft Persistence**: WorkTimeForm drafts are now saved to SQLite with autosave recovery
- **Single Instance Lock**: Desktop app now enforces single instance to prevent duplicate windows

### Changed

- **Task Search**: Enhanced to search by task name and task link
- **Reports Page**: Added task search/filter functionality

### Fixed

- **Combobox Focus**: Improved focus behavior when dropdown opens
- **WorkTime startTime/endTime**: Proper handling for afterLunch toggle cascade effects
- **TypeScript**: Normalized input casing and encryption mock typing

### Refactored

- Migrated from `@/` path aliases to relative imports for consistency
- Updated TypeScript config with `esModuleInterop` enabled

## [1.6.0] - 2026-04-2026

### Added

- **AI Agents Skills**: Framework for AI-assisted development with specialized skills
- **Sticky Navbar**: Navigation bar with back-to-top action
- **Task Link Duplicates Handling**: Detect and handle duplicate TW task links on import

### Changed

- **Task Import**: Improved robustness for handling task duplicates

## [1.5.0] - 2026-04-2026

### Added

- **i18n Support**: Full English and Spanish translations
- **Settings Page**: Complete settings management with work schedule, holidays sync, and comment templates
- **Pull from TeamWork**: Import time entries directly from TeamWork API
- **CSV Task Import**: Import tasks from CSV files with auto-type creation

## [1.4.0] - 2026-03-2026

### Added

- **Tasks Page**: Full task management with types, estimated times, and progress tracking
- **TimeLogs Page**: Tabular view of all time entries with edit, duplicate, delete, and sync actions

### Changed

- **Navigation**: Reorganized with separate Tasks page and TimeLogs tab

## [1.3.0] - 2026-03-2026

### Added

- **WorkTimeForm**: Time entry form with timer support, drag-to-reorder entries, and smart slot suggestions
- **Keyboard Shortcuts**: Ctrl+N (new entry), Ctrl+S (save), Esc (remove last entry)

### Changed

- **Daily Time Info**: Better calculation of available slots and remaining time

## [1.2.0] - 2026-02-2026

### Added

- **TeamWork Sync**: Bidirectional sync with TeamWork API (send/receive time entries)
- **Task Comments**: Post comments to TeamWork tasks directly from the app

### Changed

- **Authentication**: TeamWork API credentials stored securely with electron-store encryption

## [1.1.0] - 2026-02-2026

### Added

- **Reports Page**: Time reports by task and by day with filters
- **Summary Cards**: Quick stats dashboard on home page

## [1.0.0] - 2026-01-2026

### Added

- Initial release with basic time tracking and TeamWork integration