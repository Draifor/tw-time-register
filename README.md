# TW Time Register

> **Aplicación de escritorio para gestionar y registrar tiempos de trabajo en TeamWork**

Una aplicación Electron que permite crear borradores de registros de tiempo de forma flexible e inteligente, con cálculos dinámicos de fechas y horas, para luego sincronizarlos con la API de TeamWork.

---

## 🎯 Objetivo

Herramienta personal para registrar el tiempo de trabajo diario de forma eficiente:

1. **Borrador inteligente** — registrar actividades conforme se realizan, con cálculos automáticos
2. **Cálculos encadenados** — hora fin de la entrada N se propaga como hora inicio de la N+1
3. **Flexibilidad** — modificar cualquier dato manualmente sin perder la automatización
4. **Organización por tareas** — gestionar proyectos y tareas vinculadas a TeamWork
5. **Reportes** — tiempo por tarea, por día, horas facturables vs. totales
6. **Sync bidireccional** — POST la primera vez, PUT si ya existe en TW; siempre filtrado por el usuario de sesión

---

## 🏗️ Stack Tecnológico

### Core

- **Electron** v44 — proceso main, IPC, acceso a SQLite
- **React** v19 + **TypeScript** v7 — renderer
- **Vite** v8 (Rolldown) — bundler ultrarrápido

### UI

- **shadcn/ui** — componentes accesibles (Radix UI)
- **Tailwind CSS** v4 — utility-first
- **Lucide React** — iconos
- **Sonner** — notificaciones toast

### Estado y datos

- **TanStack React Query** v5 — cache y estado del servidor
- **TanStack React Table** v8 — tablas con edición inline e infinite scroll
- **React Hook Form** v7 — formularios con validación

### Base de datos

- **better-sqlite3** v13 — SQLite local, prebuilts N-API (sin recompilar)

### Internacionalización

- **i18next** + **react-i18next** — ES / EN

### Calidad

- **ESLint** v10 (flat config) + **@eslint-react** + **Prettier** v3
- **Vitest** v5 — 285 tests unitarios, 0 fallos

### Distribución

- **electron-updater** v6 — auto-actualizaciones vía GitHub Releases
- **electron-builder** — instalador NSIS para Windows

---

## 📁 Estructura

```txt
src/
├── main/                        # Proceso Electron (Node.js)
│   ├── index.ts                 # BrowserWindow + DevTools + error handling
│   ├── preload.ts               # contextBridge → window.Main.*
│   ├── database/
│   │   ├── database.ts          # DatabaseWrapper (async sobre better-sqlite3)
│   │   ├── migrations.ts        # Migraciones idempotentes
│   │   └── models/
│   │       ├── TimeLog.ts       # time_entries: interfaces + columnsDB
│   │       ├── TaskLinks.ts     # extractTwTaskId() + TaskLink
│   │       └── History.ts       # sync_history: SyncHistory + SyncAction
│   ├── ipc/
│   │   └── databaseIpc.ts       # Todos los handlers IPC
│   └── services/
│       ├── apiService.ts        # GET/POST/PUT/DELETE TeamWork API + fetchUserTimeEntriesInRange
│       ├── syncService.ts       # smartSyncEntries() + pullEntriesFromTW()
│       ├── historyService.ts    # CRUD sync_history
│       ├── timeLogService.ts    # markEntryAsSent/NotSent, getUnsentEntries
│       ├── taskLinkService.ts   # getLinkedTasks, updateTaskLink
│       ├── timeEntriesService.ts # CRUD time_entries
│       ├── taskService.ts       # CRUD tasks (LEFT JOIN para tareas huérfanas)
│       ├── typeTasksService.ts  # CRUD tipos (unicidad case-insensitive, cascade protect)
│       ├── settingsService.ts   # work_settings + credenciales TW + syncHolidaysFromApi
│       └── encryptionService.ts # DPAPI via safeStorage
├── renderer/                    # Proceso React
│   ├── App.tsx                  # HashRouter + rutas
│   ├── components/
│   │   ├── WorkTimeForm.tsx     # Formulario principal + timer en vivo
│   │   ├── TimeLogsTable.tsx    # Edición inline + sync + duplicar entrada
│   │   ├── TasksTable.tsx       # + formulario colapsable + PullTaskDialog por fila
│   │   ├── TypeTasksTable.tsx   # + formulario colapsable + protección cascade
│   │   ├── PullFromTWDialog.tsx # Asistente 3 pasos: config → resultado → tareas faltantes
│   │   ├── PullTaskDialog.tsx   # Pull de una sola tarea (2 pasos)
│   │   └── ui/                  # Componentes shadcn/ui
│   ├── hooks/
│   │   ├── useTasks.tsx         # TaskLinkCell: badge #ID + edición inline
│   │   ├── useTWSession.ts      # Sesión TW activa → badge en NavBar
│   │   └── useAutoUpdater.ts    # Estado del auto-updater
│   ├── lib/
│   │   └── timeUtils.ts         # parseDuration / formatDuration (puras)
│   ├── locales/
│   │   ├── es.ts
│   │   └── en.ts
│   ├── pages/
│   │   ├── HomePage.tsx
│   │   ├── TasksPage.tsx
│   │   ├── ReportsPage.tsx
│   │   └── SettingsPage.tsx
│   └── services/
│       └── timesService.ts      # Wrappers window.Main.* + SmartSyncResult
└── tests/                       # Vitest — 285 tests, 39 archivos, 0 fallos
    ├── setup.ts
    ├── main/
    │   ├── models/TaskLinks.test.ts
    │   └── services/
    │       ├── syncService.test.ts
    │       ├── historyService.test.ts
    │       ├── timeEntriesService.test.ts
    │       ├── apiService.test.ts
    │       ├── settingsService.test.ts
    │       └── encryptionService.test.ts
    └── renderer/
        └── timeUtils.test.ts
```

