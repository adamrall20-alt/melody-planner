import Database from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const SYNC_TO_DRIVE_ROOT = path.join(os.homedir(), 'Sync to Drive');
function findGoogleDriveMyDrive() {
    // macOS Google Drive for Desktop: ~/Library/CloudStorage/GoogleDrive-*/My Drive
    const cloudStorage = path.join(os.homedir(), 'Library', 'CloudStorage');
    if (fs.existsSync(cloudStorage)) {
        try {
            const entries = fs.readdirSync(cloudStorage);
            for (const entry of entries) {
                if (entry.startsWith('GoogleDrive-')) {
                    const myDrive = path.join(cloudStorage, entry, 'My Drive');
                    if (fs.existsSync(myDrive))
                        return myDrive;
                }
            }
        }
        catch {
            // ignore permission errors
        }
    }
    // Windows / alternative Google Drive paths
    const candidates = [
        path.join(os.homedir(), 'Google Drive', 'My Drive'),
        'G:\\My Drive',
    ];
    for (const candidate of candidates) {
        if (fs.existsSync(candidate))
            return candidate;
    }
    return null;
}
export function getDataDir() {
    if (process.env.MELODY_DATA_DIR) {
        return path.resolve(process.env.MELODY_DATA_DIR);
    }
    const myDrive = findGoogleDriveMyDrive();
    if (myDrive) {
        return path.join(myDrive, 'Melody Planner');
    }
    if (fs.existsSync(SYNC_TO_DRIVE_ROOT)) {
        return path.join(SYNC_TO_DRIVE_ROOT, 'Melody Planner');
    }
    return path.resolve(process.cwd(), 'data');
}
function copyDirRecursive(src, dest) {
    if (!fs.existsSync(src))
        return;
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDirRecursive(srcPath, destPath);
        }
        else if (!fs.existsSync(destPath)) {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}
