import type {
  AllTimeTotals,
  AppSettings,
  AppUsageLog,
  AppUsageSummary,
  AuthStatus,
  CalendarEvent,
  Category,
  GamificationState,
  HistoryDaySummary,
  JournalEntry,
  MediaItem,
  MemoryItem,
  NetworkInfo,
  Routine,
  StudyNote,
  SyncStatus,
  Task,
  TimeEntry,
} from '@shared/types';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  getAuthStatus: () => request<AuthStatus>('/api/auth/status'),
  loginWithToken: (token: string) =>
    request<{ ok: boolean }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),
  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  rotateAccessToken: () =>
    request<{ accessToken: string }>('/api/auth/rotate-token', { method: 'POST' }),

  getNetworkInfo: () => request<NetworkInfo>('/api/network-info'),
  getCategories: () => request<Category[]>('/api/categories'),
  createCategory: (payload: {
    name: string;
    color: string;
    icon?: string;
    is_productive?: boolean;
  }) =>
    request<Category>('/api/categories', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateCategory: (
    id: number,
    payload: { name?: string; color?: string; icon?: string; is_productive?: boolean }
  ) =>
    request<Category>(`/api/categories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteCategory: (id: number) => request<void>(`/api/categories/${id}`, { method: 'DELETE' }),

  // Gamification (XP, Levels, Streaks, Daily Quests)
  getGamification: (date: string) =>
    request<GamificationState>(`/api/gamification?date=${date}`),
  claimQuest: (quest_key: string, date: string) =>
    request<{ state: GamificationState; leveledUp: boolean; xpAwarded: number }>(
      '/api/gamification/quests/claim',
      {
        method: 'POST',
        body: JSON.stringify({ quest_key, date }),
      }
    ),

  // Obsidian-style Study Notes
  getStudyNotes: () => request<StudyNote[]>('/api/study-notes'),
  createStudyNote: (payload: {
    title: string;
    folder?: string;
    content?: string;
    category_id?: number | null;
  }) =>
    request<StudyNote>('/api/study-notes', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateStudyNote: (
    id: number,
    payload: { title?: string; folder?: string; content?: string; category_id?: number | null }
  ) =>
    request<StudyNote>(`/api/study-notes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteStudyNote: (id: number) => request<void>(`/api/study-notes/${id}`, { method: 'DELETE' }),

  // Time entries
  getTimeEntries: (date: string) => request<TimeEntry[]>(`/api/time-entries?date=${date}`),
  startTimer: (payload: { title: string; category_id: number | null; notes?: string }) =>
    request<TimeEntry>('/api/time-entries/start', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  stopTimer: (id: number) =>
    request<TimeEntry>(`/api/time-entries/${id}/stop`, { method: 'POST' }),
  deleteTimeEntry: (id: number) =>
    request<void>(`/api/time-entries/${id}`, { method: 'DELETE' }),

  // Automatic app usage
  getAppUsage: (date: string) =>
    request<{ summary: AppUsageSummary[]; recent: AppUsageLog[]; trackerActive: boolean }>(
      `/api/app-usage?date=${date}`
    ),
  toggleAppTracker: (enabled: boolean) =>
    request<{ trackerActive: boolean }>('/api/app-usage/toggle', {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    }),
  categorizeApp: (app_name: string, category_id: number) =>
    request<{ ok: boolean }>('/api/app-usage/categorize', {
      method: 'POST',
      body: JSON.stringify({ app_name, category_id }),
    }),
  getHistory: (days = 14) => request<HistoryDaySummary[]>(`/api/history?days=${days}`),
  getAllTimeTotals: () => request<AllTimeTotals>('/api/stats/totals'),

  // Tasks
  getTasks: (date: string) => request<Task[]>(`/api/tasks?date=${date}`),
  getTasksRange: (from: string, to: string) =>
    request<Task[]>(`/api/tasks?from=${from}&to=${to}`),
  createTask: (payload: {
    title: string;
    due_date: string;
    scheduled_start?: string | null;
    scheduled_end?: string | null;
    priority?: 'low' | 'medium' | 'high';
    category_id?: number | null;
    notes?: string;
  }) =>
    request<Task>('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateTask: (id: number, payload: Partial<Task>) =>
    request<Task>(`/api/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteTask: (id: number) => request<void>(`/api/tasks/${id}`, { method: 'DELETE' }),

  // Routines
  getRoutines: (date: string) => request<Routine[]>(`/api/routines?date=${date}`),
  createRoutine: (payload: {
    title: string;
    time_of_day: Routine['time_of_day'];
    target_minutes: number;
  }) =>
    request<Routine>('/api/routines', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  toggleRoutine: (id: number, date: string) =>
    request<{ completed_today: boolean }>(`/api/routines/${id}/toggle`, {
      method: 'POST',
      body: JSON.stringify({ date }),
    }),
  deleteRoutine: (id: number) => request<void>(`/api/routines/${id}`, { method: 'DELETE' }),

  // Journal
  getJournal: (date: string) => request<JournalEntry>(`/api/journal?date=${date}`),
  getRecentJournals: (limit = 20) => request<JournalEntry[]>(`/api/journal/recent?limit=${limit}`),
  saveJournal: (date: string, payload: Omit<JournalEntry, 'id' | 'entry_date' | 'updated_at'>) =>
    request<JournalEntry>(`/api/journal/${date}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  // Memory Bank
  getMemories: (tag?: string) =>
    request<MemoryItem[]>(tag ? `/api/memories?tag=${encodeURIComponent(tag)}` : '/api/memories'),
  createMemory: (payload: {
    memory_date: string;
    title: string;
    description?: string;
    tag?: string;
    media_id?: number | null;
  }) =>
    request<MemoryItem>('/api/memories', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  deleteMemory: (id: number) => request<void>(`/api/memories/${id}`, { method: 'DELETE' }),

  // Media (Images & Voice Memos)
  getMedia: (kind?: 'image' | 'voice') =>
    request<MediaItem[]>(kind ? `/api/media?kind=${kind}` : '/api/media'),
  uploadMedia: async (payload: {
    file: Blob | File;
    filename?: string;
    kind: 'image' | 'voice';
    title: string;
    caption?: string;
    entry_date: string;
    duration_sec?: number;
  }): Promise<MediaItem> => {
    const form = new FormData();
    form.append('kind', payload.kind);
    form.append('title', payload.title);
    form.append('caption', payload.caption ?? '');
    form.append('entry_date', payload.entry_date);
    form.append('duration_sec', String(payload.duration_sec ?? 0));
    form.append('file', payload.file, payload.filename ?? (payload.file instanceof File ? payload.file.name : 'memo.webm'));
    const res = await fetch('/api/media/upload', {
      method: 'POST',
      credentials: 'include',
      body: form,
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<MediaItem>;
  },
  deleteMedia: (id: number) => request<void>(`/api/media/${id}`, { method: 'DELETE' }),

  // Settings & Sync Status
  getSettings: () => request<AppSettings>('/api/settings'),
  updateSettings: (payload: Partial<AppSettings>) =>
    request<AppSettings>('/api/settings', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  getSyncStatus: () => request<SyncStatus>('/api/sync-status'),
  createBackupSnapshot: () =>
    request<{
      ok: boolean;
      backupFile: string;
      exportedJournals: number;
      exportedNotes: number;
      backupDir: string;
      exportDir: string;
    }>('/api/sync/backup', { method: 'POST' }),
  getGoogleCalendarEvents: (from: string, to: string, refresh = false) =>
    request<{ connected: boolean; events: CalendarEvent[]; error?: string }>(
      `/api/calendar/google-events?from=${from}&to=${to}${refresh ? '&refresh=1' : ''}`
    ),
};