---

## 🗃️ Base de Datos

```sql
type_tasks    (type_id, type_name)
tasks         (task_id, type_id, task_name, task_link, description)
time_entries  (entry_id, task_id, description, entry_date, hora_inicio, hora_fin, facturable, send)
sync_history  (history_id, entry_id, action, synced_at, tw_time_entry_id, tw_task_id, success, error_message)
worktime_drafts (draft_key, payload, updated_at)
```

`sync_history` es la clave del sync bidireccional: si `tw_time_entry_id` ya existe → PUT, si no → POST.

---

## ✅ Funcionalidades

- **WorkTimeForm** — campos dinámicos, cálculo encadenado inicio/fin, borrador persistente en SQLite (`worktime_drafts`), **timer en vivo** (play/stop auto-calcula duración)
- **TimeLogsTable** — edición inline, sync individual y masivo, búsqueda + filtros, **duplicar entrada** con un click
- **Sync bidireccional** — `smartSyncEntries()`: POST / PUT según `sync_history`, siempre con `person-id = userId`
- **Pull desde TW** — `pullEntriesFromTW()`: importa time entries de TW en un rango de fechas (global o por tarea)
  - `PullFromTWDialog` — 3 pasos: período → resultado → agregar tareas TW faltantes
  - `PullTaskDialog` — pull escopado a una sola tarea desde la columna de acciones
- **Tasks table** — tareas huérfanas visibles (`LEFT JOIN`), **link editable inline** (badge `#ID` + icono lápiz), botón pull por fila
- **TypeTasks** — unicidad case-insensitive, cascade protect (bloquea DELETE si hay tareas)
- **ImportTasksDialog** — asistente 3 pasos para importar subtareas de TW (templates RECA/FORE y OTHER)
- **ReportsPage** — horas por tarea y por día, 4 tarjetas resumen, filtro por rango de fechas
- **SettingsPage** — credenciales TW encriptadas (DPAPI), horario, días laborales, festivos colombianos (Nager.Date API)
- **NavBar** — badge de sesión TW activa, badge de auto-updater
- **i18n** — ES/EN completo en todos los componentes y páginas
- **Seguridad** — credenciales TW cifradas con `safeStorage` (DPAPI en Windows)
- **Auto-updater** — descarga en segundo plano, toasts de estado, botón "Buscar actualizaciones", e instalación silenciosa (sin asistente NSIS) al pulsar "Instalar" o al cerrar la app
- **285 tests** — main (modelos, servicios core) y renderer (hooks, componentes, i18n, router)

---

## ⌨️ Atajos de teclado

El menú nativo de Electron expone estos aceleradores. En macOS se usa `Cmd`; en Windows/Linux, `Ctrl`.

### Edición

| Atajo | Acción |
| --- | --- |
| `Ctrl/Cmd + Z` | Deshacer |
| `Ctrl/Cmd + Shift + Z` | Rehacer |
| `Ctrl/Cmd + X` | Cortar |
| `Ctrl/Cmd + C` | Copiar |
| `Ctrl/Cmd + V` | Pegar |
| `Ctrl/Cmd + A` | Seleccionar todo |

### Vista

| Atajo | Acción |
| --- | --- |
| `Ctrl/Cmd + +` | Acercar |
| `Ctrl/Cmd + -` | Alejar |
| `Ctrl/Cmd + 0` | Restablecer zoom |
| `F11` (Windows/Linux) · `Ctrl + Cmd + F` (macOS) | Pantalla completa |

> **Solo en desarrollo:** `Ctrl/Cmd + R` recarga, `Ctrl/Cmd + Shift + R` fuerza la recarga y `Ctrl/Cmd + Shift + I` (`Alt + Cmd + I` en macOS) abre las DevTools. El menú nativo omite estas acciones en las builds de producción.

