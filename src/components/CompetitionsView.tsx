import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  Flame,
  Medal,
  Play,
  RefreshCw,
  Share2,
  Trophy,
  Users,
  XCircle,
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  COMPETITION_QUESTIONS,
  CompetitionMode,
  CompetitionQuestion,
  selectSeededQuestions,
} from '../data/competitionsData';
import { awardCompetitionPoints } from '../firebase';
import { HifzQuizAchievementRecord, LastReadPosition, SurahMeta } from '../types/quran';
import { toArabicDigits } from '../utils/arabic';
import { APP_DEFAULT_SHARE_TEXT, APP_SHARE_URL, shareNativeOrCopy } from '../utils/share';
import { CertificateData, CertificateModal } from './CertificateModal';
import { ChallengeRoom } from './ChallengeRoom';
import { HifzQuizView } from './HifzQuizView';
import { Leaderboard } from './Leaderboard';

export type HubTab = 'solo' | 'hifz_quiz' | 'friend' | 'leaderboard';

interface CompetitionsViewProps {
  user: User | null;
  authLoading: boolean;
  lastRead: LastReadPosition;
  surahList: SurahMeta[];
  initialRoomCode?: string | null;
  initialTab?: HubTab;
  hifzStats: HifzQuizAchievementRecord;
  onUpdateHifzStats: (next: HifzQuizAchievementRecord) => void;
  onHifzQuizCompleted?: () => void;
  onSignIn: () => Promise<void> | void;
  onOpenSurah: (surahNumber: number, ayahNumber?: number) => void;
  onShowToast: (msg: string) => void;
}

interface SoloSavedStats {
  totalAnswered: number;
  totalCorrect: number;
  bestScorePct: number;
  roundsCompleted: number;
  totalPoints: number;
  winsCount: number;
}

const STATS_STORAGE_KEY = 'quran_competition_stats_v1';

function loadSoloStats(): SoloSavedStats {
  try {
    const raw = localStorage.getItem(STATS_STORAGE_KEY);
    if (!raw) {
      return {
        totalAnswered: 0,
        totalCorrect: 0,
        bestScorePct: 0,
        roundsCompleted: 0,
        totalPoints: 0,
        winsCount: 0,
      };
    }
    return {
      totalAnswered: 0,
      totalCorrect: 0,
      bestScorePct: 0,
      roundsCompleted: 0,
      totalPoints: 0,
      winsCount: 0,
      ...JSON.parse(raw),
    };
  } catch {
    return {
      totalAnswered: 0,
      totalCorrect: 0,
      bestScorePct: 0,
      roundsCompleted: 0,
      totalPoints: 0,
      winsCount: 0,
    };
  }
}

