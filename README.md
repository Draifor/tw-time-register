# TW Time Register

> **Aplicación de escritorio para gestionar y registrar tiempos de trabajo en TeamWork**

Una aplicación Electron que permite crear borradores de registros de tiempo de forma flexible e inteligente, con cálculos dinámicos de fechas y horas, para luego sincronizarlos con la API de TeamWork.

## 🎯 Objetivo del Proyecto

El objetivo principal es tener una herramienta personal para:

1. **Crear borradores de tiempo** - Registrar actividades conforme se van realizando, como un "borrador inteligente"
2. **Cálculos dinámicos** - Calcular automáticamente fechas, horas de inicio/fin, duración total, etc.
3. **Flexibilidad** - Poder modificar cualquier dato manualmente sin perder la funcionalidad automática
4. **Organización por tareas** - Gestionar proyectos y tareas predefinidas de TeamWork
5. **Reportes** - Ver cuánto tiempo se ha gastado por tarea, por día, etc.
6. **Sincronización** - Enviar los registros a TeamWork cuando estén listos

## 🏗️ Stack Tecnológico

Este proyecto fue diseñado para aprender tecnologías modernas y patrones de diseño escalables:

### Core

- **Electron** v30 - Framework para aplicaciones de escritorio
- **React** v18 - Biblioteca UI con Hooks
- **TypeScript** v5 - Tipado estático
- **Vite** v7 - Build tool y dev server ultrarrápido

### UI y Estilos

- **shadcn/ui** - Sistema de componentes moderno basado en Radix UI
- **Tailwind CSS** v3.4 - Framework de estilos utility-first
- **Radix UI** - Primitivos accesibles (Dialog, Select, Tabs, Tooltip, etc.)
- **Lucide React** - Iconos modernos
- **Sonner** - Notificaciones toast elegantes

### Gestión de Estado y Data

- **TanStack React Query** v5 - Manejo de estado del servidor y caché
- **TanStack React Table** v8 - Tablas avanzadas con filtrado, paginación, edición
- **React Hook Form** v7 - Manejo de formularios con validación

### Internacionalización

- **i18next** + **react-i18next** - Soporte multi-idioma (ES/EN)

### Base de Datos

- **SQLite3** - Base de datos local embebida
- **sqlite** - Driver async para SQLite

### Calidad de Código

- **ESLint** v9 - Linting con flat config
- **Prettier** v3 - Formateo de código
- **typescript-eslint** v8 - Reglas TypeScript para ESLint

### Otros

- **Axios** - Cliente HTTP para API de TeamWork
- **date-fns** - Manipulación de fechas
- **Flatpickr** - Selector de fechas/horas
- **React Router DOM** v6 - Navegación

## 📁 Estructura del Proyecto

