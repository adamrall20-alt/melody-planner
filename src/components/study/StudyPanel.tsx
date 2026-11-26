import { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  BookOpen,
  Coffee,
  CheckCircle2,
  Save,
  Check,
  Plus,
  Trash2,
  FileText,
  FolderOpen,
  CloudRain,
  Flame,
  Waves,
  Volume2,
  VolumeX,
  Eye,
  Edit3,
  Columns2,
} from 'lucide-react';
import type { Category, StudyNote, TimeEntry } from '@shared/types';
import { api } from '@/lib/api';
import { formatClock, formatDuration } from '@/lib/date';
import { ambientAudio, type AmbientTrackId } from '@/lib/ambientAudio';
import { MarkdownPreview } from '@/components/study/MarkdownPreview';

interface StudyPanelProps {
  categories: Category[];
  runningEntry: TimeEntry | null;
  onEntriesChanged: () => void;
  onCelebrate: () => void;
  onOpenCategoryManager: () => void;
}

type StudyPhase = 'focus' | 'short_break' | 'long_break';
type EditorMode = 'edit' | 'split' | 'preview';

const PRESETS: { id: string; label: string; focusMin: number; breakMin: number }[] = [
  { id: '25-5', label: '25 / 5', focusMin: 25, breakMin: 5 },
  { id: '50-10', label: '50 / 10', focusMin: 50, breakMin: 10 },
  { id: '90-15', label: '90 / 15', focusMin: 90, breakMin: 15 },
];

const AMBIENT_TRACKS: {
  id: AmbientTrackId;
  label: string;
  icon: typeof CloudRain;
  bg: string;
}[] = [
  { id: 'rain', label: 'Soft Rain', icon: CloudRain, bg: 'var(--pastel-sky)' },
  { id: 'cafe', label: 'Cozy Hum', icon: Coffee, bg: 'var(--pastel-butter)' },
  { id: 'fire', label: 'Fireplace', icon: Flame, bg: 'var(--pastel-peach)' },
  { id: 'waves', label: 'Ocean Waves', icon: Waves, bg: 'var(--pastel-mint)' },
];

