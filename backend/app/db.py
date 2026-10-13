import sqlite3
from contextlib import contextmanager
from .config import DATABASE_PATH
from .seed import seed_rules, seed_real_rules, seed_extra_rules, seed_electrical_rules

SCHEMA = '''
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS targets (
 id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL DEFAULT 1 REFERENCES users(id),
 target_type TEXT NOT NULL, name TEXT NOT NULL, age INTEGER, memo TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS spaces (
 id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL DEFAULT 1 REFERENCES users(id),
 name TEXT NOT NULL, space_type TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS scans (
 id INTEGER PRIMARY KEY, space_id INTEGER REFERENCES spaces(id), target_id INTEGER REFERENCES targets(id),
 target_type TEXT NOT NULL, space_type TEXT NOT NULL, image_url TEXT, safety_score INTEGER,
 detection_mode TEXT NOT NULL, scenario TEXT NOT NULL, result_json TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS hazards (
 id INTEGER PRIMARY KEY, scan_id INTEGER NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
 hazard_type TEXT NOT NULL, object_name TEXT NOT NULL, risk_level TEXT NOT NULL,
 confidence REAL NOT NULL, bbox_x REAL, bbox_y REAL, bbox_width REAL, bbox_height REAL, description TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS recommendations (
 id INTEGER PRIMARY KEY, hazard_id INTEGER NOT NULL REFERENCES hazards(id) ON DELETE CASCADE,
 accident_type TEXT NOT NULL, recommendation_text TEXT NOT NULL,
 resolved INTEGER NOT NULL DEFAULT 0, resolved_at TEXT
);
CREATE TABLE IF NOT EXISTS risk_rules (
 id INTEGER PRIMARY KEY, target_type TEXT NOT NULL, space_type TEXT NOT NULL, object_type TEXT NOT NULL,
 condition TEXT NOT NULL, risk_type TEXT NOT NULL, risk_level TEXT NOT NULL,
 reason TEXT NOT NULL, recommendation TEXT NOT NULL, supplement TEXT NOT NULL,
 UNIQUE(target_type, space_type, object_type, condition)
);
CREATE TABLE IF NOT EXISTS scan_checks (
 scan_id INTEGER NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
 object_type TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('risk','clear','unknown')),
 note TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 PRIMARY KEY(scan_id, object_type)
);
CREATE TABLE IF NOT EXISTS guide_tasks (
 scan_id INTEGER NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
 task_key TEXT NOT NULL, completed INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(scan_id,task_key)
);
CREATE TABLE IF NOT EXISTS care_sessions (
 id INTEGER PRIMARY KEY, name TEXT NOT NULL, owner_hash TEXT NOT NULL UNIQUE, guardian_hash TEXT NOT NULL UNIQUE,
 idle_hours INTEGER NOT NULL, start_hour INTEGER NOT NULL, end_hour INTEGER NOT NULL,
 location_consent INTEGER NOT NULL DEFAULT 0, enabled INTEGER NOT NULL DEFAULT 1,
 last_seen REAL NOT NULL, last_activity REAL NOT NULL, last_state TEXT NOT NULL,
 latitude REAL, longitude REAL, location_at REAL
);
CREATE TABLE IF NOT EXISTS care_alerts (
 id INTEGER PRIMARY KEY, session_id INTEGER NOT NULL REFERENCES care_sessions(id) ON DELETE CASCADE,
 kind TEXT NOT NULL, message TEXT NOT NULL, created_at REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_care_alerts ON care_alerts(session_id,id);
CREATE INDEX IF NOT EXISTS idx_rules_match ON risk_rules(target_type, space_type, object_type);
CREATE INDEX IF NOT EXISTS idx_hazards_scan ON hazards(scan_id);
CREATE TABLE IF NOT EXISTS interior_plans (
 scan_id INTEGER PRIMARY KEY REFERENCES scans(id) ON DELETE CASCADE,
 plan_json TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
'''

@contextmanager
def connect():
    connection = sqlite3.connect(DATABASE_PATH, timeout=15)
    connection.row_factory = sqlite3.Row
    connection.execute('PRAGMA foreign_keys = ON')
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()

def migrate_nullable_score(connection):
    columns = connection.execute('PRAGMA table_info(scans)').fetchall()
    if not any(row['name'] == 'safety_score' and row['notnull'] for row in columns):
        return
    # Keep existing scans, IDs and dependent hazards while allowing 'not assessed'.
    connection.execute('PRAGMA foreign_keys = OFF')
    try:
        connection.execute('BEGIN IMMEDIATE')
        create = SCHEMA[SCHEMA.index('CREATE TABLE IF NOT EXISTS scans ('):SCHEMA.index('CREATE TABLE IF NOT EXISTS hazards (')].strip().rstrip(';')
        connection.execute(create.replace('IF NOT EXISTS scans', 'scans_migration'))
        connection.execute('INSERT INTO scans_migration SELECT * FROM scans')
        connection.execute('DROP TABLE scans')
        connection.execute('ALTER TABLE scans_migration RENAME TO scans')
        if connection.execute('PRAGMA foreign_key_check').fetchall():
            raise sqlite3.IntegrityError('Migration failed foreign-key validation')
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.execute('PRAGMA foreign_keys = ON')


def init_db():
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with connect() as connection:
        connection.executescript(SCHEMA)
        migrate_nullable_score(connection)
        connection.execute("INSERT OR IGNORE INTO users(id, email, name) VALUES (1, 'demo@localhost', '데모 사용자')")
        seed_rules(connection)
        seed_real_rules(connection)
        seed_extra_rules(connection)
        seed_electrical_rules(connection)
        from .safety_catalog import seed_safety_rules
        seed_safety_rules(connection)