```txt
tw-time-register/
├── database/
│   └── schema.sql              # Esquema de la base de datos SQLite
├── src/
│   ├── main/                   # Proceso principal de Electron
│   │   ├── index.ts            # Entrada principal, crea la ventana
│   │   ├── preload.ts          # Bridge seguro entre main y renderer
│   │   ├── database/
│   │   │   ├── database.ts     # Conexión y queries SQLite
│   │   │   └── models/         # (Modelos vacíos, pendientes)
│   │   ├── ipc/
│   │   │   ├── index.ts        # Registro de handlers IPC
│   │   │   ├── databaseIpc.ts  # Handlers para operaciones de BD
│   │   │   ├── windowIpc.ts    # Handlers para control de ventana
│   │   │   └── anotherIpc.ts   # Handler de prueba para mensajes
│   │   └── services/
│   │       ├── apiService.ts       # Cliente API de TeamWork
│   │       ├── credentialService.ts # Autenticación
│   │       ├── taskService.ts      # CRUD de tareas
│   │       └── typeTasksService.ts # CRUD de tipos de tareas
│   ├── renderer/               # Proceso de renderizado (React)
│   │   ├── App.tsx             # Componente raíz y rutas
│   │   ├── main.tsx            # Punto de entrada React
│   │   ├── components/
│   │   │   ├── AppBar.tsx          # Barra de título personalizada
│   │   │   ├── NavBar.tsx          # Navegación principal
│   │   │   ├── WorkTimeForm.tsx    # ⭐ Formulario principal de tiempos
│   │   │   ├── DataTable.tsx       # Tabla genérica con TanStack Table
│   │   │   ├── DynamicForm.tsx     # Formulario dinámico por columnas
│   │   │   ├── ImportTasksDialog.tsx # ⭐ Asistente importación tareas desde TW
│   │   │   ├── TasksTable.tsx      # Tabla de tareas
│   │   │   ├── TypeTasksTable.tsx  # Tabla de tipos de tarea
│   │   │   ├── TimeLogsTable.tsx   # Tabla de logs de tiempo
│   │   │   ├── TotalTimeDay.tsx    # Cálculo total diario
│   │   │   ├── DeleteButton.tsx    # Botón de eliminación con confirmación
│   │   │   └── ui/                 # Componentes shadcn/ui
│   │   │       ├── button.tsx
│   │   │       ├── card.tsx
│   │   │       ├── combobox.tsx    # ⭐ Selector con búsqueda (custom)
│   │   │       ├── dialog.tsx
│   │   │       ├── alert-dialog.tsx
│   │   │       ├── dropdown-menu.tsx
│   │   │       ├── input.tsx
│   │   │       ├── label.tsx
│   │   │       ├── select.tsx
│   │   │       ├── skeleton.tsx
│   │   │       ├── table.tsx
│   │   │       ├── tabs.tsx
│   │   │       ├── tooltip.tsx
│   │   │       └── sonner.tsx
│   │   ├── hooks/
│   │   │   ├── useTasks.tsx            # Hook para gestión de tareas
│   │   │   ├── useTimeLogs.tsx         # Hook para logs de tiempo
│   │   │   ├── useTypeTasks.tsx        # Hook para tipos de tarea
│   │   │   ├── useTable.tsx            # Hook para TanStack Table
│   │   │   ├── useDarkMode.ts          # Hook para modo oscuro
│   │   │   └── useKeyboardShortcuts.ts # Hook para atajos de teclado
│   │   ├── services/
│   │   │   ├── tasksService.ts     # Servicio de tareas (renderer)
│   │   │   ├── timesService.ts     # Servicio de tiempos (renderer)
│   │   │   └── typeTasksService.ts # Servicio de tipos (renderer)
│   │   ├── pages/
│   │   │   ├── HomePage.tsx        # Página principal con WorkTimeForm
│   │   │   └── TasksPage.tsx       # Página de gestión (Tabs: Tasks, Types, Logs)
│   │   ├── locales/                # Traducciones i18n
│   │   └── styles/                 # Estilos adicionales
│   └── types/                  # Tipos TypeScript compartidos
│       ├── tasks.ts            # Tipos y columnas de tareas
│       ├── typeTasks.ts        # Tipos y columnas de tipos de tarea
│       ├── dataTable.ts        # Tipos para DataTable genérica
│       ├── field.ts            # Tipos para campos de formulario
│       └── menu.ts             # Tipos para menús
├── dist-electron/              # Build del proceso principal
├── dist-vite/                  # Build del proceso renderer
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

## 🗃️ Modelo de Datos

### Esquema Actual (SQLite)

```sql
-- Tipos de tarea (categorías)
CREATE TABLE type_tasks (
    type_id INTEGER PRIMARY KEY AUTOINCREMENT,
    type_name TEXT NOT NULL
);
-- Valores por defecto: Acompañamiento, FORE, RECA, Procesos Internos

-- Tareas (proyectos/tareas de TeamWork)
CREATE TABLE tasks (
    task_id INTEGER PRIMARY KEY AUTOINCREMENT,
    type_id INTEGER NOT NULL,          -- FK a type_tasks
    task_name TEXT NOT NULL,
    task_link TEXT,                     -- Link de TW
    description TEXT
);

-- Entradas de tiempo (borradores)
CREATE TABLE time_entries (
    entry_id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,           -- FK a tasks
    description TEXT,
    entry_date DATE NOT NULL,
    entry_date DATE NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    facturable BOOLEAN DEFAULT 0,
    send BOOLEAN DEFAULT 0              -- Si ya se envió a TW
);