export function StudyPanel({
  categories,
  runningEntry,
  onEntriesChanged,
  onCelebrate,
  onOpenCategoryManager,
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
  const [allTimeStudySec, setAllTimeStudySec] = useState(0);
  const activeTimeEntryIdRef = useRef<number | null>(null);

  // Ambient audio state
  const [playingTracks, setPlayingTracks] = useState<Record<AmbientTrackId, boolean>>({
    rain: ambientAudio.isPlaying('rain'),
    cafe: ambientAudio.isPlaying('cafe'),
    fire: ambientAudio.isPlaying('fire'),
    waves: ambientAudio.isPlaying('waves'),
  });
  const [volumes, setVolumes] = useState<Record<AmbientTrackId, number>>({
    rain: ambientAudio.getVolume('rain'),
    cafe: ambientAudio.getVolume('cafe'),
    fire: ambientAudio.getVolume('fire'),
    waves: ambientAudio.getVolume('waves'),
  });

  // Obsidian-style markdown notes state
  const [notes, setNotes] = useState<StudyNote[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteFolder, setNoteFolder] = useState('General');
  const [noteContent, setNoteContent] = useState('');
  const [editorMode, setEditorMode] = useState<EditorMode>('split');
  const [notesSaved, setNotesSaved] = useState(false);

  const loadNotes = async (selectId?: number) => {
    try {
      const list = await api.getStudyNotes();
      setNotes(list);
      const targetId = selectId ?? selectedNoteId ?? list[0]?.id ?? null;
      const found = list.find((n) => n.id === targetId) ?? list[0] ?? null;
      if (found) {
        setSelectedNoteId(found.id);
        setNoteTitle(found.title);
        setNoteFolder(found.folder);
        setNoteContent(found.content);
      } else {
        setSelectedNoteId(null);
        setNoteTitle('');
        setNoteFolder('General');
        setNoteContent('');
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    void loadNotes();
  }, []);

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
          ambientAudio.playChime();
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
      const label = topic.trim() || noteTitle.trim() || 'Study Session';
      const created = await api.startTimer({
        title: label,
        category_id: categoryId,
        notes: noteTitle ? `Note: ${noteTitle}` : '',
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

  const handleToggleTrack = (id: AmbientTrackId) => {
    const playing = ambientAudio.toggleTrack(id);
    setPlayingTracks((prev) => ({ ...prev, [id]: playing }));
  };

  const handleVolumeChange = (id: AmbientTrackId, value: number) => {
    ambientAudio.setVolume(id, value);
    setVolumes((prev) => ({ ...prev, [id]: value }));
  };

  const handleStopAllAudio = () => {
    ambientAudio.stopAll();
    setPlayingTracks({ rain: false, cafe: false, fire: false, waves: false });
  };

  const handleSelectNote = (note: StudyNote) => {
    setSelectedNoteId(note.id);
    setNoteTitle(note.title);
    setNoteFolder(note.folder);
    setNoteContent(note.content);
  };

  const handleCreateNote = async () => {
    const selectedCat = categories.find((c) => c.id === categoryId);
    const created = await api.createStudyNote({
      title: topic.trim() || 'Untitled Study Note',
      folder: selectedCat?.name || 'General',
      content: `# ${topic.trim() || 'Untitled Study Note'}\n\n## Key Points\n- \n\n## Practice / Questions\n- [ ] \n`,
      category_id: categoryId,
    });
    await loadNotes(created.id);
  };

  const handleSaveNote = async () => {
    if (selectedNoteId === null) {
      const created = await api.createStudyNote({
        title: noteTitle.trim() || 'Untitled Study Note',
        folder: noteFolder.trim() || 'General',
        content: noteContent,
        category_id: categoryId,
      });
      await loadNotes(created.id);
    } else {
      await api.updateStudyNote(selectedNoteId, {
        title: noteTitle.trim() || 'Untitled Study Note',
        folder: noteFolder.trim() || 'General',
        content: noteContent,
        category_id: categoryId,
      });
      await loadNotes(selectedNoteId);
    }
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 1800);
  };

  const handleDeleteNote = async (id: number) => {
    await api.deleteStudyNote(id);
    await loadNotes();
  };

  const totalForPhase = getPhaseDuration(phase);
  const progressPct = Math.min(
    100,
    Math.max(0, Math.round(((totalForPhase - remainingSec) / totalForPhase) * 100))
  );
  const anyAudioPlaying = Object.values(playingTracks).some(Boolean);

  // Group notes by folder
  const notesByFolder = notes.reduce<Record<string, StudyNote[]>>((acc, n) => {
    const f = n.folder || 'General';
    (acc[f] ??= []).push(n);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Focus Timer + Ambient Audio */}
      <section className="cozy-card cozy-card-mint rounded-3xl p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[var(--pastel-mint)] text-emerald-700 dark:text-emerald-300">
              <BookOpen className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-[var(--text-main)]">Study Focus</h2>
              <p className="font-mono text-[11px] font-semibold text-[var(--text-muted)]">
                All-time studied: {formatDuration(allTimeStudySec)} · +{currentPreset.focusMin * 2} XP / session
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
        <div className="mt-4 flex justify-center gap-2">
          {[
            { id: 'focus' as const, label: 'Focus', icon: BookOpen, activeBg: 'var(--pastel-mint)' },
            { id: 'short_break' as const, label: 'Short Break', icon: Coffee, activeBg: 'var(--pastel-sky)' },
            { id: 'long_break' as const, label: 'Long Break', icon: Coffee, activeBg: 'var(--pastel-butter)' },
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
                    ? 'text-[var(--text-main)] ring-1 ring-[var(--accent)] shadow-xs'
                    : 'bg-[var(--bg-card)]/70 text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
                style={active ? { background: item.activeBg } : undefined}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Big Pomodoro Display */}
        <div
          className="mx-auto my-5 max-w-md rounded-3xl border border-[var(--border-card)] p-6 text-center shadow-xs"
          style={{
            background: phase === 'focus' ? 'var(--pastel-mint)' : 'var(--pastel-butter)',
          }}
        >
          <div className="font-mono text-5xl font-extrabold tracking-tight text-[var(--text-main)] sm:text-7xl">
            {formatClock(remainingSec)}
          </div>
          <div className="mx-auto mt-4 h-2.5 max-w-xs overflow-hidden rounded-full bg-black/10 dark:bg-white/15">
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="mt-2.5 text-xs font-semibold text-[var(--text-muted)]">
            {phase === 'focus'
              ? 'Focus time syncs to Time & Apps and earns XP automatically.'
              : 'Take a breather—breaks are not logged as focus time.'}
          </p>
        </div>

        {/* Topic & Category Sync Picker */}
        <div className="mx-auto flex max-w-xl flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="What are you studying? (e.g. Japanese Kanji, BA Lesson 2)"
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
              title="Add or manage custom categories"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="mt-4 flex items-center justify-center gap-3">
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
            className="inline-flex items-center gap-1.5 rounded-2xl bg-[var(--bg-card)] px-4 py-3 text-sm font-semibold text-[var(--text-main)] ring-1 ring-[var(--border-card)] transition hover:brightness-95"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>
        </div>

        {completedPomodoros > 0 && (
          <div className="mt-3 flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />
            {completedPomodoros} focus {completedPomodoros === 1 ? 'session' : 'sessions'} completed
          </div>
        )}

        {/* Cozy Ambient Soundscape Mixer */}
        <div className="mt-5 rounded-2xl border border-[var(--border-card)] bg-[var(--bg-card)]/85 p-3.5">
          <div className="mb-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-extrabold text-[var(--text-main)]">
              <Volume2 className="h-4 w-4 text-[var(--accent)]" />
              Ambient Focus Sounds
            </div>
            {anyAudioPlaying && (
              <button
                type="button"
                onClick={handleStopAllAudio}
                className="inline-flex items-center gap-1 rounded-xl bg-[var(--pastel-peach)] px-2.5 py-1 text-[11px] font-bold text-[var(--text-main)]"
              >
                <VolumeX className="h-3 w-3" />
                Mute All
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {AMBIENT_TRACKS.map((track) => {
              const Icon = track.icon;
              const active = playingTracks[track.id];
              return (
                <div
                  key={track.id}
                  className={`rounded-2xl border p-2.5 transition ${
                    active
                      ? 'border-[var(--accent)] shadow-xs'
                      : 'border-[var(--border-card)] bg-[var(--bg-subtle)]/60'
                  }`}
                  style={active ? { background: track.bg } : undefined}
                >
                  <button
                    type="button"
                    onClick={() => handleToggleTrack(track.id)}
                    className="flex w-full items-center gap-2 text-left text-xs font-bold text-[var(--text-main)]"
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{track.label}</span>
                  </button>
                  <input
                    type="range"
                    min={0.05}
                    max={1}
                    step={0.05}
                    value={volumes[track.id]}
                    onChange={(e) => handleVolumeChange(track.id, Number(e.target.value))}
                    className="mt-2 h-1.5 w-full cursor-pointer accent-[var(--accent)]"
                  />
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Obsidian-Style Markdown Study Notes */}
      <section className="cozy-card cozy-card-sky rounded-3xl p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--pastel-sky)] text-sky-700 dark:text-sky-300">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-[var(--text-main)]">
                Study Notes (Markdown)
              </h3>
              <p className="text-[11px] text-[var(--text-muted)]">
                Obsidian-style notes synced to your Drive folder
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <div className="flex items-center rounded-xl bg-[var(--bg-subtle)] p-0.5 text-[11px]">
              {(
                [
                  { id: 'edit', label: 'Edit', icon: Edit3 },
                  { id: 'split', label: 'Split', icon: Columns2 },
                  { id: 'preview', label: 'Read', icon: Eye },
                ] as const
              ).map((m) => {
                const Icon = m.icon;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setEditorMode(m.id)}
                    className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 font-bold transition ${
                      editorMode === m.id
                        ? 'bg-[var(--bg-card)] text-[var(--text-main)] shadow-xs'
                        : 'text-[var(--text-muted)]'
                    }`}
                  >
                    <Icon className="h-3 w-3" />
                    <span className="hidden sm:inline">{m.label}</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => void handleCreateNote()}
              className="inline-flex items-center gap-1 rounded-xl bg-[var(--pastel-mint)] px-3 py-1.5 text-xs font-bold text-[var(--text-main)] transition hover:brightness-95"
            >
              <Plus className="h-3.5 w-3.5" />
              New Note
            </button>

            <button
              type="button"
              onClick={() => void handleSaveNote()}
              className="pastel-btn inline-flex items-center gap-1 rounded-xl px-3.5 py-1.5 text-xs font-bold"
            >
              {notesSaved ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
              {notesSaved ? 'Saved' : 'Save'}
            </button>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[210px_1fr]">
          {/* Notes Sidebar */}
          <div className="max-h-60 space-y-2.5 overflow-y-auto rounded-2xl border border-[var(--border-card)] bg-[var(--bg-card)]/85 p-2.5 lg:max-h-[420px]">
            {Object.keys(notesByFolder).length === 0 ? (
              <p className="p-2 text-center text-xs text-[var(--text-muted)]">
                Click &quot;New Note&quot; to start writing.
              </p>
            ) : (
              Object.entries(notesByFolder).map(([folder, folderNotes]) => (
                <div key={folder}>
                  <div className="mb-1 flex items-center gap-1.5 px-1.5 text-[10px] font-extrabold tracking-wider text-[var(--text-muted)] uppercase">
                    <FolderOpen className="h-3 w-3 text-[var(--accent)]" />
                    {folder}
                  </div>
                  <div className="space-y-1">
                    {folderNotes.map((n) => {
                      const active = n.id === selectedNoteId;
                      return (
                        <div
                          key={n.id}
                          className={`group flex items-center justify-between rounded-xl px-2.5 py-1.5 text-xs transition ${
                            active
                              ? 'bg-[var(--pastel-sky)] font-bold text-[var(--text-main)]'
                              : 'text-[var(--text-main)] hover:bg-[var(--bg-subtle)]'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => handleSelectNote(n)}
                            className="min-w-0 flex-1 truncate text-left"
                          >
                            {n.title}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteNote(n.id)}
                            className="ml-1 text-[var(--text-muted)] opacity-60 hover:text-rose-500 sm:opacity-0 sm:group-hover:opacity-100"
                            title="Delete note"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Note Editor / Preview */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder="Note title..."
                className="flex-1 rounded-xl border border-[var(--border-card)] bg-[var(--bg-input)] px-3 py-2 text-sm font-bold text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
              />
              <input
                type="text"
                value={noteFolder}
                onChange={(e) => setNoteFolder(e.target.value)}
                placeholder="Folder (e.g. Japanese)"
                className="w-36 rounded-xl border border-[var(--border-card)] bg-[var(--bg-input)] px-3 py-2 text-xs font-semibold text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
              />
            </div>

            <div
              className={`grid gap-3 ${
                editorMode === 'split' ? 'md:grid-cols-2' : 'grid-cols-1'
              }`}
            >
              {(editorMode === 'edit' || editorMode === 'split') && (
                <textarea
                  rows={12}
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="# Lesson Notes&#10;- Write in Markdown&#10;- [ ] Add checklists"
                  className="w-full resize-y rounded-2xl border border-[var(--border-card)] bg-[var(--bg-input)] p-3.5 font-mono text-xs leading-relaxed text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
                />
              )}
              {(editorMode === 'preview' || editorMode === 'split') && (
                <div className="min-h-[240px] max-h-[380px] overflow-y-auto rounded-2xl border border-[var(--border-card)] bg-[var(--bg-card)] p-4">
                  {noteContent.trim() ? (
                    <MarkdownPreview content={noteContent} />
                  ) : (
                    <p className="text-xs text-[var(--text-muted)]">
                      Start typing Markdown to see your formatted preview here.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
