# Instrucciones para Asistentes de IA - TW Time Register

## Contexto del Proyecto

**TW Time Register** es una aplicación de escritorio desarrollada con Electron para registrar y gestionar tiempos de trabajo que luego se sincronizan con TeamWork.

### Propósito Principal
Crear un "borrador inteligente" de registros de tiempo con:
- Cálculos automáticos de fechas y horas (hora fin = hora inicio + duración)
- Flexibilidad para modificar cualquier dato manualmente
- Gestión de tareas predefinidas vinculadas a TeamWork
- Reportes de tiempo por tarea y por día
- Sincronización con la API de TeamWork

### Usuario Objetivo
Desarrollador que necesita registrar su tiempo de trabajo diario en TeamWork de forma eficiente.

---

## Stack Tecnológico

### Proceso Principal (Electron Main)
- **Electron v30** - El proceso main maneja la ventana, IPC y acceso a SQLite
- **better-sqlite3 v11** - Base de datos local para persistencia (sync API, prebuilts nativos sin compilar)
- **Axios** - Cliente HTTP para API de TeamWork
- **electron-updater v6** - Auto-actualizaciones via GitHub Releases

### Proceso Renderer (React)
- **React v18** con hooks
- **TypeScript v5** - Todo el código debe estar tipado
- **Vite v7** - Bundler y dev server ultrarrápido
- **TanStack React Query v5** - Cache y estado del servidor
- **TanStack React Table v8** - Tablas con infinite scroll y edición inline
- **React Hook Form v7** - Formularios con validación
- **Tailwind CSS v3.4** - Estilos utility-first
- **shadcn/ui** - Componentes accesibles (basados en Radix UI)
- **React Router DOM v6** - Navegación SPA
- **i18next** - Internacionalización (ES/EN)
- **date-fns** - Manipulación de fechas
- **Flatpickr** - Selector de tiempo
- **Sonner** - Notificaciones toast

### Calidad de Código
- **ESLint v9** - Linting con flat config (`eslint.config.js`)
- **Prettier v3** - Formateo de código
- **typescript-eslint v8** - Reglas TypeScript para ESLint

---

## Arquitectura y Estructura

```
src/
├── main/                   # Proceso Electron (Node.js)
│   ├── index.ts            # Punto de entrada, crea BrowserWindow
│   ├── preload.ts          # Expone API segura al renderer via contextBridge
│   ├── database/
│   │   ├── database.ts     # Conexión SQLite y queries básicas
│   │   ├── migrations.ts   # Migraciones de esquema
│   │   └── models/         # Modelos de datos
│   ├── ipc/
│   │   ├── index.ts        # Registro central de handlers
│   │   ├── databaseIpc.ts  # Handlers IPC para BD
│   │   ├── windowIpc.ts    # Handlers para ventana
│   │   └── anotherIpc.ts   # Otros handlers
│   └── services/
│       ├── taskService.ts      # CRUD de tareas
│       ├── typeTasksService.ts # CRUD de tipos de tareas
│       ├── timeLogService.ts   # CRUD de registros de tiempo
│       ├── credentialService.ts # Gestión de credenciales
│       ├── apiService.ts       # Cliente API TeamWork
│       └── ...
├── renderer/               # Proceso React (Browser)
│   ├── App.tsx             # Rutas y providers
│   ├── components/
│   │   ├── WorkTimeForm.tsx    # ⭐ Formulario principal de tiempos
│   │   ├── DataTable.tsx       # Tabla genérica con TanStack + infinite scroll
│   │   ├── TimeLogsTable.tsx   # Tabla de registros de tiempo
│   │   ├── TasksTable.tsx      # Tabla de tareas
│   │   ├── TypeTasksTable.tsx  # Tabla de tipos de tareas
│   │   └── ui/                 # Componentes shadcn/ui
│   │       ├── button.tsx, card.tsx, dialog.tsx
│   │       ├── input.tsx, label.tsx, textarea-form.tsx
│   │       ├── select.tsx, select-custom.tsx
│   │       ├── table.tsx, tabs.tsx, separator.tsx
│   │       ├── tooltip.tsx, badge.tsx, skeleton.tsx
│   │       ├── alert-dialog.tsx, dropdown-menu.tsx
│   │       └── sonner.tsx
│   ├── hooks/
│   │   ├── useTasks.tsx            # React Query para tareas
│   │   ├── useTypeTasks.tsx        # React Query para tipos
│   │   ├── useTimeLogs.tsx         # React Query para time logs
│   │   ├── useTable.tsx            # Configuración TanStack Table
│   │   ├── useKeyboardShortcuts.ts # ⭐ Atajos de teclado
│   │   └── useDarkMode.ts          # Toggle tema oscuro
│   ├── services/
│   │   ├── tasksService.ts     # Llama a window.Main.* (IPC)
│   │   ├── typeTasksService.ts
│   │   └── timesService.ts
│   ├── hooks/
│   │   └── useTWSession.ts     # Estado de sesión TW (isConfigured, username)
│   └── pages/
│       ├── HomePage.tsx        # Página principal de registro
│       ├── TasksPage.tsx       # Gestión de tareas y tipos
│       ├── ReportsPage.tsx     # ⭐ Vista de reportes (horas por tarea y por día)
│       └── SettingsPage.tsx    # ⭐ Configuración: credenciales TW, horario, festivos
└── types/                  # Tipos compartidos
    ├── tasks.ts
    ├── typeTasks.ts
    ├── dataTable.ts
    └── ...
```

