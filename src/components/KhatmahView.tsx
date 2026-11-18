import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import {
  BarChart3,
  Bell,
  BellRing,
  BookOpen,
  CalendarClock,
  Check,
  CheckCircle2,
  Edit3,
  Plus,
  RotateCcw,
  Trash2,
  Users,
} from 'lucide-react';
import { JUZ_LIST } from '../data/quranMeta';
import {
  KhatmahState,
  PersonalKhatmahRecord,
  ReviewSchedule,
  ReviewWirdType,
  SurahMeta,
} from '../types/quran';
import { toArabicDigits } from '../utils/arabic';
import { GroupKhatmahPanel } from './GroupKhatmahPanel';

interface KhatmahViewProps {
  khatmah: KhatmahState;
  khatmahs: PersonalKhatmahRecord[];
  activeKhatmahId: string;
  surahList: SurahMeta[];
  reviewSchedule: ReviewSchedule;
  todayDateKey: string;
  user: User | null;
  authLoading: boolean;
  initialGroupCode?: string | null;
  onSignIn: () => void;
  onSelectKhatmah: (id: string) => void;
  onCreateKhatmah: (name: string, targetDays: number) => void;
  onRenameKhatmah: (id: string, newName: string) => void;
  onDeleteKhatmah: (id: string) => void;
  onUpdateKhatmah: (next: KhatmahState) => void;
  onUpdateReviewSchedule: (partial: Partial<ReviewSchedule>) => void;
  onOpenPage: (pageNumber: number) => void;
  onOpenJuz: (juzNumber: number) => void;
  onOpenSurah: (surahNumber: number) => void;
  onTestReviewReminder: () => void;
  onOpenStats: () => void;
  onShowToast?: (msg: string) => void;
}

const TOTAL_PAGES = 604;
const DURATION_OPTIONS = [15, 30, 60, 90];
const KHATMAH_NAME_SUGGESTIONS = [
  'ختمة التلاوة',
  'ختمة التدبر',
  'ختمة الحفظ',
  'ختمة المراجعة',
];

const WEEK_DAYS: { dayIndex: number; short: string; label: string }[] = [
  { dayIndex: 6, short: 'سبت', label: 'السبت' },
  { dayIndex: 0, short: 'أحد', label: 'الأحد' },
  { dayIndex: 1, short: 'إثنين', label: 'الإثنين' },
  { dayIndex: 2, short: 'ثلاثاء', label: 'الثلاثاء' },
  { dayIndex: 3, short: 'أربعاء', label: 'الأربعاء' },
  { dayIndex: 4, short: 'خميس', label: 'الخميس' },
  { dayIndex: 5, short: 'جمعة', label: 'الجمعة' },
];

const WIRD_TYPE_OPTIONS: { id: ReviewWirdType; label: string }[] = [
  { id: 'pages', label: 'عدد صفحات' },
  { id: 'juz', label: 'جزء محدد' },
  { id: 'surah', label: 'سورة محددة' },
  { id: 'custom', label: 'ورد مخصص' },
];

export function formatReviewWirdSummary(
  schedule: ReviewSchedule,
  surahList: SurahMeta[]
): string {
  if (schedule.wirdType === 'juz') {
    const juz = JUZ_LIST.find((j) => j.number === schedule.juzNumber);
    return `مراجعة الجزء ${toArabicDigits(schedule.juzNumber)}${
      juz ? ` (${juz.name})` : ''
    }`;
  }
  if (schedule.wirdType === 'surah') {
    const surah = surahList.find((s) => s.number === schedule.surahNumber);
    return surah
      ? `مراجعة ${surah.name}`
      : `مراجعة السورة رقم ${toArabicDigits(schedule.surahNumber)}`;
  }
  if (schedule.wirdType === 'custom') {
    return schedule.customNote.trim() || 'مراجعة الورد القرآني المخصص';
  }
  const endPage = Math.min(
    TOTAL_PAGES,
    schedule.fromPage + Math.max(1, schedule.pagesCount) - 1
  );
  return `مراجعة ${toArabicDigits(schedule.pagesCount)} صفحة (من ص ${toArabicDigits(
    schedule.fromPage
  )} إلى ص ${toArabicDigits(endPage)})`;
}

