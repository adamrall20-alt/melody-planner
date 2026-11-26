import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getDb } from '../db/database.js';

const execFileAsync = promisify(execFile);

interface ActiveWindowInfo {
  appName: string;
  windowTitle: string;
}

async function getMacActiveWindow(): Promise<ActiveWindowInfo | null> {
  const script = `
    tell application "System Events"
      set frontApp to first application process whose frontmost is true
      set appName to name of frontApp
      set winTitle to ""
      try
        set winTitle to name of front window of frontApp
      end try
      return appName & "|||" & winTitle
    end tell
  `;
  try {
    const { stdout } = await execFileAsync('osascript', ['-e', script], { timeout: 2500 });
    const [appName, windowTitle = ''] = stdout.trim().split('|||');
    if (!appName) return null;
    return { appName: appName.trim(), windowTitle: windowTitle.trim() };
  } catch {
    return null;
  }
}

async function getWindowsActiveWindow(): Promise<ActiveWindowInfo | null> {
  const psScript = `
    Add-Type @"
      using System;
      using System.Runtime.InteropServices;
      using System.Text;
      public class WinAPI {
        [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
        [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
        [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
      }
"@
    $hwnd = [WinAPI]::GetForegroundWindow()
    $sb = New-Object System.Text.StringBuilder 256
    [void][WinAPI]::GetWindowText($hwnd, $sb, 256)
    $pidOut = 0
    [void][WinAPI]::GetWindowThreadProcessId($hwnd, [ref]$pidOut)
    $proc = Get-Process -Id $pidOut -ErrorAction SilentlyContinue
    Write-Output "$($proc.ProcessName)|||$($sb.ToString())"
  `;
  try {
    const { stdout } = await execFileAsync(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-Command', psScript],
      { timeout: 3000 }
    );
    const [appName, windowTitle = ''] = stdout.trim().split('|||');
    if (!appName) return null;
    return { appName: appName.trim(), windowTitle: windowTitle.trim() };
  } catch {
    return null;
  }
}

export async function getActiveWindow(): Promise<ActiveWindowInfo | null> {
  if (process.platform === 'darwin') return getMacActiveWindow();
  if (process.platform === 'win32') return getWindowsActiveWindow();
  return null;
}

class ActiveWindowTracker {
  private timer: NodeJS.Timeout | null = null;
  private currentLogId: number | null = null;
  private currentApp: string | null = null;
  private currentTitle: string | null = null;
  private startedAtMs: number = 0;
  private lastTickMs: number = 0;
  private pollIntervalMs = 5000;
  public isRunning = false;

  start(): void {
    if (this.timer) return;
    this.isRunning = true;
    void this.tick();
    this.timer = setInterval(() => {
      void this.tick();
    }, this.pollIntervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    this.currentLogId = null;
    this.currentApp = null;
    this.currentTitle = null;
    this.lastTickMs = 0;
  }

  private resolveCategoryId(appName: string): number | null {
    const db = getDb();
    const rule = db
      .prepare('SELECT category_id FROM app_category_rules WHERE LOWER(app_pattern) = LOWER(?)')
      .get(appName) as { category_id: number } | undefined;
    return rule?.category_id ?? null;
  }

  private async tick(): Promise<void> {
    const info = await getActiveWindow();
    if (!info) return;

    const now = new Date();
    const nowMs = now.getTime();
    const nowIso = now.toISOString();
    const db = getDb();

    // Guard against laptop sleep/suspend gaps (>20s since last 5s poll)
    const isSleepGap = this.lastTickMs > 0 && nowMs - this.lastTickMs > 20_000;
    this.lastTickMs = nowMs;

    if (
      !isSleepGap &&
      this.currentLogId !== null &&
      this.currentApp === info.appName &&
      this.currentTitle === info.windowTitle
    ) {
      const durationSec = Math.max(1, Math.round((nowMs - this.startedAtMs) / 1000));
      db.prepare('UPDATE app_usage_logs SET ended_at = ?, duration_sec = ? WHERE id = ?').run(
        nowIso,
        durationSec,
        this.currentLogId
      );
      return;
    }

    const categoryId = this.resolveCategoryId(info.appName);
    const result = db
      .prepare(
        `INSERT INTO app_usage_logs (app_name, window_title, category_id, started_at, ended_at, duration_sec)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(info.appName, info.windowTitle, categoryId, nowIso, nowIso, 5);

    this.currentLogId = Number(result.lastInsertRowid);
    this.currentApp = info.appName;
    this.currentTitle = info.windowTitle;
    this.startedAtMs = nowMs;
  }
}

export const activeWindowTracker = new ActiveWindowTracker();
