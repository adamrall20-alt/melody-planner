import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { getDb, getMediaDir } from './db/database.js';
import { apiRouter } from './routes/api.js';
import { activeWindowTracker } from './tracker/activeWindow.js';
import { enforceAllowedOrigin, getAllowedOrigins, getOrCreateAccessToken, LAN_ENABLED, PORT, requireAuth, SERVER_HOST, } from './security.js';
const app = express();
app.disable('x-powered-by');
// Strict CORS: only allow localhost and (when LAN mode is enabled) this machine's LAN origins
app.use(cors({
    origin: (origin, callback) => {
        if (!origin)
            return callback(null, true);
        if (getAllowedOrigins().has(origin))
            return callback(null, true);
        return callback(null, false);
    },
    credentials: true,
}));
// Basic security headers on all responses
app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'same-origin');
    next();
});
app.use(express.json({ limit: '10mb' }));
// Initialize SQLite database, defaults, and access token
getDb();
getOrCreateAccessToken();
// Serve uploaded images & voice memos (protected by auth + strict CSP so uploaded files can never run scripts)
app.use('/media', enforceAllowedOrigin, requireAuth, (_req, res, next) => {
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'none'; script-src 'none'");
    next();
}, express.static(getMediaDir()));
// REST API (protected by origin check + auth for non-localhost devices)
app.use('/api', enforceAllowedOrigin, requireAuth, apiRouter);
// Serve built frontend in production (so LAN Wi-Fi devices can open http://<ip>:4310 directly)
const distDir = path.resolve(process.cwd(), 'dist');
if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
    });
}
// Start automatic active-window tracking
activeWindowTracker.start();
app.listen(PORT, SERVER_HOST, () => {
    if (LAN_ENABLED) {
        console.log(`[Melody Planner] Server listening on http://localhost:${PORT} (Phone/LAN mode ENABLED on 0.0.0.0:${PORT} — token auth required for remote devices)`);
    }
    else {
        console.log(`[Melody Planner] Server listening on http://127.0.0.1:${PORT} (Local-only mode — safe for public/school Wi-Fi. Run with MELODY_LAN=1 for phone access)`);
    }
});
