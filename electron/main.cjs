const { app, BrowserWindow, nativeImage } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const isDev = process.env.NODE_ENV === 'development';
const APP_URL = process.env.MELODY_APP_URL || (isDev ? 'http://localhost:5173' : 'http://localhost:4310');
const ICON_PATH = path.resolve(__dirname, '..', 'public', 'mac-icon.png');

app.setName('Melody Planner');

function getAppIcon() {
  if (fs.existsSync(ICON_PATH)) {
    const img = nativeImage.createFromPath(ICON_PATH);
    if (!img.isEmpty()) return img;
  }
  const fallback = path.resolve(__dirname, '..', 'public', 'melody-logo.png');
  if (fs.existsSync(fallback)) {
    const img = nativeImage.createFromPath(fallback);
    if (!img.isEmpty()) return img;
  }
  return undefined;
}

function createWindow() {
  const icon = getAppIcon();
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    title: 'Melody Planner',
    backgroundColor: '#d6f0fc',
    icon,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  // Prevent navigation or popups to untrusted external URLs inside Electron
  const allowedOrigin = new URL(APP_URL).origin;
  win.webContents.on('will-navigate', (event, url) => {
    try {
      if (new URL(url).origin !== allowedOrigin) {
        event.preventDefault();
      }
    } catch {
      event.preventDefault();
    }
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  if (process.platform === 'darwin' && icon && app.dock) {
    app.dock.setIcon(icon);
  }

  win.loadURL(APP_URL);
}

app.whenReady().then(() => {
  const icon = getAppIcon();
  if (process.platform === 'darwin' && icon && app.dock) {
    app.dock.setIcon(icon);
  }
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
