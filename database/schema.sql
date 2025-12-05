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

-- Work schedule settings table
CREATE TABLE IF NOT EXISTS work_settings (
    setting_id INTEGER PRIMARY KEY AUTOINCREMENT,
    setting_key TEXT NOT NULL UNIQUE,
    setting_value TEXT NOT NULL,
    description TEXT
);

-- Default work settings (only insert if table is empty)
INSERT INTO work_settings (setting_key, setting_value, description)
SELECT 'default_start_time', '09:00', 'Default work start time (HH:MM)'
WHERE NOT EXISTS (SELECT 1 FROM work_settings WHERE setting_key = 'default_start_time');

INSERT INTO work_settings (setting_key, setting_value, description)
SELECT 'max_hours_monday', '9', 'Maximum work hours on Monday'
WHERE NOT EXISTS (SELECT 1 FROM work_settings WHERE setting_key = 'max_hours_monday');

INSERT INTO work_settings (setting_key, setting_value, description)
SELECT 'max_hours_tuesday', '9', 'Maximum work hours on Tuesday'
WHERE NOT EXISTS (SELECT 1 FROM work_settings WHERE setting_key = 'max_hours_tuesday');

INSERT INTO work_settings (setting_key, setting_value, description)
SELECT 'max_hours_wednesday', '9', 'Maximum work hours on Wednesday'
WHERE NOT EXISTS (SELECT 1 FROM work_settings WHERE setting_key = 'max_hours_wednesday');

INSERT INTO work_settings (setting_key, setting_value, description)
SELECT 'max_hours_thursday', '9', 'Maximum work hours on Thursday'
WHERE NOT EXISTS (SELECT 1 FROM work_settings WHERE setting_key = 'max_hours_thursday');

INSERT INTO work_settings (setting_key, setting_value, description)
SELECT 'max_hours_friday', '8', 'Maximum work hours on Friday'
WHERE NOT EXISTS (SELECT 1 FROM work_settings WHERE setting_key = 'max_hours_friday');

INSERT INTO work_settings (setting_key, setting_value, description)
SELECT 'work_days', '1,2,3,4,5', 'Work days (1=Monday, 7=Sunday)'
WHERE NOT EXISTS (SELECT 1 FROM work_settings WHERE setting_key = 'work_days');

-- Holidays table (Colombian holidays + custom)
CREATE TABLE IF NOT EXISTS holidays (
    holiday_id INTEGER PRIMARY KEY AUTOINCREMENT,
    holiday_date DATE NOT NULL UNIQUE,
    description TEXT,
    is_custom BOOLEAN DEFAULT 0
);

-- Colombian holidays for 2025 (only insert if not exists)
INSERT OR IGNORE INTO holidays (holiday_date, description, is_custom) VALUES
('2025-01-01', 'Año Nuevo', 0),
('2025-01-06', 'Día de los Reyes Magos', 0),
('2025-03-24', 'Día de San José', 0),
('2025-04-17', 'Jueves Santo', 0),
('2025-04-18', 'Viernes Santo', 0),
('2025-05-01', 'Día del Trabajo', 0),
('2025-06-02', 'Día de la Ascensión', 0),
('2025-06-23', 'Corpus Christi', 0),
('2025-06-30', 'Sagrado Corazón', 0),
('2025-07-20', 'Día de la Independencia', 0),
('2025-08-07', 'Batalla de Boyacá', 0),
('2025-08-18', 'Asunción de la Virgen', 0),
('2025-10-13', 'Día de la Raza', 0),
('2025-11-03', 'Todos los Santos', 0),
('2025-11-17', 'Independencia de Cartagena', 0),
('2025-12-08', 'Día de la Inmaculada Concepción', 0),
('2025-12-25', 'Navidad', 0);