### Flujo de Datos (IPC)
```
Renderer (React) → window.Main.método() → preload.ts → ipcRenderer.invoke()
    ↓
Main (Electron) ← ipcMain.handle() ← ipc/databaseIpc.ts ← services/*.ts ← SQLite
```

---

## Patrones y Convenciones

### TypeScript
- **Usar tipos estrictos**: Evitar `any`, definir interfaces para todos los objetos
- **Tipos compartidos**: Colocar en `src/types/` si se usan en main y renderer
- **Columnas de BD**: Usar constantes `columnsDB` para evitar strings mágicos

```typescript
// ✅ Correcto
export const columnsDB = {
  TABLE_NAME: 'tasks',
  ID: 'task_id',
  TASK_NAME: 'task_name'
};

// ✅ En queries
const query = `SELECT ${columnsDB.ID} FROM ${columnsDB.TABLE_NAME}`;
```

### React Query
- **Queries**: Para obtener datos (`useQuery`)
- **Mutations**: Para crear/actualizar/eliminar (`useMutation`)
- **Optimistic Updates**: Actualizar UI antes de confirmar servidor
- **Invalidate**: Refrescar después de mutaciones

```typescript
// Patrón estándar React Query v5
const { data, isPending, error } = useQuery({
  queryKey: ['tasks'],
  queryFn: fetchTasks
});

const { mutate } = useMutation({
  mutationFn: addTask,
  onSettled: () => queryClient.invalidateQueries({ queryKey: ['tasks'] })
});
```

### TanStack Table
- **useTable hook**: Centraliza configuración de tabla
- **Columnas definidas por entidad**: En `types/*.ts` junto con el tipo
- **Edición inline**: Usar `meta.updateData` para actualizar estado local
- **Infinite scroll**: DataTable usa `fetchNextPage` y observadores de intersección

### Componentes shadcn/ui
- **Ubicación**: `components/ui/` - Componentes copiados de shadcn
- **Basados en Radix UI**: Accesibilidad garantizada
- **Estilizados con Tailwind**: Personalizables via className
- **Primitivos instalados**: Select, Dialog, AlertDialog, DropdownMenu, Tooltip, Tabs, etc.

### Atajos de Teclado
- **useKeyboardShortcuts hook**: Centraliza manejo de shortcuts
- **Shortcuts actuales**: Ctrl+N (nuevo), Ctrl+S (guardar), Esc (limpiar)
- **Tooltips**: Muestran atajos disponibles en los botones

### React Hook Form
- **useForm**: Para formularios simples
- **useFieldArray**: Para listas dinámicas de campos
- **useWatch**: Para observar cambios y calcular valores derivados
- **control**: Pasar a componentes controlados

### Componentes
- **Naming**: PascalCase para componentes, camelCase para hooks
- **Props**: Definir interface para props complejas
- **UI Components**: Colocar en `components/ui/`, sin lógica de negocio

