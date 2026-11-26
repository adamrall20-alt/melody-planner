import { useCallback, useEffect, useState } from 'react';
import {
  BookHeart,
  BookOpen,
  CalendarDays,
  CheckSquare,
  Clock,
  Flame,
  FolderHeart,
  Menu,
  Moon,
  Settings,
  Star,
  Sun,
  Trophy,
  X,
} from 'lucide-react';
import type {
  AppSettings,
  Category,
  CompanionMood,
  GamificationState,
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
import { QuestsProgressPanel } from '@/components/gamification/QuestsProgressPanel';
import { CategoryManagerModal } from '@/components/categories/CategoryManagerModal';

type Tab = 'today' | 'study' | 'tracker' | 'quests' | 'journal' | 'vault' | 'calendar' | 'settings';

const DESKTOP_TABS: { id: Tab; label: string; icon: typeof CheckSquare; activeBg: string }[] = [
  { id: 'today', label: 'Today', icon: CheckSquare, activeBg: 'var(--pastel-sky)' },
  { id: 'study', label: 'Study', icon: BookOpen, activeBg: 'var(--pastel-mint)' },
  { id: 'tracker', label: 'Time & Apps', icon: Clock, activeBg: 'var(--pastel-butter)' },
  { id: 'quests', label: 'Quests', icon: Trophy, activeBg: 'var(--pastel-pink)' },
  { id: 'journal', label: 'Journal', icon: BookHeart, activeBg: 'var(--pastel-peach)' },
  { id: 'vault', label: 'Vault', icon: FolderHeart, activeBg: 'var(--pastel-lavender)' },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays, activeBg: 'var(--pastel-mint)' },
  { id: 'settings', label: 'Settings', icon: Settings, activeBg: 'var(--pastel-sky)' },
];

