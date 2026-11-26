export type CompanionMood = 'idle' | 'focus' | 'relax' | 'celebrate';

export interface Category {
  id: number;
  name: string;
  color: string;
  icon: string;
  is_productive: number; // 0 | 1
}

export interface TimeEntry {
  id: number;
  title: string;
  category_id: number | null;
  started_at: string; // ISO string
  ended_at: string | null; // null while running
  notes: string;
  category_name?: string;
  category_color?: string;
}

export interface AppUsageLog {
  id: number;
  app_name: string;
  window_title: string;
  category_id: number | null;
  started_at: string;
  ended_at: string;
  duration_sec: number;
  category_name?: string;
  category_color?: string;
}

export interface AppUsageSummary {
  app_name: string;
  total_sec: number;
  category_id: number | null;
  category_name: string | null;
  category_color: string | null;
}

export interface Task {
  id: number;
  title: string;
  notes: string;
  due_date: string; // YYYY-MM-DD
  scheduled_start: string | null; // HH:mm
  scheduled_end: string | null; // HH:mm
  completed: number; // 0 | 1
  priority: 'low' | 'medium' | 'high';
  category_id: number | null;
  created_at: string;
  category_name?: string;
  category_color?: string;
}

export interface Routine {
  id: number;
  title: string;
  time_of_day: 'morning' | 'afternoon' | 'evening' | 'anytime';
  target_minutes: number;
  sort_order: number;
  completed_today: boolean;
}

export interface NetworkInfo {
  port: number;
  lanUrls: string[];
  trackerActive: boolean;
  platform: string;
  dataDir?: string;
}

export interface HistoryDaySummary {
  day: string;
  manual_sec: number;
  session_count: number;
  app_sec: number;
  app_count: number;
}

export interface CategoryTotal {
  category_id: number | null;
  category_name: string;
  category_color: string;
  total_sec: number;
}

export interface AllTimeTotals {
  total_manual_sec: number;
  total_sessions: number;
  total_app_sec: number;
  study_sec: number;
  by_category: CategoryTotal[];
}

export interface JournalEntry {
  id?: number;
  entry_date: string;
  title: string;
  content: string;
  reflection_learned: string;
  reflection_challenge: string;
  reflection_gratitude: string;
  mood_rating: number; // 1-5
  updated_at?: string;
}

export interface MemoryItem {
  id: number;
  memory_date: string;
  title: string;
  description: string;
  tag: string;
  media_id: number | null;
  media_url?: string | null;
  created_at: string;
}

export interface MediaItem {
  id: number;
  kind: 'image' | 'voice';
  title: string;
  caption: string;
  entry_date: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  duration_sec: number;
  url: string;
  created_at: string;
}

export type AppTheme = 'pastel' | 'dark';

export interface AppSettings {
  theme: AppTheme;
  eye_tracking: boolean;
  study_notes: string;
}

export interface SyncStatus {
  dataDir: string;
  dbSizeKb: number;
  counts: {
    tasks: number;
    routines: number;
    timeEntries: number;
    appLogs: number;
    journals: number;
    memories: number;
    images: number;
    voiceMemos: number;
  };
}
