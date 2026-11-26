import { useState } from 'react';
import { Award, CheckCircle2, Flame, Gift, Sparkles, Star, Zap } from 'lucide-react';
import type { DailyQuest, GamificationState } from '@shared/types';
import { api } from '@/lib/api';

interface QuestsProgressPanelProps {
  gamification: GamificationState | null;
  selectedDate: string;
  onUpdated: (state: GamificationState) => void;
  onCelebrate: () => void;
}

const ACCENT_BG: Record<DailyQuest['accent'], string> = {
  mint: 'var(--pastel-mint)',
  sky: 'var(--pastel-sky)',
  butter: 'var(--pastel-butter)',
  peach: 'var(--pastel-peach)',
};

const ACCENT_BAR: Record<DailyQuest['accent'], string> = {
  mint: '#10b981',
  sky: '#0ea5e9',
  butter: '#f59e0b',
  peach: '#f43f5e',
};

export function QuestsProgressPanel({
  gamification,
  selectedDate,
  onUpdated,
  onCelebrate,
}: QuestsProgressPanelProps) {
  const [claimingKey, setClaimingKey] = useState<string | null>(null);
  const [levelUpBanner, setLevelUpBanner] = useState<number | null>(null);

  if (!gamification) return null;

  const handleClaim = async (questKey: string) => {
    setClaimingKey(questKey);
    try {
      const res = await api.claimQuest(questKey, selectedDate);
      onUpdated(res.state);
      onCelebrate();
      if (res.leveledUp) {
        setLevelUpBanner(res.state.level);
        setTimeout(() => setLevelUpBanner(null), 4500);
      }
    } finally {
      setClaimingKey(null);
    }
  };

  const claimableCount = gamification.quests.filter((q) => q.completed && !q.claimed).length;

  return (
    <div className="space-y-4">
      {levelUpBanner !== null && (
        <div className="flex items-center justify-between rounded-3xl border-2 border-amber-400/60 bg-[var(--pastel-butter)] px-5 py-3.5 shadow-md">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-400 text-white shadow-sm">
              <Award className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-extrabold text-[var(--text-main)]">
                Level Up! You reached Level {levelUpBanner}!
              </p>
              <p className="text-xs font-medium text-[var(--text-muted)]">
                Rank: {gamification.rankTitle} · Melody is cheering for you!
              </p>
            </div>
          </div>
          <Sparkles className="h-5 w-5 text-amber-500" />
        </div>
      )}

      {/* Level, XP & Streak Hero Card */}
      <section className="cozy-card cozy-card-peach rounded-3xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-400 via-sky-400 to-emerald-400 text-white shadow-md">
              <span className="font-mono text-xl font-black">{gamification.level}</span>
              <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-white shadow">
                <Star className="h-3 w-3 fill-current" />
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-[var(--text-main)]">
                  Level {gamification.level} · {gamification.rankTitle}
                </h2>
                <span className="rounded-full bg-[var(--pastel-butter)] px-2.5 py-0.5 font-mono text-[11px] font-bold text-amber-800 dark:text-amber-200">
                  +{gamification.todayXp} XP today
                </span>
              </div>
              <p className="mt-0.5 text-xs font-medium text-[var(--text-muted)]">
                {gamification.currentLevelXp} / {gamification.nextLevelXp} XP to Level{' '}
                {gamification.level + 1} · {gamification.totalXp} total XP
              </p>
            </div>
          </div>

          {/* Streak pill */}
          <div className="flex items-center gap-2.5 rounded-2xl bg-[var(--pastel-butter)] px-4 py-2.5">
            <Flame className="h-5 w-5 text-amber-500" />
            <div>
              <p className="font-mono text-base leading-none font-extrabold text-[var(--text-main)]">
                {gamification.streak} {gamification.streak === 1 ? 'day' : 'days'}
              </p>
              <p className="mt-0.5 text-[10px] font-bold text-[var(--text-muted)] uppercase">
                Best: {gamification.longestStreak}d
              </p>
            </div>
          </div>
        </div>

        {/* XP Progress Bar */}
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sky-400 via-teal-400 to-emerald-400 transition-all duration-500"
            style={{ width: `${Math.max(4, gamification.progressPct)}%` }}
          />
        </div>

        {/* 7-Day Activity Strip */}
        <div className="mt-4 grid grid-cols-7 gap-1.5">
          {gamification.weekActivity.map((day) => (
            <div
              key={day.date}
              className={`flex flex-col items-center rounded-2xl py-2 text-center transition ${
                day.active
                  ? 'bg-[var(--pastel-mint)] text-[var(--text-main)] ring-1 ring-emerald-400/50'
                  : 'bg-[var(--bg-card)]/70 text-[var(--text-muted)]'
              }`}
              title={`${day.date}: ${day.xp} XP`}
            >
              <span className="text-[10px] font-bold">{day.label}</span>
              <span
                className={`mt-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                  day.active
                    ? 'bg-emerald-500 text-white'
                    : 'bg-black/5 text-[var(--text-muted)] dark:bg-white/10'
                }`}
              >
                {day.active ? '✓' : '·'}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Daily Quests */}
      <section className="cozy-card cozy-card-sky rounded-3xl p-5">
        <div className="mb-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--pastel-butter)] text-amber-700 dark:text-amber-300">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-[var(--text-main)]">Daily Quests</h3>
              <p className="text-[11px] text-[var(--text-muted)]">
                Complete study & productive goals to earn bonus XP
              </p>
            </div>
          </div>
          {claimableCount > 0 && (
            <span className="animate-pulse rounded-full bg-amber-400 px-2.5 py-0.5 text-[11px] font-extrabold text-slate-900">
              {claimableCount} ready to claim!
            </span>
          )}
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2">
          {gamification.quests.map((q) => {
            const pct = Math.min(100, Math.round((q.current / q.target) * 100));
            return (
              <div
                key={q.key}
                className="flex flex-col justify-between rounded-2xl border border-[var(--border-card)] p-3.5"
                style={{ background: ACCENT_BG[q.accent] }}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-extrabold text-[var(--text-main)]">{q.title}</p>
                      <p className="text-[11px] font-medium text-[var(--text-muted)]">
                        {q.description}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-[var(--bg-card)]/90 px-2 py-0.5 font-mono text-[11px] font-extrabold text-[var(--text-main)]">
                      +{q.xp} XP
                    </span>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/10 dark:bg-white/15">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: ACCENT_BAR[q.accent],
                        }}
                      />
                    </div>
                    <span className="font-mono text-[11px] font-bold text-[var(--text-main)]">
                      {q.current}/{q.target} {q.unit}
                    </span>
                  </div>
                </div>

                <div className="mt-3 flex justify-end">
                  {q.claimed ? (
                    <span className="inline-flex items-center gap-1 rounded-xl bg-[var(--bg-card)]/80 px-3 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Claimed
                    </span>
                  ) : q.completed ? (
                    <button
                      type="button"
                      disabled={claimingKey === q.key}
                      onClick={() => void handleClaim(q.key)}
                      className="pastel-btn inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-extrabold"
                    >
                      <Gift className="h-3.5 w-3.5" />
                      {claimingKey === q.key ? 'Claiming...' : `Claim +${q.xp} XP`}
                    </button>
                  ) : (
                    <span className="text-[11px] font-semibold text-[var(--text-muted)]">
                      In progress
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Recent XP Feed */}
        {gamification.recentXpEvents.length > 0 && (
          <div className="mt-4 border-t border-[var(--border-card)] pt-3">
            <p className="mb-2 text-[11px] font-bold tracking-wider text-[var(--text-muted)] uppercase">
              Recent XP Earned
            </p>
            <div className="flex flex-wrap gap-1.5">
              {gamification.recentXpEvents.slice(0, 6).map((ev) => (
                <span
                  key={ev.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-card)] bg-[var(--bg-card)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-main)]"
                >
                  <span className="font-mono font-extrabold text-emerald-600 dark:text-emerald-400">
                    +{ev.xp}
                  </span>
                  <span className="max-w-[160px] truncate">{ev.label}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
