import { useEffect, useState } from 'react';
import { BookHeart, Sparkles, Save, Trash2, Plus, Check } from 'lucide-react';
import type { JournalEntry, MediaItem, MemoryItem } from '@shared/types';
import { api } from '@/lib/api';

interface JournalMemoryPanelProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onCelebrate: () => void;
}

const MEMORY_TAGS = ['Fun', 'Milestone', 'Cozy', 'Learning', 'Funny'];
const MOOD_LABELS = ['Rough', 'Low', 'Okay', 'Good', 'Great'];

export function JournalMemoryPanel({
  selectedDate,
  onSelectDate,
  onCelebrate,
}: JournalMemoryPanelProps) {
  const [subView, setSubView] = useState<'journal' | 'memories'>('journal');

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [learned, setLearned] = useState('');
  const [challenge, setChallenge] = useState('');
  const [gratitude, setGratitude] = useState('');
  const [moodRating, setMoodRating] = useState(3);
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [recentJournals, setRecentJournals] = useState<JournalEntry[]>([]);

  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [images, setImages] = useState<MediaItem[]>([]);
  const [filterTag, setFilterTag] = useState<string>('');
  const [memTitle, setMemTitle] = useState('');
  const [memDesc, setMemDesc] = useState('');
  const [memTag, setMemTag] = useState('Fun');
  const [memImageId, setMemImageId] = useState<number | null>(null);

  const loadJournalData = async () => {
    try {
      const [entry, recent] = await Promise.all([
        api.getJournal(selectedDate),
        api.getRecentJournals(12),
      ]);
      setTitle(entry.title || '');
      setContent(entry.content || '');
      setLearned(entry.reflection_learned || '');
      setChallenge(entry.reflection_challenge || '');
      setGratitude(entry.reflection_gratitude || '');
      setMoodRating(entry.mood_rating || 3);
      setRecentJournals(recent);
    } catch (err) {
      console.error(err);
    }
  };

  const loadMemoriesData = async () => {
    try {
      const [mems, imgs] = await Promise.all([
        api.getMemories(filterTag || undefined),
        api.getMedia('image'),
      ]);
      setMemories(mems);
      setImages(imgs);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    void loadJournalData();
  }, [selectedDate]);

  useEffect(() => {
    void loadMemoriesData();
  }, [filterTag]);

  const handleSaveJournal = async () => {
    setSaving(true);
    try {
      await api.saveJournal(selectedDate, {
        title,
        content,
        reflection_learned: learned,
        reflection_challenge: challenge,
        reflection_gratitude: gratitude,
        mood_rating: moodRating,
      });
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 2000);
      const recent = await api.getRecentJournals(12);
      setRecentJournals(recent);
    } finally {
      setSaving(false);
    }
  };

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memTitle.trim()) return;
    await api.createMemory({
      memory_date: selectedDate,
      title: memTitle.trim(),
      description: memDesc.trim(),
      tag: memTag,
      media_id: memImageId,
    });
    setMemTitle('');
    setMemDesc('');
    setMemImageId(null);
    onCelebrate();
    void loadMemoriesData();
  };

  const handleDeleteMemory = async (id: number) => {
    await api.deleteMemory(id);
    void loadMemoriesData();
  };

  return (
    <div className="space-y-4">
      {/* Clean Pill Sub-navigation */}
      <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-[var(--bg-subtle)] p-1 sm:inline-grid sm:w-auto">
        <button
          type="button"
          onClick={() => setSubView('journal')}
          className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition ${
            subView === 'journal'
              ? 'bg-[var(--bg-card)] text-[var(--text-main)] shadow-sm'
              : 'text-[var(--text-muted)]'
          }`}
        >
          <BookHeart className="h-3.5 w-3.5" />
          Journal
        </button>
        <button
          type="button"
          onClick={() => setSubView('memories')}
          className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition ${
            subView === 'memories'
              ? 'bg-[var(--bg-card)] text-[var(--text-main)] shadow-sm'
              : 'text-[var(--text-muted)]'
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Memories ({memories.length})
        </button>
      </div>

      {subView === 'journal' ? (
        <div className="grid gap-4 xl:grid-cols-[1fr_240px]">
          <section className="cozy-card space-y-4 rounded-3xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={`Journal — ${selectedDate}`}
                className="flex-1 bg-transparent text-lg font-bold text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => void handleSaveJournal()}
                disabled={saving}
                className="pastel-btn inline-flex items-center gap-1.5 rounded-2xl px-4 py-2 text-xs font-bold disabled:opacity-60"
              >
                {savedToast ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
                {savedToast ? 'Saved' : saving ? 'Saving...' : 'Save'}
              </button>
            </div>

            {/* Day Mood Rating */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-[var(--text-muted)]">Today felt:</span>
              <div className="flex flex-wrap gap-1.5">
                {MOOD_LABELS.map((label, idx) => {
                  const val = idx + 1;
                  const active = moodRating === val;
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setMoodRating(val)}
                      className={`rounded-full px-3 py-1 font-bold transition ${
                        active
                          ? 'bg-[var(--pastel-butter)] text-[var(--text-main)] ring-1 ring-[var(--accent)]'
                          : 'bg-[var(--bg-subtle)] text-[var(--text-muted)]'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Structured Daily Reflection Prompts */}
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl p-3.5" style={{ background: 'var(--pastel-mint)' }}>
                <label className="mb-1.5 block text-[11px] font-bold tracking-wider text-[var(--text-main)] uppercase">
                  Learned Something New
                </label>
                <textarea
                  rows={3}
                  value={learned}
                  onChange={(e) => setLearned(e.target.value)}
                  placeholder="One concept, insight, or skill..."
                  className="w-full resize-none bg-transparent text-xs text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none"
                />
              </div>
              <div className="rounded-2xl p-3.5" style={{ background: 'var(--pastel-sky)' }}>
                <label className="mb-1.5 block text-[11px] font-bold tracking-wider text-[var(--text-main)] uppercase">
                  Challenged Myself
                </label>
                <textarea
                  rows={3}
                  value={challenge}
                  onChange={(e) => setChallenge(e.target.value)}
                  placeholder="Stepped out of comfort zone..."
                  className="w-full resize-none bg-transparent text-xs text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none"
                />
              </div>
              <div className="rounded-2xl p-3.5" style={{ background: 'var(--pastel-peach)' }}>
                <label className="mb-1.5 block text-[11px] font-bold tracking-wider text-[var(--text-main)] uppercase">
                  Highlight / Reflection
                </label>
                <textarea
                  rows={3}
                  value={gratitude}
                  onChange={(e) => setGratitude(e.target.value)}
                  placeholder="Best moment or takeaway..."
                  className="w-full resize-none bg-transparent text-xs text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none"
                />
              </div>
            </div>

            {/* Freeform Journal */}
            <div>
              <label className="mb-1.5 block text-[11px] font-bold tracking-wider text-[var(--text-muted)] uppercase">
                Freeform Notes
              </label>
              <textarea
                rows={8}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write freely about your day..."
                className="w-full resize-y rounded-2xl border border-[var(--border-card)] bg-[var(--bg-input)] p-3.5 text-sm leading-relaxed text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
              />
            </div>
          </section>

          <aside className="cozy-card rounded-3xl p-4">
            <h3 className="mb-2.5 text-xs font-bold tracking-wider text-[var(--text-muted)] uppercase">
              Recent Entries
            </h3>
            {recentJournals.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">No saved entries yet.</p>
            ) : (
              <div className="space-y-1.5">
                {recentJournals.map((entry) => {
                  const active = entry.entry_date === selectedDate;
                  return (
                    <button
                      key={entry.entry_date}
                      type="button"
                      onClick={() => onSelectDate(entry.entry_date)}
                      className={`w-full rounded-2xl px-3 py-2 text-left transition ${
                        active
                          ? 'bg-[var(--pastel-sky)] text-[var(--text-main)] ring-1 ring-[var(--accent)]'
                          : 'bg-[var(--bg-subtle)] text-[var(--text-main)]'
                      }`}
                    >
                      <p className="font-mono text-[11px] text-[var(--text-muted)]">
                        {entry.entry_date}
                      </p>
                      <p className="truncate text-xs font-bold">
                        {entry.title || entry.content?.slice(0, 32) || 'Untitled Entry'}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </aside>
        </div>
      ) : (
        <div className="space-y-4">
          <section className="cozy-card rounded-3xl p-5">
            <h3 className="mb-3 text-sm font-bold text-[var(--text-main)]">Save a Memory</h3>
            <form onSubmit={(e) => void handleAddMemory(e)} className="space-y-2.5">
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  value={memTitle}
                  onChange={(e) => setMemTitle(e.target.value)}
                  placeholder="What fun or memorable thing happened?"
                  className="flex-1 rounded-2xl border border-[var(--border-card)] bg-[var(--bg-input)] px-3.5 py-2.5 text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
                />
                <div className="flex gap-2">
                  <select
                    value={memTag}
                    onChange={(e) => setMemTag(e.target.value)}
                    className="rounded-2xl border border-[var(--border-card)] bg-[var(--bg-input)] px-3 py-2 text-xs font-semibold text-[var(--text-main)]"
                  >
                    {MEMORY_TAGS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  {images.length > 0 && (
                    <select
                      value={memImageId ?? ''}
                      onChange={(e) =>
                        setMemImageId(e.target.value ? Number(e.target.value) : null)
                      }
                      className="rounded-2xl border border-[var(--border-card)] bg-[var(--bg-input)] px-3 py-2 text-xs text-[var(--text-main)]"
                    >
                      <option value="">Attach photo</option>
                      {images.map((img) => (
                        <option key={img.id} value={img.id}>
                          {img.title}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={memDesc}
                  onChange={(e) => setMemDesc(e.target.value)}
                  placeholder="Add a short story or details..."
                  className="flex-1 rounded-2xl border border-[var(--border-card)] bg-[var(--bg-input)] px-3.5 py-2 text-xs text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
                />
                <button
                  type="submit"
                  className="pastel-btn inline-flex items-center gap-1 rounded-2xl px-4 py-2 text-xs font-bold"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Save
                </button>
              </div>
            </form>
          </section>

          <div className="flex flex-wrap gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setFilterTag('')}
              className={`rounded-full px-3 py-1 font-bold transition ${
                filterTag === ''
                  ? 'bg-[var(--pastel-sky)] text-[var(--text-main)] ring-1 ring-[var(--accent)]'
                  : 'bg-[var(--bg-subtle)] text-[var(--text-muted)]'
              }`}
            >
              All
            </button>
            {MEMORY_TAGS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setFilterTag(t)}
                className={`rounded-full px-3 py-1 font-bold transition ${
                  filterTag === t
                    ? 'bg-[var(--pastel-sky)] text-[var(--text-main)] ring-1 ring-[var(--accent)]'
                    : 'bg-[var(--bg-subtle)] text-[var(--text-muted)]'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {memories.length === 0 ? (
            <div className="cozy-card rounded-3xl p-8 text-center text-xs text-[var(--text-muted)]">
              No memories saved yet. Capture a fun moment from today!
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {memories.map((mem) => (
                <article
                  key={mem.id}
                  className="cozy-card group flex flex-col overflow-hidden rounded-3xl"
                >
                  {mem.media_url && (
                    <img src={mem.media_url} alt={mem.title} className="h-40 w-full object-cover" />
                  )}
                  <div className="flex flex-1 flex-col justify-between p-4">
                    <div>
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <span className="rounded-full bg-[var(--pastel-butter)] px-2.5 py-0.5 text-[10px] font-bold text-[var(--text-main)]">
                          {mem.tag}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] text-[var(--text-muted)]">
                            {mem.memory_date}
                          </span>
                          <button
                            type="button"
                            onClick={() => void handleDeleteMemory(mem.id)}
                            className="text-[var(--text-muted)] opacity-60 transition hover:text-rose-500 sm:opacity-0 sm:group-hover:opacity-100"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <h4 className="text-sm font-bold text-[var(--text-main)]">{mem.title}</h4>
                      {mem.description && (
                        <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
                          {mem.description}
                        </p>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
