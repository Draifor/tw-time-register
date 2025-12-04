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
- **Vite** v2.8 - Build tool y dev server

### UI y Estilos

- **Tailwind CSS** v3 - Framework de estilos utility-first
- **Material Tailwind** - Componentes pre-diseñados
- **Lucide React** - Iconos

### Gestión de Estado y Data

- **TanStack React Query** v4 - Manejo de estado del servidor y caché
- **TanStack React Table** v8 - Tablas avanzadas con filtrado, paginación, edición
- **React Hook Form** v7 - Manejo de formularios con validación

### Internacionalización

- **i18next** + **react-i18next** - Soporte multi-idioma (ES/EN)

### Base de Datos

- **SQLite3** - Base de datos local embebida
- **sqlite** - Driver async para SQLite

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
│   │   │   ├── DataTable.tsx       # Tabla genérica con formulario
│   │   │   ├── DataTableNew.tsx    # Tabla genérica simplificada
│   │   │   ├── DynamicForm.tsx     # Formulario dinámico por columnas
│   │   │   ├── Tasks.tsx           # Componente de tareas
│   │   │   ├── TypeTasks.tsx       # Componente de tipos de tarea
│   │   │   ├── TimeLogs.tsx        # Componente de logs de tiempo
│   │   │   ├── TotalTimeDay.tsx    # Cálculo total diario
│   │   │   └── ui/                 # Componentes UI reutilizables
│   │   ├── hooks/
│   │   │   ├── useTasks.tsx        # Hook para gestión de tareas
│   │   │   ├── useTimeLogs.tsx     # Hook para logs de tiempo
│   │   │   ├── useTable.tsx        # Hook para TanStack Table
│   │   │   └── useDarkMode.ts      # Hook para modo oscuro
│   │   ├── services/
│   │   │   ├── tasksService.ts     # Servicio de tareas (renderer)
│   │   │   ├── timesService.ts     # Servicio de tiempos (renderer)
│   │   │   └── typeTasksService.ts # Servicio de tipos (renderer)
│   │   ├── pages/
│   │   │   ├── Tasks.tsx           # Página de gestión de tareas
│   │   │   ├── EditableTable.tsx   # 🔧 Ejemplo de tabla editable
│   │   │   └── makeData.ts         # 🔧 Generador de datos fake
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
- [x] Formulario de registro de tiempos (`WorkTimeForm`)
  - [x] Campos dinámicos con `useFieldArray`
  - [x] Cálculo automático de hora fin basado en inicio + duración
  - [x] Persistencia en localStorage mientras se edita
  - [x] Guardado en base de datos
  - [x] Selector de tarea con datos de BD
- [x] Visualización de tiempos registrados (`TimeLogs`)
- [x] CRUD de tareas (`Tasks`)
- [x] CRUD de tipos de tarea (`TypeTasks`)
- [x] Sistema de navegación con React Router
- [x] AppBar personalizada (sin frame nativo)
- [x] Soporte básico i18n (EN/ES)
- [x] Modo oscuro (parcial)
- [x] Tabla genérica reutilizable con TanStack Table

### Pendiente / Parcial

- [ ] Envío de tiempos a API de TeamWork (estructura existe pero sin credenciales)
- [ ] Cálculo de total por día (componente existe, funcionalidad parcial)
- [ ] Sistema de autenticación completo
- [ ] Visualización de tiempos por tarea/día
- [ ] Edición inline de tiempos ya registrados
- [ ] Sincronización bidireccional con TeamWork
- [ ] Filtros avanzados en tablas
- [ ] Tests unitarios/integración

## 🐛 Problemas Conocidos

### Código de Prueba/Ejemplos

Archivos que son ejemplos o pruebas y no forman parte del flujo principal:

- `src/renderer/pages/EditableTable.tsx` - Ejemplo de tabla editable con faker
- `src/renderer/pages/makeData.ts` - Generador de datos falsos con faker
- `src/renderer/hooks/Users.tsx` - Ejemplo con API externa (jsonplaceholder)
- `src/renderer/hooks/Comments.tsx` - Ejemplo con API externa
- `src/renderer/services/usersService.ts` - Servicio de ejemplo
- `src/renderer/services/commentsServices.ts` - Servicio de ejemplo

