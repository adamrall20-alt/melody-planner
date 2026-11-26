import { useCallback, useEffect, useState } from 'react';
import {
  BookHeart,
  BookOpen,
  CalendarDays,
  CheckSquare,
  Clock,
  FolderHeart,
  Menu,
  Moon,
  Settings,
  Sparkles,
  Sun,
  X,
} from 'lucide-react';
import type {
  AppSettings,
  Category,
  CompanionMood,
  NetworkInfo,
  Routine,
  Task,
  TimeEntry,
} from '@shared/types';
import { api } from '@/lib/api';
import { toLocalDateStr } from '@/lib/date';
import { MelodyCompanion } from '@/components/companion/MelodyCompanion';
import { ActivityTrackerPanel } from '@/components/tracker/ActivityTrackerPanel';
import { TasksRoutinesPanel } from '@/components/tasks/TasksRoutinesPanel';
import { CalendarPanel } from '@/components/calendar/CalendarPanel';
import { StudyPanel } from '@/components/study/StudyPanel';
import { JournalMemoryPanel } from '@/components/journal/JournalMemoryPanel';
import { MediaVaultPanel } from '@/components/media/MediaVaultPanel';
import { SettingsPanel } from '@/components/settings/SettingsPanel';

type Tab = 'today' | 'study' | 'tracker' | 'journal' | 'vault' | 'calendar' | 'settings';

