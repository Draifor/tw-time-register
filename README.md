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

- **Tailwind CSS** v3.4 - Framework de estilos utility-first
- **Material Tailwind** - Componentes pre-diseñados
- **Lucide React** - Iconos

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
│   │   │   ├── Tasks.tsx           # Componente de tareas
│   │   │   ├── TypeTasks.tsx       # Componente de tipos de tarea
│   │   │   ├── TimeLogs.tsx        # Componente de logs de tiempo
│   │   │   ├── TotalTimeDay.tsx    # Cálculo total diario
│   │   │   └── ui/                 # Componentes UI reutilizables
│   │   ├── hooks/
│   │   │   ├── useTasks.tsx        # Hook para gestión de tareas (React Query v5)
│   │   │   ├── useTimeLogs.tsx     # Hook para logs de tiempo (React Query v5)
│   │   │   ├── useTable.tsx        # Hook para TanStack Table
│   │   │   └── useDarkMode.ts      # Hook para modo oscuro
│   │   ├── services/
│   │   │   ├── tasksService.ts     # Servicio de tareas (renderer)
│   │   │   ├── timesService.ts     # Servicio de tiempos (renderer)
│   │   │   └── typeTasksService.ts # Servicio de tipos (renderer)
│   │   ├── pages/
│   │   │   └── Tasks.tsx           # Página de gestión de tareas
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

### Errores de Linting

Después de la migración a ESLint 9, hay varios errores de linting pendientes de corregir:

- Uso de `any` en algunos archivos (se debe tipar correctamente)
- Variables `event` no usadas en handlers IPC (usar `_event`)
- Algunos imports no utilizados

### Arquitectura

- Duplicación: `Tasks.tsx` en components/ y pages/ (aclarar roles)
- Modelos en `main/database/models/` vacíos (placeholders)

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
|---------|-------|---------|
| Vite | 2.8.6 | **7.2.6** ✅ |
| @vitejs/plugin-react | 1.2.0 | **5.1.1** ✅ |
| TanStack Query | 4.x | **5.x** ✅ |
| Tailwind CSS | 3.0.23 | **3.4.18** ✅ |
| ESLint | 8.11.0 | **9.39.1** ✅ |
| Prettier | 2.6.0 | **3.7.4** ✅ |
| typescript-eslint | 5.16.0 | **8.48.1** ✅ |

### 🔄 Fase 3: Mejora de UI/UX (PENDIENTE)

> 🎨 Transformar la interfaz para que sea atractiva y profesional

1. **Implementar shadcn/ui** - Componentes modernos basados en Radix UI
2. **Sistema de diseño** - Paleta de colores, tipografía, espaciados
3. **Áreas a mejorar**:
   - AppBar y navegación
   - Formulario de tiempos (WorkTimeForm)
   - Tablas de datos
   - Modales y confirmaciones
   - Estados de carga y error
   - Tema oscuro completo

### Fase 4: Estabilización de Código (PENDIENTE)

1. Corregir errores de linting (ESLint 9)
2. Tipar correctamente todas las interfaces
3. Crear types para TimeEntry, WorkTimeEntry
4. Mejorar manejo de errores

### Fase 5: Funcionalidad Core (PENDIENTE)

1. Completar flujo de registro de tiempos
2. Mejorar cálculos dinámicos (fechas encadenadas, totales)
3. Implementar edición/eliminación de tiempos
4. Vista de resumen por día/tarea

### Fase 6: Integración TeamWork (PENDIENTE)

1. Configuración segura de credenciales
2. Sincronización con API de TeamWork
3. Importación de proyectos/tareas desde TW

### Fase 7: Pulido Final (PENDIENTE)

1. Completar i18n
2. Tests unitarios
3. Documentación
4. Optimización de rendimiento

---

## 📝 Notas para Desarrollo con IA

Este proyecto está configurado para desarrollo asistido por IA. Ver `.github/copilot-instructions.md` para instrucciones detalladas sobre el contexto y convenciones del proyecto.

## 📄 Licencia

MIT
