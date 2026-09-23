# Roadmap de Rendimiento — TW Time Register

> Auditoría completa de rendimiento (renderer, main process, SQLite y build/startup).
> Documento de trabajo: define hallazgos, acciones y criterios de aceptación para ejecutarlos por fases.

- **Fecha de la auditoría:** 2026-09-23
- **Alcance:** `src/renderer/**`, `src/main/**`, `database/**`, `vite.config.ts`, `package.json`
- **Estado general:** `Pendiente` — sin cambios de rendimiento aplicados todavía
- **Método:** lectura directa del código + revisión cruzada de datos reales de build en `dist-vite/` y `dist-electron/`

---

## 1. Resumen ejecutivo

El diseño actual **carga todos los datos en cada pantalla** (todos los `time_entries` sin `LIMIT` y todas las tareas con `SUM` agregado), y no hay índices en SQLite. Con pocos datos no se nota, pero al crecer el historial aparecen cuellos de botella O(n) / O(n·m) en el hilo principal y refetch constante de tablas completas.

Los 9 focos de mayor impacto:

1. `QueryClient` sin defaults → refetch constante (`staleTime: 0`, `refetchOnWindowFocus: true`).
2. Sin índices en SQLite ni PRAGMAs adecuados (incl. `foreign_keys` OFF).
3. `getTasks` con `julianday` + `GROUP BY` sin índice sobre toda `time_entries`.
4. `WorkTimeForm` re-renderiza todo el formulario en cada tecla y **cada segundo** con el timer.
5. `TimeLogsTable` con O(entries×tasks) por fila y sin virtualización.
6. `fetchTasks()` duplicado fuera del caché de React Query en 4 lugares.
7. Sincronización TW secuencial sin concurrencia ni transacciones.
8. Migraciones bloquean la creación de la ventana (better-sqlite3 es síncrono).
9. Bundle único de ~702 KB sin code splitting.

Además hay **7 bugs de correctitud** relacionados (listeners duplicados, invalidaciones a keys incorrectas, update optimista roto, etc.) — ver §4.

---

## 2. Baseline medido (build de referencia)

| Artefacto | Tamaño |
|---|---|
| `dist-vite/assets/index-*.js` (renderer, **chunk único**) | **701.9 KB** |
| `dist-vite/assets/index-*.css` | 55.7 KB |
| `dist-electron/index.js` (main bundle) | 916.8 KB |
| `dist-electron/preload.js` | 10.8 KB |

Sin code splitting: todas las rutas, flatpickr, date-fns e i18n (ambos idiomas) van al chunk inicial.

---

## 3. Leyenda

**Severidad:** 🔴 Alta · 🟡 Media · ⚪ Baja

**Estado:** `[ ]` pendiente · `[~]` en progreso · `[x]` hecho · `[!]` bloqueado

> Referencias de línea corresponden al estado del código en la fecha de auditoría; pueden desplazarse con los cambios.

---

## 4. Bugs de correctitud detectados (transversal)

Estos son bugs funcionales (no solo lentitud) y conviene resolverlos temprano.

| ID | Bug | Ubicación | Detalle |
|---|---|---|---|
| BUG-01 | `off` de IPC roto + listeners sin cleanup | `src/main/preload.ts:379-384`, `src/renderer/hooks/useAutoUpdater.ts:75-79` | `on` envuelve el callback en una lambda nueva; `off` crea **otra** lambda que nunca coincide → no remueve nada. Sin cleanup, cada montaje de `NavBar` acumula listeners y **toasts duplicados**. |
| BUG-02 | `ipcRenderer` completo expuesto | `src/main/preload.ts:8` | Anula el aislamiento y la whitelist de `window.Main`. |
| BUG-03 | Update optimista a la key equivocada | `src/renderer/hooks/useTasks.tsx:199-203` | Escribe en `['tasks']` pero el query es `['tasks', searchTerm]` → nunca se ve el optimista y el rollback queda `undefined`. |
| BUG-04 | Invalidación de key incorrecta | `src/renderer/components/PullFromTWDialog.tsx:111,186`, `src/renderer/components/PullTaskDialog.tsx:75` | Invalidan `['timeLogs']`, pero la key real es `['workTimes']` (`src/renderer/hooks/useTimeLogs.tsx:11`) → la tabla queda stale. |
| BUG-05 | Guardar WorkTime no invalida caché | `src/renderer/components/WorkTimeForm.tsx` (`onSubmit`) | Usa `window.Main.addTimeEntry` individual y no invalida `['workTimes']`/`['tasks']` → UI desactualizada. |
| BUG-06 | Re-registro de IPC al crear 2ª ventana | `src/main/index.ts:75-76`, `src/main/ipc/windowIpc.ts`, `src/main/updater.ts:14,18` | `initAutoUpdater` usa `ipcMain.handle`; una segunda `createWindow` (second-instance/macOS activate) **lanza** "Attempted to register a second handler". |
| BUG-07 | Combobox resetea la búsqueda | `src/renderer/components/ui/combobox.tsx:72-78` | El effect depende de `options`/`value` que cambian cada segundo con el timer → `setSearch('')` mientras el usuario escribe en el dropdown. |
| BUG-08 | `foreign_keys` OFF | `src/main/database/database.ts:20` | `ON DELETE CASCADE` de `database/schema.sql` no se aplica → huérfanos en `time_entries`/`sync_history`. |