const DESKTOP_TABS: { id: Tab; label: string; icon: typeof CheckSquare }[] = [
  { id: 'today', label: 'Today', icon: CheckSquare },
  { id: 'study', label: 'Study', icon: BookOpen },
  { id: 'tracker', label: 'Time & Apps', icon: Clock },
  { id: 'journal', label: 'Journal', icon: BookHeart },
  { id: 'vault', label: 'Vault', icon: FolderHeart },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const MOBILE_PRIMARY_TABS: { id: Tab; label: string; icon: typeof CheckSquare }[] = [
  { id: 'today', label: 'Today', icon: CheckSquare },
  { id: 'study', label: 'Study', icon: BookOpen },
  { id: 'tracker', label: 'Time', icon: Clock },
];

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('today');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(toLocalDateStr());
  const [mood, setMood] = useState<CompanionMood>('idle');
  const [categories, setCategories] = useState<Category[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [settings, setSettings] = useState<AppSettings>({
    theme: 'pastel',
    eye_tracking: true,
    study_notes: '',
  });

  // Apply theme class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('theme-dark');
      root.classList.add('dark');
    } else {
      root.classList.remove('theme-dark');
      root.classList.remove('dark');
    }
  }, [settings.theme]);

  const loadAll = useCallback(async () => {
    try {
      const [cats, timeEntries, dayTasks, dayRoutines, net, appSettings] = await Promise.all([
        api.getCategories(),
        api.getTimeEntries(selectedDate),
        api.getTasks(selectedDate),
        api.getRoutines(selectedDate),
        api.getNetworkInfo(),
        api.getSettings(),
      ]);
      setCategories(cats);
      setEntries(timeEntries);
      setTasks(dayTasks);
      setRoutines(dayRoutines);
      setNetworkInfo(net);
      setSettings(appSettings);
    } catch (err) {
      console.error('Failed to load planner data:', err);
    }
  }, [selectedDate]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleUpdateSettings = async (patch: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
    try {
      const updated = await api.updateSettings(patch);
      setSettings(updated);
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  };

  const runningEntry = entries.find((e) => e.ended_at === null) ?? null;

  useEffect(() => {
    if (runningEntry) {
      setMood('focus');
    } else if (mood === 'focus') {
      setMood('idle');
    }
  }, [runningEntry]);

  const triggerCelebrate = () => {
    setMood('celebrate');
    setTimeout(() => {
      setMood(runningEntry ? 'focus' : 'idle');
    }, 3000);
  };

  const navigateMobile = (tab: Tab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--bg-app)] text-[var(--text-main)]">
      {/* Top Bar — padded on desktop for macOS traffic-light buttons */}
      <header className="app-drag flex h-14 shrink-0 items-center justify-between border-b border-[var(--border-card)] bg-[var(--bg-header)] px-4 backdrop-blur lg:pl-20">
        <div className="app-no-drag flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--pastel-sky)] text-sky-700 dark:text-sky-300">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-sm font-extrabold tracking-tight text-[var(--text-main)]">
              Melody
            </h1>
            <p className="hidden text-[11px] font-medium text-[var(--text-muted)] sm:block">
              {selectedDate}
            </p>
          </div>
        </div>

        {/* Desktop Navigation Tabs */}
        <nav className="app-no-drag hidden items-center gap-1 rounded-2xl bg-[var(--bg-subtle)] p-1 md:flex">
          {DESKTOP_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  active
                    ? 'bg-[var(--bg-card)] text-[var(--text-main)] shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Right Controls: Date + Quick Dark Mode Toggle */}
        <div className="app-no-drag flex items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded-xl border border-[var(--border-card)] bg-[var(--bg-input)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-main)] focus:border-[var(--accent)] focus:outline-none"
          />
          <button
            type="button"
            onClick={() =>
              void handleUpdateSettings({
                theme: settings.theme === 'pastel' ? 'dark' : 'pastel',
              })
            }
            className="rounded-xl bg-[var(--bg-subtle)] p-2 text-[var(--text-main)] transition hover:brightness-95"
            title="Switch Pastel / Dark theme"
          >
            {settings.theme === 'pastel' ? (
              <Moon className="h-4 w-4" />
            ) : (
              <Sun className="h-4 w-4 text-amber-300" />
            )}
          </button>
        </div>
      </header>

      {/* Main Split Workspace: Melody on the LEFT + Content on the RIGHT */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden p-3 pb-24 md:p-4 md:pb-4 lg:grid-cols-[340px_1fr]">
        {/* Persistent 3D Companion on the LEFT */}
        <div className="hidden min-h-0 lg:block">
          <MelodyCompanion
            mood={mood}
            onMoodChange={setMood}
            activeActivityLabel={runningEntry?.title ?? null}
            theme={settings.theme}
            eyeTracking={settings.eye_tracking}
          />
        </div>

        <main className="min-h-0 overflow-y-auto pr-0.5">
          {activeTab === 'today' && (
            <div className="space-y-4">
              <TasksRoutinesPanel
                selectedDate={selectedDate}
                categories={categories}
                tasks={tasks}
                routines={routines}
                onTasksChanged={() => void loadAll()}
                onRoutinesChanged={() => void loadAll()}
                onCelebrate={triggerCelebrate}
              />
              {/* On mobile, keep Today focused on Tasks & Routines; Time & Apps has its own clean tab */}
              <div className="hidden md:block">
                <ActivityTrackerPanel
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                  categories={categories}
                  entries={entries}
                  onEntriesChanged={() => void loadAll()}
                />
              </div>
            </div>
          )}

          {activeTab === 'study' && (
            <StudyPanel
              categories={categories}
              runningEntry={runningEntry}
              initialNotes={settings.study_notes}
              onSaveNotes={(notes) => void handleUpdateSettings({ study_notes: notes })}
              onEntriesChanged={() => void loadAll()}
              onCelebrate={triggerCelebrate}
            />
          )}

          {activeTab === 'tracker' && (
            <ActivityTrackerPanel
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              categories={categories}
              entries={entries}
              onEntriesChanged={() => void loadAll()}
            />
          )}

          {activeTab === 'journal' && (
            <JournalMemoryPanel
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              onCelebrate={triggerCelebrate}
            />
          )}

          {activeTab === 'vault' && <MediaVaultPanel selectedDate={selectedDate} />}

          {activeTab === 'calendar' && (
            <div className="space-y-4">
              <CalendarPanel
                selectedDate={selectedDate}
                onSelectDate={(d) => setSelectedDate(d)}
              />
              <TasksRoutinesPanel
                selectedDate={selectedDate}
                categories={categories}
                tasks={tasks}
                routines={routines}
                onTasksChanged={() => void loadAll()}
                onRoutinesChanged={() => void loadAll()}
                onCelebrate={triggerCelebrate}
              />
            </div>
          )}

          {activeTab === 'settings' && (
            <SettingsPanel
              settings={settings}
              networkInfo={networkInfo}
              onUpdateSettings={(patch) => void handleUpdateSettings(patch)}
            />
          )}
        </main>
      </div>

      {/* Clean Mobile 4-Item Bottom Bar (Today, Study, Time, Menu) */}
      <nav className="fixed right-3 bottom-3 left-3 z-40 grid grid-cols-4 rounded-3xl border border-[var(--border-card)] bg-[var(--bg-glass)] p-1.5 shadow-lg backdrop-blur md:hidden">
        {MOBILE_PRIMARY_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id && !mobileMenuOpen;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => navigateMobile(tab.id)}
              className={`flex flex-col items-center gap-0.5 rounded-2xl py-2 text-[11px] font-bold transition ${
                active
                  ? 'bg-[var(--pastel-sky)] text-[var(--text-main)]'
                  : 'text-[var(--text-muted)]'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setMobileMenuOpen((v) => !v)}
          className={`flex flex-col items-center gap-0.5 rounded-2xl py-2 text-[11px] font-bold transition ${
            mobileMenuOpen ||
            activeTab === 'journal' ||
            activeTab === 'vault' ||
            activeTab === 'calendar' ||
            activeTab === 'settings'
              ? 'bg-[var(--pastel-mint)] text-[var(--text-main)]'
              : 'text-[var(--text-muted)]'
          }`}
        >
          <Menu className="h-4 w-4" />
          Menu
        </button>
      </nav>

      {/* Mobile Slide-Over Menu Sheet (Journal, Vault, Calendar, Settings) */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/40 backdrop-blur-xs md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="cozy-card w-full rounded-t-3xl p-5 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-[var(--text-main)]">Explore Melody</h3>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-xl bg-[var(--bg-subtle)] p-1.5 text-[var(--text-muted)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { id: 'journal' as const, label: 'Journal & Memories', icon: BookHeart, bg: 'var(--pastel-mint)' },
                { id: 'vault' as const, label: 'Photos & Voice', icon: FolderHeart, bg: 'var(--pastel-peach)' },
                { id: 'calendar' as const, label: 'Calendar', icon: CalendarDays, bg: 'var(--pastel-sky)' },
                { id: 'settings' as const, label: 'Settings & Sync', icon: Settings, bg: 'var(--pastel-butter)' },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigateMobile(item.id)}
                    className="flex flex-col items-start gap-2 rounded-2xl p-4 text-left transition active:scale-98"
                    style={{ background: item.bg }}
                  >
                    <Icon className="h-5 w-5 text-[var(--text-main)]" />
                    <span className="text-xs font-bold text-[var(--text-main)]">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