-- Usuarios/credenciales (para API de TW)
CREATE TABLE users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL              -- ⚠️ Almacenado en texto plano
);
```

## ✅ Funcionalidades Implementadas

### Funcionando

- [x] Estructura base Electron + React + Vite
- [x] Base de datos SQLite con esquema básico
- [x] **Sistema de UI moderno con shadcn/ui**
  - [x] Componentes: Button, Card, Dialog, Select, Table, Tabs, Tooltip, etc.
  - [x] Tema claro/oscuro completo
  - [x] Notificaciones toast con Sonner
- [x] Formulario de registro de tiempos (`WorkTimeForm`)
  - [x] Campos dinámicos con `useFieldArray`
  - [x] Cálculo automático de hora fin basado en inicio + duración
  - [x] Persistencia en localStorage mientras se edita
  - [x] Guardado en base de datos
  - [x] **Selector de tarea con Combobox buscable** (navegación teclado, checkmark en selección)
  - [x] Textarea auto-expandible para descripciones
  - [x] Layout responsivo de una sola fila
  - [x] Fix: nuevas entradas no disparan el cálculo de post-almuerzo
- [x] **DataTable mejorada**
  - [x] Infinite scroll (carga más filas al hacer scroll)
  - [x] Skeleton loaders mientras carga
  - [x] Empty states atractivos
  - [x] Búsqueda global
- [x] **Keyboard shortcuts**
  - [x] `Ctrl+N` - Nueva entrada
  - [x] `Ctrl+S` - Guardar/Registrar
  - [x] `Esc` - Eliminar última entrada
- [x] **TimeLogsTable** - Visualización avanzada de tiempos registrados
  - [x] Edición inline (fecha, descripción, hora inicio/fin, facturable)
  - [x] Sincronización individual y masiva con TeamWork API
  - [x] Confirmación de eliminación con AlertDialog
  - [x] **Búsqueda general** por tarea o descripción
  - [x] **Filtros** por tarea (Combobox buscable), fecha desde, fecha hasta
  - [x] Contador de resultados filtrados
  - [x] Empty state específico para filtros sin resultados
- [x] **Importación de tareas desde TeamWork** (`ImportTasksDialog`)
  - [x] Asistente 3 pasos: Configurar → Previsualizar → Listo
  - [x] Templates predefinidos: RECA/FORE (5 subtareas) y OTHER (3 subtareas)
  - [x] Matching por número de ítem (ej. `^2.`, `^3.`, etc.)
  - [x] Panel diagnóstico cuando no hay coincidencias
  - [x] Soporte multi-campo de la API TW (`content`, `name`, `title`)
- [x] CRUD de tareas (`TasksTable`) - **ordenado por tipo y nombre**
- [x] CRUD de tipos de tarea (`TypeTasksTable`) - **ordenado alfabéticamente**
- [x] Sistema de navegación con React Router
- [x] AppBar personalizada con iconos Lucide
- [x] Soporte i18n (EN/ES) con dropdown de selección
- [x] Modo oscuro completo
- [x] Confirmación de eliminación con AlertDialog

### Pendiente / Parcial

- [ ] Sistema de autenticación completo (Settings page parcial)
- [ ] Encriptar credenciales en BD
- [ ] Vista de resumen/reportes por tarea y por día
- [ ] Sincronización bidireccional con TeamWork
- [ ] Tests unitarios/integración

## 🐛 Problemas Conocidos

### Errores de Linting

Hay algunos warnings de linting pendientes:

- Uso de `any` en algunos handlers IPC y formularios
- Variables `event` no usadas en handlers IPC (usar `_event`)

### Seguridad

- Credenciales almacenadas en texto plano (pendiente encriptar)

## 🚀 Desarrollo

### Requisitos

- Node.js v20+ (recomendado v24+)
- pnpm (recomendado) o npm

### Instalación

```bash
pnpm install
```

### Desarrollo

```bash
# Inicia Vite dev server + Electron
pnpm dev
```

### Build

```bash
# Genera dist-vite y dist-electron
pnpm build