---

## Draft de WorkTime (Persistencia)

- **Fuente de verdad**: SQLite (`worktime_drafts`), no `localStorage`.
- **Auto-guardado**: el formulario guarda borrador en BD con debounce mientras se edita.
- **Recuperación**: al abrir WorkTime, primero intenta restaurar desde BD.
- **Migración legacy**: si no existe draft en BD, toma una sola vez `localStorage['workTimeFormEntries']`, lo migra a BD y elimina esa clave.
- **Cuándo se borra el draft**: solo cuando los registros pasan a `time_entries` (guardado definitivo) o cuando el borrador queda vacío por acciones del usuario.
- **Qué sigue en localStorage**: únicamente `wt_activeTimer` (estado efímero del timer UI).

### Mantenimiento futuro recomendado

- **No tocar** esta lógica salvo que cambie el flujo funcional de WorkTime.
- **Opcional (v futura)**: eliminar por completo el fallback de migración de `workTimeFormEntries` cuando ya no existan usuarios en transición.
- Si se elimina el fallback, conservar `wt_activeTimer` en localStorage (o migrarlo si se decide persistir también el timer en BD).

---

## 🚀 Desarrollo

### Requisitos

- **Node.js 22 LTS** — `better-sqlite3` tiene prebuilts solo para Node 22

  ```bash
  fnm use 22
  ```

- **pnpm**

### Instalación

```bash
pnpm install
```

### Comandos

```bash
pnpm dev              # Vite dev server + Electron
pnpm build            # Compilar para producción
pnpm test             # Vitest (una pasada)
pnpm test:watch       # Vitest en modo watch
pnpm test:coverage    # Coverage en /coverage
.\build-local.ps1    # Build local sin instalador (no requiere admin)
```

### Distribución para producción (requiere admin en Windows para NSIS)

```bash
pnpm dist:win    # Instalador NSIS para Windows x64
```

> `better-sqlite3` 13 es Node-API y trae prebuilds propios: no requiere recompilación contra el ABI de Electron. No ejecutar `electron-builder install-app-deps` (ignora `npmRebuild: false` y falla sin MSVC).

---

## 🔒 Seguridad

Las credenciales TeamWork (`tw_username`, `tw_password`) se cifran con `safeStorage` de Electron (DPAPI en Windows) antes de guardarse en SQLite. El prefijo `enc:` hace el proceso idempotente — valores antiguos se migran automáticamente al arrancar.

---

## 📦 Releases

Las releases se publican automáticamente vía GitHub Actions al crear un tag `v*.*.*`. El instalador se sube a GitHub Releases y la app lo detecta al arrancar (o desde Ayuda → Buscar actualizaciones).

| Versión | Highlights |
| --------- | ----------- |
| **v1.2.0** | Sync bidireccional · Tests (41) · Festivos API · Auto-updater robusto |
| v1.1.x | Seguridad (DPAPI) · i18n ES/EN · Modelos BD |
| v1.0.0 | Release inicial · HashRouter · SQLite + better-sqlite3 |

---

## 🗺️ Roadmap

### v1.3.0 — Calidad & Cobertura

- [x] Ampliar tests: `timeEntriesService`, `apiService`, `settingsService`
- [ ] Tests de componentes React (WorkTimeForm, TimeLogsTable)
- [ ] Documentar lógica de cálculo en ReportsPage

### v1.4.0 — UX & Productividad

- [x] **Timer en vivo** — play/stop que auto-calcula la duración al detener
- [x] **Duplicar entrada** — clonar fila en TimeLogsTable con un click
- [x] **Drag & drop** para reordenar entradas en WorkTimeForm
- [ ] Exportar reporte a CSV

### v1.5.0 — Sync Avanzado

- [x] Eliminar entrada en TW desde TimeLogsTable
- [x] Pull desde TW — importar time entries existentes al histórico local
- [ ] Indicador de "última sincronización" por entrada

### v1.8.0 — Confiabilidad de Sync (Siguiente)

- [ ] Detectar conflictos de sync (local vs TW) por entrada
- [ ] Flujo de resolución de conflictos en UI (conservador por defecto)
- [ ] Mostrar "última sincronización" por entrada en TimeLogsTable
- [ ] Tests de componentes React: WorkTimeForm y TimeLogsTable
- [ ] E2E smoke con Playwright: draft recovery, single-instance, sync básico

### ✅ v1.9.0 — UX & Rendimiento (PUBLICADA - Sep 2026)

