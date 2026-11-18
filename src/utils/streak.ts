import { AppLanguage } from '../i18n/translations';
import { DailyStreakLog, DailyStreakState, StreakActivityKind } from '../types/quran';

export interface StreakRewardTier {
  day: number; // 1..7
  title: string;
  titleEn: string;
  rewardPoints: number;
  description: string;
  descriptionEn: string;
}

export const DOUBLE_HABIT_BONUS = 10;

export const DAILY_STREAK_REWARDS: StreakRewardTier[] = [
  {
    day: 1,
    title: 'نية وبداية',
    titleEn: 'Intention & Start',
    rewardPoints: 10,
    description: 'أول خطوة مباركة على طريق المواظبة اليومية',
    descriptionEn: 'First blessed step toward daily consistency',
  },
  {
    day: 2,
    title: 'خطوة ثابتة',
    titleEn: 'Steady Step',
    rewardPoints: 15,
    description: 'استمرارك في اليوم الثاني يثبّت العادة الطيبة',
    descriptionEn: 'Continuing on day two strengthens your daily habit',
  },
  {
    day: 3,
    title: 'مداومة طيبة',
    titleEn: 'Good Persistence',
    rewardPoints: 20,
    description: 'ثلاثة أيام متواصلة من القراءة أو التسبيح',
    descriptionEn: 'Three consecutive days of Quran or Dhikr',
  },
  {
    day: 4,
    title: 'قلب ذاكر',
    titleEn: 'Mindful Heart',
    rewardPoints: 25,
    description: 'تجاوزت منتصف الأسبوع بهمة وثبات',
    descriptionEn: 'Past midweek with strong dedication',
  },
  {
    day: 5,
    title: 'همة عالية',
    titleEn: 'High Resolve',
    rewardPoints: 30,
    description: 'خمسة أيام متتالية من الصلة بالله',
    descriptionEn: 'Five consecutive days connected with Allah',
  },
  {
    day: 6,
    title: 'قرب وإتقان',
    titleEn: 'Nearness & Excellence',
    rewardPoints: 40,
    description: 'يوم واحد يفصلك عن مكافأة الأسبوع الكبرى',
    descriptionEn: 'Just one day away from the weekly grand reward',
  },
  {
    day: 7,
    title: 'وسام ٧ أيام متتالية',
    titleEn: '7-Day Streak Badge',
    rewardPoints: 100,
    description: 'إتمام ٧ أيام متواصلة — أحب الأعمال إلى الله أدومها وإن قل',
    descriptionEn:
      'Completed 7 consecutive days — the most beloved deeds to Allah are the consistent ones',
  },
];

export const DEFAULT_DAILY_STREAK: DailyStreakState = {
  currentStreak: 0,
  longestStreak: 0,
  lastActiveDate: '',
  totalActiveDays: 0,
  totalStreakPoints: 0,
  celebratedMilestones: [],
  dailyLogs: {},
};

export function getStreakDateKey(d = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getOffsetDateKey(baseDateKey: string, offsetDays: number): string {
  const parts = baseDateKey.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + offsetDays);
    return getStreakDateKey(d);
  }
  const d = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return getStreakDateKey(d);
}

export function getEmptyDayLog(dateKey: string): DailyStreakLog {
  return {
    date: dateKey,
    quranDone: false,
    tasbeehDone: false,
    rewardClaimed: false,
    pointsEarned: 0,
  };
}

/**
 * Computes effective streak for `todayKey` without mutating historical records.
 * Streak stays intact if `lastActiveDate` is today or yesterday; otherwise resets to 0.
 */