### Errores de TypeScript/ESLint

- Uso excesivo de `any` en varios archivos
- Variables `event` no usadas en handlers IPC
- `console.log` y `alert` en código de producción
- Algunos tipos incompletos en componentes

### Arquitectura

- Duplicación: `DataTable.tsx` y `DataTableNew.tsx` (similares)
- Duplicación: `Tasks.tsx` en components/ y pages/
- Modelos en `main/database/models/` vacíos (placeholders)
- Mezcla de responsabilidades en algunos hooks

### Seguridad

- Credenciales almacenadas en texto plano
- Exposición directa de `ipcRenderer` al window

## 🚀 Desarrollo

### Requisitos

- Node.js v18+
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

### Fase 1: Limpieza (Prioridad: ALTA)

1. Eliminar código de ejemplo (Users, Comments, faker, etc.)
2. Unificar componentes duplicados (DataTable, Tasks)
3. Remover dependencias innecesarias del package.json

### Fase 2: Actualización del Stack (Prioridad: ALTA)

> ⚠️ Esta fase es arriesgada pero necesaria para aprendizaje. Hacer backup antes.

#### Dependencias Desactualizadas vs Actuales

| Paquete | Actual | Última | Notas |
|---------|--------|--------|-------|
| Vite | 2.8.6 | 6.x | Breaking changes significativos |
| @vitejs/plugin-react | 1.2.0 | 4.x | Actualizar junto con Vite |
| Electron | 30.0.7 | 33.x | Actualizar con cuidado |
| TanStack Query | 4.x | 5.x | API changes menores |
| Tailwind CSS | 3.0.23 | 3.4.x | Compatible, actualización segura |
| ESLint | 8.11.0 | 9.x | Nueva config format (flat config) |
| TypeScript | 5.8.3 | ✅ | Ya está actualizado |

#### Pasos de Actualización

1. **Grupo 1 - Seguro**: Tailwind, Autoprefixer, PostCSS, Lucide, date-fns
2. **Grupo 2 - Moderado**: React Query v5, React Hook Form, React Router
3. **Grupo 3 - Cuidado**: Vite 6 + plugins de Electron
4. **Grupo 4 - Después**: ESLint 9 (nuevo formato de config)

### Fase 3: Mejora de UI/UX (Prioridad: MEDIA-ALTA)

> 🎨 Transformar la interfaz para que sea atractiva y profesional

1. **Definir sistema de diseño**
   - Paleta de colores consistente
   - Tipografía y espaciados
   - Componentes base estilizados

2. **Opciones de UI Library** (elegir una):
   - **shadcn/ui** - Componentes copiables, muy personalizable, tendencia actual
   - **Radix UI + Tailwind** - Accesible, sin estilos (base de shadcn)
   - **Headless UI** - Por los creadores de Tailwind
   - Mantener Material Tailwind (ya instalado, pero menos moderno)

3. **Áreas a mejorar**:
   - AppBar y navegación
   - Formulario de tiempos (WorkTimeForm)
   - Tablas de datos
   - Modales y confirmaciones
   - Estados de carga y error
   - Tema oscuro completo

### Fase 4: Estabilización de Código (Prioridad: MEDIA)

1. Corregir errores de TypeScript/ESLint
2. Tipar correctamente todas las interfaces
3. Crear types para TimeEntry, WorkTimeEntry
4. Mejorar manejo de errores

### Fase 5: Funcionalidad Core (Prioridad: MEDIA)

1. Completar flujo de registro de tiempos
2. Mejorar cálculos dinámicos (fechas encadenadas, totales)
3. Implementar edición/eliminación de tiempos
4. Vista de resumen por día/tarea

### Fase 6: Integración TeamWork (Prioridad: BAJA)

1. Configuración segura de credenciales
2. Sincronización con API de TeamWork
3. Importación de proyectos/tareas desde TW

### Fase 7: Pulido Final (Prioridad: BAJA)

1. Completar i18n
2. Tests unitarios
3. Documentación
4. Optimización de rendimiento

---

## 📝 Notas para Desarrollo con IA

Este proyecto está configurado para desarrollo asistido por IA. Ver `.github/copilot-instructions.md` para instrucciones detalladas sobre el contexto y convenciones del proyecto.

## 📄 Licencia

MIT
