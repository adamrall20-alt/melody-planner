import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import type { Task } from '@shared/types';
import { api } from '@/lib/api';
import { toLocalDateStr } from '@/lib/date';

interface CalendarPanelProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function CalendarPanel({ selectedDate, onSelectDate }: CalendarPanelProps) {
  const [viewMonth, setViewMonth] = useState(() => {
    const [y, m] = selectedDate.split('-').map(Number);
    return new Date(y, m - 1, 1);
  });
  const [monthTasks, setMonthTasks] = useState<Task[]>([]);

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  useEffect(() => {
    const from = toLocalDateStr(new Date(year, month, 1));
    const to = toLocalDateStr(new Date(year, month + 1, 0));
    void api.getTasksRange(from, to).then(setMonthTasks);
  }, [year, month]);

  const tasksByDate = monthTasks.reduce<Record<string, Task[]>>((acc, task) => {
    (acc[task.due_date] ??= []).push(task);
    return acc;
  }, {});

  const todayStr = toLocalDateStr();
  const cells: (number | null)[] = [
    ...Array<null>(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <section className="cozy-card cozy-card-mint rounded-3xl p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--pastel-mint)] text-emerald-700 dark:text-emerald-300">
            <CalendarIcon className="h-4 w-4" />
          </div>
          <h2 className="text-base font-bold text-[var(--text-main)]">
            {viewMonth.toLocaleDateString([], { month: 'long', year: 'numeric' })}
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setViewMonth(new Date(year, month - 1, 1))}
            className="rounded-xl bg-[var(--bg-subtle)] p-2 text-[var(--text-main)]"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              const now = new Date();
              setViewMonth(new Date(now.getFullYear(), now.getMonth(), 1));
              onSelectDate(todayStr);
            }}
            className="rounded-xl bg-[var(--pastel-sky)] px-3 py-1.5 text-xs font-bold text-[var(--text-main)]"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setViewMonth(new Date(year, month + 1, 1))}
            className="rounded-xl bg-[var(--bg-subtle)] p-2 text-[var(--text-main)]"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-[var(--text-muted)]">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1.5">
        {cells.map((day, idx) => {
          if (day === null) {
            return <div key={`empty-${idx}`} className="h-14 rounded-2xl sm:h-20" />;
          }
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const dayTasks = tasksByDate[dateStr] ?? [];
          const isSelected = dateStr === selectedDate;
          const isToday = dateStr === todayStr;

          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => onSelectDate(dateStr)}
              className={`flex h-14 flex-col items-start justify-between rounded-2xl border p-1.5 text-left transition sm:h-20 sm:p-2 ${
                isSelected
                  ? 'border-[var(--accent)] bg-[var(--pastel-sky)]'
                  : 'border-[var(--border-card)] bg-[var(--bg-subtle)] hover:brightness-95'
              }`}
            >
              <span
                className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                  isToday
                    ? 'bg-[var(--accent)] text-[var(--accent-ink)]'
                    : 'text-[var(--text-main)]'
                }`}
              >
                {day}
              </span>
              {/* Mobile dot indicator, desktop title pills */}
              {dayTasks.length > 0 && (
                <>
                  <div className="flex gap-1 sm:hidden">
                    {dayTasks.slice(0, 3).map((t) => (
                      <span
                        key={t.id}
                        className={`h-1.5 w-1.5 rounded-full ${
                          t.completed ? 'bg-emerald-500' : 'bg-[var(--accent)]'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="hidden w-full space-y-0.5 overflow-hidden sm:block">
                    {dayTasks.slice(0, 2).map((t) => (
                      <div
                        key={t.id}
                        className={`truncate rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                          t.completed
                            ? 'bg-[var(--pastel-mint)] text-[var(--text-muted)] line-through'
                            : 'bg-[var(--bg-card)] text-[var(--text-main)]'
                        }`}
                      >
                        {t.title}
                      </div>
                    ))}
                    {dayTasks.length > 2 && (
                      <div className="text-[10px] text-[var(--text-muted)]">
                        +{dayTasks.length - 2} more
                      </div>
                    )}
                  </div>
                </>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