- [x] Insertar entradas en cualquier posición del WorkTime (divisores con hover)
- [x] Progreso proyectado en WorkTime (incluye borrador sin guardar + timer activo)
- [x] Horas máximas fraccionarias en Ajustes
- [x] Auto-scroll al arrastrar entradas cerca de los bordes del viewport
- [x] TimeLogs: texto completo de tarea/descripción + link a TW
- [x] Fix: redondeo de decimales en el progreso

### v1.10.0 — Reportes & Observabilidad

- [ ] Exportar reportes a CSV/Excel
- [ ] Timeline de eventos de sync por entrada (auditable)
- [ ] Checklist de release para validaciones críticas post-build

### v1.11.0 — Distribución & Actualizaciones

- [ ] **Actualizaciones silenciosas estilo VS Code**: instalar sin el asistente NSIS (`/S`) al pulsar "Actualizar" o al cerrar la app, con relanzado automático
  - Publicado en la release `1.11.0` (`src/main/updater.ts`). Verificado en un build empaquetado (cliente `1.11.0` → `1.12.0`): el instalado silencioso funciona, pero el **relanzado no** con el instalador asistido. Causa raíz y fix en `v1.13.0` (ver `odd/tasks/update-ux.md`). Detalle original en `odd/tasks/silent-updates.md`.
  - Pulsar "Instalar" → `/S --force-run`: instala en silencio y **relanza** la app en la versión nueva.
  - Cerrar la app con una actualización ya descargada → `/S` sin `--force-run`: instala en silencio y **no** relanza. Relanzar una app que el usuario acaba de cerrar sería intrusivo, así que ese comportamiento se deja como lo entrega `electron-updater`.
  - El upgrade silencioso respeta la carpeta elegida en la instalación original: el instalador lee `InstallLocation` del registro y la reutiliza.

### ✅ v1.12.0 — Modernización del stack & Rendimiento (PUBLICADA - Oct 2026)

- [x] Tailwind CSS 4 — capa de tokens CSS-first (`@theme`), `tw-animate-css` y variante `dark` corregida
- [x] Vite 8 (Rolldown) con `@vitejs/plugin-react` 6
- [x] Vitest 5 para la suite (203 tests)
- [x] TypeScript 7 en paralelo a la API de TS 6
- [x] ESLint 10 + `@eslint-react`
- [x] React Compiler evaluado y descartado como no-go medido
- [x] Rendimiento Fase 2 — timer aislado, tarjetas memoizadas, lookups O(1) y atajos registrados una vez (`docs/PERFORMANCE-ROADMAP.md`)
- [x] Gate de release R4 — un release por tag y URLs del updater verificadas

### ✅ v1.13.0 — Actualizaciones amigables, rendimiento Fases 3–6 & relanzado confiable (PUBLICADA - Oct 2026)

- [x] Progreso real de descarga: barra determinada con porcentaje (evento `download-progress` reenviado al renderer)
- [x] Overlay bloqueante "Instalando / la app se reiniciará" antes de cerrar, con delay acotado
- [x] Confirmación post-reinicio "Actualizado a vX" (marcador one-shot en `userData`, consumido al arrancar)
- [x] Fix del relanzado en el instalador asistido: hook NSIS `customFinishPage` (`build/installer.nsh`) que fuerza el arranque cuando `${isUpdated}` (electron-builder #2179 / #5792), manteniendo `oneClick: false` y el selector de carpeta
- [x] Rendimiento Fase 3 — tabla de time-logs virtualizada y tablas de reportes acotadas (`docs/PERFORMANCE-ROADMAP.md`)
- [x] Rendimiento Fase 4 — sync con concurrencia acotada, escrituras por lotes y reintentos seguros
- [x] Rendimiento Fase 5 — ventana antes de migrar (sin flash blanco), rutas y locale `es` lazy, chunk inicial ~464 kB
- [x] Rendimiento Fase 6 — cancelación de fetches obsoletos, scroll con rAF y CSV de importación por chunks
- [ ] **Pendiente**: verificar el relanzado en un build empaquetado real, actualizando un cliente ya en `1.13.0` a una versión posterior
  - El instalador NSIS compila con el include custom, pero el relanzado end-to-end sólo se observa en una actualización real. Detalle, decisiones y evidencia en `odd/tasks/update-ux.md`.

### v2.0.0 — Multi-plataforma

- [ ] Soporte macOS (Apple Silicon + Intel)
- [ ] Migrar a `electron-vite`
- [ ] Drizzle ORM sobre better-sqlite3

---

## 📝 Desarrollo con IA

Ver [`.github/copilot-instructions.md`](.github/copilot-instructions.md) para contexto completo, patrones, convenciones y estado actual del proyecto.

Ver también el [🗺️ Roadmap de Rendimiento](docs/PERFORMANCE-ROADMAP.md): auditoría completa de rendimiento y plan de optimización por fases (bugs, SQLite, re-renders, sync y bundle).

---

## 📄 Licencia

MIT
