import { useState } from 'react';
import { Plus, Trash2, X, Sparkles, Check } from 'lucide-react';
import type { Category } from '@shared/types';
import { api } from '@/lib/api';

interface CategoryManagerModalProps {
  open: boolean;
  categories: Category[];
  onClose: () => void;
  onCategoriesChanged: (createdCategory?: Category) => void;
}

const COLOR_SWATCHES = [
  '#f472b6', // melody pink
  '#38bdf8', // sky blue
  '#34d399', // mint green
  '#f59e0b', // warm butter/amber
  '#a78bfa', // soft lavender
  '#fb7185', // coral peach
  '#2dd4bf', // teal
  '#60a5fa', // periwinkle
  '#fb923c', // tangerine
  '#94a3b8', // slate
];

export function CategoryManagerModal({
  open,
  categories,
  onClose,
  onCategoriesChanged,
}: CategoryManagerModalProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLOR_SWATCHES[0]);
  const [isProductive, setIsProductive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const created = await api.createCategory({
        name: name.trim(),
        color,
        is_productive: isProductive,
      });
      setName('');
      onCategoriesChanged(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create category');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleProductive = async (cat: Category) => {
    await api.updateCategory(cat.id, { is_productive: !cat.is_productive });
    onCategoriesChanged();
  };

  const handleRecolor = async (cat: Category, nextColor: string) => {
    await api.updateCategory(cat.id, { color: nextColor });
    onCategoriesChanged();
  };

  const handleDelete = async (id: number) => {
    await api.deleteCategory(id);
    onCategoriesChanged();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="cozy-card cozy-card-sky w-full max-w-lg rounded-3xl p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[var(--pastel-pink)] text-pink-700 dark:text-pink-300">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[var(--text-main)]">
                Activity Categories
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                Create custom categories like Japanese, Gym, Art, or Reading.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-[var(--bg-subtle)] p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Create new category form */}
        <form
          onSubmit={(e) => void handleCreate(e)}
          className="mb-4 space-y-3 rounded-2xl border border-[var(--border-card)] bg-[var(--bg-card)] p-3.5"
        >
          <div className="flex gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="New category (e.g. Japanese, Guitar, Gym)..."
              className="flex-1 rounded-xl border border-[var(--border-card)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
            />
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="pastel-btn inline-flex items-center gap-1 rounded-xl px-4 py-2 text-xs font-bold disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Add
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {COLOR_SWATCHES.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  onClick={() => setColor(swatch)}
                  className="flex h-6 w-6 items-center justify-center rounded-full border-2 transition hover:scale-110"
                  style={{
                    backgroundColor: swatch,
                    borderColor: color === swatch ? 'var(--text-main)' : 'transparent',
                  }}
                  title={swatch}
                >
                  {color === swatch && <Check className="h-3 w-3 text-white drop-shadow" />}
                </button>
              ))}
              <label
                className="flex h-6 w-6 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-[var(--border-card)] bg-[var(--bg-subtle)] text-[10px] font-bold"
                title="Custom color"
              >
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-8 w-8 cursor-pointer opacity-0"
                />
              </label>
            </div>

            <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-[var(--text-main)]">
              <input
                type="checkbox"
                checked={isProductive}
                onChange={(e) => setIsProductive(e.target.checked)}
                className="h-3.5 w-3.5 accent-[var(--accent)]"
              />
              Counts for XP & Focus
            </label>
          </div>

          {error && <p className="text-xs font-semibold text-rose-500">{error}</p>}
        </form>

        {/* Existing categories list */}
        <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="flex items-center justify-between gap-2 rounded-2xl border border-[var(--border-card)] bg-[var(--bg-card)] px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <label className="relative h-5 w-5 shrink-0 cursor-pointer">
                  <span
                    className="block h-5 w-5 rounded-full ring-2 ring-white/80 dark:ring-black/30"
                    style={{ backgroundColor: cat.color }}
                  />
                  <input
                    type="color"
                    value={cat.color}
                    onChange={(e) => void handleRecolor(cat, e.target.value)}
                    className="absolute inset-0 cursor-pointer opacity-0"
                    title="Change color"
                  />
                </label>
                <span className="truncate text-sm font-bold text-[var(--text-main)]">
                  {cat.name}
                </span>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleToggleProductive(cat)}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold transition ${
                    cat.is_productive
                      ? 'bg-[var(--pastel-mint)] text-emerald-800 dark:text-emerald-200'
                      : 'bg-[var(--pastel-peach)] text-rose-800 dark:text-rose-200'
                  }`}
                >
                  {cat.is_productive ? 'XP On' : 'Relax'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(cat.id)}
                  className="rounded-lg p-1 text-[var(--text-muted)] transition hover:bg-rose-500/10 hover:text-rose-500"
                  title="Delete category"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
