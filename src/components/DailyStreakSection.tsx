import React from 'react';
import {
  Award,
  BookOpen,
  CheckCircle2,
  Flame,
  Gift,
  Heart,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { DailyStreakState } from '../types/quran';
import {
  DAILY_STREAK_REWARDS,
  DOUBLE_HABIT_BONUS,
  getNormalizedStreakView,
  getStreakDateKey,
} from '../utils/streak';

interface DailyStreakSectionProps {
  streak: DailyStreakState;
  onOpenMushaf: () => void;
  onOpenAzkar: () => void;
  onQuickTasbeeh: () => void;
  onClaimReward: () => void;
  onOpenSevenDayCelebration: (milestoneDays: number) => void;
}

export const DailyStreakSection: React.FC<DailyStreakSectionProps> = ({
  streak,
  onOpenMushaf,
  onOpenAzkar,
  onQuickTasbeeh,
  onClaimReward,
  onOpenSevenDayCelebration,
}) => {
  const { language, t, formatNumber } = useLanguage();
  const todayKey = getStreakDateKey();
  const view = getNormalizedStreakView(streak, todayKey);
  const {
    effectiveStreak,
    activeToday,
    todayLog,
    cycleDay,
    currentTier,
    daysUntilSeven,
    sevenDayCompleted,
  } = view;

  const bothHabitsDone = todayLog.quranDone && todayLog.tasbeehDone;
  const potentialTodayPoints =
    currentTier.rewardPoints + (bothHabitsDone ? DOUBLE_HABIT_BONUS : 0);

  const highestSevenMilestone =
    streak.celebratedMilestones.length > 0
      ? Math.max(...streak.celebratedMilestones)
      : effectiveStreak >= 7
      ? 7
      : 0;

  const getStreakUnit = (count: number) => {
    if (count === 1) return t('streakUnitOne');
    if (count <= 10) return t('streakUnitFew');
    return t('streakUnitMany');
  };

  return (
    <section
      aria-label={t('streakSectionAria')}
      className="rounded-3xl ios-glass-card p-6 sm:p-8 space-y-6"
    >
      {/* Header Row: Streak Summary & Key Metrics */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 pb-5 border-b border-stone-200/80 dark:border-white/10">
        <div className="flex items-start gap-4">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border ${
              activeToday
                ? 'bg-[#9A742E]/15 dark:bg-amber-500/20 border-[#9A742E]/35 dark:border-amber-400/35 text-[#9A742E] dark:text-amber-300'
                : 'bg-[#14532D]/10 dark:bg-emerald-500/15 border-[#14532D]/20 dark:border-emerald-400/25 text-[#14532D] dark:text-emerald-300'
            }`}
          >
            <Flame className="w-7 h-7" />
          </div>

          <div className="space-y-1 text-start">
            <div className="text-xs font-medium text-[#9A742E] dark:text-amber-400">
              {t('streakEyebrow')}
            </div>
            <h2 className="font-amiri text-2xl sm:text-3xl font-bold text-[#1C1917] dark:text-[#F2EFE8] tabular-nums">
              {effectiveStreak > 0
                ? t('streakHeadlineActive', {
                    count: formatNumber(effectiveStreak),
                    unit: getStreakUnit(effectiveStreak),
                  })
                : t('streakHeadlineStart')}
            </h2>
            <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 leading-relaxed tabular-nums">
              {sevenDayCompleted
                ? t('streakDescCompleted7')
                : activeToday
                ? t('streakDescActiveToday', {
                    days: formatNumber(daysUntilSeven),
                    unit: daysUntilSeven === 1 ? t('day') : t('days'),
                  })
                : t('streakDescInactiveToday')}
            </p>
          </div>
        </div>

        {/* Clean Unboxed KPI Figures */}
        <div className="flex flex-wrap items-center gap-6 sm:gap-8 text-start shrink-0">
          <div className="space-y-0.5">
            <div className="text-xs text-stone-500 dark:text-stone-400">
              {t('streakLongestLabel')}
            </div>
            <div className="text-xl font-bold text-stone-900 dark:text-stone-100 tabular-nums">
              {formatNumber(streak.longestStreak)}{' '}
              {streak.longestStreak === 1 ? t('day') : t('days')}
            </div>
          </div>

          <div className="space-y-0.5">
            <div className="text-xs text-stone-500 dark:text-stone-400">
              {t('streakTotalDaysLabel')}
            </div>
            <div className="text-xl font-bold text-stone-900 dark:text-stone-100 tabular-nums">
              {formatNumber(streak.totalActiveDays)}{' '}
              {streak.totalActiveDays === 1 ? t('day') : t('days')}
            </div>
          </div>

          <div className="space-y-0.5">
            <div className="text-xs text-stone-500 dark:text-stone-400">
              {t('streakPointsLabel')}
            </div>
            <div className="text-xl font-bold text-[#14532D] dark:text-emerald-300 tabular-nums">
              {formatNumber(streak.totalStreakPoints)} {t('points')}
            </div>
          </div>
        </div>
      </div>

      {/* 7-Day Reward Ladder */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
            {t('streakLadderTitle')}
          </h3>
          <span className="text-xs text-stone-500 dark:text-stone-400 tabular-nums">
            {t('streakLadderProgress', { day: formatNumber(cycleDay) })}{' '}
            <strong className="text-[#9A742E] dark:text-amber-300">
              +{formatNumber(potentialTodayPoints)} {t('points')}
            </strong>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          {DAILY_STREAK_REWARDS.map((tier) => {
            const isPastDay = tier.day < cycleDay;
            const isCurrentSlot = tier.day === cycleDay;
            const isClaimedCurrent =
              isCurrentSlot && activeToday && todayLog.rewardClaimed;
            const isCompleted = isPastDay || isClaimedCurrent;
            const isActiveUnclaimed =
              isCurrentSlot && activeToday && !todayLog.rewardClaimed;
            const isSevenDay = tier.day === 7;

            return (
              <div
                key={tier.day}
                className={`rounded-2xl p-3 border transition-colors flex flex-col justify-between gap-2 text-start ${
                  isCompleted
                    ? 'bg-[#14532D]/10 dark:bg-emerald-500/15 border-[#14532D]/35 dark:border-emerald-400/35'
                    : isActiveUnclaimed
                    ? 'bg-[#9A742E]/12 dark:bg-amber-500/15 border-[#9A742E]/50 dark:border-amber-400/50'
                    : isSevenDay
                    ? 'ios-glass-input border-[#9A742E]/35 dark:border-amber-400/30'
                    : 'ios-glass-input border-stone-200/70 dark:border-white/10'
                }`}
              >
                <div className="flex items-center justify-between gap-1 text-xs font-semibold tabular-nums">
                  <span
                    className={
                      isCompleted
                        ? 'text-[#14532D] dark:text-emerald-300'
                        : isActiveUnclaimed || isSevenDay
                        ? 'text-[#9A742E] dark:text-amber-300'
                        : 'text-stone-700 dark:text-stone-300'
                    }
                  >
                    {t('streakDayLabel', { day: formatNumber(tier.day) })}
                  </span>

                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 text-[#14532D] dark:text-emerald-300 shrink-0" />
                  ) : isSevenDay ? (
                    <Trophy className="w-4 h-4 text-[#9A742E] dark:text-amber-300 shrink-0" />
                  ) : isActiveUnclaimed ? (
                    <Gift className="w-4 h-4 text-[#9A742E] dark:text-amber-300 shrink-0" />
                  ) : null}
                </div>

                <div>
                  <div className="text-sm font-bold text-stone-900 dark:text-stone-100 tabular-nums">
                    +{formatNumber(tier.rewardPoints)} {t('points')}
                  </div>
                  <div className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5 truncate">
                    {language === 'en' ? tier.titleEn : tier.title}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Today's Qualifying Habits & Reward Action */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-2 border-t border-stone-200/70 dark:border-white/10">
        {/* Habit 1: Daily Quran Reading */}
        <div className="rounded-2xl ios-glass-input p-4 flex flex-col justify-between gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 text-start">
              <div className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                {t('streakHabitQuranTitle')}
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
                {todayLog.quranDone
                  ? t('streakHabitQuranDone')
                  : t('streakHabitQuranTodo')}
              </p>
            </div>
            {todayLog.quranDone ? (
              <CheckCircle2 className="w-5 h-5 text-[#14532D] dark:text-emerald-300 shrink-0" />
            ) : (
              <BookOpen className="w-5 h-5 text-[#14532D] dark:text-emerald-300 shrink-0" />
            )}
          </div>

          <button
            type="button"
            onClick={onOpenMushaf}
            className={`ios-spring min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 whitespace-nowrap ${
              todayLog.quranDone
                ? 'bg-[#14532D]/12 text-[#14532D] dark:bg-emerald-500/20 dark:text-emerald-300'
                : 'bg-[#14532D] hover:bg-[#114224] dark:bg-emerald-700 dark:hover:bg-emerald-600 text-[#FBF8F1]'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>
              {todayLog.quranDone
                ? t('streakHabitQuranBtnDone')
                : t('streakHabitQuranBtnTodo')}
            </span>
          </button>
        </div>

        {/* Habit 2: Daily Tasbeeh & Azkar */}
        <div className="rounded-2xl ios-glass-input p-4 flex flex-col justify-between gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 text-start">
              <div className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                {t('streakHabitTasbeehTitle')}
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
                {todayLog.tasbeehDone
                  ? t('streakHabitTasbeehDone')
                  : t('streakHabitTasbeehTodo')}
              </p>
            </div>
            {todayLog.tasbeehDone ? (
              <CheckCircle2 className="w-5 h-5 text-[#14532D] dark:text-emerald-300 shrink-0" />
            ) : (
              <Heart className="w-5 h-5 text-[#9A742E] dark:text-amber-300 shrink-0" />
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onQuickTasbeeh}
              className="ios-spring flex-1 min-h-[44px] px-3 py-2 rounded-xl bg-[#9A742E] hover:bg-[#836123] text-white text-xs font-semibold whitespace-nowrap truncate"
            >
              {t('streakQuickTasbeehBtn')}
            </button>
            <button
              type="button"
              onClick={onOpenAzkar}
              className="ios-spring min-h-[44px] px-3 py-2 rounded-xl ios-glass-card text-xs font-medium text-stone-800 dark:text-stone-200 whitespace-nowrap"
            >
              {t('streakTasbeehCounterBtn')}
            </button>
          </div>
        </div>

        {/* Daily Reward Claim / 7-Day Milestone Box */}
        <div className="rounded-2xl ios-glass-input p-4 flex flex-col justify-between gap-3">
          <div className="space-y-1 text-start">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                {t('streakTodayRewardTitle')}
              </span>
              <span className="text-xs font-bold text-[#9A742E] dark:text-amber-300 tabular-nums">
                +{formatNumber(potentialTodayPoints)} {t('points')}
              </span>
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed tabular-nums">
              {todayLog.rewardClaimed
                ? t('streakTodayRewardClaimed', {
                    points: formatNumber(todayLog.pointsEarned),
                  })
                : activeToday
                ? bothHabitsDone
                  ? t('streakTodayRewardBothDone', {
                      bonus: formatNumber(DOUBLE_HABIT_BONUS),
                    })
                  : t('streakTodayRewardReady', {
                      bonus: formatNumber(DOUBLE_HABIT_BONUS),
                    })
                : t('streakTodayRewardInactive')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {todayLog.rewardClaimed ? (
              <div className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-[#14532D]/12 dark:bg-emerald-500/20 text-[#14532D] dark:text-emerald-300 text-xs font-semibold flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>{t('streakClaimedBadge')}</span>
              </div>
            ) : (
              <button
                type="button"
                disabled={!activeToday}
                onClick={onClaimReward}
                className="ios-spring w-full min-h-[44px] px-4 py-2 rounded-xl bg-[#14532D] hover:bg-[#114224] dark:bg-emerald-700 dark:hover:bg-emerald-600 text-[#FBF8F1] text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap"
              >
                <Gift className="w-4 h-4" />
                <span>
                  {activeToday
                    ? t('streakClaimBtn', {
                        points: formatNumber(potentialTodayPoints),
                      })
                    : t('streakCompleteFirstBtn')}
                </span>
              </button>
            )}

            {highestSevenMilestone >= 7 && (
              <button
                type="button"
                onClick={() => onOpenSevenDayCelebration(highestSevenMilestone)}
                className="ios-spring w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-[#9A742E]/40 text-[#9A742E] dark:text-amber-300 text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                <Award className="w-3.5 h-3.5" />
                <span>
                  {t('streakShowCelebrationBtn', {
                    days: formatNumber(highestSevenMilestone),
                  })}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Seven-Day Motivational Milestone Strip when active streak < 7 */}
      {effectiveStreak > 0 && effectiveStreak < 7 && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs text-stone-600 dark:text-stone-300 tabular-nums">
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-[#9A742E] dark:text-amber-400 shrink-0" />
            <span>{t('streakMilestoneStripText')}</span>
          </span>
          <span className="font-semibold text-[#14532D] dark:text-emerald-300">
            {t('streakMilestoneProgress', {
              current: formatNumber(effectiveStreak),
            })}
          </span>
        </div>
      )}
    </section>
  );
};