---

## 5. Fases y tareas

### Fase 0 — Quick wins de bajo riesgo
> Objetivo: eliminar el churn de datos y los bugs de IPC/caché. Cambios pequeños, alto retorno.

- [ ] **PERF-001 · 🔴 `QueryClient` sin defaults → refetch constante**
  - **Ubicación:** `src/renderer/App.tsx:13`
  - **Problema:** Defaults de TanStack (`staleTime: 0`, `refetchOnWindowFocus: true`). En desktop el foco cambia mucho y los `Tabs` desmontan tablas (`src/renderer/pages/TasksPage.tsx:34-42`) → refetch de tablas completas continuamente.
  - **Acción:**
    ```ts
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { staleTime: 30_000, gcTime: 300_000, refetchOnWindowFocus: false, retry: 1 }
      }
    });
    ```
  - **Aceptación:** cambiar de pestaña o alt-tab no dispara refetch dentro de los 30 s.

- [ ] **PERF-002 · 🔴 Eliminar `fetchTasks()` duplicado fuera del caché**
  - **Ubicación:** `src/renderer/components/TimeLogsTable.tsx:59-69`, `src/renderer/pages/HomePage.tsx:37-47`, `src/renderer/pages/ReportsPage.tsx:71-81`, `src/renderer/components/PullFromTWDialog.tsx:128`
  - **Problema:** Llamadas directas a `fetchTasks()`/`fetchTypeTasks()` que saltan `['tasks']`/`['typeTasks']`; cada una es un IPC + query pesada extra.
  - **Acción:** consumir `useTasks()` / `useQuery({ queryKey: ['typeTasks'] })` compartido.
  - **Aceptación:** una sola consulta de tareas por navegación (verificable en logs IPC).

- [ ] **PERF-003 · 🔴 BUG-01 + BUG-02: IPC seguro y sin leaks**
  - **Ubicación:** `src/main/preload.ts:8,379-384`, `src/renderer/hooks/useAutoUpdater.ts:75-79`
  - **Acción:** eliminar `exposeInMainWorld('ipcRenderer', ...)`; guardar el wrapper real en un `Map` para que `off` remueva el listener correcto; devolver cleanup en `useAutoUpdater` (y memoizar `installUpdate`/`checkForUpdates`).
  - **Aceptación:** navegar entre páginas repetidamente no duplica toasts ni listeners.

- [ ] **PERF-004 · 🔴 Unificar query keys e invalidaciones (BUG-03, BUG-04, BUG-05)**
  - **Ubicación:** `src/renderer/hooks/useTasks.tsx:189-203`, `PullFromTWDialog.tsx:111,186`, `PullTaskDialog.tsx:75`, `WorkTimeForm.tsx` (`onSubmit`)
  - **Acción:** definir constantes de key (p. ej. `TIME_LOGS_KEY = ['workTimes']`, `TASKS_KEY = ['tasks']`); usar `setQueriesData({ queryKey: ['tasks'] })` o la key exacta para el optimista; invalidar `['workTimes']` y `['tasks']` al guardar WorkTime.
  - **Aceptación:** tras guardar/sincronizar, Home/TimeLogs/Reports reflejan los datos sin recargar.