const MOBILE_PRIMARY_TABS: { id: Tab; label: string; icon: typeof CheckSquare; activeBg: string }[] = [
  { id: 'today', label: 'Today', icon: CheckSquare, activeBg: 'var(--pastel-sky)' },
  { id: 'study', label: 'Study', icon: BookOpen, activeBg: 'var(--pastel-mint)' },
  { id: 'tracker', label: 'Time', icon: Clock, activeBg: 'var(--pastel-butter)' },
];

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('today');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(toLocalDateStr());
  const [mood, setMood] = useState<CompanionMood>('idle');
  const [categories, setCategories] = useState<Category[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [gamification, setGamification] = useState<GamificationState | null>(null);
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
      const [cats, timeEntries, dayTasks, dayRoutines, net, appSettings, gamif] = await Promise.all([
        api.getCategories(),
        api.getTimeEntries(selectedDate),
        api.getTasks(selectedDate),
        api.getRoutines(selectedDate),
        api.getNetworkInfo(),
        api.getSettings(),
        api.getGamification(selectedDate),
      ]);
      setCategories(cats);
      setEntries(timeEntries);
      setTasks(dayTasks);
      setRoutines(dayRoutines);
      setNetworkInfo(net);
      setSettings(appSettings);
      setGamification(gamif);
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

  const claimableQuests =
    gamification?.quests.filter((q) => q.completed && !q.claimed).length ?? 0;

  return (
    <div className="app-canvas flex h-screen flex-col overflow-hidden text-[var(--text-main)]">
      {/* Top Bar — padded on desktop for macOS traffic-light buttons */}
      <header className="app-drag app-header-bar flex h-14 shrink-0 items-center justify-between border-b border-[var(--border-card)] px-3 backdrop-blur sm:px-4 lg:pl-20">
        <div className="app-no-drag flex items-center gap-2.5">
          <img
            src="/melody-logo.png"
            alt="Melody"
            className="h-9 w-9 shrink-0 object-contain drop-shadow-sm"
          />
          <div>
            <h1 className="text-sm leading-tight font-black tracking-tight text-[var(--text-main)]">
              Melody
            </h1>
            <p className="hidden text-[11px] font-semibold text-[var(--text-muted)] sm:block">
              {selectedDate}
            </p>
          </div>
        </div>

        {/* Desktop Navigation Tabs */}
        <nav className="app-no-drag hidden items-center gap-1 rounded-2xl border border-[var(--border-card)] bg-[var(--bg-card)]/75 p-1 md:flex">
          {DESKTOP_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`relative inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-extrabold transition ${
                  active
                    ? 'text-[var(--text-main)] shadow-xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
                style={active ? { background: tab.activeBg } : undefined}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
                {tab.id === 'quests' && claimableQuests > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-black text-slate-900">
                    {claimableQuests}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right Controls: Level/Streak Pill + Date + Quick Dark Mode Toggle */}
        <div className="app-no-drag flex items-center gap-1.5 sm:gap-2">
          {gamification && (
            <button
              type="button"
              onClick={() => setActiveTab('quests')}
              className="relative inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-card)] bg-[var(--pastel-butter)] px-2.5 py-1.5 text-xs font-extrabold text-[var(--text-main)] transition hover:brightness-95"
              title={`Level ${gamification.level} · ${gamification.rankTitle} (${gamification.currentLevelXp}/${gamification.nextLevelXp} XP)`}
            >
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
              <span>Lv.{gamification.level}</span>
              <span className="hidden items-center gap-0.5 text-amber-700 sm:inline-flex dark:text-amber-300">
                <Flame className="h-3 w-3" />
                {gamification.streak}
              </span>
              {claimableQuests > 0 && (
                <span className="absolute -top-1 -right-1 h-2.5 w-2.5 animate-ping rounded-full bg-pink-500" />
              )}
            </button>
          )}
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-[116px] rounded-xl border border-[var(--border-card)] bg-[var(--bg-input)] px-2 py-1.5 text-xs font-semibold text-[var(--text-main)] focus:border-[var(--accent)] focus:outline-none sm:w-auto sm:px-2.5"
          />
          <button
            type="button"
            onClick={() =>
              void handleUpdateSettings({
                theme: settings.theme === 'pastel' ? 'dark' : 'pastel',
              })
            }
            className="rounded-xl border border-[var(--border-card)] bg-[var(--pastel-sky)] p-2 text-[var(--text-main)] transition hover:brightness-95"
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

      {/* Main Split Workspace: Melody on the LEFT + Content on the RIGHT (Study uses full-width 50/50 room split) */}
      <div
        className={`grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden p-3 pb-24 md:p-4 md:pb-4 ${
          activeTab === 'study' ? '' : 'lg:grid-cols-[340px_1fr]'
        }`}
      >
        {/* Persistent 3D Companion on the LEFT (hidden on Study tab where the 50/50 3D Study Room takes over) */}
        {activeTab !== 'study' && (
          <div className="hidden min-h-0 lg:block">
            <MelodyCompanion
              mood={mood}
              activeActivityLabel={runningEntry?.title ?? null}
              theme={settings.theme}
              eyeTracking={settings.eye_tracking}
            />
          </div>
        )}

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
                onOpenCategoryManager={() => setCategoryModalOpen(true)}
              />
              {/* On mobile, keep Today focused on Tasks & Routines; Time & Apps has its own clean tab */}
              <div className="hidden md:block">
                <ActivityTrackerPanel
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                  categories={categories}
                  entries={entries}
                  onEntriesChanged={() => void loadAll()}
                  onOpenCategoryManager={() => setCategoryModalOpen(true)}
                />
              </div>
            </div>
          )}

          {activeTab === 'study' && (
            <StudyPanel
              categories={categories}
              runningEntry={runningEntry}
              theme={settings.theme}
              eyeTracking={settings.eye_tracking}
              celebrating={mood === 'celebrate'}
              onEntriesChanged={() => void loadAll()}
              onCelebrate={triggerCelebrate}
              onOpenCategoryManager={() => setCategoryModalOpen(true)}
            />
          )}

          {activeTab === 'tracker' && (
            <ActivityTrackerPanel
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              categories={categories}
              entries={entries}
              onEntriesChanged={() => void loadAll()}
              onOpenCategoryManager={() => setCategoryModalOpen(true)}
            />
          )}

          {activeTab === 'quests' && (
            <QuestsProgressPanel
              gamification={gamification}
              selectedDate={selectedDate}
              onUpdated={setGamification}
              onCelebrate={triggerCelebrate}
            />
          )}

          {activeTab === 'journal' && (
            <JournalMemoryPanel
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              onCelebrate={() => {
                triggerCelebrate();
                void loadAll();
              }}
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
                onOpenCategoryManager={() => setCategoryModalOpen(true)}
              />
            </div>
          )}

          {activeTab === 'settings' && (
            <SettingsPanel
              settings={settings}
              categories={categories}
              networkInfo={networkInfo}
              onUpdateSettings={(patch) => void handleUpdateSettings(patch)}
              onOpenCategoryManager={() => setCategoryModalOpen(true)}
            />
          )}
        </main>
      </div>

      {/* Clean Mobile 4-Item Bottom Bar (Today, Study, Time, Menu) */}
      <nav className="fixed right-3 bottom-3 left-3 z-40 grid grid-cols-4 gap-1 rounded-3xl border border-[var(--border-card)] bg-[var(--bg-glass)] p-1.5 shadow-lg backdrop-blur md:hidden">
        {MOBILE_PRIMARY_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id && !mobileMenuOpen;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => navigateMobile(tab.id)}
              className={`flex flex-col items-center gap-0.5 rounded-2xl py-2 text-[11px] font-extrabold transition ${
                active ? 'text-[var(--text-main)] shadow-xs' : 'text-[var(--text-muted)]'
              }`}
              style={active ? { background: tab.activeBg } : undefined}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setMobileMenuOpen((v) => !v)}
          className={`relative flex flex-col items-center gap-0.5 rounded-2xl py-2 text-[11px] font-extrabold transition ${
            mobileMenuOpen ||
            activeTab === 'quests' ||
            activeTab === 'journal' ||
            activeTab === 'vault' ||
            activeTab === 'calendar' ||
            activeTab === 'settings'
              ? 'bg-[var(--pastel-pink)] text-[var(--text-main)] shadow-xs'
              : 'text-[var(--text-muted)]'
          }`}
        >
          <Menu className="h-4 w-4" />
          Menu
          {claimableQuests > 0 && (
            <span className="absolute top-1.5 right-4 h-2 w-2 rounded-full bg-amber-400" />
          )}
        </button>
      </nav>

      {/* Mobile Slide-Over Menu Sheet (Quests, Journal, Vault, Calendar, Settings) */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/40 backdrop-blur-xs md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="cozy-card cozy-card-sky w-full rounded-t-3xl p-5 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img src="/melody-logo.png" alt="Melody" className="h-7 w-7 object-contain" />
                <h3 className="text-sm font-black text-[var(--text-main)]">Explore Melody</h3>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-xl bg-[var(--bg-card)] p-1.5 text-[var(--text-muted)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                {
                  id: 'quests' as const,
                  label: claimableQuests > 0 ? `Quests (${claimableQuests}!)` : 'Quests & XP',
                  icon: Trophy,
                  bg: 'var(--pastel-pink)',
                },
                { id: 'journal' as const, label: 'Journal & Memories', icon: BookHeart, bg: 'var(--pastel-mint)' },
                { id: 'vault' as const, label: 'Photos & Voice', icon: FolderHeart, bg: 'var(--pastel-peach)' },
                { id: 'calendar' as const, label: 'Calendar', icon: CalendarDays, bg: 'var(--pastel-sky)' },
                { id: 'settings' as const, label: 'Settings & Categories', icon: Settings, bg: 'var(--pastel-butter)' },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigateMobile(item.id)}
                    className="flex flex-col items-start gap-2 rounded-2xl border border-[var(--border-card)] p-4 text-left transition active:scale-98"
                    style={{ background: item.bg }}
                  >
                    <Icon className="h-5 w-5 text-[var(--text-main)]" />
                    <span className="text-xs font-extrabold text-[var(--text-main)]">
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Custom Category Manager Modal */}
      <CategoryManagerModal
        open={categoryModalOpen}
        categories={categories}
        onClose={() => setCategoryModalOpen(false)}
        onCategoriesChanged={() => void loadAll()}
      />
    </div>
  );
}
