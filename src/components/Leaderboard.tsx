import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  CalendarDays,
  Check,
  Copy,
  Crown,
  ExternalLink,
  LogIn,
  Medal,
  Share2,
  Trophy,
  Users,
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  getCurrentMonthKey,
  getCurrentWeekKey,
  LeaderboardEntryRecord,
  LeaderboardPeriod,
  subscribeToLeaderboard,
  subscribeToMyLeaderboardEntry,
} from '../firebase';
import { toArabicDigits } from '../utils/arabic';
import {
  APP_DEFAULT_SHARE_TEXT,
  APP_SHARE_URL,
  buildTelegramShareUrl,
  buildWhatsAppShareUrl,
  copyTextToClipboard,
  shareNativeOrCopy,
} from '../utils/share';
import type { CertificateData } from './CertificateModal';

export interface LeaderboardProps {
  user: User | null;
  authLoading: boolean;
  localPoints: number;
  localWins: number;
  localRounds: number;
  onSignIn: () => Promise<void> | void;
  onOpenCertificate: (cert: CertificateData) => void;
  onShowToast: (msg: string) => void;
}

const PERIOD_OPTIONS: {
  id: LeaderboardPeriod;
  label: string;
  subtitle: string;
}[] = [
  { id: 'weekly', label: 'التصنيف الأسبوعي', subtitle: 'نقاط هذا الأسبوع' },
  { id: 'monthly', label: 'التصنيف الشهري', subtitle: 'نقاط هذا الشهر' },
  { id: 'all', label: 'التصنيف العام', subtitle: 'إجمالي النقاط التراكمية' },
];