- [ ] **PERF-005 · 🔴 Batchear el guardado de WorkTime**
  - **Ubicación:** `src/renderer/components/WorkTimeForm.tsx` (`onSubmit`, usa `window.Main.addTimeEntry` en `Promise.all`)
  - **Acción:** usar el endpoint batch ya existente `addTimeEntries` (`src/renderer/services/timesService.ts:85-87`) y luego invalidar caché.
  - **Aceptación:** guardar N entradas = 1 IPC de escritura.

---

### Fase 1 — Base de datos (SQLite)
> Objetivo: desbloquear los cuellos de botella de consulta. Requiere una migración idempotente.

- [ ] **PERF-101 · 🔴 Crear índices faltantes**
  - **Ubicación:** `database/schema.sql` (no hay ningún `CREATE INDEX`), `src/main/database/migrations.ts`
  - **Problema:** columnas filtradas/joineadas/ordenadas sin índice → full scans.
  - **Acción (migración `CREATE INDEX IF NOT EXISTS`):**
    ```sql
    CREATE INDEX IF NOT EXISTS idx_te_date        ON time_entries(entry_date);
    CREATE INDEX IF NOT EXISTS idx_te_date_start  ON time_entries(entry_date, hora_inicio);
    CREATE INDEX IF NOT EXISTS idx_te_date_end    ON time_entries(entry_date, hora_fin);
    CREATE INDEX IF NOT EXISTS idx_te_task        ON time_entries(task_id);
    CREATE INDEX IF NOT EXISTS idx_te_send        ON time_entries(send);
    CREATE INDEX IF NOT EXISTS idx_te_task_times  ON time_entries(task_id, hora_inicio, hora_fin);
    CREATE INDEX IF NOT EXISTS idx_sh_entry       ON sync_history(entry_id);
    CREATE INDEX IF NOT EXISTS idx_sh_tw_entry    ON sync_history(tw_time_entry_id);
    CREATE INDEX IF NOT EXISTS idx_sh_entry_ok    ON sync_history(entry_id, success, synced_at);
    CREATE INDEX IF NOT EXISTS idx_tasks_type     ON tasks(type_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_name     ON tasks(task_name, type_id);
    CREATE INDEX IF NOT EXISTS idx_typetasks_name ON type_tasks(type_name);
    ```
  - **Aceptación:** `EXPLAIN QUERY PLAN` de las consultas de §PERF-102/103 usa los índices (sin `SCAN time_entries`).

- [ ] **PERF-102 · 🔴 PRAGMAs de SQLite (incl. BUG-08)**
  - **Ubicación:** `src/main/database/database.ts:20`
  - **Acción:**
    ```ts
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('busy_timeout = 5000');
    ```
  - **Aceptación:** `PRAGMA foreign_keys` = 1; borrar una tarea elimina sus `time_entries`.

- [ ] **PERF-103 · 🔴 Optimizar `getTasks` (agregado)**
  - **Ubicación:** `src/main/services/taskService.ts:34-59`
  - **Problema:** `LEFT JOIN time_entries` + `SUM(julianday(...))` + `GROUP BY` sin índice; se ejecuta en Home/Reports/TimeLogs/selector.
  - **Acción:** apoyarse en `idx_te_task_times` y reemplazar `julianday` por aritmética entera `substr` (patrón ya usado en `src/main/services/timeEntriesService.ts:399`). Evaluar paginación.
  - **Aceptación:** tiempo de la consulta se reduce de forma medible con historial grande.

- [ ] **PERF-104 · 🟡 Cachear prepared statements**
  - **Ubicación:** `src/main/database/database.ts:24,28,32`
  - **Problema:** `prepare()` recompila SQL en cada llamada (crítico en loops de sync/import).
  - **Acción:** `Map<string, Statement>` en el wrapper.
  - **Aceptación:** los loops de sync/import no recompilan la misma sentencia.

- [ ] **PERF-105 · 🟡 Batch de escrituras en transacción**
  - **Ubicación:** `src/main/services/timeEntriesService.ts:71-78` (`addTimeEntries`), `src/main/services/taskService.ts:210-263` (`importTasksFromCSV`), `src/main/services/settingsService.ts:160-173`
  - **Acción:** exponer `db.transaction` y envolver las escrituras por lote.
  - **Aceptación:** importar/pull N filas = 1 transacción.

