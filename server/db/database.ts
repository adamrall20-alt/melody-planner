import Database from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SYNC_TO_DRIVE_ROOT = path.join(os.homedir(), 'Sync to Drive');

export function getDataDir(): string {
  if (process.env.MELODY_DATA_DIR) {
    return path.resolve(process.env.MELODY_DATA_DIR);
  }
  if (fs.existsSync(SYNC_TO_DRIVE_ROOT)) {
    return path.join(SYNC_TO_DRIVE_ROOT, 'Melody Planner');
  }
  return path.resolve(process.cwd(), 'data');
}

export function getMediaDir(kind?: 'image' | 'voice'): string {
  const base = path.join(getDataDir(), 'media');
  if (!kind) return base;
  return path.join(base, kind === 'image' ? 'images' : 'voice');
}

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (dbInstance) return dbInstance;

  const dataDir = getDataDir();
  const dbPath = path.join(dataDir, 'melody.db');

  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(getMediaDir('image'), { recursive: true });
  fs.mkdirSync(getMediaDir('voice'), { recursive: true });

  // Migrate any existing local ./data/melody.db into Sync to Drive on first run
  const legacyDb = path.resolve(process.cwd(), 'data', 'melody.db');
  if (!fs.existsSync(dbPath) && fs.existsSync(legacyDb) && legacyDb !== dbPath) {
    fs.copyFileSync(legacyDb, dbPath);
    console.log(`[Melody Planner] Migrated existing database to ${dbPath}`);
  }

  const db = new Database(dbPath);
  // Single-file journal mode is safest for Google Drive / cloud-synced folders
  db.pragma('journal_mode = DELETE');
  db.pragma('foreign_keys = ON');

  runMigrations(db);
  seedDefaults(db);

  console.log(`[Melody Planner] Using database at ${dbPath}`);
  dbInstance = db;
  return db;
}

function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT '#f59e0b',
      icon TEXT NOT NULL DEFAULT 'sparkles',
      is_productive INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS time_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      notes TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS app_usage_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_name TEXT NOT NULL,
      window_title TEXT NOT NULL DEFAULT '',
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT NOT NULL,
      duration_sec INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS app_category_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_pattern TEXT NOT NULL UNIQUE,
      category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      due_date TEXT NOT NULL,
      scheduled_start TEXT,
      scheduled_end TEXT,
      completed INTEGER NOT NULL DEFAULT 0,
      priority TEXT NOT NULL DEFAULT 'medium',
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS routines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      time_of_day TEXT NOT NULL DEFAULT 'anytime',
      target_minutes INTEGER NOT NULL DEFAULT 15,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS routine_completions (
      routine_id INTEGER NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
      completed_date TEXT NOT NULL,
      PRIMARY KEY (routine_id, completed_date)
    );

    CREATE TABLE IF NOT EXISTS media_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL CHECK(kind IN ('image', 'voice')),
      title TEXT NOT NULL DEFAULT '',
      caption TEXT NOT NULL DEFAULT '',
      entry_date TEXT NOT NULL,
      filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL DEFAULT 0,
      duration_sec INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS journal_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_date TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      reflection_learned TEXT NOT NULL DEFAULT '',
      reflection_challenge TEXT NOT NULL DEFAULT '',
      reflection_gratitude TEXT NOT NULL DEFAULT '',
      mood_rating INTEGER NOT NULL DEFAULT 3,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      memory_date TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      tag TEXT NOT NULL DEFAULT 'Fun',
      media_id INTEGER REFERENCES media_items(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_time_entries_started ON time_entries(started_at);
    CREATE INDEX IF NOT EXISTS idx_app_usage_started ON app_usage_logs(started_at);
    CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
    CREATE INDEX IF NOT EXISTS idx_journal_date ON journal_entries(entry_date);
    CREATE INDEX IF NOT EXISTS idx_memories_date ON memories(memory_date);
    CREATE INDEX IF NOT EXISTS idx_media_kind_date ON media_items(kind, entry_date);
  `);
}

function seedDefaults(db: Database.Database): void {
  const catCount = (db.prepare('SELECT COUNT(*) as c FROM categories').get() as { c: number }).c;
  if (catCount === 0) {
    const insertCat = db.prepare(
      'INSERT INTO categories (name, color, icon, is_productive) VALUES (?, ?, ?, ?)'
    );
    const defaults: [string, string, string, number][] = [
      ['Study', '#f59e0b', 'book-open', 1],
      ['Coding', '#38bdf8', 'code-2', 1],
      ['Creative', '#fb7185', 'palette', 1],
      ['Life & Admin', '#a8a29e', 'check-square', 1],
      ['Relax & Fun', '#34d399', 'gamepad-2', 0],
    ];
    for (const row of defaults) insertCat.run(...row);
  }

  const routineCount = (db.prepare('SELECT COUNT(*) as c FROM routines').get() as { c: number }).c;
  if (routineCount === 0) {
    const insertRoutine = db.prepare(
      'INSERT INTO routines (title, time_of_day, target_minutes, sort_order) VALUES (?, ?, ?, ?)'
    );
    const defaultRoutines: [string, string, number, number][] = [
      ['Morning stretch & water', 'morning', 10, 1],
      ['Learn something new', 'afternoon', 30, 2],
      ['Practice core skills', 'afternoon', 45, 3],
      ['Evening reflection & memory log', 'evening', 15, 4],
    ];
    for (const row of defaultRoutines) insertRoutine.run(...row);
  }
}
