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
- **SQLite3 + sqlite** - Base de datos local para persistencia
- **Axios** - Cliente HTTP para API de TeamWork

### Proceso Renderer (React)
- **React v18** con hooks
- **TypeScript v5** - Todo el código debe estar tipado
- **Vite v2.8** - Bundler y dev server
- **TanStack React Query v4** - Cache y estado del servidor
- **TanStack React Table v8** - Tablas con filtrado, paginación, edición
- **React Hook Form v7** - Formularios con validación
- **Tailwind CSS v3** - Estilos utility-first
- **React Router DOM v6** - Navegación SPA
- **i18next** - Internacionalización (ES/EN)
- **date-fns** - Manipulación de fechas
- **Flatpickr** - Selector de tiempo

---

## Arquitectura y Estructura

```
src/
├── main/                   # Proceso Electron (Node.js)
│   ├── index.ts            # Punto de entrada, crea BrowserWindow
│   ├── preload.ts          # Expone API segura al renderer via contextBridge
│   ├── database/
│   │   └── database.ts     # Conexión SQLite y queries básicas
│   ├── ipc/
│   │   └── databaseIpc.ts  # Handlers IPC para BD (ipcMain.handle)
│   └── services/
│       ├── taskService.ts  # CRUD de tareas
│       └── apiService.ts   # Cliente API TeamWork
├── renderer/               # Proceso React (Browser)
│   ├── App.tsx             # Rutas y providers
│   ├── components/
│   │   ├── WorkTimeForm.tsx    # ⭐ Formulario principal de tiempos
│   │   ├── DataTable.tsx       # Tabla genérica con TanStack
│   │   └── ui/                 # Componentes UI base
│   ├── hooks/
│   │   ├── useTasks.tsx        # React Query + mutaciones para tareas
│   │   └── useTable.tsx        # Hook para configurar TanStack Table
│   ├── services/
│   │   └── tasksService.ts     # Llama a window.Main.* (IPC)
│   └── pages/
│       └── Tasks.tsx           # Página de gestión de tareas
└── types/                  # Tipos compartidos entre main y renderer
    ├── tasks.ts
    └── dataTable.ts
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
// Patrón estándar
const { data, isLoading, error } = useQuery(['tasks'], fetchTasks);

const { mutate } = useMutation({
  mutationFn: addTask,
  onSettled: () => queryClient.invalidateQueries(['tasks'])
});
```

### TanStack Table
- **useTable hook**: Centraliza configuración de tabla
- **Columnas definidas por entidad**: En `types/*.ts` junto con el tipo
- **Edición inline**: Usar `meta.updateData` para actualizar estado local

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

### ✅ Limpieza Completada (Dic 2024)
- Eliminados archivos de ejemplo: EditableTable, makeData, Users, Comments
- Eliminados servicios de ejemplo: usersService, commentsServices
- Unificado DataTable (eliminado DataTableNew)
- Removido @faker-js/faker
- Actualizados metadatos del package.json

### ⚠️ Pendiente: Aclarar roles
- `components/Tasks.tsx` - Componente de tabla de tareas
- `pages/Tasks.tsx` - Página que agrupa TypeTasks, Tasks y TimeLogs

### ⚠️ Problemas de Tipos
- Muchos `any` en IPC handlers y forms
- Variables `event` no usadas en handlers IPC (usar `_event`)

### ⚠️ Mejoras Pendientes
- Encriptar credenciales en BD
- Remover `console.log` en producción
- Completar modelos en `main/database/models/`

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
1. **Limpieza**: Eliminar código de ejemplo
2. **Actualización Stack**: Vite 6, TanStack Query v5, etc.
3. **UI/UX**: Implementar sistema de diseño moderno (shadcn/ui recomendado)
4. **Estabilidad**: Corregir errores TypeScript
5. **Core**: Completar flujo de registro de tiempos

---

## Actualización del Stack Tecnológico

### Dependencias Desactualizadas

| Paquete | Actual | Target | Riesgo |
|---------|--------|--------|--------|
| Vite | 2.8.6 | 6.x | ALTO |
| @vitejs/plugin-react | 1.2.0 | 4.x | ALTO |
| Electron | 30.0.7 | 33.x | MEDIO |
| TanStack Query | 4.x | 5.x | BAJO |
| Tailwind CSS | 3.0.23 | 3.4.x | MUY BAJO |
| ESLint | 8.11.0 | 9.x | MEDIO |

### Orden de Actualización Recomendado

1. **Primero (seguro)**: Tailwind, date-fns, lucide-react, axios
2. **Segundo (cuidado)**: React Query v5, React Hook Form
3. **Tercero (arriesgado)**: Vite 6 + vite-plugin-electron
4. **Último**: ESLint 9 (requiere migrar a flat config)

### Al actualizar dependencias
- Hacer commits pequeños por grupo de dependencias
- Probar después de cada actualización
- Revisar CHANGELOG de breaking changes
- Usar `pnpm update --interactive` para control granular

---

## Mejora de UI/UX

### Biblioteca Recomendada: shadcn/ui

**Razones**:
- Componentes copiables (no dependencia)
- Basado en Radix UI (accesible)
- Estilizado con Tailwind (ya lo usamos)
- Muy popular y documentado
- Fácil de personalizar

### Instalación
```bash
pnpm dlx shadcn@latest init
```

### Componentes a agregar primero
- Button, Input, Label (reemplazar los actuales en ui/)
- Select (reemplazar react-select)
- Table (para DataTable)
- Card (para contenedores)
- Dialog/AlertDialog (para modales)
- Toast (para notificaciones, reemplazar alert())

### Diseño sugerido
- **Colores**: Slate para neutros, Blue/Indigo para primarios
- **Modo oscuro**: Usar las variables CSS de shadcn
- **Tipografía**: Inter (popular) o sistema
- **Espaciado**: Consistente con scale de Tailwind

---

## Comandos de Desarrollo

```bash
pnpm install        # Instalar dependencias
pnpm dev            # Iniciar desarrollo (Vite + Electron)
pnpm build          # Compilar para producción
pnpm dist:win       # Empaquetar para Windows
```

---

## Notas Adicionales

- El proyecto usa **AppBar personalizada** (frame: false en BrowserWindow)
- Los tiempos se manejan con **Date** y **Flatpickr**, conversión a strings para BD
- El cálculo de hora fin (`endTime = startTime + hours`) está en `WorkTimeForm.tsx`
- Las entradas se persisten en **localStorage** mientras se editan (antes de guardar en BD)