- [ ] **PERF-106 · 🟡 `getNextAvailableSlot` / `getDailyTimeInfo`**
  - **Ubicación:** `src/main/services/timeEntriesService.ts:201-230`, `:233-315`
  - **Problema:** hasta ~150 queries síncronas por llamada; `getWorkSettings` se re-lee varias veces; `getTotalMinutesForDate` suma en JS.
  - **Acción:** cargar settings/holidays una vez; agregar totales por rango con un `GROUP BY entry_date`; calcular en memoria.
  - **Aceptación:** `getNextAvailableSlot` usa un número constante de queries.

- [ ] **PERF-107 · 🟡 Acotar consultas sin límite**
  - **Ubicación:** `src/main/services/timeEntriesService.ts:124-139` (`getAllTimeEntries`), `src/main/services/historyService.ts:56-65` (`getSyncHistory`)
  - **Acción:** rango de fechas por defecto y/o `LIMIT/OFFSET` (apoyado en `idx_te_date_start`).

---

### Fase 2 — Re-renders del renderer
> Objetivo: dejar de re-renderizar árboles completos por tecla/segundo.

- [ ] **PERF-201 · 🔴 Aislar el timer en vivo de `WorkTimeForm`**
  - **Ubicación:** `src/renderer/components/WorkTimeForm.tsx:269-280`, `:445-455`, `:990`; `draftMinutesByTask` en `:293-320`
  - **Problema:** `elapsedSeconds` vive en la raíz → todo el formulario se re-renderiza cada segundo; además reconstruye `optionsWithDraft` cada segundo.
  - **Acción:** extraer `<LiveTimer startedAt=... />` que solo re-renderice ese nodo; quitar `elapsedSeconds` de `draftMinutesByTask`.

- [ ] **PERF-202 · 🔴 Sacar `useWatch` global de la raíz**
  - **Ubicación:** `src/renderer/components/WorkTimeForm.tsx:174`
  - **Problema:** `useWatch({ name: 'entries' })` suscribe todo el form; cada tecla re-renderiza todos los `Card`, `Controller`, `Combobox` y 3 flatpickr por fila.
  - **Acción:** extraer `EntryCard` con `React.memo` (key `field.id`); usar `getValues()` en handlers y suscripciones por campo donde aplique.

- [ ] **PERF-203 · 🔴 `Map` de tareas en tablas (O(E×T) → O(E))**
  - **Ubicación:** `src/renderer/components/TimeLogsTable.tsx:113-117` (llamado en `:586`); `src/renderer/pages/ReportsPage.tsx:83-91` (llamado en `:321-322`)
  - **Acción:** `useMemo(() => new Map(tasks.map(t => [t.taskName, t])), [tasks])` y lookup O(1).

- [ ] **PERF-204 · 🔴 Estabilizar `Combobox` (BUG-07)**
  - **Ubicación:** `src/renderer/components/ui/combobox.tsx:57,72-78,176-187`
  - **Acción:** `filtered` con `useMemo` y solo si `open`; effect dependiente de `open` + `value?.value` (primitivo); memoizar `options` aguas arriba.

- [ ] **PERF-205 · 🟡 Memoizar filas y opciones repetidas**
  - **Ubicación:** `src/renderer/hooks/useTasks.tsx:295-300` (`typeTasks.map` por celda), `src/renderer/components/TimeLogsTable.tsx:422` (fila inline)
  - **Acción:** `typeOptions` memoizado; extraer `TimeLogRow` con `React.memo`.

- [ ] **PERF-206 · 🟡 Mover serialización del draft dentro del debounce**
  - **Ubicación:** `src/renderer/components/WorkTimeForm.tsx:523-550`
  - **Problema:** `result.map(serializeEntryDates)` corre en cada tecla antes del `setTimeout`.
  - **Acción:** calcular el payload dentro del timeout.

- [ ] **PERF-207 · 🟡 `useKeyboardShortcuts` estable**
  - **Ubicación:** `src/renderer/hooks/useKeyboardShortcuts.ts:30-60`, `src/renderer/components/WorkTimeForm.tsx:900-934`
  - **Acción:** mantener `shortcuts` en un ref y registrar el listener una sola vez (`[]`).

