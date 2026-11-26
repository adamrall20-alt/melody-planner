# Melody Planner — Architecture & Roadmap

A local-first, cross-platform (macOS & Windows) life planner with a cozy 3D VRM companion, automatic + manual time tracking, daily tasks/routines, calendar, journaling, and LAN Wi-Fi access from mobile devices.

## Tech Stack

- **Desktop Shell:** Electron (macOS & Windows)
- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4
- **3D Companion:** Three.js + `@pixiv/three-vrm` (rendering `Melody.vrm`)
- **Local Server:** Express + TypeScript (binds to `0.0.0.0:4310` for LAN Wi-Fi access)
- **Database:** SQLite (`better-sqlite3`) with versioned SQL migrations
- **Active-Window Tracker:** Cross-platform OS watcher (macOS AppleScript/JXA + Windows PowerShell/Win32, swappable cleanly)

## Directory Structure

```
melody-planner/
├── docs/              # Architecture & design docs
├── shared/            # Shared TypeScript domain types
├── server/            # Local REST API, SQLite DB, and active-window tracker
│   ├── db/            # Database connection & migrations
│   ├── routes/        # Modular API routers
│   └── tracker/       # OS-level active app/window polling
├── electron/          # Electron main process & preload
├── src/               # React frontend
│   ├── components/
│   │   ├── companion/ # Three.js + VRM cozy scene
│   │   ├── layout/    # App shell, sidebar, topbar
│   │   ├── tracker/   # Timers + auto app-tracking timeline
│   │   ├── tasks/     # Daily tasks & routines
│   │   └── calendar/  # Day/Week/Month calendar
│   └── lib/           # API client & helpers
└── public/            # Static assets (includes Melody.vrm)
```

## Core Data Model (Phase 1)

- `categories`: Activity categories (Study, Coding, Creative, Relax, Admin, etc.) with color & icon.
- `time_entries`: Manual Toggl-style timer sessions (`category_id`, `title`, `started_at`, `ended_at`, `notes`).
- `app_usage_logs`: Automatic active-window sessions (`app_name`, `window_title`, `category_id`, `started_at`, `ended_at`, `duration_sec`).
- `app_category_rules`: Maps app names / title patterns to a `category_id`.
- `tasks`: Daily/scheduled tasks (`title`, `due_date`, `scheduled_start`, `scheduled_end`, `completed`, `priority`, `category_id`).
- `routines` & `routine_completions`: Recurring daily habits/routines (Morning, Study, Evening) with daily completion history.

## Phased Roadmap

1. **Phase 1 (Current):** Foundation, `Melody.vrm` cozy 3D companion, Activity Timers + Auto App Tracking, Daily Tasks, Routines, Calendar, LAN Wi-Fi access.
2. **Phase 2:** Journal, Memory Bank, End-of-Day Reflection, local image storage & voice memo recording.
3. **Phase 3:** XP / Level-Up system, Streaks, Daily Quests, Study Sessions (Obsidian-style markdown notes + focus timer + ambient audio).
4. **Phase 4:** Google Drive backup & cross-device sync (macOS ↔ Windows), Google Calendar sync, 3D room customization.