export function getNormalizedStreakView(
  state: DailyStreakState,
  todayKey = getStreakDateKey()
): {
  effectiveStreak: number;
  activeToday: boolean;
  todayLog: DailyStreakLog;
  cycleDay: number; // 1..7 showing current step in 7-day ladder
  currentTier: StreakRewardTier;
  daysUntilSeven: number;
  sevenDayCompleted: boolean;
} {
  const yesterdayKey = getOffsetDateKey(todayKey, -1);
  const rawToday = state.dailyLogs[todayKey] ?? getEmptyDayLog(todayKey);
  const activeToday = Boolean(rawToday.quranDone || rawToday.tasbeehDone);

  const isAlive =
    state.lastActiveDate === todayKey || state.lastActiveDate === yesterdayKey;

  const effectiveStreak = isAlive
    ? Math.max(activeToday ? 1 : 0, state.currentStreak)
    : activeToday
    ? 1
    : 0;

  // Determine which day of the 7-day cycle the user is currently at or working on
  let cycleDay = 1;
  if (effectiveStreak === 0) {
    cycleDay = 1;
  } else if (activeToday) {
    cycleDay = ((effectiveStreak - 1) % 7) + 1;
  } else {
    // Streak is alive from yesterday, next active step today is effectiveStreak + 1
    cycleDay = (effectiveStreak % 7) + 1;
  }

  const currentTier =
    DAILY_STREAK_REWARDS[Math.max(0, Math.min(6, cycleDay - 1))];

  const remainder = effectiveStreak % 7;
  const sevenDayCompleted = effectiveStreak >= 7 && remainder === 0 && activeToday;
  const daysUntilSeven = sevenDayCompleted
    ? 0
    : remainder === 0
    ? 7
    : 7 - remainder;

  return {
    effectiveStreak,
    activeToday,
    todayLog: rawToday,
    cycleDay,
    currentTier,
    daysUntilSeven,
    sevenDayCompleted,
  };
}

function pruneDailyLogs(
  logs: Record<string, DailyStreakLog>,
  todayKey: string
): Record<string, DailyStreakLog> {
  const cutoffKey = getOffsetDateKey(todayKey, -35);
  const result: Record<string, DailyStreakLog> = {};
  for (const [k, v] of Object.entries(logs)) {
    if (k >= cutoffKey && k <= todayKey) {
      result[k] = v;
    }
  }
  return result;
}

export function recordDailyStreakActivity(
  state: DailyStreakState,
  kind: StreakActivityKind,
  todayKey = getStreakDateKey()
): {
  nextState: DailyStreakState;
  becameActiveToday: boolean;
  newlyCompletedHabit: boolean;
  newlyReachedMilestone: number | null;
} {
  const yesterdayKey = getOffsetDateKey(todayKey, -1);
  const existingToday = state.dailyLogs[todayKey] ?? getEmptyDayLog(todayKey);

  const hadQuran = existingToday.quranDone;
  const hadTasbeeh = existingToday.tasbeehDone;
  const wasActiveToday = hadQuran || hadTasbeeh;

  const nextQuran = hadQuran || kind === 'quran';
  const nextTasbeeh = hadTasbeeh || kind === 'tasbeeh';
  const newlyCompletedHabit =
    (kind === 'quran' && !hadQuran) || (kind === 'tasbeeh' && !hadTasbeeh);

  if (!newlyCompletedHabit && wasActiveToday && state.lastActiveDate === todayKey) {
    return {
      nextState: state,
      becameActiveToday: false,
      newlyCompletedHabit: false,
      newlyReachedMilestone: null,
    };
  }

  let nextStreak = state.currentStreak;
  let nextTotalActiveDays = state.totalActiveDays;

  if (!wasActiveToday && state.lastActiveDate !== todayKey) {
    nextStreak =
      state.lastActiveDate === yesterdayKey ? Math.max(1, state.currentStreak + 1) : 1;
    nextTotalActiveDays = Math.max(1, state.totalActiveDays + 1);
  } else if (state.lastActiveDate === todayKey) {
    nextStreak = Math.max(1, state.currentStreak);
  }

  const nextLongest = Math.max(state.longestStreak, nextStreak);
  const updatedLog: DailyStreakLog = {
    ...existingToday,
    date: todayKey,
    quranDone: nextQuran,
    tasbeehDone: nextTasbeeh,
  };

  const isSevenMilestone = nextStreak >= 7 && nextStreak % 7 === 0;
  const alreadyCelebrated = state.celebratedMilestones.includes(nextStreak);
  const newlyReachedMilestone =
    isSevenMilestone && !alreadyCelebrated ? nextStreak : null;

  const nextMilestones = newlyReachedMilestone
    ? [...state.celebratedMilestones, newlyReachedMilestone].slice(-30)
    : state.celebratedMilestones;

  const nextState: DailyStreakState = {
    currentStreak: nextStreak,
    longestStreak: nextLongest,
    lastActiveDate: todayKey,
    totalActiveDays: nextTotalActiveDays,
    totalStreakPoints: state.totalStreakPoints,
    celebratedMilestones: nextMilestones,
    dailyLogs: pruneDailyLogs(
      { ...state.dailyLogs, [todayKey]: updatedLog },
      todayKey
    ),
  };

  return {
    nextState,
    becameActiveToday: !wasActiveToday,
    newlyCompletedHabit,
    newlyReachedMilestone,
  };
}