### Servicios
- **renderer/services/**: Wrappean llamadas a `window.Main.*`
- **main/services/**: Lógica de negocio y acceso a BD

---

## Base de Datos (SQLite)

### Tablas Principales
```sql
type_tasks (type_id, type_name)           -- Categorías: FORE, RECA, etc.
tasks (task_id, type_id, task_name, ...)  -- Tareas de TeamWork
time_entries (entry_id, task_id, ...)     -- Registros de tiempo (borrador)
```

### Agregar IPC Handler
1. Agregar función en `main/services/` o `main/database/`
2. Registrar handler en `main/ipc/databaseIpc.ts`
3. Exponer en `main/preload.ts` dentro del objeto `api`
4. Crear wrapper en `renderer/services/`

---

## Estado Actual y Problemas Conocidos

### ✅ Fase 1: Limpieza (COMPLETADA - Dic 2025)
- Eliminados archivos de ejemplo: EditableTable, makeData, Users, Comments
- Eliminados servicios de ejemplo: usersService, commentsServices
- Unificado DataTable (eliminado DataTableNew)
- Removido @faker-js/faker
- Actualizados metadatos del package.json

### ✅ Fase 2: Stack Actualizado (COMPLETADA - Dic 2025)
- Vite 2.8 → 7.2.6
- @vitejs/plugin-react 1.2 → 5.1.1
- TanStack React Query 4.x → 5.x (sintaxis migrada)
- Tailwind CSS 3.0 → 3.4.18
- ESLint 8 → 9.39.1 (migrado a flat config)
- Prettier 2.6 → 3.7.4
- typescript-eslint 5.x → 8.48.1

### ✅ Fase 3: UI/UX con shadcn/ui (COMPLETADA - Dic 2025)
- Instalados componentes shadcn/ui (Button, Card, Dialog, Select, etc.)
- Tema claro/oscuro completo con variables CSS
- Infinite scroll en tablas (reemplaza paginación)
- Skeleton loaders durante carga de datos
- Empty states atractivos para tablas vacías
- Keyboard shortcuts (Ctrl+N, Ctrl+S, Esc)
- Tooltips con indicadores de shortcuts
- Notificaciones toast con Sonner
- Eliminada dependencia de Material Tailwind
- Eliminada dependencia de react-select

### ✅ Fase 4: Funcionalidad Core — Parte 1 (COMPLETADA - Feb 2026)
- `Combobox` buscable con navegación por teclado (reemplaza Radix Select en `WorkTimeForm`)
- Fix: inicialización de `previousValues` en nuevas entradas (evitaba ajuste incorrecto de -1h)
- `ImportTasksDialog`: asistente 3-pasos para importar subtareas de TW
  - Templates RECA/FORE (subtareas 2,3,4,5,10) y OTHER (1,3,11)
  - Fallbacks de campo API: `content || name || title`
  - Fallbacks de clave raíz: `tasks || todo-items`
  - Panel de diagnóstico cuando no hay coincidencias
- Ordenamiento: tipos de tarea alfabético; tareas por tipo luego nombre
- `TimeLogsTable`: edición inline completa + sincronización masiva con TW
- `TimeLogsTable`: búsqueda general + filtros por fecha y tarea (Combobox buscable)
- Guard `data &&` en `TasksTable` para evitar TypeError antes de que resuelva la query

### ✅ Fase 5: Funcionalidad Core — Parte 2 (COMPLETADA - Feb 2026)
- **Linting limpio**: 0 errores, 0 warnings en todo `src/` (tipado estricto, sin `any`, sin `console.log`)
  - `any` eliminados de IPC handlers, forms, hooks y servicios
  - `_event` en handlers IPC sin usar el argumento
  - `useCallback` + dependencias correctas en `useTasks`, `useTypeTasks`
- **`ReportsPage`** (`/reports`): vista de reportes completa
  - 4 tarjetas resumen: horas totales, facturables, enviadas a TW, días con registros
  - Pestañas: por tarea (con barra de progreso y badge de estado) y por día
  - Filtro por rango de fechas
- **Cálculos encadenados en `WorkTimeForm`**: hora fin de la entrada N se propaga como hora inicio de la entrada N+1
- **`SettingsPage`** (`/settings`): flujo completo de autenticación con TeamWork
  - Campos: dominio, usuario, contraseña, userId
  - Botón "Probar conexión" → llama `/me.json` y auto-rellena userId
  - Banner de resultado (éxito/error)
  - `useTWSession` hook: muestra punto verde animado + nombre en NavBar cuando hay sesión activa
  - Migración automática de claves TW en BD existentes
- **Festivos 2026** añadidos al schema SQL
- Ruta `/reports` en `App.tsx` y `BarChart2` en `NavBar.tsx`

### ✅ Fase 6: Release & Distribución (COMPLETADA - Mar 2026)
- **`better-sqlite3`** reemplaza `sqlite3 + sqlite` — prebuilts N-API, sin VS Build Tools
  - `DatabaseWrapper` en `database.ts`: API async compatible, preserva signatures de todos los servicios
  - Tipos genéricos en `db.all<T>()` y `db.get<T>()` para type-safety estricto
- **ASAR deshabilitado** (`"asar": false`) — simplifica packaging con módulos nativos + pnpm hoisted
- **Vite bundlea todas las deps JS** del main process en `dist-electron/index.js`
  - Solo se externalizan `electron` (runtime) y `better-sqlite3` (nativo)
  - Elimina necesidad de `node_modules` en la app instalada (excepto el `.node` nativo)
- **`HashRouter`** reemplaza `BrowserRouter` — necesario en Electron (no hay servidor HTTP en producción)
- **Paths absolutos** en `database.ts` usando `app.getPath('userData')` y `app.getAppPath()`
- **Error handling** en `main/index.ts` con `dialog.showErrorBox` para crashes visibles
- **GitHub Actions** (`release.yml`): Node 22, pnpm hoisted solo en CI, `electron-builder install-app-deps`
- **`build-local.ps1`**: script para probar builds localmente sin instalador (usa `--dir`, no requiere admin)
- **`useAutoUpdater` hook** + badge en NavBar (amber descargando, verde listo para instalar)
- **`.node-version`** fija Node 22 LTS para el proyecto
- **`.npmrc`** con `onlyBuiltDependencies` para auto-aprobar builds de `better-sqlite3`/`electron`

### ✅ Fase 7: Seguridad — Credenciales TW Encriptadas (COMPLETADA - 2026)
- **`encryptionService.ts`** — wrapper sobre `safeStorage` de Electron (DPAPI en Windows)
  - `encrypt(plainText)` → `enc:<base64>`; `decrypt(value)` → texto plano con fallback transparente
  - `isEncryptedValue()` para detectar si ya está cifrado; `isEncryptionAvailable()` para UI
- **`settingsService.ts`** — `saveTWCredentials` cifra `tw_username`/`tw_password` al guardar; `getTWCredentials` descifra al leer
- **`migrations.ts`** — migración automática: recifra valores plain-text existentes en el primer arranque
- Commit: `7838941`

### ✅ Fase 8: i18n — Migración Completa (COMPLETADA - 2026)
- **Locales reconstruidos** (`es.ts`, `en.ts`) con estructura completa:
  `common`, `nav`, `home`, `reports`, `settings`, `timeLogs`, `days`, `menu`
- **Páginas migradas**: `ReportsPage`, `SettingsPage`, `HomePage`, `NavBar`, `TimeLogsTable`
- Eliminados todos los ternarios `isSpanish ? '...' : '...'` — todo usa `t('section.key')`
- Interpolación: `t('key', { var: value })` con `{{var}}` en locales
- Commit: `8d87b91`

### ⚠️ Mejoras Pendientes
- Completar modelos en `main/database/models/` (History, TaskLinks, TimeLog)
- Agregar festivos 2027+ al schema cuando corresponda

---

## Cómo Ayudar en Este Proyecto

### Al crear código nuevo
1. **Usar TypeScript estricto** - Definir tipos para todo
2. **Seguir patrones existentes** - Ver `useTasks.tsx` como referencia
3. **Componentes pequeños** - Una responsabilidad por componente
4. **Documentar complejidad** - Comentar lógica no obvia

### Al refactorizar
1. **No romper funcionalidad** - Verificar que sigue funcionando
2. **Migrar gradualmente** - No cambiar todo de golpe
3. **Mantener tipos** - Actualizar interfaces afectadas

### Prioridades actuales
1. **Modelos**: Completar `main/database/models/` (History, TaskLinks, TimeLog)
2. **Tests**: Agregar tests unitarios/integración
3. **Sync bidireccional**: Detectar entradas ya enviadas a TW al reimportar
4. **Festivos 2027+**: Agregar al schema SQL cuando corresponda

---

## Actualización del Stack Tecnológico

### ✅ Stack Completamente Actualizado (Dic 2025)

| Paquete | Versión Anterior | Versión Actual |
|---------|------------------|----------------|
| Vite | 2.8.6 | **7.2.6** |
| @vitejs/plugin-react | 1.2.0 | **5.1.1** |
| TanStack React Query | 4.x | **5.x** |
| Tailwind CSS | 3.0.23 | **3.4.18** |
| ESLint | 8.11.0 | **9.39.1** |
| Prettier | 2.6.0 | **3.7.4** |
| typescript-eslint | 5.16.0 | **8.48.1** |
| sqlite3 + sqlite | 5.x + 4.x | **better-sqlite3 11.x** |

### Cambios importantes en la migración

#### better-sqlite3 (Mar 2026)
- API síncrona envuelta en `DatabaseWrapper` async para no cambiar los 11 servicios
- Requiere **Node 22 LTS** — los prebuilts N-API no existen para Node 24
- Tras instalar, ejecutar `electron-builder install-app-deps` para recompilar contra el ABI de Electron
- pnpm necesita `node-linker=hoisted` durante el packaging (`build-local.ps1` y CI lo hacen automáticamente)

#### React Query v5
- Sintaxis de `useQuery` cambió a objeto: `useQuery({ queryKey, queryFn })`
- `isLoading` → `isPending` para mutaciones
- `invalidateQueries` usa objeto: `{ queryKey: ['tasks'] }`

#### ESLint 9 (Flat Config)
- Archivo de configuración: `eslint.config.js` (no `.eslintrc.json`)
- Usa `typescript-eslint` en lugar de `@typescript-eslint/*`
- Scripts simplificados: `eslint .` (sin `--ext`)

---

## Sistema de UI/UX (shadcn/ui)

### Componentes Instalados

Los siguientes componentes de shadcn/ui están disponibles en `components/ui/`:

| Componente | Uso |
|------------|-----|
| `Button` | Botones con variantes (default, destructive, outline, ghost) |
| `Card` | Contenedores con header, content, footer |
| `Combobox` | ⭐ Selector buscable custom (sin deps externas, nav teclado) |
| `Dialog` | Modales para formularios y confirmaciones |
| `AlertDialog` | Confirmación de acciones destructivas |
| `DropdownMenu` | Menús contextuales (selector de idioma) |
| `Input`, `Label` | Campos de formulario |
| `Select` | Selector con Radix UI (dark mode compatible) |
| `Table` | Estructura de tabla HTML estilizada |
| `Tabs` | Navegación por pestañas |
| `Tooltip` | Información emergente (muestra shortcuts) |
| `Badge` | Etiquetas de estado |
| `Skeleton` | Placeholders de carga |
| `Separator` | Líneas divisorias |
| `Sonner` | Notificaciones toast |

### Personalización

- **Tema**: Variables CSS en `index.css` (`:root` y `.dark`)
- **Colores**: Slate para neutros, primarios en HSL
- **Dark mode**: Toggle con `useDarkMode` hook, clase `dark` en `<html>`
- **Path alias**: `@/` apunta a `src/renderer/`

### Patrones de UX Implementados

```typescript
// Skeleton loader durante carga
{isPending ? <Skeleton className="h-8 w-full" /> : <Content />}

// Empty state cuando no hay datos
{data.length === 0 && <EmptyState message="No hay registros" />}

// Keyboard shortcuts con tooltips
<Tooltip>
  <TooltipTrigger asChild>
    <Button onClick={handleSave}>
      Guardar <kbd>Ctrl+S</kbd>
    </Button>
  </TooltipTrigger>
</Tooltip>

// Confirmación de eliminación
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="destructive">Eliminar</Button>
  </AlertDialogTrigger>
  <AlertDialogContent>...</AlertDialogContent>
</AlertDialog>
```

---

## Comandos de Desarrollo

```bash
pnpm install        # Instalar dependencias (requiere Node 22: fnm use 22)
pnpm dev            # Iniciar desarrollo (Vite + Electron)
pnpm build          # Compilar para producción
.\build-local.ps1  # Build local sin instalador para probar (no requiere admin)
```

### Notas sobre Node y módulos nativos
- **Usar siempre Node 22 LTS** (`fnm use 22.17.0`) — `better-sqlite3` tiene prebuilts para Node 22
- Node 24 no tiene prebuilts y sin VS Build Tools no puede compilar desde fuente
- Tras cambiar de Node version, reimplementar `node_modules` con `pnpm install`
- `electron-builder install-app-deps` reconstruye `better-sqlite3` contra los headers de Electron (ABI distinto al de Node)

---

## Notas Adicionales

- El proyecto usa **AppBar personalizada** (frame: false en BrowserWindow)
- Los tiempos se manejan con **Date** y **Flatpickr**, conversión a strings para BD
- El cálculo de hora fin (`endTime = startTime + hours`) está en `WorkTimeForm.tsx`
- Las entradas se persisten en **localStorage** mientras se editan (antes de guardar en BD)
- **HashRouter** es obligatorio en Electron — BrowserRouter no funciona con `file://` en producción
- **Paths en producción**: usar `app.getPath('userData')` para datos de usuario y `app.getAppPath()` para assets bundleados. `process.cwd()` NO es confiable en producción
- **WAL mode**: `better-sqlite3` usa `PRAGMA journal_mode=WAL` — genera `.sqlite-shm` y `.sqlite-wal` temporales (excluidos en `.gitignore`)
