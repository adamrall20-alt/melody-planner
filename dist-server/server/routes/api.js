import { Router } from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import multer from 'multer';
import { getDataDir, getDb, getMediaDir } from '../db/database.js';
import { activeWindowTracker } from '../tracker/activeWindow.js';
export const apiRouter = Router();
const storage = multer.diskStorage({
    destination: (req, _file, cb) => {
        const kind = req.body?.kind === 'voice' ? 'voice' : 'image';
        const dir = getMediaDir(kind);
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname || '') || (file.mimetype.includes('audio') ? '.webm' : '.png');
        const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
        cb(null, safeName);
    },
});
const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB max
});
function todayDateStr() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}
apiRouter.get('/health', (_req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
});
apiRouter.get('/network-info', (_req, res) => {
    const interfaces = os.networkInterfaces();
    const lanUrls = [];
    const port = Number(process.env.PORT || 4310);
    for (const ifaceList of Object.values(interfaces)) {
        if (!ifaceList)
            continue;
        for (const iface of ifaceList) {
            if (iface.family === 'IPv4' && !iface.internal) {
                lanUrls.push(`http://${iface.address}:${port}`);
            }
        }
    }
    res.json({
        port,
        lanUrls,
        trackerActive: activeWindowTracker.isRunning,
        platform: process.platform,
        dataDir: getDataDir(),
    });
});
// ─── Categories ───────────────────────────────────────────────────────────────
apiRouter.get('/categories', (_req, res) => {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM categories ORDER BY id ASC').all();
    res.json(rows);
});
apiRouter.post('/categories', (req, res) => {
    const { name, color = '#8b5cf6', icon = 'sparkles', is_productive = 1 } = req.body;
    if (!name?.trim())
        return res.status(400).json({ error: 'Name is required' });
    const db = getDb();
    const info = db
        .prepare('INSERT INTO categories (name, color, icon, is_productive) VALUES (?, ?, ?, ?)')
        .run(name.trim(), color, icon, is_productive ? 1 : 0);
    const created = db.prepare('SELECT * FROM categories WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(created);
});
// ─── Time Entries (Toggl-style Timers) ────────────────────────────────────────
apiRouter.get('/time-entries', (req, res) => {
    const date = req.query.date || todayDateStr();
    const db = getDb();
    const rows = db
        .prepare(`SELECT te.*, c.name as category_name, c.color as category_color
       FROM time_entries te
       LEFT JOIN categories c ON c.id = te.category_id
       WHERE date(te.started_at, 'localtime') = ? OR te.ended_at IS NULL
       ORDER BY te.started_at DESC`)
        .all(date);
    res.json(rows);
});
apiRouter.post('/time-entries/start', (req, res) => {
    const { title, category_id = null, notes = '' } = req.body;
    if (!title?.trim())
        return res.status(400).json({ error: 'Title is required' });
    const db = getDb();
    const now = new Date().toISOString();
    // Stop any currently running timer first
    db.prepare('UPDATE time_entries SET ended_at = ? WHERE ended_at IS NULL').run(now);
    const info = db
        .prepare('INSERT INTO time_entries (title, category_id, started_at, ended_at, notes) VALUES (?, ?, ?, NULL, ?)')
        .run(title.trim(), category_id, now, notes);
    const created = db
        .prepare(`SELECT te.*, c.name as category_name, c.color as category_color
       FROM time_entries te
       LEFT JOIN categories c ON c.id = te.category_id
       WHERE te.id = ?`)
        .get(info.lastInsertRowid);
    res.status(201).json(created);
});
apiRouter.post('/time-entries/:id/stop', (req, res) => {
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare('UPDATE time_entries SET ended_at = ? WHERE id = ? AND ended_at IS NULL').run(now, req.params.id);
    const updated = db
        .prepare(`SELECT te.*, c.name as category_name, c.color as category_color
       FROM time_entries te
       LEFT JOIN categories c ON c.id = te.category_id
       WHERE te.id = ?`)
        .get(req.params.id);
    res.json(updated);
});
apiRouter.delete('/time-entries/:id', (req, res) => {
    const db = getDb();
    db.prepare('DELETE FROM time_entries WHERE id = ?').run(req.params.id);
    res.status(204).end();
});
// ─── Automatic App Usage Tracking ─────────────────────────────────────────────
apiRouter.get('/app-usage', (req, res) => {
    const date = req.query.date || todayDateStr();
    const db = getDb();
    const summary = db
        .prepare(`SELECT
         a.app_name,
         SUM(a.duration_sec) as total_sec,
         MAX(a.category_id) as category_id,
         MAX(c.name) as category_name,
         MAX(c.color) as category_color
       FROM app_usage_logs a
       LEFT JOIN categories c ON c.id = a.category_id
       WHERE date(a.started_at, 'localtime') = ?
       GROUP BY a.app_name
       ORDER BY total_sec DESC`)
        .all(date);
    const recent = db
        .prepare(`SELECT a.*, c.name as category_name, c.color as category_color
       FROM app_usage_logs a
       LEFT JOIN categories c ON c.id = a.category_id
       WHERE date(a.started_at, 'localtime') = ?
       ORDER BY a.started_at DESC
       LIMIT 40`)
        .all(date);
    res.json({ summary, recent, trackerActive: activeWindowTracker.isRunning });
});
apiRouter.post('/app-usage/toggle', (req, res) => {
    const { enabled } = req.body;
    if (enabled)
        activeWindowTracker.start();
    else
        activeWindowTracker.stop();
    res.json({ trackerActive: activeWindowTracker.isRunning });
});
apiRouter.post('/app-usage/categorize', (req, res) => {
    const { app_name, category_id } = req.body;
    if (!app_name || !category_id) {
        return res.status(400).json({ error: 'app_name and category_id are required' });
    }
    const db = getDb();
    db.prepare(`INSERT INTO app_category_rules (app_pattern, category_id) VALUES (?, ?)
     ON CONFLICT(app_pattern) DO UPDATE SET category_id = excluded.category_id`).run(app_name, category_id);
    db.prepare('UPDATE app_usage_logs SET category_id = ? WHERE LOWER(app_name) = LOWER(?)').run(category_id, app_name);
    res.json({ ok: true });
});
// ─── History (Past Time Entries & App Usage) ──────────────────────────────────
apiRouter.get('/history', (req, res) => {
    const days = Math.min(90, Math.max(1, Number(req.query.days) || 14));
    const db = getDb();
    const manualByDay = db
        .prepare(`SELECT
         date(started_at, 'localtime') as day,
         SUM(
           CASE
             WHEN ended_at IS NOT NULL THEN CAST((julianday(ended_at) - julianday(started_at)) * 86400 AS INTEGER)
             ELSE CAST((julianday('now') - julianday(started_at)) * 86400 AS INTEGER)
           END
         ) as manual_sec,
         COUNT(*) as session_count
       FROM time_entries
       WHERE date(started_at, 'localtime') >= date('now', 'localtime', ?)
       GROUP BY day
       ORDER BY day DESC`)
        .all(`-${days - 1} days`);
    const appByDay = db
        .prepare(`SELECT
         date(started_at, 'localtime') as day,
         SUM(duration_sec) as app_sec,
         COUNT(DISTINCT app_name) as app_count
       FROM app_usage_logs
       WHERE date(started_at, 'localtime') >= date('now', 'localtime', ?)
       GROUP BY day
       ORDER BY day DESC`)
        .all(`-${days - 1} days`);
    const map = new Map();
    for (const row of manualByDay) {
        map.set(row.day, {
            day: row.day,
            manual_sec: Math.max(0, row.manual_sec || 0),
            session_count: row.session_count || 0,
            app_sec: 0,
            app_count: 0,
        });
    }
    for (const row of appByDay) {
        const existing = map.get(row.day) ?? {
            day: row.day,
            manual_sec: 0,
            session_count: 0,
            app_sec: 0,
            app_count: 0,
        };
        existing.app_sec = Math.max(0, row.app_sec || 0);
        existing.app_count = row.app_count || 0;
        map.set(row.day, existing);
    }
    const history = Array.from(map.values()).sort((a, b) => b.day.localeCompare(a.day));
    res.json(history);
});
// ─── All-Time Global Totals ───────────────────────────────────────────────────
apiRouter.get('/stats/totals', (_req, res) => {
    const db = getDb();
    const manualRow = db
        .prepare(`SELECT
         COALESCE(SUM(
           CASE
             WHEN ended_at IS NOT NULL THEN CAST((julianday(ended_at) - julianday(started_at)) * 86400 AS INTEGER)
             ELSE CAST((julianday('now') - julianday(started_at)) * 86400 AS INTEGER)
           END
         ), 0) as total_manual_sec,
         COUNT(*) as total_sessions
       FROM time_entries`)
        .get();
    const appRow = db
        .prepare('SELECT COALESCE(SUM(duration_sec), 0) as total_app_sec FROM app_usage_logs')
        .get();
    const byCategory = db
        .prepare(`SELECT
         te.category_id,
         COALESCE(c.name, 'Uncategorized') as category_name,
         COALESCE(c.color, '#a8a29e') as category_color,
         COALESCE(SUM(
           CASE
             WHEN te.ended_at IS NOT NULL THEN CAST((julianday(te.ended_at) - julianday(te.started_at)) * 86400 AS INTEGER)
             ELSE CAST((julianday('now') - julianday(te.started_at)) * 86400 AS INTEGER)
           END
         ), 0) as total_sec
       FROM time_entries te
       LEFT JOIN categories c ON c.id = te.category_id
       GROUP BY te.category_id
       ORDER BY total_sec DESC`)
        .all();
    const studyRow = byCategory.find((c) => c.category_name.toLowerCase() === 'study');
    res.json({
        total_manual_sec: Math.max(0, manualRow.total_manual_sec || 0),
        total_sessions: manualRow.total_sessions || 0,
        total_app_sec: Math.max(0, appRow.total_app_sec || 0),
        study_sec: Math.max(0, studyRow?.total_sec || 0),
        by_category: byCategory.map((c) => ({ ...c, total_sec: Math.max(0, c.total_sec || 0) })),
    });
});
// ─── Tasks ────────────────────────────────────────────────────────────────────
apiRouter.get('/tasks', (req, res) => {
    const { date, from, to } = req.query;
    const db = getDb();
    if (from && to) {
        const rows = db
            .prepare(`SELECT t.*, c.name as category_name, c.color as category_color
         FROM tasks t
         LEFT JOIN categories c ON c.id = t.category_id
         WHERE t.due_date BETWEEN ? AND ?
         ORDER BY t.due_date ASC, t.completed ASC, t.scheduled_start ASC, t.id DESC`)
            .all(from, to);
        return res.json(rows);
    }
    const targetDate = date || todayDateStr();
    const rows = db
        .prepare(`SELECT t.*, c.name as category_name, c.color as category_color
       FROM tasks t
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.due_date = ?
       ORDER BY t.completed ASC, t.scheduled_start ASC, t.id DESC`)
        .all(targetDate);
    res.json(rows);
});
apiRouter.post('/tasks', (req, res) => {
    const { title, notes = '', due_date = todayDateStr(), scheduled_start = null, scheduled_end = null, priority = 'medium', category_id = null, } = req.body;
    if (!title?.trim())
        return res.status(400).json({ error: 'Title is required' });
    const db = getDb();
    const info = db
        .prepare(`INSERT INTO tasks (title, notes, due_date, scheduled_start, scheduled_end, priority, category_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(title.trim(), notes, due_date, scheduled_start, scheduled_end, priority, category_id);
    const created = db
        .prepare(`SELECT t.*, c.name as category_name, c.color as category_color
       FROM tasks t
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.id = ?`)
        .get(info.lastInsertRowid);
    res.status(201).json(created);
});
apiRouter.patch('/tasks/:id', (req, res) => {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    if (!existing)
        return res.status(404).json({ error: 'Task not found' });
    const fields = [
        'title',
        'notes',
        'due_date',
        'scheduled_start',
        'scheduled_end',
        'completed',
        'priority',
        'category_id',
    ];
    const updates = [];
    const values = [];
    for (const field of fields) {
        if (req.body[field] !== undefined) {
            updates.push(`${field} = ?`);
            values.push(field === 'completed' ? (req.body[field] ? 1 : 0) : req.body[field]);
        }
    }
    if (updates.length > 0) {
        values.push(req.params.id);
        db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }
    const updated = db
        .prepare(`SELECT t.*, c.name as category_name, c.color as category_color
       FROM tasks t
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.id = ?`)
        .get(req.params.id);
    res.json(updated);
});
apiRouter.delete('/tasks/:id', (req, res) => {
    const db = getDb();
    db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
    res.status(204).end();
});
// ─── Routines ─────────────────────────────────────────────────────────────────
apiRouter.get('/routines', (req, res) => {
    const date = req.query.date || todayDateStr();
    const db = getDb();
    const rows = db
        .prepare(`SELECT r.*,
              CASE WHEN rc.routine_id IS NOT NULL THEN 1 ELSE 0 END as completed_today
       FROM routines r
       LEFT JOIN routine_completions rc
         ON rc.routine_id = r.id AND rc.completed_date = ?
       ORDER BY r.sort_order ASC, r.id ASC`)
        .all(date);
    res.json(rows.map((r) => ({ ...r, completed_today: Boolean(r.completed_today) })));
});
apiRouter.post('/routines', (req, res) => {
    const { title, time_of_day = 'anytime', target_minutes = 15 } = req.body;
    if (!title?.trim())
        return res.status(400).json({ error: 'Title is required' });
    const db = getDb();
    const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), 0) as m FROM routines').get().m;
    const info = db
        .prepare('INSERT INTO routines (title, time_of_day, target_minutes, sort_order) VALUES (?, ?, ?, ?)')
        .run(title.trim(), time_of_day, target_minutes, maxOrder + 1);
    const created = db.prepare('SELECT * FROM routines WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ ...created, completed_today: false });
});
apiRouter.post('/routines/:id/toggle', (req, res) => {
    const date = req.body.date || todayDateStr();
    const db = getDb();
    const exists = db
        .prepare('SELECT 1 FROM routine_completions WHERE routine_id = ? AND completed_date = ?')
        .get(req.params.id, date);
    if (exists) {
        db.prepare('DELETE FROM routine_completions WHERE routine_id = ? AND completed_date = ?').run(req.params.id, date);
        return res.json({ completed_today: false });
    }
    else {
        db.prepare('INSERT INTO routine_completions (routine_id, completed_date) VALUES (?, ?)').run(req.params.id, date);
        return res.json({ completed_today: true });
    }
});
apiRouter.delete('/routines/:id', (req, res) => {
    const db = getDb();
    db.prepare('DELETE FROM routines WHERE id = ?').run(req.params.id);
    res.status(204).end();
});
// ─── Journal & Reflections ────────────────────────────────────────────────────
apiRouter.get('/journal', (req, res) => {
    const date = req.query.date || todayDateStr();
    const db = getDb();
    const row = db.prepare('SELECT * FROM journal_entries WHERE entry_date = ?').get(date);
    if (!row) {
        return res.json({
            entry_date: date,
            title: '',
            content: '',
            reflection_learned: '',
            reflection_challenge: '',
            reflection_gratitude: '',
            mood_rating: 3,
        });
    }
    res.json(row);
});
apiRouter.get('/journal/recent', (req, res) => {
    const limit = Math.min(60, Math.max(1, Number(req.query.limit) || 20));
    const db = getDb();
    const rows = db
        .prepare('SELECT * FROM journal_entries ORDER BY entry_date DESC LIMIT ?')
        .all(limit);
    res.json(rows);
});
apiRouter.put('/journal/:date', (req, res) => {
    const date = req.params.date;
    const { title = '', content = '', reflection_learned = '', reflection_challenge = '', reflection_gratitude = '', mood_rating = 3, } = req.body;
    const db = getDb();
    db.prepare(`INSERT INTO journal_entries (
       entry_date, title, content, reflection_learned, reflection_challenge, reflection_gratitude, mood_rating, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(entry_date) DO UPDATE SET
       title = excluded.title,
       content = excluded.content,
       reflection_learned = excluded.reflection_learned,
       reflection_challenge = excluded.reflection_challenge,
       reflection_gratitude = excluded.reflection_gratitude,
       mood_rating = excluded.mood_rating,
       updated_at = datetime('now')`).run(date, title, content, reflection_learned, reflection_challenge, reflection_gratitude, Number(mood_rating) || 3);
    const saved = db.prepare('SELECT * FROM journal_entries WHERE entry_date = ?').get(date);
    res.json(saved);
});
// ─── Memory Bank ──────────────────────────────────────────────────────────────
apiRouter.get('/memories', (req, res) => {
    const tag = req.query.tag;
    const db = getDb();
    const baseQuery = `
    SELECT m.*,
           CASE
             WHEN mi.id IS NOT NULL THEN '/media/' || CASE WHEN mi.kind = 'voice' THEN 'voice' ELSE 'images' END || '/' || mi.filename
             ELSE NULL
           END as media_url
    FROM memories m
    LEFT JOIN media_items mi ON mi.id = m.media_id
  `;
    const rows = tag
        ? db
            .prepare(`${baseQuery} WHERE m.tag = ? ORDER BY m.memory_date DESC, m.id DESC`)
            .all(tag)
        : db.prepare(`${baseQuery} ORDER BY m.memory_date DESC, m.id DESC LIMIT 100`).all();
    res.json(rows);
});
apiRouter.post('/memories', (req, res) => {
    const { memory_date = todayDateStr(), title, description = '', tag = 'Fun', media_id = null, } = req.body;
    if (!title?.trim())
        return res.status(400).json({ error: 'Title is required' });
    const db = getDb();
    const info = db
        .prepare('INSERT INTO memories (memory_date, title, description, tag, media_id) VALUES (?, ?, ?, ?, ?)')
        .run(memory_date, title.trim(), description, tag, media_id);
    const created = db
        .prepare(`SELECT m.*,
              CASE
                WHEN mi.id IS NOT NULL THEN '/media/' || CASE WHEN mi.kind = 'voice' THEN 'voice' ELSE 'images' END || '/' || mi.filename
                ELSE NULL
              END as media_url
       FROM memories m
       LEFT JOIN media_items mi ON mi.id = m.media_id
       WHERE m.id = ?`)
        .get(info.lastInsertRowid);
    res.status(201).json(created);
});
apiRouter.delete('/memories/:id', (req, res) => {
    const db = getDb();
    db.prepare('DELETE FROM memories WHERE id = ?').run(req.params.id);
    res.status(204).end();
});
// ─── Media (Images & Voice Memos stored in Sync to Drive) ────────────────────
function attachMediaUrl(row) {
    const folder = row.kind === 'voice' ? 'voice' : 'images';
    return { ...row, url: `/media/${folder}/${row.filename}` };
}
apiRouter.get('/media', (req, res) => {
    const kind = req.query.kind;
    const db = getDb();
    const rows = kind
        ? db
            .prepare('SELECT * FROM media_items WHERE kind = ? ORDER BY entry_date DESC, id DESC LIMIT 120')
            .all(kind)
        : db
            .prepare('SELECT * FROM media_items ORDER BY entry_date DESC, id DESC LIMIT 120')
            .all();
    res.json(rows.map(attachMediaUrl));
});
apiRouter.post('/media/upload', upload.single('file'), (req, res) => {
    const file = req.file;
    if (!file)
        return res.status(400).json({ error: 'File is required' });
    const kind = req.body.kind === 'voice' ? 'voice' : 'image';
    const title = req.body.title?.trim() || file.originalname || (kind === 'voice' ? 'Voice Memo' : 'Photo');
    const caption = req.body.caption || '';
    const entryDate = req.body.entry_date || todayDateStr();
    const durationSec = Number(req.body.duration_sec) || 0;
    const db = getDb();
    const info = db
        .prepare(`INSERT INTO media_items (kind, title, caption, entry_date, filename, mime_type, size_bytes, duration_sec)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(kind, title, caption, entryDate, file.filename, file.mimetype, file.size, durationSec);
    const created = db
        .prepare('SELECT * FROM media_items WHERE id = ?')
        .get(info.lastInsertRowid);
    res.status(201).json(attachMediaUrl(created));
});
apiRouter.delete('/media/:id', (req, res) => {
    const db = getDb();
    const existing = db
        .prepare('SELECT * FROM media_items WHERE id = ?')
        .get(req.params.id);
    if (existing) {
        const filePath = path.join(getMediaDir(existing.kind), existing.filename);
        if (fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
            }
            catch {
                // ignore unlink errors
            }
        }
        db.prepare('DELETE FROM media_items WHERE id = ?').run(req.params.id);
    }
    res.status(204).end();
});
// ─── Settings & Sync Status (stored in Sync to Drive SQLite DB) ──────────────
apiRouter.get('/settings', (_req, res) => {
    const db = getDb();
    const rows = db.prepare('SELECT key, value FROM app_settings').all();
    const map = new Map(rows.map((r) => [r.key, r.value]));
    res.json({
        theme: map.get('theme') === 'dark' ? 'dark' : 'pastel',
        eye_tracking: map.get('eye_tracking') !== 'false',
        study_notes: map.get('study_notes') ?? '',
    });
});
apiRouter.patch('/settings', (req, res) => {
    const db = getDb();
    const upsert = db.prepare('INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
    if (req.body.theme === 'pastel' || req.body.theme === 'dark') {
        upsert.run('theme', req.body.theme);
    }
    if (typeof req.body.eye_tracking === 'boolean') {
        upsert.run('eye_tracking', String(req.body.eye_tracking));
    }
    if (typeof req.body.study_notes === 'string') {
        upsert.run('study_notes', req.body.study_notes);
    }
    const rows = db.prepare('SELECT key, value FROM app_settings').all();
    const map = new Map(rows.map((r) => [r.key, r.value]));
    res.json({
        theme: map.get('theme') === 'dark' ? 'dark' : 'pastel',
        eye_tracking: map.get('eye_tracking') !== 'false',
        study_notes: map.get('study_notes') ?? '',
    });
});
apiRouter.get('/sync-status', (_req, res) => {
    const db = getDb();
    const dataDir = getDataDir();
    const dbPath = path.join(dataDir, 'melody.db');
    const dbSizeKb = fs.existsSync(dbPath) ? Math.round(fs.statSync(dbPath).size / 1024) : 0;
    const count = (sql) => db.prepare(sql).get().c;
    res.json({
        dataDir,
        dbSizeKb,
        counts: {
            tasks: count('SELECT COUNT(*) as c FROM tasks'),
            routines: count('SELECT COUNT(*) as c FROM routines'),
            timeEntries: count('SELECT COUNT(*) as c FROM time_entries'),
            appLogs: count('SELECT COUNT(*) as c FROM app_usage_logs'),
            journals: count('SELECT COUNT(*) as c FROM journal_entries'),
            memories: count('SELECT COUNT(*) as c FROM memories'),
            images: count("SELECT COUNT(*) as c FROM media_items WHERE kind = 'image'"),
            voiceMemos: count("SELECT COUNT(*) as c FROM media_items WHERE kind = 'voice'"),
        },
    });
});
