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

- **Electron** v30 — proceso main, IPC, acceso a SQLite
- **React** v18 + **TypeScript** v5 — renderer
- **Vite** v7 — bundler ultrarrápido

### UI

- **shadcn/ui** — componentes accesibles (Radix UI)
- **Tailwind CSS** v3.4 — utility-first
- **Lucide React** — iconos
- **Sonner** — notificaciones toast

### Estado y datos

- **TanStack React Query** v5 — cache y estado del servidor
- **TanStack React Table** v8 — tablas con edición inline e infinite scroll
- **React Hook Form** v7 — formularios con validación

### Base de datos

- **better-sqlite3** v11 — SQLite local, prebuilts N-API (sin recompilar)

### Internacionalización

- **i18next** + **react-i18next** — ES / EN

### Calidad

- **ESLint** v9 (flat config) + **Prettier** v3 + **typescript-eslint** v8
- **Vitest** v4 — 41 tests unitarios, 0 fallos

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
│       ├── apiService.ts        # GET/POST/PUT/DELETE TeamWork API
│       ├── syncService.ts       # smartSyncEntries() — sync bidireccional
│       ├── historyService.ts    # CRUD sync_history
│       ├── timeLogService.ts    # markEntryAsSent/NotSent, getUnsentEntries
│       ├── taskLinkService.ts   # getLinkedTasks, updateTaskLink
│       ├── timeEntriesService.ts # CRUD time_entries
│       ├── taskService.ts       # CRUD tasks
│       ├── settingsService.ts   # work_settings + credenciales TW
│       └── encryptionService.ts # DPAPI via safeStorage
├── renderer/                    # Proceso React
│   ├── App.tsx                  # HashRouter + rutas
│   ├── components/
│   │   ├── WorkTimeForm.tsx     # Formulario principal de tiempos
│   │   ├── TimeLogsTable.tsx    # Tabla con edición inline + sync
│   │   ├── TasksTable.tsx
│   │   ├── TypeTasksTable.tsx
│   │   └── ui/                  # Componentes shadcn/ui
│   ├── hooks/
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
└── tests/                       # Vitest
    ├── setup.ts
    ├── main/
    │   ├── models/TaskLinks.test.ts
    │   └── services/syncService.test.ts, historyService.test.ts
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
```

`sync_history` es la clave del sync bidireccional: si `tw_time_entry_id` ya existe → PUT, si no → POST.

---

## ✅ Funcionalidades

- **WorkTimeForm** — campos dinámicos, cálculo encadenado inicio/fin, persistencia localStorage
- **TimeLogsTable** — edición inline, sync individual y masivo, búsqueda + filtros por fecha y tarea
- **Sync bidireccional** — `smartSyncEntries()`: POST / PUT según `sync_history`, siempre con `person-id = userId`
- **ImportTasksDialog** — asistente 3 pasos para importar subtareas de TW (templates RECA/FORE y OTHER)
- **ReportsPage** — horas por tarea y por día, 4 tarjetas resumen, filtro por rango de fechas
- **SettingsPage** — credenciales TW encriptadas (DPAPI), horario, días laborales, festivos
- **NavBar** — badge de sesión TW activa, badge de auto-updater
- **i18n** — ES/EN completo en todos los componentes y páginas
- **Seguridad** — credenciales TW cifradas con `safeStorage` (DPAPI en Windows)
- **Auto-updater** — descarga en segundo plano, toasts de estado, botón "Buscar actualizaciones"
- **41 tests** — modelos, historyService, syncService, timeUtils

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

> Tras cambiar versión de Node, ejecutar `electron-builder install-app-deps` para recompilar `better-sqlite3` contra el ABI de Electron.

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

- [ ] Ampliar tests: `timeEntriesService`, `apiService`, `settingsService`
- [ ] Tests de componentes React (WorkTimeForm, TimeLogsTable)
- [ ] Documentar lógica de cálculo en ReportsPage

### v1.4.0 — UX & Productividad

- [ ] **Timer en vivo** — play/stop que auto-calcula la duración al detener
- [ ] **Duplicar entrada** — clonar fila en TimeLogsTable con un click
- [ ] **Drag & drop** para reordenar entradas en WorkTimeForm
- [ ] Exportar reporte a CSV

### v1.5.0 — Sync Avanzado

- [ ] Eliminar entrada en TW desde TimeLogsTable
- [ ] Pull desde TW — importar time entries existentes al histórico local
- [ ] Indicador de "última sincronización" por entrada

### v2.0.0 — Multi-plataforma

- [ ] Soporte macOS (Apple Silicon + Intel)
- [ ] Migrar a `electron-vite`
- [ ] Drizzle ORM sobre better-sqlite3

---

## 📝 Desarrollo con IA

Ver [`.github/copilot-instructions.md`](.github/copilot-instructions.md) para contexto completo, patrones, convenciones y estado actual del proyecto.

---

## 📄 Licencia

MIT
