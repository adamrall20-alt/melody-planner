import { useEffect, useState } from 'react';
import { Play, Square, Trash2, Monitor, Clock, Power, History, Trophy, Plus } from 'lucide-react';
import type {
  AllTimeTotals,
  AppUsageLog,
  AppUsageSummary,
  Category,
  HistoryDaySummary,
  TimeEntry,
} from '@shared/types';
import { api } from '@/lib/api';
import { formatClock, formatDuration, formatTimeShort } from '@/lib/date';

interface ActivityTrackerPanelProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  categories: Category[];
  entries: TimeEntry[];
  onEntriesChanged: () => void;
  onOpenCategoryManager: () => void;
}

export function ActivityTrackerPanel({
  selectedDate,
  onSelectDate,
  categories,
  entries,
  onEntriesChanged,
  onOpenCategoryManager,
}: ActivityTrackerPanelProps) {
  const [mobileTab, setMobileTab] = useState<'timer' | 'apps' | 'history'>('timer');
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(categories[0]?.id ?? null);
  const [nowMs, setNowMs] = useState(Date.now());
  const [appSummary, setAppSummary] = useState<AppUsageSummary[]>([]);
  const [recentApps, setRecentApps] = useState<AppUsageLog[]>([]);
  const [trackerActive, setTrackerActive] = useState(true);
  const [history, setHistory] = useState<HistoryDaySummary[]>([]);
  const [totals, setTotals] = useState<AllTimeTotals | null>(null);

  const runningEntry = entries.find((e) => e.ended_at === null) ?? null;

  useEffect(() => {
    if (categoryId === null && categories.length > 0) {
      setCategoryId(categories[0].id);
    }
  }, [categories, categoryId]);

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const loadAppUsageAndHistory = async () => {
    try {
      const [usage, hist, allTotals] = await Promise.all([
        api.getAppUsage(selectedDate),
        api.getHistory(14),
        api.getAllTimeTotals(),
      ]);
      setAppSummary(usage.summary);
      setRecentApps(usage.recent);
      setTrackerActive(usage.trackerActive);
      setHistory(hist);
      setTotals(allTotals);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    void loadAppUsageAndHistory();
    const id = setInterval(() => void loadAppUsageAndHistory(), 10000);
    return () => clearInterval(id);
  }, [selectedDate]);

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await api.startTimer({ title: title.trim(), category_id: categoryId });
    setTitle('');
    onEntriesChanged();
    void loadAppUsageAndHistory();
  };

  const handleStop = async (id: number) => {
    await api.stopTimer(id);
    onEntriesChanged();
    void loadAppUsageAndHistory();
  };

  const handleDelete = async (id: number) => {
    await api.deleteTimeEntry(id);
    onEntriesChanged();
    void loadAppUsageAndHistory();
  };

  const handleToggleAutoTracker = async () => {
    const res = await api.toggleAppTracker(!trackerActive);
    setTrackerActive(res.trackerActive);
  };

  const handleCategorizeApp = async (appName: string, newCategoryId: number) => {
    await api.categorizeApp(appName, newCategoryId);
    void loadAppUsageAndHistory();
  };

  const runningSeconds = runningEntry
    ? Math.max(0, Math.floor((nowMs - new Date(runningEntry.started_at).getTime()) / 1000))
    : 0;

  const totalManualSec = entries.reduce((sum, entry) => {
    const end = entry.ended_at ? new Date(entry.ended_at).getTime() : nowMs;
    return sum + Math.max(0, Math.floor((end - new Date(entry.started_at).getTime()) / 1000));
  }, 0);

  const totalAutoSec = appSummary.reduce((sum, a) => sum + a.total_sec, 0);

  return (
    <div className="space-y-4">
      {/* Mobile-only clean segmented tabs */}
      <div className="grid grid-cols-3 gap-1 rounded-2xl border border-[var(--border-card)] bg-[var(--bg-glass)] p-1 md:hidden">
        {[
          { id: 'timer' as const, label: 'Timer', bg: 'var(--pastel-mint)' },
          { id: 'apps' as const, label: 'Apps', bg: 'var(--pastel-sky)' },
          { id: 'history' as const, label: 'History', bg: 'var(--pastel-butter)' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setMobileTab(t.id)}
            className={`rounded-xl py-2 text-xs font-extrabold transition ${
              mobileTab === t.id
                ? 'text-[var(--text-main)] shadow-xs'
                : 'text-[var(--text-muted)]'
            }`}
            style={mobileTab === t.id ? { background: t.bg } : undefined}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Live Timer Bar */}
      <section
        className={`cozy-card cozy-card-mint rounded-3xl p-5 ${
          mobileTab === 'timer' ? 'block' : 'hidden md:block'
        }`}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--pastel-sky)] text-sky-700 dark:text-sky-300">
              <Clock className="h-4 w-4" />
            </div>
            <h2 className="text-sm font-bold text-[var(--text-main)]">Activity Timer</h2>
          </div>
          <span className="rounded-full bg-[var(--pastel-butter)] px-2.5 py-0.5 font-mono text-xs font-bold text-[var(--text-main)]">
            {formatDuration(totalManualSec)}
          </span>
        </div>

        {runningEntry ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--pastel-mint)] px-4 py-3.5">
            <div className="flex items-center gap-3">
              <span
                className="h-3 w-3 animate-pulse rounded-full"
                style={{ backgroundColor: runningEntry.category_color || '#10b981' }}
              />
              <div>
                <p className="text-sm font-bold text-[var(--text-main)]">{runningEntry.title}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {runningEntry.category_name || 'Uncategorized'} · Started{' '}
                  {formatTimeShort(runningEntry.started_at)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-lg font-extrabold text-[var(--text-main)]">
                {formatClock(runningSeconds)}
              </span>
              <button
                type="button"
                onClick={() => void handleStop(runningEntry.id)}
                className="inline-flex items-center gap-1.5 rounded-2xl bg-rose-500 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-rose-600"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
                Stop
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={(e) => void handleStart(e)} className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What are you working on?"
              className="flex-1 rounded-2xl border border-[var(--border-card)] bg-[var(--bg-input)] px-3.5 py-2.5 text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
            />
            <div className="flex gap-1.5">
              <select
                value={categoryId ?? ''}
                onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
                className="flex-1 rounded-2xl border border-[var(--border-card)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-main)] focus:border-[var(--accent)] focus:outline-none sm:flex-none"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={onOpenCategoryManager}
                className="inline-flex items-center justify-center rounded-2xl border border-[var(--border-card)] bg-[var(--pastel-pink)] px-3 text-[var(--text-main)] transition hover:brightness-95"
                title="Add or manage custom categories (e.g. Japanese)"
              >
                <Plus className="h-4 w-4" />
              </button>
              <button
                type="submit"
                className="pastel-btn inline-flex items-center gap-1.5 rounded-2xl px-5 py-2.5 text-sm font-bold"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                Start
              </button>
            </div>
          </form>
        )}

        {/* Manual entries list */}
        <div className="mt-4 space-y-1.5">
          {entries.filter((e) => e.ended_at !== null).length === 0 ? (
            <p className="py-3 text-center text-xs text-[var(--text-muted)]">
              No completed timer sessions for {selectedDate}.
            </p>
          ) : (
            entries
              .filter((e) => e.ended_at !== null)
              .map((entry) => {
                const dur = Math.max(
                  1,
                  Math.floor(
                    (new Date(entry.ended_at!).getTime() - new Date(entry.started_at).getTime()) /
                      1000
                  )
                );
                return (
                  <div
                    key={entry.id}
                    className="group flex items-center justify-between rounded-2xl bg-[var(--bg-subtle)] px-3.5 py-2.5 text-sm"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: entry.category_color || 'var(--accent)' }}
                      />
                      <span className="truncate font-semibold text-[var(--text-main)]">
                        {entry.title}
                      </span>
                      {entry.category_name && (
                        <span className="hidden rounded-full bg-[var(--bg-card)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-muted)] sm:inline">
                          {entry.category_name}
                        </span>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-3 text-xs text-[var(--text-muted)]">
                      <span className="hidden sm:inline">
                        {formatTimeShort(entry.started_at)} – {formatTimeShort(entry.ended_at!)}
                      </span>
                      <span className="font-mono font-bold text-[var(--text-main)]">
                        {formatDuration(dur)}
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleDelete(entry.id)}
                        className="text-[var(--text-muted)] opacity-60 transition hover:text-rose-500 sm:opacity-0 sm:group-hover:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
          )}
        </div>
      </section>

      {/* Active Window Tracking */}
      <section
        className={`cozy-card cozy-card-sky rounded-3xl p-5 ${
          mobileTab === 'apps' ? 'block' : 'hidden md:block'
        }`}
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--pastel-mint)] text-emerald-700 dark:text-emerald-300">
              <Monitor className="h-4 w-4" />
            </div>
            <h2 className="text-sm font-bold text-[var(--text-main)]">Active Window Tracking</h2>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                trackerActive
                  ? 'bg-[var(--pastel-mint)] text-emerald-700 dark:text-emerald-300'
                  : 'bg-[var(--bg-subtle)] text-[var(--text-muted)]'
              }`}
            >
              {trackerActive ? 'Active' : 'Paused'}
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-xs font-bold text-[var(--text-main)]">
              {formatDuration(totalAutoSec)}
            </span>
            <button
              type="button"
              onClick={() => void handleToggleAutoTracker()}
              className="inline-flex items-center gap-1 rounded-xl bg-[var(--bg-subtle)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-main)]"
            >
              <Power className="h-3 w-3" />
              {trackerActive ? 'Pause' : 'Resume'}
            </button>
          </div>
        </div>

        {appSummary.length === 0 ? (
          <p className="py-4 text-center text-xs text-[var(--text-muted)]">
            No active-window logs recorded for {selectedDate}.
          </p>
        ) : (
          <div className="space-y-3">
            {appSummary.map((app) => {
              const pct = totalAutoSec > 0 ? Math.round((app.total_sec / totalAutoSec) * 100) : 0;
              return (
                <div key={app.app_name} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[var(--text-main)]">{app.app_name}</span>
                      <select
                        value={app.category_id ?? ''}
                        onChange={(e) => {
                          if (e.target.value) {
                            void handleCategorizeApp(app.app_name, Number(e.target.value));
                          }
                        }}
                        className="rounded-lg border border-[var(--border-card)] bg-[var(--bg-input)] px-2 py-0.5 text-[11px] text-[var(--text-main)]"
                      >
                        <option value="">Uncategorized</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <span className="font-mono font-semibold text-[var(--text-muted)]">
                      {formatDuration(app.total_sec)} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.max(3, pct)}%`,
                        backgroundColor: app.category_color || 'var(--accent)',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {recentApps.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-main)]">
              Recent window log ({recentApps.length})
            </summary>
            <div className="mt-2 max-h-40 space-y-1 overflow-y-auto pr-1 text-xs">
              {recentApps.slice(0, 15).map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between rounded-xl bg-[var(--bg-subtle)] px-3 py-1.5 text-[var(--text-muted)]"
                >
                  <span className="truncate pr-2">
                    <strong className="text-[var(--text-main)]">{log.app_name}</strong>
                    {log.window_title ? ` — ${log.window_title}` : ''}
                  </span>
                  <span className="shrink-0 font-mono text-[11px]">
                    {formatDuration(log.duration_sec)}
                  </span>
                </div>
              ))}
            </div>
          </details>
        )}
      </section>

      {/* All-Time Global Totals + 14-Day History */}
      <div className={mobileTab === 'history' ? 'space-y-4' : 'hidden space-y-4 md:block'}>
        {totals && (
          <section className="cozy-card cozy-card-butter rounded-3xl p-5">
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--pastel-butter)] text-amber-700 dark:text-amber-300">
                <Trophy className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-bold text-[var(--text-main)]">All-Time Totals</h2>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              <div className="rounded-2xl p-3" style={{ background: 'var(--pastel-butter)' }}>
                <p className="text-[11px] font-semibold text-[var(--text-muted)]">Studied</p>
                <p className="mt-1 font-mono text-base font-extrabold text-[var(--text-main)]">
                  {formatDuration(totals.study_sec)}
                </p>
              </div>
              <div className="rounded-2xl p-3" style={{ background: 'var(--pastel-mint)' }}>
                <p className="text-[11px] font-semibold text-[var(--text-muted)]">
                  Timers ({totals.total_sessions})
                </p>
                <p className="mt-1 font-mono text-base font-extrabold text-[var(--text-main)]">
                  {formatDuration(totals.total_manual_sec)}
                </p>
              </div>
              <div className="rounded-2xl p-3" style={{ background: 'var(--pastel-sky)' }}>
                <p className="text-[11px] font-semibold text-[var(--text-muted)]">App Usage</p>
                <p className="mt-1 font-mono text-base font-extrabold text-[var(--text-main)]">
                  {formatDuration(totals.total_app_sec)}
                </p>
              </div>
            </div>
            {totals.by_category.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {totals.by_category.map((cat) => (
                  <span
                    key={cat.category_name}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[var(--bg-subtle)] px-3 py-1 text-xs font-medium text-[var(--text-main)]"
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: cat.category_color }}
                    />
                    {cat.category_name}:{' '}
                    <strong className="font-mono">{formatDuration(cat.total_sec)}</strong>
                  </span>
                ))}
              </div>
            )}
          </section>
        )}

        <section className="cozy-card cozy-card-peach rounded-3xl p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--pastel-peach)] text-rose-700 dark:text-rose-300">
                <History className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-bold text-[var(--text-main)]">Past 14 Days</h2>
            </div>
            <span className="text-xs text-[var(--text-muted)]">Tap a day</span>
          </div>

          {history.length === 0 ? (
            <p className="py-4 text-center text-xs text-[var(--text-muted)]">
              Your past daily summaries will appear here.
            </p>
          ) : (
            <div className="space-y-1.5">
              {history.map((item) => {
                const isSelected = item.day === selectedDate;
                return (
                  <button
                    key={item.day}
                    type="button"
                    onClick={() => onSelectDate(item.day)}
                    className={`flex w-full items-center justify-between rounded-2xl px-3.5 py-2.5 text-left text-xs transition ${
                      isSelected
                        ? 'bg-[var(--pastel-sky)] font-bold text-[var(--text-main)] ring-1 ring-[var(--accent)]'
                        : 'bg-[var(--bg-subtle)] text-[var(--text-main)] hover:brightness-95'
                    }`}
                  >
                    <span className="font-mono font-semibold">{item.day}</span>
                    <div className="flex items-center gap-4">
                      <span>
                        Timers: <strong className="font-mono">{formatDuration(item.manual_sec)}</strong>
                      </span>
                      <span>
                        Apps: <strong className="font-mono">{formatDuration(item.app_sec)}</strong>
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
