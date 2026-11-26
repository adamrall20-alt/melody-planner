import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { getDb, getMediaDir } from './db/database.js';
import { apiRouter } from './routes/api.js';
import { activeWindowTracker } from './tracker/activeWindow.js';

const PORT = Number(process.env.PORT || 4310);
const HOST = '0.0.0.0';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Initialize SQLite database & seed defaults
getDb();

// Serve uploaded images & voice memos from Sync to Drive / data media folder
app.use('/media', express.static(getMediaDir()));

// REST API
app.use('/api', apiRouter);

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

app.listen(PORT, HOST, () => {
  console.log(`[Melody Planner] Server listening on http://localhost:${PORT} (LAN enabled on 0.0.0.0:${PORT})`);
});
