import { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, BookOpen, Coffee, CheckCircle2, Save, Check } from 'lucide-react';
import type { Category, TimeEntry } from '@shared/types';
import { api } from '@/lib/api';
import { formatClock, formatDuration } from '@/lib/date';

interface StudyPanelProps {
  categories: Category[];
  runningEntry: TimeEntry | null;
  initialNotes: string;
  onSaveNotes: (notes: string) => void;
  onEntriesChanged: () => void;
  onCelebrate: () => void;
}

type StudyPhase = 'focus' | 'short_break' | 'long_break';

const PRESETS: { id: string; label: string; focusMin: number; breakMin: number }[] = [
  { id: '25-5', label: '25 / 5', focusMin: 25, breakMin: 5 },
  { id: '50-10', label: '50 / 10', focusMin: 50, breakMin: 10 },
  { id: '90-15', label: '90 / 15', focusMin: 90, breakMin: 15 },
];

export function StudyPanel({
  categories,
  runningEntry,
  initialNotes,
  onSaveNotes,
  onEntriesChanged,
  onCelebrate,
}: StudyPanelProps) {
  const studyDefault =
    categories.find((c) => c.name.toLowerCase() === 'study')?.id ?? categories[0]?.id ?? null;

  const [presetId, setPresetId] = useState('25-5');
  const [phase, setPhase] = useState<StudyPhase>('focus');
  const [topic, setTopic] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(studyDefault);
  const [remainingSec, setRemainingSec] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [completedPomodoros, setCompletedPomodoros] = useState(0);
  const [sessionNotes, setSessionNotes] = useState(initialNotes);
  const [notesSaved, setNotesSaved] = useState(false);
  const [allTimeStudySec, setAllTimeStudySec] = useState(0);
  const activeTimeEntryIdRef = useRef<number | null>(null);

  useEffect(() => {
    setSessionNotes(initialNotes);
  }, [initialNotes]);

  useEffect(() => {
    void api.getAllTimeTotals().then((t) => setAllTimeStudySec(t.study_sec)).catch(() => {});
  }, [runningEntry, completedPomodoros]);

  useEffect(() => {
    if (categoryId === null && studyDefault !== null) {
      setCategoryId(studyDefault);
    }
  }, [studyDefault, categoryId]);

  const currentPreset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[0];

  const getPhaseDuration = (p: StudyPhase, preset = currentPreset) => {
    if (p === 'focus') return preset.focusMin * 60;
    if (p === 'short_break') return preset.breakMin * 60;
    return Math.max(15, preset.breakMin * 2) * 60;
  };

  const stopSyncedTimer = async () => {
    const idToStop = activeTimeEntryIdRef.current ?? runningEntry?.id ?? null;
    if (idToStop !== null) {
      activeTimeEntryIdRef.current = null;
      await api.stopTimer(idToStop);
      onEntriesChanged();
    }
  };

  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => {
      setRemainingSec((prev) => {
        if (prev <= 1) {
          setIsRunning(false);
          if (phase === 'focus') {
            setCompletedPomodoros((c) => c + 1);
            void stopSyncedTimer();
            onCelebrate();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [isRunning, phase]);

  const handleStartPause = async () => {
    if (isRunning) {
      setIsRunning(false);
      if (phase === 'focus') {
        await stopSyncedTimer();
      }
      return;
    }

    if (remainingSec <= 0) {
      setRemainingSec(getPhaseDuration(phase));
    }

    if (phase === 'focus') {
      const label = topic.trim() || 'Study Session';
      const created = await api.startTimer({
        title: label,
        category_id: categoryId,
        notes: sessionNotes,
      });
      activeTimeEntryIdRef.current = created.id;
      onEntriesChanged();
    }
    setIsRunning(true);
  };

  const handleReset = async () => {
    setIsRunning(false);
    if (phase === 'focus') {
      await stopSyncedTimer();
    }
    setRemainingSec(getPhaseDuration(phase));
  };

  const handleSelectPhase = async (nextPhase: StudyPhase) => {
    if (isRunning && phase === 'focus') {
      await stopSyncedTimer();
    }
    setIsRunning(false);
    setPhase(nextPhase);
    setRemainingSec(getPhaseDuration(nextPhase));
  };

  const handleSelectPreset = async (nextPresetId: string) => {
    const nextPreset = PRESETS.find((p) => p.id === nextPresetId) ?? PRESETS[0];
    if (isRunning && phase === 'focus') {
      await stopSyncedTimer();
    }
    setIsRunning(false);
    setPresetId(nextPresetId);
    setRemainingSec(getPhaseDuration(phase, nextPreset));
  };

  const handleSaveStudyNotes = () => {
    onSaveNotes(sessionNotes);
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 1800);
  };

  const totalForPhase = getPhaseDuration(phase);
  const progressPct = Math.min(
    100,
    Math.max(0, Math.round(((totalForPhase - remainingSec) / totalForPhase) * 100))
  );

  return (
    <div className="space-y-4">
      <section className="cozy-card rounded-3xl p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--pastel-mint)] text-emerald-700 dark:text-emerald-300">
              <BookOpen className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[var(--text-main)]">Study Focus</h2>
              <p className="font-mono text-[11px] font-semibold text-[var(--text-muted)]">
                All-time studied: {formatDuration(allTimeStudySec)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 rounded-2xl bg-[var(--bg-subtle)] p-1 text-xs">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => void handleSelectPreset(p.id)}
                className={`rounded-xl px-2.5 py-1 font-bold transition ${
                  presetId === p.id
                    ? 'bg-[var(--bg-card)] text-[var(--text-main)] shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Phase switcher */}
        <div className="mt-5 flex justify-center gap-2">
          {[
            { id: 'focus' as const, label: 'Focus', icon: BookOpen },
            { id: 'short_break' as const, label: 'Short Break', icon: Coffee },
            { id: 'long_break' as const, label: 'Long Break', icon: Coffee },
          ].map((item) => {
            const Icon = item.icon;
            const active = phase === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => void handleSelectPhase(item.id)}
                className={`inline-flex items-center gap-1.5 rounded-2xl px-3.5 py-2 text-xs font-bold transition ${
                  active
                    ? 'bg-[var(--pastel-sky)] text-[var(--text-main)] ring-1 ring-[var(--border-card)]'
                    : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Big Pomodoro Display */}
        <div
          className="mx-auto my-6 max-w-md rounded-3xl p-6 text-center"
          style={{
            background: phase === 'focus' ? 'var(--pastel-mint)' : 'var(--pastel-butter)',
          }}
        >
          <div className="font-mono text-5xl font-extrabold tracking-tight text-[var(--text-main)] sm:text-7xl">
            {formatClock(remainingSec)}
          </div>
          <div className="mx-auto mt-4 h-2 max-w-xs overflow-hidden rounded-full bg-black/10">
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="mt-2.5 text-xs font-medium text-[var(--text-muted)]">
            {phase === 'focus'
              ? 'Focus time automatically syncs to Time & Apps and Google Drive.'
              : 'Take a breather—breaks are not logged as focus time.'}
          </p>
        </div>

        {/* Topic & Category Sync Picker */}
        <div className="mx-auto flex max-w-xl flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="What are you studying? (e.g. BA Lesson 2)"
            className="flex-1 rounded-2xl border border-[var(--border-card)] bg-[var(--bg-input)] px-3.5 py-2.5 text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
          />
          <select
            value={categoryId ?? ''}
            onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
            className="rounded-2xl border border-[var(--border-card)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-main)] focus:border-[var(--accent)] focus:outline-none"
          >
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                Sync to: {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Controls */}
        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => void handleStartPause()}
            className="pastel-btn inline-flex items-center gap-2 rounded-2xl px-7 py-3 text-sm font-bold"
          >
            {isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
            {isRunning ? 'Pause' : 'Start Session'}
          </button>
          <button
            type="button"
            onClick={() => void handleReset()}
            className="inline-flex items-center gap-1.5 rounded-2xl bg-[var(--bg-subtle)] px-4 py-3 text-sm font-semibold text-[var(--text-main)] transition hover:brightness-95"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>
        </div>

        {completedPomodoros > 0 && (
          <div className="mt-4 flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            {completedPomodoros} focus {completedPomodoros === 1 ? 'session' : 'sessions'} completed
          </div>
        )}
      </section>

      {/* Synced Study Scratchpad */}
      <section className="cozy-card rounded-3xl p-5">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-bold tracking-wider text-[var(--text-muted)] uppercase">
            Study Notes (Synced to Drive)
          </h3>
          <button
            type="button"
            onClick={handleSaveStudyNotes}
            className="inline-flex items-center gap-1 rounded-xl bg-[var(--pastel-sky)] px-3 py-1 text-xs font-bold text-[var(--text-main)]"
          >
            {notesSaved ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
            {notesSaved ? 'Synced' : 'Save'}
          </button>
        </div>
        <textarea
          rows={5}
          value={sessionNotes}
          onChange={(e) => setSessionNotes(e.target.value)}
          placeholder="Jot down key takeaways, questions, or what to review next..."
          className="w-full resize-none rounded-2xl border border-[var(--border-card)] bg-[var(--bg-input)] p-3.5 text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
        />
      </section>
    </div>
  );
}