export const Leaderboard: React.FC<LeaderboardProps> = ({
  user,
  authLoading,
  localPoints,
  localWins,
  localRounds,
  onSignIn,
  onOpenCertificate,
  onShowToast,
}) => {
  const [period, setPeriod] = useState<LeaderboardPeriod>('weekly');
  const [entries, setEntries] = useState<LeaderboardEntryRecord[]>([]);
  const [myDirectEntry, setMyDirectEntry] =
    useState<LeaderboardEntryRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [copiedLink, setCopiedLink] = useState(false);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!user) {
      setEntries([]);
      setMyDirectEntry(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    const unsubList = subscribeToLeaderboard(
      (list) => {
        setEntries(list);
        setLoading(false);
        setError(null);
      },
      () => {
        setError('تعذر تحميل لوحة الصدارة حالياً، حاول التحديث لاحقاً');
        setLoading(false);
      },
      { period, maxEntries: 100 }
    );
    const unsubMe = subscribeToMyLeaderboardEntry(
      user.uid,
      (mine) => {
        setMyDirectEntry(mine);
      },
      () => {
        // Ignore individual fallback errors; list subscription already surfaces error state
      }
    );
    return () => {
      unsubList();
      unsubMe();
    };
  }, [user, period, reloadNonce]);

  const currentWeekKey = getCurrentWeekKey();
  const currentMonthKey = getCurrentMonthKey();

  const mergedEntries = useMemo(() => {
    if (!user || !myDirectEntry) return entries;
    if (entries.some((e) => e.uid === myDirectEntry.uid)) {
      return entries.map((e) => (e.uid === myDirectEntry.uid ? myDirectEntry : e));
    }
    return [...entries, myDirectEntry];
  }, [entries, myDirectEntry, user]);

  const rankedEntries = useMemo(() => {
    const withPeriodScore = mergedEntries
      .map((entry) => {
        let periodScore = entry.totalPoints;
        let isActiveInPeriod = entry.totalPoints > 0;
        if (period === 'weekly') {
          isActiveInPeriod = entry.weekKey === currentWeekKey && entry.weeklyPoints > 0;
          periodScore = entry.weekKey === currentWeekKey ? entry.weeklyPoints : 0;
        } else if (period === 'monthly') {
          isActiveInPeriod = entry.monthKey === currentMonthKey && entry.monthlyPoints > 0;
          periodScore = entry.monthKey === currentMonthKey ? entry.monthlyPoints : 0;
        }
        return {
          ...entry,
          periodScore,
          isActiveInPeriod,
        };
      })
      .filter((item) => item.isActiveInPeriod)
      .sort((a, b) => {
        if (b.periodScore !== a.periodScore) return b.periodScore - a.periodScore;
        if (b.winsCount !== a.winsCount) return b.winsCount - a.winsCount;
        return b.totalPoints - a.totalPoints;
      });

    return withPeriodScore;
  }, [mergedEntries, period, currentWeekKey, currentMonthKey]);

  const myEntry = useMemo(
    () =>
      user
        ? myDirectEntry ?? entries.find((e) => e.uid === user.uid) ?? null
        : null,
    [entries, myDirectEntry, user]
  );

  const myRankIndex = useMemo(
    () => (user ? rankedEntries.findIndex((e) => e.uid === user.uid) : -1),
    [rankedEntries, user]
  );

  const myRankNumber = myRankIndex >= 0 ? myRankIndex + 1 : null;
  const activePeriodLabel =
    PERIOD_OPTIONS.find((p) => p.id === period)?.label || 'التصنيف الأسبوعي';

  const myDisplayPoints = useMemo(() => {
    if (!myEntry) return period === 'all' ? localPoints : 0;
    if (period === 'weekly') {
      return myEntry.weekKey === currentWeekKey ? myEntry.weeklyPoints : 0;
    }
    if (period === 'monthly') {
      return myEntry.monthKey === currentMonthKey ? myEntry.monthlyPoints : 0;
    }
    return myEntry.totalPoints;
  }, [myEntry, period, currentWeekKey, currentMonthKey, localPoints]);

  const handleOpenMyCertificate = () => {
    const name =
      myEntry?.displayName ||
      user?.displayName ||
      'قارئ كتاب الله';
    const points = myEntry ? Math.max(myDisplayPoints, myEntry.totalPoints) : localPoints;
    const wins = myEntry ? myEntry.winsCount : localWins;
    const rounds = myEntry ? myEntry.roundsCount : localRounds;

    onOpenCertificate({
      recipientName: name,
      title: 'شهادة تميّز وتفوق في مسابقات القرآن والسنة',
      achievementLabel:
        'تقديراً لجهوده المباركة في حفظ كتاب الله والتفقّه في السنة النبوية المطهرة ومنافساته الإيمانية.',
      points,
      winsCount: wins,
      roundsCount: rounds,
      rank: myRankNumber,
      periodLabel: myRankNumber
        ? `${activePeriodLabel} · المركز ${toArabicDigits(myRankNumber)}`
        : activePeriodLabel,
    });
  };

  const handleCopyAppLink = async () => {
    const ok = await copyTextToClipboard(`${APP_DEFAULT_SHARE_TEXT}\n${APP_SHARE_URL}`);
    if (ok) {
      setCopiedLink(true);
      onShowToast('تم نسخ رابط مشاركة التطبيق!');
      window.setTimeout(() => setCopiedLink(false), 2000);
    } else {
      onShowToast(APP_SHARE_URL);
    }
  };

  const handleNativeShareApp = async () => {
    const res = await shareNativeOrCopy({
      title: 'تطبيق المصحف الجامع — حفظ القرآن والسنة',
      text: APP_DEFAULT_SHARE_TEXT,
      url: APP_SHARE_URL,
    });
    if (res === 'copied') {
      onShowToast('تم نسخ رسالة ورابط مشاركة التطبيق');
    }
  };

  const topThree = rankedEntries.slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Period Filter & Personal Certificate Summary */}
      <section className="rounded-3xl ios-glass-card p-6 sm:p-7 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#9A742E] dark:text-amber-400">
              <CalendarDays className="w-3.5 h-3.5" />
              <span>تصفية الترتيب · نقاط الفوز · شهادات التقدير</span>
            </div>
            <h2 className="font-amiri text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100">
              لوحة صدارة فرسان القرآن والسنة
            </h2>
          </div>

          <div
            role="group"
            aria-label="تصفية لوحة الصدارة حسب الفترة"
            className="flex flex-wrap items-center gap-2"
          >
            {PERIOD_OPTIONS.map((opt) => {
              const active = period === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPeriod(opt.id)}
                  className={`ios-spring px-4 py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-[#14532D] dark:bg-emerald-700 text-[#FBF8F1]'
                      : 'ios-glass-input text-stone-700 dark:text-stone-200 hover:bg-white/70 dark:hover:bg-stone-800/70'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* User Personal Score & Virtual Certificate Trigger */}
        <div className="rounded-2xl bg-[#14532D]/8 dark:bg-emerald-500/12 border border-[#14532D]/20 dark:border-emerald-400/25 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-semibold text-[#14532D] dark:text-emerald-300">
              {user ? `رصيدك في ${activePeriodLabel}` : 'إحصائياتك المحلية الحالية'}
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm sm:text-base font-bold text-stone-900 dark:text-stone-100 tabular-nums">
              <span>
                النقاط:{' '}
                <span className="text-[#14532D] dark:text-emerald-300">
                  {toArabicDigits(user ? myDisplayPoints : localPoints)}
                </span>
              </span>
              <span aria-hidden="true" className="text-stone-400">
                ·
              </span>
              <span>
                مرات الفوز:{' '}
                <span className="text-[#9A742E] dark:text-amber-400">
                  {toArabicDigits(myEntry ? myEntry.winsCount : localWins)}
                </span>
              </span>
              {myRankNumber && (
                <>
                  <span aria-hidden="true" className="text-stone-400">
                    ·
                  </span>
                  <span>
                    ترتيبك الحالي: المركز {toArabicDigits(myRankNumber)}
                  </span>
                </>
              )}
            </div>
            <p className="text-xs text-stone-600 dark:text-stone-300">
              يحصل الفائز في التحدي المباشر على +٥٠ نقطة إضافية (+٢٥ للتعادل، و+٢٥ نقطة تفوّق في المسابقات الفردية).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleOpenMyCertificate}
              className="ios-spring inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#9A742E] hover:bg-[#826023] text-white text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0"
            >
              <Award className="w-4 h-4" />
              <span>استخراج شهادة افتراضية</span>
            </button>
          </div>
        </div>
      </section>

      {/* Real Firestore Leaderboard List */}
      {!user ? (
        <section className="rounded-3xl ios-glass-card p-8 sm:p-10 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#14532D]/12 dark:bg-emerald-500/20 flex items-center justify-center text-[#14532D] dark:text-emerald-300">
            <Trophy className="w-7 h-7" />
          </div>
          <h3 className="font-amiri text-2xl font-bold text-stone-900 dark:text-stone-100">
            سجّل دخولك لعرض الترتيب العام والأسبوعي والشهري
          </h3>
          <p className="text-sm text-stone-600 dark:text-stone-300 max-w-xl mx-auto leading-relaxed">
            تعرض لوحة الصدارة ترتيب المشاركين الحقيقيين ونقاطهم المسجلة في مسابقات حفظ القرآن والسنة. سجّل دخولك عبر Google ليُحفظ رصيدك وتظهر في التصنيف الأسبوعي والشهري.
          </p>
          <button
            type="button"
            disabled={authLoading}
            onClick={() => void onSignIn()}
            className="ios-spring inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#14532D] hover:bg-[#114224] dark:bg-emerald-700 dark:hover:bg-emerald-600 text-[#FBF8F1] text-sm font-semibold whitespace-nowrap shrink-0 disabled:opacity-60"
          >
            <LogIn className="w-4 h-4" />
            <span>تسجيل الدخول عبر Google</span>
          </button>
        </section>
      ) : loading ? (
        <div className="rounded-3xl ios-glass-card p-10 text-center text-sm text-stone-500 dark:text-stone-400">
          جاري تحميل لوحة الصدارة...
        </div>
      ) : error ? (
        <div
          role="alert"
          className="rounded-2xl bg-rose-500/12 border border-rose-500/35 px-4 py-3.5 flex flex-wrap items-center justify-between gap-3 text-sm text-rose-800 dark:text-rose-200"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setReloadNonce((n) => n + 1)}
            className="ios-spring px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold whitespace-nowrap"
          >
            إعادة المحاولة
          </button>
        </div>
      ) : rankedEntries.length === 0 ? (
        <section className="rounded-3xl ios-glass-card p-8 sm:p-10 text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/15 text-[#9A742E] dark:text-amber-400 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="font-amiri text-2xl font-bold text-stone-900 dark:text-stone-100">
            لا توجد نقاط مسجلة في {activePeriodLabel} حتى الآن
          </h3>
          <p className="text-sm text-stone-600 dark:text-stone-300 max-w-lg mx-auto">
            أكمل جولة في المسابقات الفردية أو نافس صديقاً في غرفة التحدي لتتصدر القائمة هذا الأسبوع!
          </p>
        </section>
      ) : (
        <div className="space-y-6">
          {/* Top 3 Honor Podium */}
          <section
            aria-label="المراكز الثلاثة الأولى"
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            {topThree.map((item, idx) => {
              const rank = idx + 1;
              const isMe = item.uid === user.uid;
              const medalColor =
                rank === 1
                  ? 'bg-amber-500/20 text-[#9A742E] dark:text-amber-300 border-amber-500/40'
                  : rank === 2
                  ? 'bg-stone-300/30 text-stone-700 dark:text-stone-200 border-stone-400/40'
                  : 'bg-orange-500/15 text-orange-800 dark:text-orange-300 border-orange-500/35';

              return (
                <div
                  key={item.uid}
                  className={`rounded-3xl ios-glass-card p-5 space-y-4 border ${
                    isMe
                      ? 'border-[#14532D] dark:border-emerald-400'
                      : 'border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl border text-xs font-bold tabular-nums ${medalColor}`}
                    >
                      {rank === 1 ? (
                        <Crown className="w-3.5 h-3.5" />
                      ) : (
                        <Medal className="w-3.5 h-3.5" />
                      )}
                      <span>المركز {toArabicDigits(rank)}</span>
                    </span>
                    <span className="text-lg font-bold text-[#14532D] dark:text-emerald-300 tabular-nums">
                      {toArabicDigits(item.periodScore)} نقطة
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    {item.photoURL && !brokenImages[item.uid] ? (
                      <img
                        src={item.photoURL}
                        alt={item.displayName}
                        onError={() =>
                          setBrokenImages((prev) => ({ ...prev, [item.uid]: true }))
                        }
                        className="w-11 h-11 rounded-full object-cover border border-stone-300/70 dark:border-stone-700 shrink-0"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-[#14532D]/15 dark:bg-emerald-500/25 text-[#14532D] dark:text-emerald-200 flex items-center justify-center font-bold text-base shrink-0">
                        {item.displayName.slice(0, 1)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-stone-900 dark:text-stone-100 truncate">
                        {item.displayName} {isMe ? '(أنت)' : ''}
                      </div>
                      <div className="text-xs text-stone-500 dark:text-stone-400 tabular-nums">
                        {toArabicDigits(item.winsCount)} فوز ·{' '}
                        {toArabicDigits(item.roundsCount)} جولة
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </section>

          {/* Full Ranking List */}
          <section className="rounded-3xl ios-glass-card overflow-hidden">
            <div className="px-6 py-4 border-b border-stone-200/70 dark:border-stone-800/70 flex items-center justify-between gap-3">
              <h3 className="font-amiri text-xl font-bold text-stone-900 dark:text-stone-100">
                الترتيب الكامل ({toArabicDigits(rankedEntries.length)} متسابق)
              </h3>
              <span className="text-xs text-stone-500 dark:text-stone-400">
                {PERIOD_OPTIONS.find((p) => p.id === period)?.subtitle}
              </span>
            </div>

            <div className="divide-y divide-stone-200/60 dark:divide-stone-800/70">
              {rankedEntries.map((item, idx) => {
                const rank = idx + 1;
                const isMe = item.uid === user.uid;
                return (
                  <div
                    key={item.uid}
                    className={`px-5 sm:px-6 py-3.5 flex items-center justify-between gap-4 ${
                      isMe ? 'bg-[#14532D]/8 dark:bg-emerald-500/12' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold tabular-nums shrink-0 ${
                          rank <= 3
                            ? 'bg-[#9A742E]/18 text-[#9A742E] dark:text-amber-300'
                            : 'ios-glass-input text-stone-700 dark:text-stone-300'
                        }`}
                      >
                        {toArabicDigits(rank)}
                      </div>

                      {item.photoURL && !brokenImages[item.uid] ? (
                        <img
                          src={item.photoURL}
                          alt={item.displayName}
                          onError={() =>
                            setBrokenImages((prev) => ({
                              ...prev,
                              [item.uid]: true,
                            }))
                          }
                          className="w-9 h-9 rounded-full object-cover border border-stone-300/60 dark:border-stone-700 shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-[#14532D]/15 dark:bg-emerald-500/20 text-[#14532D] dark:text-emerald-200 flex items-center justify-center text-sm font-bold shrink-0">
                          {item.displayName.slice(0, 1)}
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="text-sm font-bold text-stone-900 dark:text-stone-100 truncate">
                          {item.displayName} {isMe ? '(أنت)' : ''}
                        </div>
                        <div className="text-xs text-stone-500 dark:text-stone-400 tabular-nums">
                          {toArabicDigits(item.winsCount)} فوز ·{' '}
                          {toArabicDigits(item.roundsCount)} جولة · أطول سلسلة{' '}
                          {toArabicDigits(item.bestStreak)}
                        </div>
                      </div>
                    </div>

                    <div className="text-left shrink-0 tabular-nums">
                      <div className="text-sm sm:text-base font-bold text-[#14532D] dark:text-emerald-300">
                        {toArabicDigits(item.periodScore)} نقطة
                      </div>
                      {period !== 'all' && (
                        <div className="text-[11px] text-stone-500 dark:text-stone-400">
                          الإجمالي: {toArabicDigits(item.totalPoints)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* Share App Section */}
      <section className="rounded-3xl ios-glass-card p-6 sm:p-7 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="space-y-1.5 max-w-2xl">
          <div className="text-xs font-semibold text-[#9A742E] dark:text-amber-400">
            الدال على الخير كفاعله
          </div>
          <h3 className="font-amiri text-2xl font-bold text-stone-900 dark:text-stone-100">
            شارك تطبيق «المصحف الجامع» مع أهلك وأصدقائك
          </h3>
          <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
            ادعُ أصدقاءك لقراءة كتاب الله، وتنافسوا معاً في غرف تحدي الحفظ والسنة النبوية، وتصّدروا لوحة الشرف الأسبوعية والشهرية.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => void handleNativeShareApp()}
            className="ios-spring inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#14532D] hover:bg-[#114224] dark:bg-emerald-700 dark:hover:bg-emerald-600 text-[#FBF8F1] text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0"
          >
            <Share2 className="w-4 h-4" />
            <span>مشاركة التطبيق</span>
          </button>

          <button
            type="button"
            onClick={() => void handleCopyAppLink()}
            className="ios-spring inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl ios-glass-input text-xs sm:text-sm font-medium text-stone-800 dark:text-stone-200 whitespace-nowrap shrink-0"
          >
            {copiedLink ? (
              <Check className="w-4 h-4 text-emerald-600" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
            <span>نسخ الرابط</span>
          </button>

          <a
            href={buildWhatsAppShareUrl(`${APP_DEFAULT_SHARE_TEXT}\n${APP_SHARE_URL}`)}
            target="_blank"
            rel="noopener noreferrer"
            className="ios-spring inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl ios-glass-input text-xs sm:text-sm font-medium text-[#14532D] dark:text-emerald-300 whitespace-nowrap shrink-0"
          >
            <ExternalLink className="w-4 h-4" />
            <span>واتساب</span>
          </a>

          <a
            href={buildTelegramShareUrl(APP_SHARE_URL, APP_DEFAULT_SHARE_TEXT)}
            target="_blank"
            rel="noopener noreferrer"
            className="ios-spring inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl ios-glass-input text-xs sm:text-sm font-medium text-[#14532D] dark:text-emerald-300 whitespace-nowrap shrink-0"
          >
            <ExternalLink className="w-4 h-4" />
            <span>تيليجرام</span>
          </a>
        </div>
      </section>
    </div>
  );
};
export default Leaderboard;