export const KhatmahView: React.FC<KhatmahViewProps> = ({
  khatmah,
  khatmahs,
  activeKhatmahId,
  surahList,
  reviewSchedule,
  todayDateKey,
  user,
  authLoading,
  initialGroupCode,
  onSignIn,
  onSelectKhatmah,
  onCreateKhatmah,
  onRenameKhatmah,
  onDeleteKhatmah,
  onUpdateKhatmah,
  onUpdateReviewSchedule,
  onOpenPage,
  onOpenJuz,
  onOpenSurah,
  onTestReviewReminder,
  onOpenStats,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<'personal' | 'group'>(() =>
    initialGroupCode ? 'group' : 'personal'
  );
  const [createFormOpen, setCreateFormOpen] = useState(false);
  const [newKhatmahName, setNewKhatmahName] = useState('');
  const [newKhatmahDays, setNewKhatmahDays] = useState(30);

  const [renamingOpen, setRenamingOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    if (initialGroupCode) {
      setActiveTab('group');
    }
  }, [initialGroupCode]);

  const activeRecord =
    khatmahs.find((item) => item.id === activeKhatmahId) ?? khatmahs[0];

  useEffect(() => {
    setRenamingOpen(false);
    setConfirmDeleteOpen(false);
  }, [activeKhatmahId]);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newKhatmahName.trim();
    if (!cleaned) {
      onShowToast?.('يرجى إدخال اسم للختمة الجديدة');
      return;
    }
    onCreateKhatmah(cleaned, newKhatmahDays);
    setNewKhatmahName('');
    setNewKhatmahDays(30);
    setCreateFormOpen(false);
  };

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = renameDraft.trim();
    if (!cleaned || !activeRecord) return;
    onRenameKhatmah(activeRecord.id, cleaned);
    setRenamingOpen(false);
  };

  const pagesPerDay = Math.ceil(TOTAL_PAGES / khatmah.targetDays);
  const pagesPerPrayer = Math.max(1, Math.ceil(pagesPerDay / 5));
  const pageProgressPct = Math.min(
    100,
    Math.round((khatmah.currentPage / TOTAL_PAGES) * 100)
  );
  const juzCompletedCount = khatmah.completedJuz.length;
  const remainingPages = Math.max(0, TOTAL_PAGES - khatmah.currentPage);
  const estimatedDaysLeft = Math.ceil(remainingPages / pagesPerDay);

  const todayDayIndex = new Date().getDay();
  const isTodayScheduled =
    reviewSchedule.enabled && reviewSchedule.days.includes(todayDayIndex);
  const isTodayCompleted =
    reviewSchedule.completedDates.includes(todayDateKey);
  const reviewSummaryText = formatReviewWirdSummary(reviewSchedule, surahList);

  const toggleJuzCompleted = (juzNumber: number) => {
    const exists = khatmah.completedJuz.includes(juzNumber);
    const nextJuz = exists
      ? khatmah.completedJuz.filter((j) => j !== juzNumber)
      : [...khatmah.completedJuz, juzNumber].sort((a, b) => a - b);
    onUpdateKhatmah({ ...khatmah, completedJuz: nextJuz });
  };

  const adjustCurrentPage = (delta: number) => {
    const nextPage = Math.max(1, Math.min(TOTAL_PAGES, khatmah.currentPage + delta));
    onUpdateKhatmah({ ...khatmah, currentPage: nextPage });
  };

  const resetKhatmah = () => {
    onUpdateKhatmah({
      targetDays: khatmah.targetDays,
      completedJuz: [],
      currentPage: 1,
      startedAt: Date.now(),
    });
  };

  const toggleScheduleEnabled = (nextEnabled: boolean) => {
    if (
      nextEnabled &&
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'default'
    ) {
      void Notification.requestPermission();
    }
    onUpdateReviewSchedule({ enabled: nextEnabled });
  };

  const toggleScheduleDay = (dayIndex: number) => {
    const exists = reviewSchedule.days.includes(dayIndex);
    const nextDays = exists
      ? reviewSchedule.days.filter((d) => d !== dayIndex)
      : [...reviewSchedule.days, dayIndex];
    onUpdateReviewSchedule({ days: nextDays });
  };

  const toggleTodayReviewDone = () => {
    const nextDates = isTodayCompleted
      ? reviewSchedule.completedDates.filter((d) => d !== todayDateKey)
      : [todayDateKey, ...reviewSchedule.completedDates].slice(0, 120);
    onUpdateReviewSchedule({ completedDates: nextDates });
  };

  const handleOpenScheduledWird = () => {
    if (reviewSchedule.wirdType === 'juz') {
      onOpenJuz(reviewSchedule.juzNumber);
      return;
    }
    if (reviewSchedule.wirdType === 'surah') {
      onOpenSurah(reviewSchedule.surahNumber);
      return;
    }
    if (reviewSchedule.wirdType === 'pages') {
      onOpenPage(reviewSchedule.fromPage);
      return;
    }
    onOpenPage(khatmah.currentPage);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-28 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-stone-200 dark:border-stone-800 pb-6">
        <div>
          <h1 className="font-amiri text-3xl sm:text-4xl font-bold text-stone-900 dark:text-stone-100">
            متابعة الختمة القرآنية
          </h1>
          <p className="mt-1.5 text-sm text-stone-600 dark:text-stone-400">
            خطط لختم كتاب الله وحدد وردك اليومي وجدول المراجعة الأسبوعي وتابع إنجازك
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start">
          <button
            type="button"
            onClick={onOpenStats}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-xl bg-[#14532D] hover:bg-[#114224] dark:bg-emerald-700 dark:hover:bg-emerald-600 text-[#FBF8F1] ios-spring shadow-sm whitespace-nowrap"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>الرسوم البيانية والإحصائيات</span>
          </button>

          {activeTab === 'personal' && (
            <button
              type="button"
              onClick={resetKhatmah}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-xl ios-glass-input ios-spring text-stone-700 dark:text-stone-300 whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>بدء ختمة جديدة</span>
            </button>
          )}
        </div>
      </div>

      {/* Mode Switcher: Individual vs Collaborative Group Khatmah */}
      <div
        role="tablist"
        aria-label="نوع الختمة"
        className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl ios-glass-input max-w-md"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'personal'}
          onClick={() => setActiveTab('personal')}
          className={`ios-spring inline-flex items-center justify-center gap-2 py-2.5 px-4 min-h-[44px] rounded-xl text-xs sm:text-sm font-semibold ${
            activeTab === 'personal'
              ? 'bg-[#14532D] dark:bg-emerald-700 text-white shadow-sm'
              : 'text-stone-700 dark:text-stone-300 hover:bg-white/40 dark:hover:bg-white/[0.06]'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>ختمتي الفردية</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'group'}
          onClick={() => setActiveTab('group')}
          className={`ios-spring inline-flex items-center justify-center gap-2 py-2.5 px-4 min-h-[44px] rounded-xl text-xs sm:text-sm font-semibold ${
            activeTab === 'group'
              ? 'bg-[#14532D] dark:bg-emerald-700 text-white shadow-sm'
              : 'text-stone-700 dark:text-stone-300 hover:bg-white/40 dark:hover:bg-white/[0.06]'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>الختمات الجماعية</span>
        </button>
      </div>

      {activeTab === 'group' ? (
        <GroupKhatmahPanel
          user={user}
          authLoading={authLoading}
          personalKhatmah={khatmah}
          initialGroupCode={initialGroupCode}
          onSignIn={onSignIn}
          onOpenJuz={onOpenJuz}
          onOpenPage={onOpenPage}
          onShowToast={onShowToast}
        />
      ) : (
        <>
          {/* Multi-Khatmah Manager & Switcher */}
          <section
            aria-label="إدارة الختمات المتعددة"
            className="rounded-3xl ios-glass-card p-5 sm:p-6 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base sm:text-lg font-semibold text-stone-900 dark:text-stone-100 tabular-nums">
                  ختماتي القرآنية النشطة ({toArabicDigits(khatmahs.length)})
                </h2>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  أنشئ أكثر من ختمة في وقت واحد (مثل ختمة التدبر أو الحفظ) وتابع كل ختمة بشكل مستقل
                </p>
              </div>

              <button
                type="button"
                onClick={() => setCreateFormOpen((v) => !v)}
                className="ios-spring inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-xl bg-[#14532D] hover:bg-[#114224] dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white text-xs font-medium whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>{createFormOpen ? 'إغلاق النموذج' : 'إضافة ختمة جديدة'}</span>
              </button>
            </div>

            {createFormOpen && (
              <form
                onSubmit={handleCreateSubmit}
                className="rounded-2xl ios-glass-input p-4 sm:p-5 space-y-4 border border-[#14532D]/25 dark:border-emerald-500/25"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label
                      htmlFor="new-khatmah-name"
                      className="block text-xs font-semibold text-stone-700 dark:text-stone-300"
                    >
                      اسم الختمة الجديدة
                    </label>
                    <input
                      id="new-khatmah-name"
                      type="text"
                      required
                      maxLength={80}
                      value={newKhatmahName}
                      onChange={(e) => setNewKhatmahName(e.target.value)}
                      placeholder="مثال: ختمة التدبر، ختمة الحفظ..."
                      className="w-full px-3.5 py-2.5 text-sm rounded-xl ios-glass-input text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                    />
                    <div className="flex flex-wrap items-center gap-1.5">
                      {KHATMAH_NAME_SUGGESTIONS.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => setNewKhatmahName(suggestion)}
                          className="px-2.5 py-1 rounded-lg ios-glass-card text-[11px] font-medium text-stone-700 dark:text-stone-300 hover:border-[#14532D]/40"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="block text-xs font-semibold text-stone-700 dark:text-stone-300">
                      المدة المستهدفة لإتمامها
                    </span>
                    <div className="grid grid-cols-4 gap-1.5 p-1 rounded-2xl ios-glass-card">
                      {DURATION_OPTIONS.map((days) => (
                        <button
                          key={days}
                          type="button"
                          onClick={() => setNewKhatmahDays(days)}
                          className={`py-2 text-xs font-medium rounded-xl ios-spring tabular-nums ${
                            newKhatmahDays === days
                              ? 'bg-[#14532D] dark:bg-emerald-700 text-white shadow-xs'
                              : 'text-stone-600 dark:text-stone-400'
                          }`}
                        >
                          {toArabicDigits(days)} يوم
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setCreateFormOpen(false)}
                    className="px-4 py-2.5 min-h-[44px] rounded-xl ios-glass-card text-xs font-medium text-stone-700 dark:text-stone-300"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="ios-spring px-5 py-2.5 min-h-[44px] rounded-xl bg-[#14532D] hover:bg-[#114224] dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white text-xs font-semibold"
                  >
                    حفظ وبدء الختمة
                  </button>
                </div>
              </form>
            )}

            {/* Khatmah Cards Switcher */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {khatmahs.map((item) => {
                const isSelected = item.id === activeKhatmahId;
                const pct = Math.min(
                  100,
                  Math.round((item.currentPage / TOTAL_PAGES) * 100)
                );
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectKhatmah(item.id)}
                    className={`ios-spring text-right p-4 rounded-2xl border transition-colors space-y-2.5 ${
                      isSelected
                        ? 'bg-[#14532D]/[0.08] dark:bg-emerald-500/[0.14] border-[#14532D]/50 dark:border-emerald-500/50'
                        : 'ios-glass-input border-transparent hover:border-[#14532D]/30'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-amiri text-xl font-bold text-stone-900 dark:text-stone-100 truncate">
                        {item.name}
                      </div>
                      <span
                        className={`text-xs font-bold tabular-nums shrink-0 ${
                          isSelected
                            ? 'text-[#14532D] dark:text-emerald-300'
                            : 'text-stone-600 dark:text-stone-300'
                        }`}
                      >
                        {toArabicDigits(pct)}٪
                      </span>
                    </div>

                    <div className="h-1.5 w-full rounded-full bg-stone-200/80 dark:bg-stone-800 overflow-hidden">
                      <div
                        className="h-full bg-[#14532D] dark:bg-emerald-500 transition-[width] duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400 tabular-nums">
                      <span>
                        صفحة {toArabicDigits(item.currentPage)} /{' '}
                        {toArabicDigits(TOTAL_PAGES)} ·{' '}
                        {toArabicDigits(item.completedJuz.length)} أجزاء
                      </span>
                      <span
                        className={
                          isSelected
                            ? 'font-semibold text-[#14532D] dark:text-emerald-300'
                            : ''
                        }
                      >
                        {isSelected ? 'قيد المتابعة' : 'تبديل'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Summary & Planner Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Progress Card (2 cols) */}
            <div className="lg:col-span-2 p-6 rounded-2xl ios-glass-card space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1 flex-1 min-w-[200px]">
                  {renamingOpen && activeRecord ? (
                    <form
                      onSubmit={handleRenameSubmit}
                      className="flex flex-wrap items-center gap-2"
                    >
                      <input
                        type="text"
                        required
                        maxLength={80}
                        value={renameDraft}
                        onChange={(e) => setRenameDraft(e.target.value)}
                        aria-label="تعديل اسم الختمة"
                        className="flex-1 min-w-[160px] px-3 py-2 text-sm rounded-xl ios-glass-input text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                      />
                      <button
                        type="submit"
                        className="px-3.5 py-2 rounded-xl bg-[#14532D] dark:bg-emerald-700 text-white text-xs font-medium"
                      >
                        حفظ
                      </button>
                      <button
                        type="button"
                        onClick={() => setRenamingOpen(false)}
                        className="px-3 py-2 rounded-xl ios-glass-input text-xs text-stone-600 dark:text-stone-300"
                      >
                        إلغاء
                      </button>
                    </form>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium text-[#9A742E] dark:text-amber-400">
                        تقدم: {activeRecord?.name || 'الختمة الرئيسية'}
                      </span>
                      {activeRecord && (
                        <button
                          type="button"
                          onClick={() => {
                            setRenameDraft(activeRecord.name);
                            setRenamingOpen(true);
                          }}
                          className="inline-flex items-center gap-1 text-[11px] text-stone-500 hover:text-[#14532D] dark:text-stone-400 dark:hover:text-emerald-300"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>تعديل الاسم</span>
                        </button>
                      )}
                      {khatmahs.length > 1 && activeRecord && (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteOpen((v) => !v)}
                          className="inline-flex items-center gap-1 text-[11px] text-rose-600 hover:underline dark:text-rose-400"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>حذف الختمة</span>
                        </button>
                      )}
                    </div>
                  )}

                  <div className="text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100 tabular-nums pt-0.5">
                    صفحة {toArabicDigits(khatmah.currentPage)} من{' '}
                    {toArabicDigits(TOTAL_PAGES)}
                  </div>
                </div>
                <div className="text-left tabular-nums">
                  <div className="text-2xl font-bold text-[#14532D] dark:text-emerald-300">
                    {toArabicDigits(pageProgressPct)}٪
                  </div>
                  <div className="text-xs text-stone-500 dark:text-stone-400">
                    المتبقي {toArabicDigits(remainingPages)} صفحة
                  </div>
                </div>
              </div>

              {confirmDeleteOpen && activeRecord && khatmahs.length > 1 && (
                <div className="rounded-2xl border border-rose-400/40 bg-rose-500/10 p-3.5 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs font-medium text-rose-800 dark:text-rose-200">
                    هل تريد حذف «{activeRecord.name}» نهائياً؟
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onDeleteKhatmah(activeRecord.id);
                        setConfirmDeleteOpen(false);
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-medium"
                    >
                      تأكيد الحذف
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteOpen(false)}
                      className="px-3 py-1.5 rounded-xl ios-glass-input text-xs text-stone-700 dark:text-stone-200"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              )}

          {/* Progress Bar */}
          <div className="h-2.5 w-full rounded-full bg-stone-200 dark:bg-stone-800 overflow-hidden">
            <div
              className="h-full bg-[#14532D] dark:bg-emerald-500 transition-[width] duration-200"
              style={{ width: `${pageProgressPct}%` }}
            />
          </div>

          {/* Quick Page Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => adjustCurrentPage(1)}
                className="px-3 py-1.5 text-xs font-medium rounded-xl ios-glass-input ios-spring text-stone-800 dark:text-stone-200 tabular-nums"
              >
                +١ صفحة
              </button>
              <button
                type="button"
                onClick={() => adjustCurrentPage(pagesPerPrayer)}
                className="px-3 py-1.5 text-xs font-medium rounded-xl ios-glass-input ios-spring text-stone-800 dark:text-stone-200 tabular-nums"
              >
                +{toArabicDigits(pagesPerPrayer)} (ورد صلاة)
              </button>
              <button
                type="button"
                onClick={() => adjustCurrentPage(pagesPerDay)}
                className="px-3 py-1.5 text-xs font-medium rounded-xl bg-[#14532D] text-[#FBF8F1] hover:bg-[#114224] dark:bg-emerald-700 dark:hover:bg-emerald-600 ios-spring shadow-sm tabular-nums"
              >
                +{toArabicDigits(pagesPerDay)} (ورد يوم كامل)
              </button>
              <button
                type="button"
                onClick={() => adjustCurrentPage(-1)}
                className="px-3 py-1.5 text-xs font-medium rounded-xl ios-spring text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200"
              >
                تراجع صفحة
              </button>
            </div>

            <button
              type="button"
              onClick={() => onOpenPage(khatmah.currentPage)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#14532D] dark:text-emerald-300 hover:underline ios-spring"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>قراءة الصفحة {toArabicDigits(khatmah.currentPage)}</span>
            </button>
          </div>
        </div>

        {/* Daily Wird Calculator Card */}
        <div className="p-6 rounded-2xl ios-glass-card space-y-5">
          <div>
            <div className="text-sm font-semibold text-stone-900 dark:text-stone-100 mb-3">
              مدة الختمة المستهدفة
            </div>
            <div className="grid grid-cols-4 gap-1.5 p-1 rounded-2xl ios-glass-input">
              {DURATION_OPTIONS.map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() =>
                    onUpdateKhatmah({ ...khatmah, targetDays: days })
                  }
                  className={`py-1.5 text-xs font-medium rounded-xl ios-spring tabular-nums ${
                    khatmah.targetDays === days
                      ? 'bg-white/85 dark:bg-white/[0.14] text-[#14532D] dark:text-emerald-300 shadow-xs'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                  }`}
                >
                  {toArabicDigits(days)} يوم
                </button>
              ))}
            </div>
          </div>

          <dl className="divide-y divide-stone-200 dark:divide-stone-800 text-sm">
            <div className="py-2.5 flex items-center justify-between">
              <dt className="text-stone-600 dark:text-stone-400">الورد اليومي</dt>
              <dd className="font-semibold text-stone-900 dark:text-stone-100 tabular-nums">
                {toArabicDigits(pagesPerDay)} صفحة / يوم
              </dd>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <dt className="text-stone-600 dark:text-stone-400">بعد كل صلاة</dt>
              <dd className="font-semibold text-stone-900 dark:text-stone-100 tabular-nums">
                {toArabicDigits(pagesPerPrayer)} صفحات تقريباً
              </dd>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <dt className="text-stone-600 dark:text-stone-400">الأيام المتوقعة</dt>
              <dd className="font-semibold text-[#14532D] dark:text-emerald-300 tabular-nums">
                {toArabicDigits(estimatedDaysLeft)} يوماً
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Weekly Review Schedule (جدول المراجعة) */}
      <section
        aria-label="جدول المراجعة الأسبوعي"
        className="rounded-3xl ios-glass-card p-6 space-y-6"
      >
        {/* Header & Enable Switch */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#14532D]/12 dark:bg-emerald-500/20 text-[#14532D] dark:text-emerald-300 flex items-center justify-center shrink-0">
              <CalendarClock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-amiri text-2xl font-bold text-stone-900 dark:text-stone-100">
                جدول المراجعة الأسبوعي
              </h2>
              <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 mt-0.5">
                اختر أيام الأسبوع ووقت التذكير والورد المطلوب مراجعته ليصلك تنبيه منتظم
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-stone-600 dark:text-stone-400">
              {reviewSchedule.enabled ? 'التذكير مفعّل' : 'التذكير متوقف'}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={reviewSchedule.enabled}
              aria-label="تفعيل تذكير جدول المراجعة"
              onClick={() => toggleScheduleEnabled(!reviewSchedule.enabled)}
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 ${
                reviewSchedule.enabled
                  ? 'bg-[#14532D] dark:bg-emerald-600'
                  : 'bg-stone-300/90 dark:bg-stone-700'
              }`}
            >
              <span
                className={`inline-block h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                  reviewSchedule.enabled ? '-translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Today's Scheduled Review Callout */}
        {(isTodayScheduled || reviewSchedule.completedDates.length > 0) && (
          <div
            className={`rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 border ${
              isTodayCompleted
                ? 'bg-emerald-500/10 border-emerald-500/30'
                : 'ios-glass-input border-[#14532D]/25 dark:border-emerald-400/25'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  isTodayCompleted
                    ? 'bg-[#14532D] text-white dark:bg-emerald-600'
                    : 'bg-[#C59B27]/15 text-[#9A742E] dark:text-amber-300'
                }`}
              >
                {isTodayCompleted ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <BellRing className="w-5 h-5" />
                )}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                  {isTodayCompleted
                    ? 'أتممت ورد المراجعة لهذا اليوم — بارك الله فيك!'
                    : isTodayScheduled
                    ? `اليوم موعد مراجعتك (${toArabicDigits(reviewSchedule.time)})`
                    : 'إنجاز جدول المراجعة'}
                </div>
                <div className="text-xs text-stone-600 dark:text-stone-400 truncate">
                  {reviewSummaryText} · إجمالي جلسات المراجعة المنجزة:{' '}
                  {toArabicDigits(reviewSchedule.completedDates.length)}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleOpenScheduledWird}
                className="ios-spring inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl ios-glass-input text-xs font-medium text-[#14532D] dark:text-emerald-300"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>فتح الورد</span>
              </button>
              <button
                type="button"
                onClick={toggleTodayReviewDone}
                className={`ios-spring inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium ${
                  isTodayCompleted
                    ? 'bg-white/70 dark:bg-stone-800/70 text-stone-700 dark:text-stone-300'
                    : 'bg-[#14532D] dark:bg-emerald-700 text-white shadow-xs'
                }`}
              >
                <Check className="w-3.5 h-3.5" />
                <span>
                  {isTodayCompleted ? 'تم الإنجاز ✓' : 'تسجيل إتمام اليوم'}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Days Picker & Time */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                أيام المراجعة في الأسبوع (
                {toArabicDigits(reviewSchedule.days.length)} أيام مختارة)
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    onUpdateReviewSchedule({ days: [0, 1, 2, 3, 4, 5, 6] })
                  }
                  className="px-2.5 py-1 rounded-lg ios-glass-input text-[11px] font-medium text-stone-700 dark:text-stone-300"
                >
                  كل يوم
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateReviewSchedule({ days: [1, 4] })}
                  className="px-2.5 py-1 rounded-lg ios-glass-input text-[11px] font-medium text-stone-700 dark:text-stone-300"
                >
                  الإثنين والخميس
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateReviewSchedule({ days: [5, 6] })}
                  className="px-2.5 py-1 rounded-lg ios-glass-input text-[11px] font-medium text-stone-700 dark:text-stone-300"
                >
                  الجمعة والسبت
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {WEEK_DAYS.map((day) => {
                const selected = reviewSchedule.days.includes(day.dayIndex);
                const isToday = day.dayIndex === todayDayIndex;
                return (
                  <button
                    key={day.dayIndex}
                    type="button"
                    onClick={() => toggleScheduleDay(day.dayIndex)}
                    aria-pressed={selected}
                    aria-label={day.label}
                    className={`ios-spring relative py-2.5 px-1 rounded-2xl text-center transition-colors border ${
                      selected
                        ? 'bg-[#14532D] dark:bg-emerald-700 text-white border-[#14532D] dark:border-emerald-600 shadow-xs'
                        : 'ios-glass-input text-stone-700 dark:text-stone-300 border-transparent hover:border-[#14532D]/35'
                    }`}
                  >
                    <span className="hidden sm:inline text-xs font-medium">
                      {day.label}
                    </span>
                    <span className="sm:hidden text-[11px] font-medium">
                      {day.short}
                    </span>
                    {isToday && (
                      <span
                        title="اليوم"
                        className={`block mx-auto mt-1 w-1.5 h-1.5 rounded-full ${
                          selected ? 'bg-amber-300' : 'bg-[#14532D] dark:bg-emerald-400'
                        }`}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="review-schedule-time"
              className="block text-xs font-semibold text-stone-700 dark:text-stone-300"
            >
              وقت التذكير
            </label>
            <div className="flex items-center gap-2">
              <input
                id="review-schedule-time"
                type="time"
                value={reviewSchedule.time}
                onChange={(e) =>
                  onUpdateReviewSchedule({ time: e.target.value || '21:00' })
                }
                className="flex-1 px-3 py-2.5 text-sm rounded-2xl ios-glass-input text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
              <button
                type="button"
                onClick={onTestReviewReminder}
                title="تجربة تنبيه المراجعة الآن"
                className="ios-spring inline-flex items-center gap-1.5 px-3 py-2.5 rounded-2xl ios-glass-input text-xs font-medium text-[#14532D] dark:text-emerald-300 shrink-0"
              >
                <Bell className="w-3.5 h-3.5" />
                <span>تجربة</span>
              </button>
            </div>
            <p className="text-[11px] text-stone-500 dark:text-stone-400">
              يظهر تنبيه داخل التطبيق وإشعار بالمتصفح في الأيام والأوقات المحددة
            </p>
          </div>
        </div>

        {/* Specific Wird Selector */}
        <div className="pt-4 border-t border-stone-200/70 dark:border-stone-800/70 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-stone-700 dark:text-stone-300">
              تحديد الورد المراد مراجعته
            </span>
            <span className="text-xs font-medium text-[#14532D] dark:text-emerald-300">
              {reviewSummaryText}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 rounded-2xl ios-glass-input">
            {WIRD_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onUpdateReviewSchedule({ wirdType: opt.id })}
                className={`ios-spring py-2 px-2 rounded-xl text-xs font-medium ${
                  reviewSchedule.wirdType === opt.id
                    ? 'bg-white/90 dark:bg-white/[0.14] text-[#14532D] dark:text-emerald-300 shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {reviewSchedule.wirdType === 'pages' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="review-pages-count"
                  className="block text-xs font-medium text-stone-600 dark:text-stone-400"
                >
                  عدد الصفحات في كل جلسة مراجعة
                </label>
                <div className="flex items-center gap-2">
                  {[5, 10, 20, 40].map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() =>
                        onUpdateReviewSchedule({ pagesCount: cnt })
                      }
                      className={`ios-spring px-3 py-2 rounded-xl text-xs font-medium tabular-nums ${
                        reviewSchedule.pagesCount === cnt
                          ? 'bg-[#14532D] dark:bg-emerald-700 text-white'
                          : 'ios-glass-input text-stone-700 dark:text-stone-300'
                      }`}
                    >
                      {toArabicDigits(cnt)} ص
                    </button>
                  ))}
                  <input
                    id="review-pages-count"
                    type="number"
                    min={1}
                    max={604}
                    value={reviewSchedule.pagesCount}
                    onChange={(e) =>
                      onUpdateReviewSchedule({
                        pagesCount: Math.max(
                          1,
                          Math.min(604, Number(e.target.value) || 1)
                        ),
                      })
                    }
                    className="w-20 px-2.5 py-2 text-xs rounded-xl ios-glass-input text-center tabular-nums text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="review-from-page"
                  className="block text-xs font-medium text-stone-600 dark:text-stone-400"
                >
                  تبدأ المراجعة من صفحة (١ إلى ٦٠٤)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="review-from-page"
                    type="number"
                    min={1}
                    max={604}
                    value={reviewSchedule.fromPage}
                    onChange={(e) =>
                      onUpdateReviewSchedule({
                        fromPage: Math.max(
                          1,
                          Math.min(604, Number(e.target.value) || 1)
                        ),
                      })
                    }
                    className="flex-1 px-3 py-2 text-sm rounded-xl ios-glass-input tabular-nums text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  />
                  <button
                    type="button"
                    onClick={() => onOpenPage(reviewSchedule.fromPage)}
                    className="ios-spring px-3.5 py-2 rounded-xl bg-[#14532D] dark:bg-emerald-700 text-white text-xs font-medium shrink-0"
                  >
                    فتح الصفحة
                  </button>
                </div>
              </div>
            </div>
          )}

          {reviewSchedule.wirdType === 'juz' && (
            <div className="flex flex-wrap items-center gap-3">
              <select
                aria-label="اختيار الجزء للمراجعة"
                value={reviewSchedule.juzNumber}
                onChange={(e) =>
                  onUpdateReviewSchedule({
                    juzNumber: Math.max(
                      1,
                      Math.min(30, Number(e.target.value) || 1)
                    ),
                  })
                }
                className="flex-1 min-w-[220px] px-3 py-2.5 text-sm rounded-xl ios-glass-input text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-700"
              >
                {JUZ_LIST.map((j) => (
                  <option key={j.number} value={j.number}>
                    الجزء {toArabicDigits(j.number)} — {j.name} (يبدأ بـ{' '}
                    {j.startSurah})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => onOpenJuz(reviewSchedule.juzNumber)}
                className="ios-spring px-4 py-2.5 rounded-xl bg-[#14532D] dark:bg-emerald-700 text-white text-xs font-medium"
              >
                فتح الجزء للمراجعة
              </button>
            </div>
          )}

          {reviewSchedule.wirdType === 'surah' && (
            <div className="flex flex-wrap items-center gap-3">
              <select
                aria-label="اختيار السورة للمراجعة"
                value={reviewSchedule.surahNumber}
                onChange={(e) =>
                  onUpdateReviewSchedule({
                    surahNumber: Math.max(
                      1,
                      Math.min(114, Number(e.target.value) || 1)
                    ),
                  })
                }
                className="flex-1 min-w-[220px] px-3 py-2.5 text-sm rounded-xl ios-glass-input text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-700"
              >
                {surahList.map((s) => (
                  <option key={s.number} value={s.number}>
                    {toArabicDigits(s.number)}. {s.name} (
                    {toArabicDigits(s.numberOfAyahs)} آية)
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => onOpenSurah(reviewSchedule.surahNumber)}
                className="ios-spring px-4 py-2.5 rounded-xl bg-[#14532D] dark:bg-emerald-700 text-white text-xs font-medium"
              >
                فتح السورة للمراجعة
              </button>
            </div>
          )}

          {reviewSchedule.wirdType === 'custom' && (
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                value={reviewSchedule.customNote}
                onChange={(e) =>
                  onUpdateReviewSchedule({
                    customNote: e.target.value.slice(0, 120),
                  })
                }
                placeholder="اكتب ورد المراجعة (مثال: مراجعة سورة البقرة وآل عمران أو الحزب ٦٠)..."
                aria-label="وصف ورد المراجعة المخصص"
                className="flex-1 min-w-[220px] px-3.5 py-2.5 text-sm rounded-xl ios-glass-input text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </div>
          )}
        </div>
      </section>

      {/* 30 Juz Checklist Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100">
            سجل الأجزاء المكتملة ({toArabicDigits(juzCompletedCount)} /{' '}
            {toArabicDigits(30)})
          </h2>
          <span className="text-xs text-stone-500 dark:text-stone-400">
            اضغط لتسجيل إتمام الجزء أو فتحه للقراءة
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-3">
          {JUZ_LIST.map((juz) => {
            const done = khatmah.completedJuz.includes(juz.number);
            return (
              <div
                key={juz.number}
                className={`p-3 rounded-2xl transition-colors flex flex-col justify-between gap-2.5 ${
                  done
                    ? 'border border-[#14532D]/40 bg-emerald-900/[0.08] dark:border-emerald-500/40 dark:bg-emerald-500/[0.12] backdrop-blur-md'
                    : 'ios-glass-card'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs text-stone-500 dark:text-stone-400 tabular-nums">
                      الجزء {toArabicDigits(juz.number)}
                    </div>
                    <div className="font-amiri text-base font-bold text-stone-900 dark:text-stone-100">
                      {juz.name}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleJuzCompleted(juz.number)}
                    aria-label={
                      done
                        ? `إلغاء إتمام الجزء ${juz.number}`
                        : `تحديد الجزء ${juz.number} كمكتمل`
                    }
                    className={`w-7 h-7 rounded-lg border flex items-center justify-center ios-spring shrink-0 ${
                      done
                        ? 'bg-[#14532D] border-[#14532D] text-white dark:bg-emerald-600 dark:border-emerald-600'
                        : 'border-stone-300/80 dark:border-stone-700 text-transparent hover:border-[#14532D]'
                    }`}
                  >
                    <Check className="w-4 h-4" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => onOpenJuz(juz.number)}
                  className="text-right text-[11px] font-medium text-[#14532D] dark:text-emerald-300 hover:underline"
                >
                  قراءة الجزء ←
                </button>
              </div>
            );
          })}
        </div>
      </div>
        </>
      )}
    </div>
  );
};
