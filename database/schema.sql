CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS type_tasks (
    type_id INTEGER PRIMARY KEY AUTOINCREMENT,
    type_name TEXT NOT NULL
);

-- Insertar valores por defecto solo si la tabla está vacía
INSERT INTO type_tasks (type_name)
SELECT 'Acompañamiento' WHERE NOT EXISTS (SELECT 1 FROM type_tasks)
UNION ALL
SELECT 'FORE' WHERE NOT EXISTS (SELECT 1 FROM type_tasks)
UNION ALL
SELECT 'RECA' WHERE NOT EXISTS (SELECT 1 FROM type_tasks)
UNION ALL
SELECT 'Procesos Internos' WHERE NOT EXISTS (SELECT 1 FROM type_tasks);

CREATE TABLE IF NOT EXISTS tasks (
    task_id INTEGER PRIMARY KEY AUTOINCREMENT,
    type_id INTEGER NOT NULL,
    task_name TEXT NOT NULL,
    task_link TEXT,
    description TEXT,
    FOREIGN KEY (type_id) REFERENCES type_tasks(type_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS time_entries (
    entry_id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    description TEXT,
    entry_date DATE NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    facturable BOOLEAN DEFAULT 0,
    send BOOLEAN DEFAULT 0,
    FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE
);