export function getMediaDir(kind) {
    const base = path.join(getDataDir(), 'media');
    if (!kind)
        return base;
    return path.join(base, kind === 'image' ? 'images' : 'voice');
}
let dbInstance = null;
export function getDb() {
    if (dbInstance)
        return dbInstance;
    const dataDir = getDataDir();
    const dbPath = path.join(dataDir, 'melody.db');
    fs.mkdirSync(dataDir, { recursive: true });
    fs.mkdirSync(getMediaDir('image'), { recursive: true });
    fs.mkdirSync(getMediaDir('voice'), { recursive: true });
    // Migrate existing DB & media from ~/Sync to Drive/Melody Planner or ./data into Google Drive My Drive
    const migrationSources = [
        path.join(SYNC_TO_DRIVE_ROOT, 'Melody Planner'),
        path.resolve(process.cwd(), 'data'),
    ];
    if (!fs.existsSync(dbPath)) {
        for (const srcDir of migrationSources) {
            const srcDb = path.join(srcDir, 'melody.db');
            if (srcDir !== dataDir && fs.existsSync(srcDb)) {
                fs.copyFileSync(srcDb, dbPath);
                copyDirRecursive(path.join(srcDir, 'media'), path.join(dataDir, 'media'));
                console.log(`[Melody Planner] Migrated existing database & media from ${srcDir} to ${dataDir}`);
                break;
            }
        }
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
function runMigrations(db) {
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

    CREATE TABLE IF NOT EXISTS xp_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      xp INTEGER NOT NULL,
      label TEXT NOT NULL,
      earned_date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(source_type, source_id)
    );

    CREATE TABLE IF NOT EXISTS quest_claims (
      quest_key TEXT NOT NULL,
      claim_date TEXT NOT NULL,
      xp INTEGER NOT NULL,
      claimed_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (quest_key, claim_date)
    );

    CREATE TABLE IF NOT EXISTS study_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      folder TEXT NOT NULL DEFAULT 'General',
      content TEXT NOT NULL DEFAULT '',
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_time_entries_started ON time_entries(started_at);
    CREATE INDEX IF NOT EXISTS idx_app_usage_started ON app_usage_logs(started_at);
    CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
    CREATE INDEX IF NOT EXISTS idx_journal_date ON journal_entries(entry_date);
    CREATE INDEX IF NOT EXISTS idx_memories_date ON memories(memory_date);
    CREATE INDEX IF NOT EXISTS idx_media_kind_date ON media_items(kind, entry_date);
    CREATE INDEX IF NOT EXISTS idx_xp_events_date ON xp_events(earned_date);
    CREATE INDEX IF NOT EXISTS idx_study_notes_updated ON study_notes(updated_at);
  `);
}
function seedDefaults(db) {
    const catCount = db.prepare('SELECT COUNT(*) as c FROM categories').get().c;
    if (catCount === 0) {
        const insertCat = db.prepare('INSERT INTO categories (name, color, icon, is_productive) VALUES (?, ?, ?, ?)');
        const defaults = [
            ['Study', '#f59e0b', 'book-open', 1],
            ['Coding', '#38bdf8', 'code-2', 1],
            ['Creative', '#fb7185', 'palette', 1],
            ['Life & Admin', '#a8a29e', 'check-square', 1],
            ['Relax & Fun', '#34d399', 'gamepad-2', 0],
        ];
        for (const row of defaults)
            insertCat.run(...row);
    }
    const routineCount = db.prepare('SELECT COUNT(*) as c FROM routines').get().c;
    if (routineCount === 0) {
        const insertRoutine = db.prepare('INSERT INTO routines (title, time_of_day, target_minutes, sort_order) VALUES (?, ?, ?, ?)');
        const defaultRoutines = [
            ['Morning stretch & water', 'morning', 10, 1],
            ['Learn something new', 'afternoon', 30, 2],
            ['Practice core skills', 'afternoon', 45, 3],
            ['Evening reflection & memory log', 'evening', 15, 4],
        ];
        for (const row of defaultRoutines)
            insertRoutine.run(...row);
    }
    const noteCount = db.prepare('SELECT COUNT(*) as c FROM study_notes').get().c;
    if (noteCount === 0) {
        const legacyNotes = db
            .prepare("SELECT value FROM app_settings WHERE key = 'study_notes'")
            .get();
        const studyCat = db
            .prepare("SELECT id FROM categories WHERE LOWER(name) = 'study' LIMIT 1")
            .get();
        if (legacyNotes && legacyNotes.value.trim()) {
            db.prepare('INSERT INTO study_notes (title, folder, content, category_id) VALUES (?, ?, ?, ?)').run('Quick Study Notes', 'General', legacyNotes.value, studyCat?.id ?? null);
        }
        else {
            db.prepare('INSERT INTO study_notes (title, folder, content, category_id) VALUES (?, ?, ?, ?)').run('Study Workspace Guide', 'General', `# Study Workspace\n\nWelcome to your **Obsidian-style** markdown study notes!\n\n## Tips\n- Create folders by typing any folder name (e.g. \`Japanese\`, \`BA Practice\`, \`Coding\`)\n- Use **Edit / Split / Preview** above to write and read cleanly\n- Pair your notes with the **Focus Timer** and **Ambient Audio** mixer\n\n### Today's Study Goals\n- [ ] Review key concepts\n- [ ] Practice with active recall\n- [ ] Summarize takeaways in your own words\n`, studyCat?.id ?? null);
        }
    }
    // Backfill initial XP from existing completed activities on first M3 migration
    const xpCount = db.prepare('SELECT COUNT(*) as c FROM xp_events').get().c;
    if (xpCount === 0) {
        const insertXp = db.prepare('INSERT OR IGNORE INTO xp_events (source_type, source_id, xp, label, earned_date) VALUES (?, ?, ?, ?, ?)');
        const completedTasks = db
            .prepare('SELECT id, title, priority, due_date FROM tasks WHERE completed = 1')
            .all();
        for (const t of completedTasks) {
            insertXp.run('task', String(t.id), t.priority === 'high' ? 30 : 20, `Task: ${t.title}`, t.due_date);
        }
        const routineDone = db
            .prepare(`SELECT rc.routine_id, rc.completed_date, r.title
         FROM routine_completions rc
         JOIN routines r ON r.id = rc.routine_id`)
            .all();
        for (const r of routineDone) {
            insertXp.run('routine', `${r.routine_id}:${r.completed_date}`, 15, `Routine: ${r.title}`, r.completed_date);
        }
        const completedTimers = db
            .prepare(`SELECT te.id, te.title, date(te.started_at, 'localtime') as day,
                CAST((julianday(te.ended_at) - julianday(te.started_at)) * 86400 AS INTEGER) as dur_sec,
                COALESCE(c.is_productive, 1) as is_productive
         FROM time_entries te
         LEFT JOIN categories c ON c.id = te.category_id
         WHERE te.ended_at IS NOT NULL`)
            .all();
        for (const te of completedTimers) {
            if (te.is_productive && te.dur_sec >= 60) {
                const xp = Math.min(240, Math.max(5, Math.round((te.dur_sec / 60) * 2)));
                insertXp.run('timer', String(te.id), xp, `Focus: ${te.title}`, te.day);
            }
        }
        const journals = db
            .prepare('SELECT entry_date FROM journal_entries')
            .all();
        for (const j of journals) {
            insertXp.run('journal', j.entry_date, 25, 'Daily Journal', j.entry_date);
        }
    }
}