---

### Fase 3 — Tablas grandes
- [ ] **PERF-301 · 🔴 Virtualizar `TimeLogsTable`**
  - **Ubicación:** `src/renderer/components/TimeLogsTable.tsx:422`
  - **Problema:** renderiza todo el historial con múltiples `TooltipProvider` por fila.
  - **Acción:** `@tanstack/react-virtual` o `react-window`; alternativa: paginación por IPC.

- [ ] **PERF-302 · 🟡 Virtualizar/reducir tablas de `ReportsPage`**
  - **Ubicación:** `src/renderer/pages/ReportsPage.tsx:318` (`byTask`), `:455` (`byDay`)
  - **Acción:** virtualizar o limitar; memoizar el `Map` de tareas (PERF-203).

---

### Fase 4 — Sync y red
- [ ] **PERF-401 · 🔴 Concurrencia acotada en `smartSyncEntries`**
  - **Ubicación:** `src/main/services/syncService.ts:125-191`
  - **Problema:** loop secuencial de HTTP con timeout 10 s; una falla bloquea el resto.
  - **Acción:** pool con `p-limit(5)`, respetando rate limits; agrupar escrituras en transacción.

- [ ] **PERF-402 · 🔴 `pullEntriesFromTW` en transacción**
  - **Ubicación:** `src/main/services/syncService.ts:337-380`
  - **Problema:** 2 INSERT (transacciones implícitas) por entrada × cientos (pageSize 500).
  - **Acción:** una transacción + statements preparados una vez.

- [ ] **PERF-403 · 🟡 Eliminar N+1 de sync**
  - **Ubicación:** `src/main/services/syncService.ts:150` (`getLastSuccessfulSync` por entrada), `src/main/services/apiService.ts` (credenciales por llamada)
  - **Acción:** una query `IN (...)` por lote (apoyada en `idx_sh_entry_ok`); resolver credenciales/`safeStorage` una vez por sync.

- [ ] **PERF-404 · 🟡 Retry/backoff y límite de concurrencia HTTP**
  - **Ubicación:** `src/main/services/apiService.ts` (todas las llamadas axios), `:330-371` (`fetchTWTaskDetails` con `Promise.all` sin límite)
  - **Acción:** instancia axios con retry en 429/5xx + backoff (`Retry-After`); `p-limit` en `fetchTWTaskDetails`; guardas de paginación (`:411-445`).

---

### Fase 5 — Startup y bundle
- [ ] **PERF-501 · 🔴 Code splitting por ruta + `manualChunks`**
  - **Ubicación:** `src/renderer/App.tsx:5-9`, `vite.config.ts:67-71,90-94`
  - **Acción:** `React.lazy` + `<Suspense>` por página; `manualChunks` para react, radix, tanstack, flatpickr/date-fns, i18n.
  - **Aceptación:** el chunk inicial deja de incluir WorkTimeForm/flatpickr/date-fns; reporte de build sin warning de 500 KB (o justificado).

- [ ] **PERF-502 · 🔴 Migraciones tras mostrar la ventana**
  - **Ubicación:** `src/main/index.ts:115-119`, `src/main/database/database.ts:80-89`, `src/main/database/migrations.ts:5-111`
  - **Acción:** `createWindow()` primero; migrar en paralelo (idempotente) y gatear IPC dependiente si hace falta.
  - **Aceptación:** menor tiempo a primer pintado.

- [ ] **PERF-503 · 🟡 `show:false` + `backgroundColor` + `ready-to-show`**
  - **Ubicación:** `src/main/index.ts:52-53`
  - **Problema:** `show:true` sin `backgroundColor`/`ready-to-show` → flash blanco.
  - **Acción:** `show:false`, `backgroundColor:'#282c34'`, `once('ready-to-show', () => window.show())`; mover `nativeTheme.themeSource` antes de crear la ventana.

