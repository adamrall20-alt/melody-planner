import { useState } from 'react';
import { CheckCircle2, Circle, Plus, Trash2, Flame, ListChecks } from 'lucide-react';
import type { Category, Routine, Task } from '@shared/types';
import { api } from '@/lib/api';

interface TasksRoutinesPanelProps {
  selectedDate: string;
  categories: Category[];
  tasks: Task[];
  routines: Routine[];
  onTasksChanged: () => void;
  onRoutinesChanged: () => void;
  onCelebrate: () => void;
}

const TIME_SLOTS: { id: Routine['time_of_day']; label: string; bg: string }[] = [
  { id: 'morning', label: 'Morning', bg: 'var(--pastel-butter)' },
  { id: 'afternoon', label: 'Afternoon', bg: 'var(--pastel-sky)' },
  { id: 'evening', label: 'Evening', bg: 'var(--pastel-peach)' },
  { id: 'anytime', label: 'Anytime', bg: 'var(--pastel-mint)' },
];

export function TasksRoutinesPanel({
  selectedDate,
  categories,
  tasks,
  routines,
  onTasksChanged,
  onRoutinesChanged,
  onCelebrate,
}: TasksRoutinesPanelProps) {
  const [mobileSection, setMobileSection] = useState<'tasks' | 'routines'>('tasks');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskTime, setTaskTime] = useState('');
  const [taskPriority, setTaskPriority] = useState<Task['priority']>('medium');
  const [taskCategoryId, setTaskCategoryId] = useState<number | null>(null);

  const [routineTitle, setRoutineTitle] = useState('');
  const [routineSlot, setRoutineSlot] = useState<Routine['time_of_day']>('morning');

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    await api.createTask({
      title: taskTitle.trim(),
      due_date: selectedDate,
      scheduled_start: taskTime || null,
      priority: taskPriority,
      category_id: taskCategoryId,
    });
    setTaskTitle('');
    setTaskTime('');
    onTasksChanged();
  };

  const handleToggleTask = async (task: Task) => {
    const nextCompleted = task.completed ? 0 : 1;
    await api.updateTask(task.id, { completed: nextCompleted });
    if (nextCompleted === 1) onCelebrate();
    onTasksChanged();
  };

  const handleDeleteTask = async (id: number) => {
    await api.deleteTask(id);
    onTasksChanged();
  };

  const handleAddRoutine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!routineTitle.trim()) return;
    await api.createRoutine({
      title: routineTitle.trim(),
      time_of_day: routineSlot,
      target_minutes: 15,
    });
    setRoutineTitle('');
    onRoutinesChanged();
  };

  const handleToggleRoutine = async (routine: Routine) => {
    const res = await api.toggleRoutine(routine.id, selectedDate);
    if (res.completed_today) onCelebrate();
    onRoutinesChanged();
  };

  const handleDeleteRoutine = async (id: number) => {
    await api.deleteRoutine(id);
    onRoutinesChanged();
  };

  const completedTasks = tasks.filter((t) => t.completed === 1).length;
  const completedRoutines = routines.filter((r) => r.completed_today).length;

  return (
    <div className="space-y-4">
      {/* Mobile-only clean pill switcher between Tasks and Routines */}
      <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-[var(--bg-subtle)] p-1 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileSection('tasks')}
          className={`rounded-xl py-2 text-xs font-bold transition ${
            mobileSection === 'tasks'
              ? 'bg-[var(--bg-card)] text-[var(--text-main)] shadow-sm'
              : 'text-[var(--text-muted)]'
          }`}
        >
          Tasks ({completedTasks}/{tasks.length})
        </button>
        <button
          type="button"
          onClick={() => setMobileSection('routines')}
          className={`rounded-xl py-2 text-xs font-bold transition ${
            mobileSection === 'routines'
              ? 'bg-[var(--bg-card)] text-[var(--text-main)] shadow-sm'
              : 'text-[var(--text-muted)]'
          }`}
        >
          Routines ({completedRoutines}/{routines.length})
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Daily Tasks */}
        <section
          className={`cozy-card rounded-3xl p-5 ${
            mobileSection === 'tasks' ? 'block' : 'hidden lg:block'
          }`}
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--pastel-sky)] text-sky-700 dark:text-sky-300">
                <ListChecks className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-bold text-[var(--text-main)]">Daily Tasks</h2>
            </div>
            <span className="rounded-full bg-[var(--pastel-mint)] px-2.5 py-0.5 text-xs font-bold text-[var(--text-main)]">
              {completedTasks}/{tasks.length}
            </span>
          </div>

          <form onSubmit={(e) => void handleAddTask(e)} className="mb-4 space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="Add a task for today..."
                className="flex-1 rounded-2xl border border-[var(--border-card)] bg-[var(--bg-input)] px-3.5 py-2.5 text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
              />
              <button
                type="submit"
                className="pastel-btn inline-flex items-center gap-1 rounded-2xl px-4 py-2 text-xs font-bold"
              >
                <Plus className="h-4 w-4" />
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <input
                type="time"
                value={taskTime}
                onChange={(e) => setTaskTime(e.target.value)}
                className="rounded-xl border border-[var(--border-card)] bg-[var(--bg-input)] px-2.5 py-1.5 text-[var(--text-main)]"
              />
              <select
                value={taskPriority}
                onChange={(e) => setTaskPriority(e.target.value as Task['priority'])}
                className="rounded-xl border border-[var(--border-card)] bg-[var(--bg-input)] px-2.5 py-1.5 text-[var(--text-main)]"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <select
                value={taskCategoryId ?? ''}
                onChange={(e) =>
                  setTaskCategoryId(e.target.value ? Number(e.target.value) : null)
                }
                className="rounded-xl border border-[var(--border-card)] bg-[var(--bg-input)] px-2.5 py-1.5 text-[var(--text-main)]"
              >
                <option value="">No category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </form>

          <div className="space-y-2">
            {tasks.length === 0 ? (
              <p className="py-6 text-center text-xs text-[var(--text-muted)]">
                No tasks scheduled for {selectedDate}.
              </p>
            ) : (
              tasks.map((task) => (
                <div
                  key={task.id}
                  className="group flex items-center justify-between rounded-2xl bg-[var(--bg-subtle)] px-3.5 py-3 transition hover:brightness-95"
                >
                  <button
                    type="button"
                    onClick={() => void handleToggleTask(task)}
                    className="flex flex-1 items-center gap-3 text-left"
                  >
                    {task.completed ? (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                    ) : (
                      <Circle className="h-5 w-5 shrink-0 text-[var(--text-muted)]" />
                    )}
                    <div className="min-w-0">
                      <p
                        className={`truncate text-sm font-medium ${
                          task.completed
                            ? 'text-[var(--text-muted)] line-through'
                            : 'text-[var(--text-main)]'
                        }`}
                      >
                        {task.title}
                      </p>
                      {(task.scheduled_start || task.category_name) && (
                        <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
                          {task.scheduled_start && <span>{task.scheduled_start}</span>}
                          {task.category_name && (
                            <span style={{ color: task.category_color || 'var(--accent)' }}>
                              {task.category_name}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteTask(task.id)}
                    className="ml-2 text-[var(--text-muted)] opacity-60 transition hover:text-rose-500 sm:opacity-0 sm:group-hover:opacity-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Daily Routines */}
        <section
          className={`cozy-card rounded-3xl p-5 ${
            mobileSection === 'routines' ? 'block' : 'hidden lg:block'
          }`}
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--pastel-butter)] text-amber-700 dark:text-amber-300">
                <Flame className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-bold text-[var(--text-main)]">Daily Routines</h2>
            </div>
            <span className="rounded-full bg-[var(--pastel-butter)] px-2.5 py-0.5 text-xs font-bold text-[var(--text-main)]">
              {completedRoutines}/{routines.length}
            </span>
          </div>

          <form onSubmit={(e) => void handleAddRoutine(e)} className="mb-4 flex gap-2">
            <input
              type="text"
              value={routineTitle}
              onChange={(e) => setRoutineTitle(e.target.value)}
              placeholder="Add a recurring routine..."
              className="flex-1 rounded-2xl border border-[var(--border-card)] bg-[var(--bg-input)] px-3.5 py-2.5 text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
            />
            <select
              value={routineSlot}
              onChange={(e) => setRoutineSlot(e.target.value as Routine['time_of_day'])}
              className="rounded-2xl border border-[var(--border-card)] bg-[var(--bg-input)] px-2.5 py-2 text-xs text-[var(--text-main)]"
            >
              {TIME_SLOTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="pastel-btn inline-flex items-center justify-center rounded-2xl px-3.5 py-2"
            >
              <Plus className="h-4 w-4" />
            </button>
          </form>

          <div className="space-y-3">
            {TIME_SLOTS.map((slot) => {
              const slotItems = routines.filter((r) => r.time_of_day === slot.id);
              if (slotItems.length === 0) return null;
              return (
                <div key={slot.id}>
                  <span
                    className="mb-1.5 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-[var(--text-main)] uppercase"
                    style={{ background: slot.bg }}
                  >
                    {slot.label}
                  </span>
                  <div className="space-y-1.5">
                    {slotItems.map((routine) => (
                      <div
                        key={routine.id}
                        className="group flex items-center justify-between rounded-2xl bg-[var(--bg-subtle)] px-3.5 py-2.5 transition"
                      >
                        <button
                          type="button"
                          onClick={() => void handleToggleRoutine(routine)}
                          className="flex flex-1 items-center gap-3 text-left"
                        >
                          {routine.completed_today ? (
                            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                          ) : (
                            <Circle className="h-5 w-5 shrink-0 text-[var(--text-muted)]" />
                          )}
                          <span
                            className={`text-sm font-medium ${
                              routine.completed_today
                                ? 'text-[var(--text-muted)] line-through'
                                : 'text-[var(--text-main)]'
                            }`}
                          >
                            {routine.title}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteRoutine(routine.id)}
                          className="ml-2 text-[var(--text-muted)] opacity-60 transition hover:text-rose-500 sm:opacity-0 sm:group-hover:opacity-100"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
