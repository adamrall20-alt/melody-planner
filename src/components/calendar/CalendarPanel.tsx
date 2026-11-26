import { useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  RefreshCw,
  Download,
} from 'lucide-react';
import type { CalendarEvent, Task } from '@shared/types';
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
  const [googleEvents, setGoogleEvents] = useState<CalendarEvent[]>([]);
  const [gcalConnected, setGcalConnected] = useState(false);
  const [syncingCal, setSyncingCal] = useState(false);

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const loadMonth = async (forceRefresh = false) => {
    const from = toLocalDateStr(new Date(year, month, 1));
    const to = toLocalDateStr(new Date(year, month + 1, 0));
    if (forceRefresh) setSyncingCal(true);
    try {
      const [tasks, gcal] = await Promise.all([
        api.getTasksRange(from, to),
        api.getGoogleCalendarEvents(from, to, forceRefresh).catch(() => ({
          connected: false,
          events: [] as CalendarEvent[],
        })),
      ]);
      setMonthTasks(tasks);
      setGcalConnected(gcal.connected);
      setGoogleEvents(gcal.events);
    } finally {
      if (forceRefresh) setSyncingCal(false);
    }
  };

  useEffect(() => {
    void loadMonth(false);
  }, [year, month]);

  const tasksByDate = monthTasks.reduce<Record<string, Task[]>>((acc, task) => {
    (acc[task.due_date] ??= []).push(task);
    return acc;
  }, {});

  const eventsByDate = googleEvents.reduce<Record<string, CalendarEvent[]>>((acc, ev) => {
    (acc[ev.date] ??= []).push(ev);
    return acc;
  }, {});

  const selectedDayEvents = eventsByDate[selectedDate] ?? [];

  const todayStr = toLocalDateStr();
  const cells: (number | null)[] = [
    ...Array<null>(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <section className="cozy-card cozy-card-mint rounded-3xl p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--pastel-mint)] text-emerald-700 dark:text-emerald-300">
            <CalendarIcon className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-[var(--text-main)]">
              {viewMonth.toLocaleDateString([], { month: 'long', year: 'numeric' })}
            </h2>
            {gcalConnected && (
              <p className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">
                Google Calendar synced ({googleEvents.length} events this month)
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {gcalConnected && (
            <button
              type="button"
              onClick={() => void loadMonth(true)}
              className="inline-flex items-center gap-1 rounded-xl bg-[var(--pastel-lavender)] px-2.5 py-1.5 text-xs font-bold text-[var(--text-main)]"
              title="Refresh Google Calendar"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncingCal ? 'animate-spin' : ''}`} />
              Sync
            </button>
          )}
          <a
            href="/api/calendar/export.ics"
            download="melody-planner.ics"
            className="inline-flex items-center gap-1 rounded-xl bg-[var(--bg-card)] px-2.5 py-1.5 text-xs font-bold text-[var(--text-main)] ring-1 ring-[var(--border-card)]"
            title="Export Melody tasks as .ics"
          >
            <Download className="h-3.5 w-3.5" />
            .ics
          </a>
          <button
            type="button"
            onClick={() => setViewMonth(new Date(year, month - 1, 1))}
            className="rounded-xl bg-[var(--bg-card)] p-2 text-[var(--text-main)]"
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
            className="rounded-xl bg-[var(--bg-card)] p-2 text-[var(--text-main)]"
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
          const dayEvents = eventsByDate[dateStr] ?? [];
          const totalItems = dayTasks.length + dayEvents.length;
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
                  : 'border-[var(--border-card)] bg-[var(--bg-card)]/75 hover:brightness-95'
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
              {totalItems > 0 && (
                <>
                  <div className="flex gap-1 sm:hidden">
                    {dayEvents.slice(0, 2).map((ev) => (
                      <span key={ev.id} className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                    ))}
                    {dayTasks.slice(0, 2).map((t) => (
                      <span
                        key={t.id}
                        className={`h-1.5 w-1.5 rounded-full ${
                          t.completed ? 'bg-emerald-500' : 'bg-[var(--accent)]'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="hidden w-full space-y-0.5 overflow-hidden sm:block">
                    {dayEvents.slice(0, 1).map((ev) => (
                      <div
                        key={ev.id}
                        className="truncate rounded-md bg-[var(--pastel-lavender)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--text-main)]"
                      >
                        {ev.start_time ? `${ev.start_time} ` : ''}
                        {ev.title}
                      </div>
                    ))}
                    {dayTasks.slice(0, dayEvents.length > 0 ? 1 : 2).map((t) => (
                      <div
                        key={t.id}
                        className={`truncate rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                          t.completed
                            ? 'bg-[var(--pastel-mint)] text-[var(--text-muted)] line-through'
                            : 'bg-[var(--bg-subtle)] text-[var(--text-main)]'
                        }`}
                      >
                        {t.title}
                      </div>
                    ))}
                    {totalItems > 2 && (
                      <div className="text-[10px] text-[var(--text-muted)]">
                        +{totalItems - 2} more
                      </div>
                    )}
                  </div>
                </>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected Day Google Calendar Events */}
      {selectedDayEvents.length > 0 && (
        <div className="mt-4 rounded-2xl border border-[var(--border-card)] bg-[var(--pastel-lavender)]/60 p-3.5">
          <h3 className="mb-2 text-xs font-extrabold text-[var(--text-main)]">
            Google Calendar · {selectedDate}
          </h3>
          <div className="space-y-1.5">
            {selectedDayEvents.map((ev) => (
              <div
                key={ev.id}
                className="flex items-center justify-between gap-2 rounded-xl bg-[var(--bg-card)]/90 px-3 py-2 text-xs"
              >
                <span className="font-bold text-[var(--text-main)]">{ev.title}</span>
                <span className="font-mono text-[11px] text-[var(--text-muted)]">
                  {ev.all_day ? 'All day' : ev.start_time || ''}
                  {ev.end_time ? ` – ${ev.end_time}` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