export function claimTodayStreakReward(
  state: DailyStreakState,
  todayKey = getStreakDateKey()
): {
  claimed: boolean;
  pointsAwarded: number;
  nextState: DailyStreakState;
  milestoneReached: number | null;
} {
  const view = getNormalizedStreakView(state, todayKey);
  if (!view.activeToday || view.todayLog.rewardClaimed) {
    return {
      claimed: false,
      pointsAwarded: 0,
      nextState: state,
      milestoneReached: null,
    };
  }

  const bothHabitsDone = view.todayLog.quranDone && view.todayLog.tasbeehDone;
  const pointsAwarded =
    view.currentTier.rewardPoints + (bothHabitsDone ? DOUBLE_HABIT_BONUS : 0);

  const updatedLog: DailyStreakLog = {
    ...view.todayLog,
    rewardClaimed: true,
    pointsEarned: view.todayLog.pointsEarned + pointsAwarded,
  };

  const nextState: DailyStreakState = {
    ...state,
    currentStreak: view.effectiveStreak,
    longestStreak: Math.max(state.longestStreak, view.effectiveStreak),
    lastActiveDate: todayKey,
    totalStreakPoints: state.totalStreakPoints + pointsAwarded,
    dailyLogs: pruneDailyLogs(
      { ...state.dailyLogs, [todayKey]: updatedLog },
      todayKey
    ),
  };

  const isSevenMilestone =
    view.effectiveStreak >= 7 && view.effectiveStreak % 7 === 0;

  return {
    claimed: true,
    pointsAwarded,
    nextState,
    milestoneReached: isSevenMilestone ? view.effectiveStreak : null,
  };
}

export function getSevenDayMotivationalMessage(
  streakDays: number,
  language: AppLanguage = 'ar'
): {
  headline: string;
  hadith: string;
  subtext: string;
} {
  if (language === 'en') {
    if (streakDays >= 28) {
      return {
        headline: `MashaAllah! You completed ${streakDays} consecutive days of consistency`,
        hadith:
          '"The most beloved deeds to Allah are those done consistently, even if small." — Agreed upon',
        subtext:
          'Reciting the Book of Allah and remembering Him has become a deeply rooted daily habit. Keep going!',
      };
    }
    if (streakDays >= 14) {
      return {
        headline: `Blessed milestone! ${streakDays} consecutive days with Quran & Dhikr`,
        hadith:
          '"The best among you are those who learn the Quran and teach it." — Al-Bukhari',
        subtext:
          'Two weeks of steadiness! Every page recited and every Tasbeeh brings peace and light to your heart.',
      };
    }
    return {
      headline: 'Congratulations! You completed 7 consecutive days of Quran & Dhikr',
      hadith:
        '"The most beloved deeds to Allah are those done consistently, even if small." — Agreed upon',
      subtext:
        'Seven uninterrupted days of Quran and Tasbeeh make a profound difference in tranquility and blessing. Keep your daily Wird strong!',
    };
  }

  if (streakDays >= 28) {
    return {
      headline: `ما شاء الله! أتممت ${streakDays} يوماً من المواظبة المتواصلة`,
      hadith: '«أَحَبُّ الأَعْمَالِ إِلَى اللَّهِ أَدْوَمُهَا وَإِنْ قَلَّ» — متفق عليه',
      subtext:
        'لقد أصبحت تلاوة كتاب الله وذكره عادة راسخة في يومك. استمر وثبّت الله قلبك بالقرآن.',
    };
  }
  if (streakDays >= 14) {
    return {
      headline: `إنجاز مبارك! ${streakDays} يوماً متتالياً مع القرآن والذكر`,
      hadith: '«خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ» — رواه البخاري',
      subtext:
        'أسبوعان من الثبات والمواظبة! كل صفحة تقرؤها وكل تسبيحة تزيد قلبك طمأنينة ونوراً.',
    };
  }
  return {
    headline: 'هنيئاً لك! أتممت ٧ أيام متتالية من القراءة والذكر',
    hadith: '«أَحَبُّ الأَعْمَالِ إِلَى اللَّهِ أَدْوَمُهَا وَإِنْ قَلَّ» — متفق عليه',
    subtext:
      'سبعة أيام متواصلة من الصلة بالقرآن والتسبيح تصنع فرقاً عظيماً في القلب والبركة. واصل هذا العهد الطيب وحافظ على وردك اليومي!',
  };
}
