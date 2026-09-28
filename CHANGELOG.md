# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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