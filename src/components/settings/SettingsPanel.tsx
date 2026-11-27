import { useEffect, useState } from 'react';
import {
  Cloud,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Moon,
  Sun,
  Wifi,
  RefreshCw,
  ShieldCheck,
  Tag,
  Plus,
  Smartphone,
  Copy,
  Check,
} from 'lucide-react';
import type { AppSettings, Category, NetworkInfo, SyncStatus } from '@shared/types';
import { api } from '@/lib/api';

interface SettingsPanelProps {
  settings: AppSettings;
  categories: Category[];
  networkInfo: NetworkInfo | null;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onOpenCategoryManager: () => void;
  onNetworkInfoChanged?: () => void;
  onLockDevice?: () => void;
}

export function SettingsPanel({
  settings,
  categories,
  networkInfo,
  onUpdateSettings,
  onOpenCategoryManager,
  onNetworkInfoChanged,
  onLockDevice,
}: SettingsPanelProps) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedPairUrl, setCopiedPairUrl] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [rotatingToken, setRotatingToken] = useState(false);
  const [testPingMsg, setTestPingMsg] = useState<string | null>(null);
  const [backupMsg, setBackupMsg] = useState<string | null>(null);
  const [backingUp, setBackingUp] = useState(false);
  const [gcalUrl, setGcalUrl] = useState(settings.gcal_ics_url ?? '');
  const [gcalSaved, setGcalSaved] = useState(false);

  useEffect(() => {
    setGcalUrl(settings.gcal_ics_url ?? '');
  }, [settings.gcal_ics_url]);

  const handleBackupNow = async () => {
    setBackingUp(true);
    try {
      const res = await api.createBackupSnapshot();
      setBackupMsg(
        `Saved ${res.backupFile} + exported ${res.exportedJournals} journals & ${res.exportedNotes} study notes to Drive!`
      );
      setTimeout(() => setBackupMsg(null), 5000);
    } finally {
      setBackingUp(false);
    }
  };

  const handleSaveGcal = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings({ gcal_ics_url: gcalUrl.trim() });
    setGcalSaved(true);
    setTimeout(() => setGcalSaved(false), 2000);
  };

  const primaryLanUrl = networkInfo?.lanUrls[0] ?? 'http://<your-mac-ip>:4310';
  const accessToken = networkInfo?.accessToken ?? '';
  const pairingUrl = accessToken
    ? `${primaryLanUrl}/?pair=${encodeURIComponent(accessToken)}`
    : primaryLanUrl;
  const mobileWebhookUrl = accessToken
    ? `${primaryLanUrl}/api/app-usage/mobile-event?token=${encodeURIComponent(accessToken)}`
    : `${primaryLanUrl}/api/app-usage/mobile-event`;

  const copyText = async (text: string, onDone: (v: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text);
      onDone(true);
      setTimeout(() => onDone(false), 1800);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleRotateToken = async () => {
    setRotatingToken(true);
    try {
      await api.rotateAccessToken();
      onNetworkInfoChanged?.();
    } finally {
      setRotatingToken(false);
    }
  };

  const handleTestMobilePing = async () => {
    try {
      const res = await fetch('/api/app-usage/mobile-event', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_name: 'Anki', duration_sec: 60, device: 'iPhone' }),
      });
      if (res.ok) {
        setTestPingMsg('Logged "Anki (iPhone)" (1m) — check Time & Apps!');
        setTimeout(() => setTestPingMsg(null), 4000);
      }
    } catch {
      setTestPingMsg('Could not reach server.');
    }
  };

  const loadSync = async () => {
    setRefreshing(true);
    try {
      const data = await api.getSyncStatus();
      setSyncStatus(data);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadSync();
  }, []);

  return (
    <div className="space-y-4">
      {/* Custom Activity Categories */}
      <section className="cozy-card cozy-card-pink rounded-3xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[var(--pastel-pink)] text-pink-700 dark:text-pink-300">
              <Tag className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-[var(--text-main)]">
                Activity Categories
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Customize what you track across tasks, timers, and study sessions (e.g. Japanese).
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenCategoryManager}
            className="pastel-btn inline-flex items-center gap-1.5 rounded-2xl px-4 py-2 text-xs font-bold"
          >
            <Plus className="h-3.5 w-3.5" />
            Manage Categories
          </button>
        </div>

        <div className="mt-3.5 flex flex-wrap gap-2">
          {categories.map((cat) => (
            <span
              key={cat.id}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--border-card)] bg-[var(--bg-card)] px-3 py-1 text-xs font-bold text-[var(--text-main)]"
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: cat.color }}
              />
              {cat.name}
            </span>
          ))}
        </div>
      </section>

      {/* Appearance / Theme */}
      <section className="cozy-card cozy-card-sky rounded-3xl p-5">
        <h2 className="text-base font-extrabold text-[var(--text-main)]">Appearance</h2>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">
          Switch between Playful Pastel and Cozy Dark anytime for sore eyes.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onUpdateSettings({ theme: 'pastel' })}
            className={`flex items-center gap-3 rounded-2xl border-2 p-3.5 text-left transition ${
              settings.theme === 'pastel'
                ? 'border-[var(--accent)] bg-[var(--pastel-sky)]'
                : 'border-[var(--border-card)] bg-[var(--bg-card)]/70'
            }`}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-amber-500 shadow-sm">
              <Sun className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-[var(--text-main)]">Playful Pastel</p>
              <p className="text-[11px] text-[var(--text-muted)]">Colorful mint, sky & pink</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onUpdateSettings({ theme: 'dark' })}
            className={`flex items-center gap-3 rounded-2xl border-2 p-3.5 text-left transition ${
              settings.theme === 'dark'
                ? 'border-[var(--accent)] bg-[var(--pastel-sky)]'
                : 'border-[var(--border-card)] bg-[var(--bg-card)]/70'
            }`}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-sky-300 shadow-sm">
              <Moon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-[var(--text-main)]">Cozy Dark</p>
              <p className="text-[11px] text-[var(--text-muted)]">Gentle on tired eyes</p>
            </div>
          </button>
        </div>
      </section>

      {/* Companion Settings */}
      <section className="cozy-card cozy-card-mint rounded-3xl p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--pastel-mint)] text-emerald-700 dark:text-emerald-300">
              <Eye className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-[var(--text-main)]">
                Melody Cursor Tracking
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                Melody&apos;s eyes and head gently follow your cursor.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onUpdateSettings({ eye_tracking: !settings.eye_tracking })}
            className={`relative h-7 w-12 rounded-full transition ${
              settings.eye_tracking ? 'bg-[var(--accent)]' : 'bg-slate-400/40'
            }`}
          >
            <span
              className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                settings.eye_tracking ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </section>

      {/* Google Drive Sync Status */}
      <section className="cozy-card cozy-card-butter rounded-3xl p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[var(--pastel-butter)] text-amber-700 dark:text-amber-300">
              <Cloud className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-[var(--text-main)]">
                Google Drive Sync Folder
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                Everything (timers, study notes, quests, journal, memories, images & voice memos) is
                stored here.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={backingUp}
              onClick={() => void handleBackupNow()}
              className="pastel-btn rounded-xl px-3 py-1.5 text-xs font-bold disabled:opacity-60"
            >
              {backingUp ? 'Backing up...' : 'Backup & Export .md'}
            </button>
            <button
              type="button"
              onClick={() => void loadSync()}
              className="rounded-xl bg-[var(--bg-card)] p-2 text-[var(--text-muted)] hover:text-[var(--text-main)]"
              title="Refresh sync stats"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {backupMsg && (
          <p className="mt-3 rounded-2xl bg-[var(--pastel-mint)] px-3.5 py-2 text-xs font-bold text-emerald-800 dark:text-emerald-200">
            {backupMsg}
          </p>
        )}

        {syncStatus && (
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl bg-[var(--bg-card)]/85 px-3.5 py-2.5 font-mono text-xs text-[var(--text-main)] break-all">
              {syncStatus.dataDir}
              <span className="ml-2 text-[var(--text-muted)]">({syncStatus.dbSizeKb} KB DB)</span>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: 'Timers & Study', val: syncStatus.counts.timeEntries, bg: 'var(--pastel-sky)' },
                { label: 'Study Notes', val: syncStatus.counts.studyNotes ?? 0, bg: 'var(--pastel-pink)' },
                { label: 'Tasks', val: syncStatus.counts.tasks, bg: 'var(--pastel-butter)' },
                { label: 'Routines', val: syncStatus.counts.routines, bg: 'var(--pastel-peach)' },
                { label: 'Journals', val: syncStatus.counts.journals, bg: 'var(--pastel-mint)' },
                { label: 'Memories', val: syncStatus.counts.memories, bg: 'var(--pastel-butter)' },
                { label: 'Photos', val: syncStatus.counts.images, bg: 'var(--pastel-sky)' },
                { label: 'Voice Memos', val: syncStatus.counts.voiceMemos, bg: 'var(--pastel-peach)' },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl p-3"
                  style={{ background: stat.bg }}
                >
                  <p className="text-[11px] font-semibold text-[var(--text-muted)]">{stat.label}</p>
                  <p className="mt-0.5 font-mono text-lg font-extrabold text-[var(--text-main)]">
                    {stat.val}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Google Calendar Sync */}
      <section className="cozy-card cozy-card-peach rounded-3xl p-5">
        <h3 className="text-sm font-extrabold text-[var(--text-main)]">Google Calendar Sync</h3>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">
          Paste your Google Calendar <strong>Secret address in iCal format</strong> (.ics URL) from
          Google Calendar → Settings → Integrate calendar.
        </p>
        <form onSubmit={handleSaveGcal} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            type="url"
            value={gcalUrl}
            onChange={(e) => setGcalUrl(e.target.value)}
            placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
            className="flex-1 rounded-2xl border border-[var(--border-card)] bg-[var(--bg-input)] px-3.5 py-2 text-xs text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
          />
          <button
            type="submit"
            className="pastel-btn rounded-2xl px-4 py-2 text-xs font-bold"
          >
            {gcalSaved ? 'Saved!' : 'Save Feed'}
          </button>
        </form>
      </section>

      {/* Mobile Wi-Fi Access & Security */}
      {networkInfo && (
        <section className="cozy-card cozy-card-sky rounded-3xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[var(--pastel-sky)] text-sky-700 dark:text-sky-300">
                <Wifi className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-[var(--text-main)]">
                  Phone Access &amp; Wi-Fi Security
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Protected with token auth so strangers on school/public Wi-Fi can&apos;t get in.
                </p>
              </div>
            </div>

            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-extrabold ${
                networkInfo.lanEnabled
                  ? 'bg-[var(--pastel-butter)] text-amber-800 dark:text-amber-200'
                  : 'bg-[var(--pastel-mint)] text-emerald-800 dark:text-emerald-200'
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              {networkInfo.lanEnabled
                ? 'Phone Wi-Fi Mode (Token Locked)'
                : 'School Wi-Fi Safe (Local Only)'}
            </span>
          </div>

          {!networkInfo.lanEnabled ? (
            <div className="mt-3 rounded-2xl border border-[var(--border-card)] bg-[var(--bg-card)]/85 p-3.5 text-xs text-[var(--text-muted)]">
              <p className="font-bold text-[var(--text-main)]">
                Currently unreachable from other devices on Wi-Fi (127.0.0.1 only).
              </p>
              <p className="mt-1">
                When you&apos;re on trusted home Wi-Fi and want to use your phone, start Melody with{' '}
                <code className="rounded bg-[var(--bg-subtle)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--text-main)]">
                  npm run dev:lan
                </code>{' '}
                or{' '}
                <code className="rounded bg-[var(--bg-subtle)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--text-main)]">
                  npm run start:lan
                </code>
                .
              </p>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              {networkInfo.lanUrls.length > 0 ? (
                networkInfo.lanUrls.map((url) => (
                  <div
                    key={url}
                    className="rounded-2xl bg-[var(--bg-card)]/85 px-3.5 py-2 font-mono text-xs font-semibold text-[var(--text-main)]"
                  >
                    {url}
                  </div>
                ))
              ) : (
                <p className="text-xs text-[var(--text-muted)]">No LAN Wi-Fi address detected.</p>
              )}
            </div>
          )}

          {/* Pairing Link & Access Token (only shown on this laptop) */}
          {networkInfo.isLocalhost && accessToken && (
            <div className="mt-4 space-y-3 rounded-2xl border border-[var(--border-card)] bg-[var(--bg-card)]/85 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--pastel-mint)] text-emerald-700 dark:text-emerald-300">
                    <KeyRound className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-extrabold text-[var(--text-main)]">
                      Phone Pairing Key
                    </h4>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      Required to unlock Melody from your phone (stays signed in for 30 days)
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={rotatingToken}
                  onClick={() => void handleRotateToken()}
                  className="rounded-xl bg-[var(--pastel-peach)] px-3 py-1.5 text-[11px] font-extrabold text-[var(--text-main)] transition hover:brightness-95 disabled:opacity-60"
                  title="Generates a new key and logs out all paired phones"
                >
                  {rotatingToken ? 'Rotating...' : 'Regenerate Key'}
                </button>
              </div>

              <div className="flex items-center gap-2 rounded-xl border border-[var(--border-card)] bg-[var(--bg-input)] px-3 py-2">
                <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-[var(--text-main)]">
                  {showToken ? accessToken : '••••••••••••••••••••••••••••••••'}
                </code>
                <button
                  type="button"
                  onClick={() => setShowToken((v) => !v)}
                  className="rounded-lg p-1 text-[var(--text-muted)] hover:text-[var(--text-main)]"
                  title={showToken ? 'Hide key' : 'Show key'}
                >
                  {showToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => void copyText(accessToken, setCopiedToken)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[var(--pastel-sky)] px-2.5 py-1 text-[11px] font-bold text-[var(--text-main)]"
                >
                  {copiedToken ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copiedToken ? 'Copied' : 'Copy Key'}
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--bg-subtle)] px-3 py-2 text-[11px]">
                <span className="text-[var(--text-muted)]">
                  Or copy a one-tap pairing link for your phone:
                </span>
                <button
                  type="button"
                  onClick={() => void copyText(pairingUrl, setCopiedPairUrl)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[var(--pastel-mint)] px-2.5 py-1 font-bold text-[var(--text-main)]"
                >
                  {copiedPairUrl ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copiedPairUrl ? 'Link Copied!' : 'Copy Phone Link'}
                </button>
              </div>
            </div>
          )}

          {/* Sign out / Lock button when viewing from a phone */}
          {!networkInfo.isLocalhost && onLockDevice && (
            <div className="mt-3">
              <button
                type="button"
                onClick={onLockDevice}
                className="inline-flex items-center gap-1.5 rounded-2xl bg-[var(--pastel-peach)] px-4 py-2 text-xs font-extrabold text-[var(--text-main)]"
              >
                <Lock className="h-3.5 w-3.5" />
                Lock / Sign Out This Phone
              </button>
            </div>
          )}

          {/* iPhone App Tracking via Apple Shortcuts */}
          <div className="mt-4 rounded-2xl border border-[var(--border-card)] bg-[var(--bg-card)]/85 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--pastel-pink)] text-pink-700 dark:text-pink-300">
                  <Smartphone className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold text-[var(--text-main)]">
                    iPhone App Tracking (Apple Shortcuts)
                  </h4>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Auto-log iPhone apps into Time &amp; Apps over home Wi-Fi (includes your auth key)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void handleTestMobilePing()}
                className="rounded-xl bg-[var(--pastel-mint)] px-3 py-1.5 text-[11px] font-extrabold text-[var(--text-main)] transition hover:brightness-95"
              >
                Send Test Ping
              </button>
            </div>

            {testPingMsg && (
              <p className="mt-2 rounded-xl bg-[var(--pastel-mint)] px-3 py-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-200">
                {testPingMsg}
              </p>
            )}

            <div className="mt-3 flex items-center gap-2 rounded-xl border border-[var(--border-card)] bg-[var(--bg-input)] px-3 py-2">
              <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-[var(--text-main)]">
                {accessToken ? `${primaryLanUrl}/api/app-usage/mobile-event?token=••••••` : mobileWebhookUrl}
              </code>
              <button
                type="button"
                onClick={() => void copyText(mobileWebhookUrl, setCopiedUrl)}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[var(--pastel-sky)] px-2.5 py-1 text-[11px] font-bold text-[var(--text-main)]"
              >
                {copiedUrl ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copiedUrl ? 'Copied' : 'Copy'}
              </button>
            </div>

            <ol className="mt-3 space-y-1 text-[11px] leading-relaxed text-[var(--text-muted)] list-decimal pl-4">
              <li>
                Open the <strong className="text-[var(--text-main)]">Shortcuts</strong> app on your
                iPhone → tap <strong className="text-[var(--text-main)]">Automation</strong> →{' '}
                <strong className="text-[var(--text-main)]">+</strong> →{' '}
                <strong className="text-[var(--text-main)]">App</strong>.
              </li>
              <li>
                Pick the app (e.g. Anki or Instagram), select{' '}
                <strong className="text-[var(--text-main)]">Is Opened</strong> and{' '}
                <strong className="text-[var(--text-main)]">Run Immediately</strong>.
              </li>
              <li>
                Add action <strong className="text-[var(--text-main)]">Get Contents of URL</strong>{' '}
                → paste the copied URL above → set Method to{' '}
                <strong className="text-[var(--text-main)]">POST</strong> → Request Body{' '}
                <strong className="text-[var(--text-main)]">JSON</strong> with fields:{' '}
                <code className="rounded bg-[var(--bg-subtle)] px-1 font-mono text-[var(--text-main)]">
                  app_name: &quot;Anki&quot;
                </code>{' '}
                and{' '}
                <code className="rounded bg-[var(--bg-subtle)] px-1 font-mono text-[var(--text-main)]">
                  action: &quot;open&quot;
                </code>
                .
              </li>
              <li>
                Repeat for <strong className="text-[var(--text-main)]">Is Closed</strong> with{' '}
                <code className="rounded bg-[var(--bg-subtle)] px-1 font-mono text-[var(--text-main)]">
                  action: &quot;close&quot;
                </code>
                . Sessions appear in <strong className="text-[var(--text-main)]">Time &amp; Apps</strong>!
              </li>
            </ol>
          </div>
        </section>
      )}
    </div>
  );
}