export const CompetitionsView: React.FC<CompetitionsViewProps> = ({
  user,
  authLoading,
  lastRead,
  surahList,
  initialRoomCode,
  initialTab,
  hifzStats,
  onUpdateHifzStats,
  onHifzQuizCompleted,
  onSignIn,
  onOpenSurah,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<HubTab>(() =>
    initialRoomCode ? 'friend' : initialTab ?? 'solo'
  );

  useEffect(() => {
    if (initialRoomCode) {
      setActiveTab('friend');
    } else if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialRoomCode, initialTab]);

  // ==================== SOLO QUIZ STATE ====================
  const [soloMode, setSoloMode] = useState<CompetitionMode>('mixed');
  const [soloCount, setSoloCount] = useState<number>(6);
  const [soloTimed, setSoloTimed] = useState<boolean>(false);
  const [soloStats, setSoloStats] = useState<SoloSavedStats>(loadSoloStats);
  const [soloQuestions, setSoloQuestions] = useState<CompetitionQuestion[]>([]);
  const [soloIndex, setSoloIndex] = useState<number>(0);
  const [soloSelectedOption, setSoloSelectedOption] = useState<number | null>(null);
  const [soloCorrectCount, setSoloCorrectCount] = useState<number>(0);
  const [soloPoints, setSoloPoints] = useState<number>(0);
  const [soloStreak, setSoloStreak] = useState<number>(0);
  const [soloMaxStreak, setSoloMaxStreak] = useState<number>(0);
  const [soloFinished, setSoloFinished] = useState<boolean>(false);
  const [soloSecondsLeft, setSoloSecondsLeft] = useState<number>(25);
  const [lastSoloAward, setLastSoloAward] = useState<{
    totalAwarded: number;
    bonus: number;
    isWin: boolean;
  } | null>(null);
  const [certificateData, setCertificateData] = useState<CertificateData | null>(null);

  const soloActiveQuestion = soloQuestions[soloIndex] ?? null;

  useEffect(() => {
    try {
      localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(soloStats));
    } catch {
      // ignore
    }
  }, [soloStats]);

  useEffect(() => {
    if (
      activeTab !== 'solo' ||
      !soloTimed ||
      !soloActiveQuestion ||
      soloSelectedOption !== null ||
      soloFinished
    ) {
      return;
    }
    if (soloSecondsLeft <= 0) {
      setSoloSelectedOption(-1);
      setSoloStreak(0);
      return;
    }
    const timer = window.setTimeout(() => {
      setSoloSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [
    activeTab,
    soloTimed,
    soloActiveQuestion,
    soloSelectedOption,
    soloFinished,
    soloSecondsLeft,
  ]);

  const handleStartSolo = () => {
    const picked = selectSeededQuestions(soloMode, soloCount);
    setSoloQuestions(picked);
    setSoloIndex(0);
    setSoloSelectedOption(null);
    setSoloCorrectCount(0);
    setSoloPoints(0);
    setSoloStreak(0);
    setSoloMaxStreak(0);
    setSoloFinished(false);
    setSoloSecondsLeft(25);
    setLastSoloAward(null);
  };

  const handleSoloAnswer = (optionIdx: number) => {
    if (!soloActiveQuestion || soloSelectedOption !== null) return;
    setSoloSelectedOption(optionIdx);
    const isCorrect = optionIdx === soloActiveQuestion.correctIndex;
    if (isCorrect) {
      const nextStreak = soloStreak + 1;
      const bonus = soloTimed ? Math.min(10, Math.floor(soloSecondsLeft / 3)) : 0;
      setSoloCorrectCount((c) => c + 1);
      setSoloPoints((p) => p + 10 + bonus);
      setSoloStreak(nextStreak);
      setSoloMaxStreak((m) => Math.max(m, nextStreak));
    } else {
      setSoloStreak(0);
    }
  };

  const handleSoloNext = () => {
    if (soloIndex + 1 < soloQuestions.length) {
      setSoloIndex((i) => i + 1);
      setSoloSelectedOption(null);
      setSoloSecondsLeft(25);
    } else {
      setSoloFinished(true);
      const total = soloQuestions.length || 1;
      const pct = Math.round((soloCorrectCount / total) * 100);
      const isWin = pct >= 70;
      const bonus = isWin ? 25 : 10;
      const totalAwarded = Math.min(250, Math.max(10, soloPoints + bonus));
      setLastSoloAward({ totalAwarded, bonus, isWin });

      setSoloStats((prev) => ({
        totalAnswered: prev.totalAnswered + total,
        totalCorrect: prev.totalCorrect + soloCorrectCount,
        bestScorePct: Math.max(prev.bestScorePct, pct),
        roundsCompleted: prev.roundsCompleted + 1,
        totalPoints: (prev.totalPoints || 0) + totalAwarded,
        winsCount: (prev.winsCount || 0) + (isWin ? 1 : 0),
      }));

      if (user) {
        const roundKey = `solo_${Date.now()}_${soloQuestions.length}_${soloCorrectCount}`;
        awardCompetitionPoints({
          user,
          pointsEarned: totalAwarded,
          isWin,
          bestStreak: soloMaxStreak,
          roundKey,
        })
          .then((res) => {
            if (res.awarded) {
              onShowToast(
                isWin
                  ? `أحسنت! أُضيف +${toArabicDigits(res.deltaPoints)} نقطة (تشمل مكافأة التفوق) للوحة الصدارة`
                  : `أُضيف +${toArabicDigits(res.deltaPoints)} نقطة إلى لوحة الصدارة`
              );
            }
          })
          .catch((err) => {
            console.error('Failed to sync solo competition points:', err);
            onShowToast('تم حفظ نتيجتك محلياً؛ تعذر تحديث لوحة الصدارة السحابية الآن');
          });
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8">
      {/* Header Banner */}
      <section className="rounded-3xl ios-glass-card p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="text-xs font-medium text-[#9A742E] dark:text-amber-400">
            حفظ كتاب الله · السنة النبوية · غرفة التحدي المباشر مع الأصدقاء
          </div>
          <h1 className="font-amiri text-3xl sm:text-4xl font-bold text-[#1C1917] dark:text-[#F2EFE8]">
            رفيق الحفظ والمسابقات
          </h1>
          <p className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
            اختبر حفظك للقرآن الكريم وتفقّهك في السنة النبوية فردياً أو أنشئ غرفة تحدٍ
            مع رمز دعوة لمشاركة صديقك والتنافس المباشر لحظة بلحظة.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('solo')}
            className={`ios-spring inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap shrink-0 ${
              activeTab === 'solo'
                ? 'bg-[#14532D] dark:bg-emerald-700 text-[#FBF8F1]'
                : 'ios-glass-input text-stone-700 dark:text-stone-200 hover:bg-white/70 dark:hover:bg-stone-800/70'
            }`}
          >
            <Trophy className="w-4 h-4" />
            <span>المسابقات الفردية</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('hifz_quiz')}
            className={`ios-spring inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap shrink-0 ${
              activeTab === 'hifz_quiz'
                ? 'bg-[#14532D] dark:bg-emerald-700 text-[#FBF8F1]'
                : 'ios-glass-input text-stone-700 dark:text-stone-200 hover:bg-white/70 dark:hover:bg-stone-800/70'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>اختبار الحفظ التفاعلي</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('friend')}
            className={`ios-spring inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap shrink-0 ${
              activeTab === 'friend'
                ? 'bg-[#14532D] dark:bg-emerald-700 text-[#FBF8F1]'
                : 'ios-glass-input text-stone-700 dark:text-stone-200 hover:bg-white/70 dark:hover:bg-stone-800/70'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>غرفة التحدي مع صديق</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('leaderboard')}
            className={`ios-spring inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap shrink-0 ${
              activeTab === 'leaderboard'
                ? 'bg-[#14532D] dark:bg-emerald-700 text-[#FBF8F1]'
                : 'ios-glass-input text-stone-700 dark:text-stone-200 hover:bg-white/70 dark:hover:bg-stone-800/70'
            }`}
          >
            <Medal className="w-4 h-4" />
            <span>لوحة الصدارة والشهادات</span>
          </button>
        </div>
      </section>

      {/* ==================== TAB 1: SOLO COMPETITIONS ==================== */}
      {activeTab === 'solo' && (
        <div className="space-y-6">
          {/* Personal Stats Bar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl ios-glass-card p-4 space-y-1">
              <div className="text-xs text-stone-500 dark:text-stone-400">مجموع نقاطك</div>
              <div className="text-2xl font-bold text-[#14532D] dark:text-emerald-300 tabular-nums">
                {toArabicDigits(soloStats.totalPoints || 0)} نقطة
              </div>
            </div>
            <div className="rounded-2xl ios-glass-card p-4 space-y-1">
              <div className="text-xs text-stone-500 dark:text-stone-400">إجابات صحيحة</div>
              <div className="text-2xl font-bold text-stone-900 dark:text-stone-100 tabular-nums">
                {toArabicDigits(soloStats.totalCorrect)} / {toArabicDigits(soloStats.totalAnswered)}
              </div>
            </div>
            <div className="rounded-2xl ios-glass-card p-4 space-y-1">
              <div className="text-xs text-stone-500 dark:text-stone-400">مرات الفوز / التفوق</div>
              <div className="text-2xl font-bold text-[#9A742E] dark:text-amber-400 tabular-nums">
                {toArabicDigits(soloStats.winsCount || 0)} ({toArabicDigits(soloStats.bestScorePct)}٪)
              </div>
            </div>
            <div className="rounded-2xl ios-glass-card p-4 space-y-1">
              <div className="text-xs text-stone-500 dark:text-stone-400">بنك الأسئلة المتاح</div>
              <div className="text-2xl font-bold text-stone-900 dark:text-stone-100 tabular-nums">
                {toArabicDigits(COMPETITION_QUESTIONS.length)} سؤال
              </div>
            </div>
          </div>

          {soloQuestions.length === 0 ? (
            <div className="rounded-3xl ios-glass-card p-6 sm:p-8 space-y-6">
              <div className="space-y-1">
                <h2 className="font-amiri text-2xl font-bold text-stone-900 dark:text-stone-100">
                  إعداد جولة المسابقة
                </h2>
                <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400">
                  اختر مسار المسابقة وعدد الأسئلة لتثبيت الحفظ وتنمية الثقافة في السنة النبوية
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(
                  [
                    {
                      id: 'hifz' as CompetitionMode,
                      title: 'حفظ كتاب الله وتدبره',
                      desc: 'إكمال الآيات، المتشابهات، وأسماء السور وربطها بالمصحف',
                    },
                    {
                      id: 'sunnah' as CompetitionMode,
                      title: 'السنة النبوية والسيرة',
                      desc: 'الأحاديث الصحيحة، الآداب النبوية اليومية، وسير الصحابة',
                    },
                    {
                      id: 'mixed' as CompetitionMode,
                      title: 'مسابقة شاملة (القرآن والسنة)',
                      desc: 'تحدٍ متوازن يجمع بين حفظ الآيات ومعرفة السنة المطهرة',
                    },
                  ]
                ).map((item) => {
                  const selected = soloMode === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSoloMode(item.id)}
                      className={`ios-spring text-right p-5 rounded-2xl border transition-all space-y-1.5 ${
                        selected
                          ? 'bg-[#14532D]/10 dark:bg-emerald-500/15 border-[#14532D] dark:border-emerald-400'
                          : 'ios-glass-input border-transparent hover:border-stone-300 dark:hover:border-stone-700'
                      }`}
                    >
                      <div className="text-base font-bold text-stone-900 dark:text-stone-100">
                        {item.title}
                      </div>
                      <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
                        {item.desc}
                      </p>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-stone-200/70 dark:border-stone-800/70">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm font-medium text-stone-700 dark:text-stone-300">
                    عدد الأسئلة:
                  </span>
                  {[6, 10, 14].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setSoloCount(num)}
                      className={`ios-spring px-3.5 py-2 rounded-xl text-xs font-semibold tabular-nums whitespace-nowrap shrink-0 ${
                        soloCount === num
                          ? 'bg-[#14532D] dark:bg-emerald-700 text-[#FBF8F1]'
                          : 'ios-glass-input text-stone-700 dark:text-stone-200'
                      }`}
                    >
                      {toArabicDigits(num)} أسئلة
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setSoloTimed((prev) => !prev)}
                  className={`ios-spring inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 ${
                    soloTimed
                      ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/40'
                      : 'ios-glass-input text-stone-700 dark:text-stone-200'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  <span>{soloTimed ? 'مؤقت ٢٥ ثانية: مفعّل' : 'الوضع الهادئ (بدون مؤقت)'}</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('friend')}
                  className="ios-spring inline-flex items-center gap-2 px-4 py-2.5 rounded-xl ios-glass-input text-[#14532D] dark:text-emerald-300 text-xs font-medium whitespace-nowrap shrink-0"
                >
                  <Users className="w-4 h-4" />
                  <span>أو أنشئ غرفة تحدٍ وادعُ صديقك</span>
                </button>

                <button
                  type="button"
                  onClick={handleStartSolo}
                  className="ios-spring inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#14532D] hover:bg-[#114224] dark:bg-emerald-700 dark:hover:bg-emerald-600 text-[#FBF8F1] font-semibold text-sm whitespace-nowrap shrink-0"
                >
                  <Play className="w-4 h-4" />
                  <span>ابدأ المسابقة الآن</span>
                </button>
              </div>
            </div>
          ) : soloFinished ? (
            <div className="rounded-3xl ios-glass-card p-6 sm:p-10 text-center space-y-6">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-[#14532D]/12 dark:bg-emerald-500/20 flex items-center justify-center text-[#14532D] dark:text-emerald-300">
                <Award className="w-9 h-9" />
              </div>

              <div className="space-y-2">
                <h2 className="font-amiri text-3xl font-bold text-stone-900 dark:text-stone-100">
                  {soloCorrectCount / soloQuestions.length >= 0.8
                    ? 'ما شاء الله! أداء متميز ومبارك'
                    : soloCorrectCount / soloQuestions.length >= 0.5
                    ? 'أحسنت! نتيجة طيبة واستمر في المراجعة'
                    : 'بداية موفقة! راجع التفسيرات وجرّب جولة أخرى'}
                </h2>
                <p className="text-sm text-stone-600 dark:text-stone-300 tabular-nums">
                  أجبت إجابة صحيحة على {toArabicDigits(soloCorrectCount)} من أصل{' '}
                  {toArabicDigits(soloQuestions.length)} سؤال · مجموع هذه الجولة:{' '}
                  {toArabicDigits(lastSoloAward ? lastSoloAward.totalAwarded : soloPoints)} نقطة
                </p>
                {lastSoloAward && (
                  <div className="inline-block rounded-2xl bg-[#14532D]/10 dark:bg-emerald-500/15 border border-[#14532D]/25 dark:border-emerald-400/25 px-4 py-2 text-xs font-semibold text-[#14532D] dark:text-emerald-300 tabular-nums">
                    {lastSoloAward.isWin
                      ? `مبارك التفوق! تم احتساب +${toArabicDigits(lastSoloAward.bonus)} نقطة مكافأة إتقان`
                      : `تم احتساب +${toArabicDigits(lastSoloAward.bonus)} نقطة مكافأة إتمام الجولة`}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleStartSolo}
                  className="ios-spring inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#14532D] dark:bg-emerald-700 text-[#FBF8F1] text-sm font-medium whitespace-nowrap shrink-0"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>جولة جديدة</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCertificateData({
                      recipientName: user?.displayName || 'قارئ كتاب الله',
                      title: 'شهادة إتقان في مسابقات القرآن والسنة',
                      achievementLabel: `لإتمام جولة مسابقة بنجاح وتحقيق ${toArabicDigits(
                        soloCorrectCount
                      )} إجابة صحيحة من ${toArabicDigits(soloQuestions.length)} سؤال.`,
                      points: lastSoloAward ? lastSoloAward.totalAwarded : soloPoints,
                      winsCount: soloStats.winsCount,
                      roundsCount: soloStats.roundsCompleted,
                      periodLabel: 'المسابقات الفردية',
                    })
                  }
                  className="ios-spring inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#9A742E] hover:bg-[#826023] text-white text-sm font-medium whitespace-nowrap shrink-0"
                >
                  <Award className="w-4 h-4" />
                  <span>استخراج شهادة افتراضية</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('leaderboard')}
                  className="ios-spring inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl ios-glass-input text-stone-800 dark:text-stone-200 text-sm font-medium whitespace-nowrap shrink-0"
                >
                  <Medal className="w-4 h-4 text-[#9A742E] dark:text-amber-400" />
                  <span>لوحة الصدارة</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void shareNativeOrCopy({
                      title: 'مسابقات المصحف الجامع',
                      text: APP_DEFAULT_SHARE_TEXT,
                      url: APP_SHARE_URL,
                    }).then((res) => {
                      if (res === 'copied') onShowToast('تم نسخ رابط مشاركة التطبيق');
                    });
                  }}
                  className="ios-spring inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl ios-glass-input text-stone-800 dark:text-stone-200 text-sm font-medium whitespace-nowrap shrink-0"
                >
                  <Share2 className="w-4 h-4" />
                  <span>مشاركة التطبيق</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSoloQuestions([])}
                  className="ios-spring px-4 py-2.5 rounded-xl ios-glass-input text-stone-800 dark:text-stone-200 text-sm font-medium whitespace-nowrap shrink-0"
                >
                  تغيير المسار
                </button>
              </div>
            </div>
          ) : (
            soloActiveQuestion && (
              <div className="rounded-3xl ios-glass-card p-6 sm:p-8 space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-stone-200/70 dark:border-stone-800/70">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-stone-600 dark:text-stone-300 tabular-nums">
                    <span className="font-bold text-[#14532D] dark:text-emerald-300">
                      السؤال {toArabicDigits(soloIndex + 1)} من{' '}
                      {toArabicDigits(soloQuestions.length)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {soloActiveQuestion.category === 'hifz'
                        ? 'حفظ كتاب الله'
                        : 'السنة النبوية'}
                    </span>
                    {soloStreak >= 2 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1 text-[#9A742E] dark:text-amber-400 font-semibold">
                          <Flame className="w-3.5 h-3.5" />
                          سلسلة {toArabicDigits(soloStreak)} إجابات
                        </span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs font-semibold tabular-nums">
                    {soloTimed && (
                      <span
                        className={
                          soloSecondsLeft <= 7
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-stone-700 dark:text-stone-300'
                        }
                      >
                        الوقت: {toArabicDigits(soloSecondsLeft)} ث
                      </span>
                    )}
                    <span className="text-[#14532D] dark:text-emerald-300">
                      النقاط: {toArabicDigits(soloPoints)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSoloQuestions([])}
                      className="text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 font-normal"
                    >
                      إنهاء
                    </button>
                  </div>
                </div>

                <div className="h-1.5 w-full rounded-full bg-stone-200/80 dark:bg-stone-800/80 overflow-hidden">
                  <div
                    className="h-full bg-[#14532D] dark:bg-emerald-500 transition-[width] duration-300"
                    style={{
                      width: `${Math.round(((soloIndex + 1) / soloQuestions.length) * 100)}%`,
                    }}
                  />
                </div>

                <h2 className="font-amiri text-2xl sm:text-3xl font-bold leading-relaxed text-[#1C1917] dark:text-[#F2EFE8]">
                  {soloActiveQuestion.prompt}
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {soloActiveQuestion.options.map((opt, idx) => {
                    const answered = soloSelectedOption !== null;
                    const isCorrect = idx === soloActiveQuestion.correctIndex;
                    const isPicked = idx === soloSelectedOption;

                    let cardStyle =
                      'ios-glass-input hover:bg-white/75 dark:hover:bg-stone-800/75 border-transparent text-stone-800 dark:text-stone-200';
                    if (answered) {
                      if (isCorrect) {
                        cardStyle =
                          'bg-emerald-600/15 dark:bg-emerald-500/20 border-emerald-600 dark:border-emerald-400 text-[#14532D] dark:text-emerald-200 font-semibold';
                      } else if (isPicked) {
                        cardStyle =
                          'bg-rose-600/15 dark:bg-rose-500/20 border-rose-600 dark:border-rose-400 text-rose-800 dark:text-rose-200';
                      } else {
                        cardStyle = 'ios-glass-input opacity-60 text-stone-500 dark:text-stone-400';
                      }
                    }

                    return (
                      <button
                        key={idx}
                        type="button"
                        disabled={answered}
                        onClick={() => handleSoloAnswer(idx)}
                        className={`ios-spring text-right p-4 rounded-2xl border flex items-center justify-between gap-3 transition-all ${cardStyle}`}
                      >
                        <span className="text-sm sm:text-base leading-relaxed">{opt}</span>
                        {answered && isCorrect && (
                          <CheckCircle2 className="w-5 h-5 text-emerald-700 dark:text-emerald-300 shrink-0" />
                        )}
                        {answered && isPicked && !isCorrect && (
                          <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {soloSelectedOption !== null && (
                  <div className="rounded-2xl bg-stone-100/80 dark:bg-stone-900/60 border border-stone-200/80 dark:border-stone-800 p-5 space-y-4">
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-[#9A742E] dark:text-amber-400">
                        الفائدة والتوضيح · {soloActiveQuestion.reference}
                      </div>
                      <p className="text-sm text-stone-700 dark:text-stone-200 leading-relaxed">
                        {soloActiveQuestion.explanation}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      {soloActiveQuestion.surahNumber ? (
                        <button
                          type="button"
                          onClick={() =>
                            onOpenSurah(
                              soloActiveQuestion.surahNumber!,
                              soloActiveQuestion.ayahNumber
                            )
                          }
                          className="ios-spring inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl ios-glass-input text-xs font-medium text-[#14532D] dark:text-emerald-300 whitespace-nowrap shrink-0"
                        >
                          <BookOpen className="w-4 h-4" />
                          <span>فتح الآية في المصحف</span>
                        </button>
                      ) : (
                        <span />
                      )}

                      <button
                        type="button"
                        onClick={handleSoloNext}
                        className="ios-spring inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#14532D] dark:bg-emerald-700 text-[#FBF8F1] text-sm font-medium whitespace-nowrap shrink-0"
                      >
                        <span>
                          {soloIndex + 1 < soloQuestions.length
                            ? 'السؤال التالي'
                            : 'عرض النتيجة النهائية'}
                        </span>
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          )}
        </div>
      )}

      {/* ==================== TAB 1B: INTERACTIVE HIFZ QUIZ ==================== */}
      {activeTab === 'hifz_quiz' && (
        <HifzQuizView
          user={user}
          lastRead={lastRead}
          surahList={surahList}
          achievementRecord={hifzStats}
          onUpdateAchievementRecord={onUpdateHifzStats}
          onLocalPointsEarned={(delta, isWin) =>
            setSoloStats((prev) => ({
              ...prev,
              totalPoints: (prev.totalPoints || 0) + delta,
              winsCount: (prev.winsCount || 0) + (isWin ? 1 : 0),
              roundsCompleted: prev.roundsCompleted + 1,
            }))
          }
          onHifzQuizCompleted={onHifzQuizCompleted}
          onOpenSurah={onOpenSurah}
          onOpenCertificate={(cert) => setCertificateData(cert)}
          onShowToast={onShowToast}
        />
      )}

      {/* ==================== TAB 2: CHALLENGE ROOM ==================== */}
      {activeTab === 'friend' && (
        <ChallengeRoom
          user={user}
          authLoading={authLoading}
          lastRead={lastRead}
          surahList={surahList}
          initialRoomCode={initialRoomCode}
          onSignIn={onSignIn}
          onOpenSurah={onOpenSurah}
          onOpenLeaderboard={() => setActiveTab('leaderboard')}
          onOpenCertificate={(cert) => setCertificateData(cert)}
          onLocalPointsEarned={(delta, isWin, isRoundComplete = true) =>
            setSoloStats((prev) => ({
              ...prev,
              totalPoints: (prev.totalPoints || 0) + delta,
              winsCount: (prev.winsCount || 0) + (isWin ? 1 : 0),
              roundsCompleted:
                prev.roundsCompleted + (isRoundComplete ? 1 : 0),
            }))
          }
          onShowToast={onShowToast}
        />
      )}

      {/* ==================== TAB 3: LEADERBOARD & CERTIFICATES ==================== */}
      {activeTab === 'leaderboard' && (
        <Leaderboard
          user={user}
          authLoading={authLoading}
          localPoints={soloStats.totalPoints || 0}
          localWins={soloStats.winsCount || 0}
          localRounds={soloStats.roundsCompleted}
          onSignIn={onSignIn}
          onOpenCertificate={(cert) => setCertificateData(cert)}
          onShowToast={onShowToast}
        />
      )}

      <CertificateModal
        isOpen={certificateData !== null}
        data={certificateData}
        onClose={() => setCertificateData(null)}
        onShowToast={onShowToast}
      />
    </div>
  );
};