# Empaqueta para distribución
pnpm dist:win   # Windows
pnpm dist:mac   # macOS
pnpm dist:linux # Linux
```

## 📋 Plan de Desarrollo

### ✅ Fase 1: Limpieza (COMPLETADA - Dic 2025)

- [x] Eliminar código de ejemplo (Users, Comments, faker, EditableTable, makeData)
- [x] Unificar componentes duplicados (DataTable)
- [x] Remover dependencias innecesarias (@faker-js/faker)
- [x] Actualizar metadatos del package.json

### ✅ Fase 2: Actualización del Stack (COMPLETADA - Dic 2025)

| Paquete | Antes | Después |
| --------- | ------- | --------- |
| Vite | 2.8.6 | **7.2.6** ✅ |
| @vitejs/plugin-react | 1.2.0 | **5.1.1** ✅ |
| TanStack Query | 4.x | **5.x** ✅ |
| Tailwind CSS | 3.0.23 | **3.4.18** ✅ |
| ESLint | 8.11.0 | **9.39.1** ✅ |
| Prettier | 2.6.0 | **3.7.4** ✅ |
| typescript-eslint | 5.16.0 | **8.48.1** ✅ |

### ✅ Fase 3: Mejora de UI/UX (COMPLETADA - Dic 2025)

> 🎨 Sistema de diseño moderno implementado con shadcn/ui

**Componentes shadcn/ui instalados:**

- Button, Card, Dialog, AlertDialog
- Input, Label, Textarea
- Select (Radix), Dropdown Menu
- Table, Tabs, Separator
- Tooltip, Badge, Skeleton
- Sonner (toasts)

**Mejoras implementadas:**

- [x] Tema claro/oscuro completo con variables CSS
- [x] Formulario de tiempos rediseñado (layout de una fila)
- [x] Textarea auto-expandible
- [x] Infinite scroll en tablas (reemplaza paginación)
- [x] Skeleton loaders durante carga
- [x] Empty states atractivos
- [x] Confirmación de eliminación con AlertDialog
- [x] Keyboard shortcuts (Ctrl+N, Ctrl+S, Esc)
- [x] Tooltips con indicadores de shortcuts
- [x] Notificaciones toast con Sonner
- [x] Selector de idioma con dropdown
- [x] Eliminada dependencia de Material Tailwind
- [x] Eliminada dependencia de react-select

### ✅ Fase 4: Funcionalidad Core — Parte 1 (COMPLETADA - Feb 2026)

- [x] Combobox buscable para selección de tarea (navegación teclado, sin dependencias nuevas)
- [x] Fix: nuevas entradas en `WorkTimeForm` no disparan ajuste de post-almuerzo
- [x] Importación de tareas desde TeamWork (`ImportTasksDialog`) con templates RECA/FORE y OTHER
- [x] Soporte de múltiples formatos de respuesta de API TW (`tasks` / `todo-items`, `content` / `name` / `title`)
- [x] Ordenamiento de tipos de tarea (alfabético) y tareas (por tipo, luego nombre)
- [x] Edición inline completa en `TimeLogsTable` (fecha, descripción, tiempos, facturable)
- [x] Sincronización masiva con TeamWork desde `TimeLogsTable`
- [x] Búsqueda general + filtros por fecha y tarea en `TimeLogsTable`

### 🔄 Fase 5: Funcionalidad Core — Parte 2 (EN PROGRESO)

1. [ ] Corregir errores de linting restantes (variables `any`, `_event`)
2. [ ] Tipar correctamente todas las interfaces (TimeEntry, WorkTimeEntry)
3. [ ] Vista de resumen/reportes: total de horas por tarea y por día
4. [ ] Mejorar cálculos encadenados en `WorkTimeForm` (ej. hora de inicio del siguiente = hora fin del anterior)
5. [ ] Remover `console.log` en producción

### Fase 6: Integración TeamWork Completa (PENDIENTE)

1. [ ] Configuración segura de credenciales (encriptar en BD)
2. [ ] Flujo completo de autenticación en Settings
3. [ ] Importación de proyectos/tareas completa desde TW (no solo subtareas)
4. [ ] Sincronización bidireccional (detectar entradas ya enviadas)

### Fase 7: Pulido Final (PENDIENTE)

1. [ ] Completar i18n (revisar strings sin traducir)
2. [ ] Tests unitarios/integración
3. [ ] Documentación de API interna
4. [ ] Optimización de rendimiento

---

## 📝 Notas para Desarrollo con IA

Este proyecto está configurado para desarrollo asistido por IA. Ver `.github/copilot-instructions.md` para instrucciones detalladas sobre el contexto y convenciones del proyecto.

## 📄 Licencia

MIT