- [ ] **PERF-504 · 🟡 i18n y libs de fecha**
  - **Ubicación:** `src/renderer/plugins/i18n.ts:4,12`, `src/renderer/locales/index.ts:1-6`, `src/renderer/components/TotalTimeDay.tsx:5-6`
  - **Acción:** cargar solo el idioma activo y el otro con `import()`; importar locales de `date-fns/locale/<x>` directo; evaluar eliminar `date-fns` (solo se usa en un archivo).

- [ ] **PERF-505 · ⚪ Higiene de build/config**
  - **Ubicación:** `package.json:5,23,26` + `src/main/tsconfig.json:17,22` (conflicto `build:electron`), `src/main/database/migrations.ts:14-111` (`console.log` en prod), `vite.config.ts:10` (`rmSync` top-level), `package.json` (deps de build en `dependencies`), `src/renderer/index.html:6` (título placeholder).

---

### Fase 6 — Otros medios y limpieza
- [ ] **PERF-601 · 🟡 `TotalTimeDay` N+1 + race**
  - **Ubicación:** `src/renderer/components/TotalTimeDay.tsx:45-53`
  - **Acción:** guard de cancelación o IPC batch `getDailyTimeInfoForDates`.
- [ ] **PERF-602 · 🟡 `ReportsPage`: debounce de búsqueda y memo del `Map`**
  - **Ubicación:** `src/renderer/pages/ReportsPage.tsx:112-162`
- [ ] **PERF-603 · 🟡 `NavBar` scroll sin throttle**
  - **Ubicación:** `src/renderer/components/NavBar.tsx:21-26` → `requestAnimationFrame` o set-state solo si cambia el booleano.
- [ ] **PERF-604 · ⚪ `useTable` limpieza**
  - **Ubicación:** `src/renderer/hooks/useTable.tsx:24-26,68,101` → quitar memo identidad, consolidar resets, estabilizar `defaultColumn`.
- [ ] **PERF-605 · ⚪ `DataTable` scroll**
  - **Ubicación:** `src/renderer/components/DataTable.tsx:151,158-164` → limpiar `setTimeout` y estabilizar listener.
- [ ] **PERF-606 · ⚪ CSV parse en worker**
  - **Ubicación:** `src/renderer/components/ImportCSVTasksDialog.tsx:34-62,107-155` → parseo por chunks/worker.

---

## 6. Orden de ejecución sugerido

| # | Fase | Foco | Riesgo |
|---|---|---|---|
| 1 | Fase 0 | Config + bugs de caché/IPC | Bajo |
| 2 | Fase 1 | Índices y PRAGMAs (desbloquea todo lo demás) | Bajo/Medio |
| 3 | Fase 2 | Re-renders de WorkTimeForm y tablas | Medio |
| 4 | Fase 3 | Virtualización | Medio |
| 5 | Fase 4 | Sync/red | Medio |
| 6 | Fase 5 | Startup/bundle | Bajo/Medio |
| 7 | Fase 6 | Medios y limpieza | Bajo |

---

## 7. Verificación

Antes de cerrar cada fase:

```pwsh
npm run test          # 111 tests (vitest)
npm run lint          # eslint
npm run type-check    # tsc (existen 2 errores preexistentes de mayúsculas button/label)
npm run build         # vite build + plugin electron
```

Chequeos específicos:
- **SQLite:** `EXPLAIN QUERY PLAN` sobre las consultas de tareas y entradas; `PRAGMA foreign_keys;` = 1.
- **Renderer:** React DevTools Profiler — medir renders de `WorkTimeForm` con timer activo (objetivo: no re-render del árbol completo cada segundo).
- **Bundle:** comparar tamaño del chunk inicial antes/después de PERF-501.
- **Sync:** contar round-trips IPC/HTTP antes/después de Fase 4.

---

## 8. Fuera de alcance (por ahora)

- Migrar SQLite a `utilityProcess`/worker (mitiga el bloqueo síncrono del main, pero es un cambio mayor).
- FTS5 para búsqueda de tareas (solo si el `LIKE '%term%'` se vuelve problema real).
- Paginación server-side completa en la UI (se aborda primero con virtualización).

---

## 9. Cómo mantener este documento

- Al completar una tarea, cambiar `[ ]` → `[x]` y anotar la fecha/PR.
- Si un hallazgo se descarta, moverlo a §8 con la justificación.
- Nuevos hallazgos de rendimiento: agregar con el siguiente ID de la fase correspondiente.
