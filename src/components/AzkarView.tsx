import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Check,
  Flame,
  Minus,
  Plus,
  RotateCcw,
  Sparkles,
  Vibrate,
} from 'lucide-react';
import { AZKAR_COLLECTION, TASBEEH_PRESETS } from '../data/quranMeta';
import { DailyStreakState, ZikrItem } from '../types/quran';
import { toArabicDigits } from '../utils/arabic';
import { getNormalizedStreakView, getStreakDateKey } from '../utils/streak';

type AzkarCategory = ZikrItem['category'] | 'tasbeeh';
type TasbeehMode = 'countdown' | 'countup';

interface AzkarViewProps {
  totalTasbeehCount: number;
  dailyStreak?: DailyStreakState;
  onIncrementTotalTasbeeh: () => void;
  onZikrActivity?: () => void;
}

const CATEGORY_TABS: { id: AzkarCategory; label: string }[] = [
  { id: 'morning', label: 'أذكار الصباح' },
  { id: 'evening', label: 'أذكار المساء' },
  { id: 'prayer', label: 'بعد الصلاة' },
  { id: 'quranic', label: 'أدعية قرآنية' },
  { id: 'tasbeeh', label: 'السبحة الإلكترونية' },
];

const QUICK_TARGETS = [33, 99, 100, 1000];
const RING_RADIUS = 96;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export const AzkarView: React.FC<AzkarViewProps> = ({
  totalTasbeehCount,
  dailyStreak,
  onIncrementTotalTasbeeh,
  onZikrActivity,
}) => {
  const [activeCategory, setActiveCategory] = useState<AzkarCategory>('morning');
  const [remainingMap, setRemainingMap] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const z of AZKAR_COLLECTION) {
      initial[z.id] = z.count;
    }
    return initial;
  });

  // Digital Tasbeeh State
  const [selectedPresetId, setSelectedPresetId] = useState(TASBEEH_PRESETS[0].id);
  const [tasbeehMode, setTasbeehMode] = useState<TasbeehMode>('countdown');
  const [targetCount, setTargetCount] = useState<number>(TASBEEH_PRESETS[0].target);
  const [customTargetInput, setCustomTargetInput] = useState<string>(
    String(TASBEEH_PRESETS[0].target)
  );
  const [sessionCount, setSessionCount] = useState(0);
  const [cycleCount, setCycleCount] = useState(0); // 0..targetCount for current round
  const [completedRounds, setCompletedRounds] = useState(0);
  const [hapticEnabled, setHapticEnabled] = useState(true);
  const [justCompleted, setJustCompleted] = useState(false);
  const completionTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (completionTimerRef.current) {
        window.clearTimeout(completionTimerRef.current);
      }
    };
  }, []);

  const currentPreset =
    TASBEEH_PRESETS.find((p) => p.id === selectedPresetId) ?? TASBEEH_PRESETS[0];

  const triggerHaptic = (pattern: number | number[]) => {
    if (!hapticEnabled) return;
    try {
      if (
        typeof navigator !== 'undefined' &&
        typeof navigator.vibrate === 'function'
      ) {
        navigator.vibrate(pattern);
      }
    } catch {
      // ignore vibration restrictions on unsupported browsers
    }
  };

  const handleZikrTap = (item: ZikrItem) => {
    const current = remainingMap[item.id] ?? item.count;
    if (current <= 0) return;
    const nextVal = current - 1;
    triggerHaptic(nextVal === 0 ? [80, 40, 120] : 10);
    setRemainingMap((prev) => ({ ...prev, [item.id]: nextVal }));
    onZikrActivity?.();
  };

  const handleResetCategory = () => {
    setRemainingMap((prev) => {
      const next = { ...prev };
      for (const z of AZKAR_COLLECTION) {
        if (z.category === activeCategory) {
          next[z.id] = z.count;
        }
      }
      return next;
    });
  };

  const applyTargetCount = (nextTarget: number) => {
    const safe = Math.max(1, Math.min(10000, Math.round(nextTarget) || 33));
    setTargetCount(safe);
    setCustomTargetInput(String(safe));
    setCycleCount(0);
    setJustCompleted(false);
  };

  const handleTasbeehTap = () => {
    const safeTarget = Math.max(1, targetCount);
    // If previous tap completed the cycle, start fresh from 1 on next tap
    const nextCycle = cycleCount >= safeTarget ? 1 : cycleCount + 1;
    const hitGoal = nextCycle === safeTarget;

    setCycleCount(nextCycle);
    setSessionCount((c) => c + 1);
    onIncrementTotalTasbeeh();

    if (hitGoal) {
      setCompletedRounds((r) => r + 1);
      setJustCompleted(true);
      triggerHaptic([90, 55, 130, 55, 180]);
      if (completionTimerRef.current) {
        window.clearTimeout(completionTimerRef.current);
      }
      completionTimerRef.current = window.setTimeout(() => {
        setJustCompleted(false);
      }, 1400);
    } else {
      setJustCompleted(false);
      triggerHaptic(12);
    }
  };

  const handleResetTasbeeh = () => {
    setSessionCount(0);
    setCycleCount(0);
    setCompletedRounds(0);
    setJustCompleted(false);
  };

  const filteredAzkar = AZKAR_COLLECTION.filter(
    (z) => z.category === activeCategory
  );

  const safeTarget = Math.max(1, targetCount);
  const remainingInRound = Math.max(0, safeTarget - cycleCount);
  const progressRatio = Math.min(1, cycleCount / safeTarget);
  const progressPct = Math.round(progressRatio * 100);
  const strokeDashoffset = RING_CIRCUMFERENCE * (1 - progressRatio);
  const isRoundCompleted = cycleCount >= safeTarget;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-28 space-y-8">
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-stone-200 dark:border-stone-800 pb-6">
        <div>
          <h1 className="font-amiri text-3xl sm:text-4xl font-bold text-stone-900 dark:text-stone-100">
            الأذكار والأدعية والتسبيح
          </h1>
          <p className="mt-1.5 text-sm text-stone-600 dark:text-stone-400">
            أذكار المسلم اليومية من القرآن الكريم والسنة الصحيحة مع عداد تفاعلي
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 rounded-2xl ios-glass-input self-start">
          {CATEGORY_TABS.map((tab) => {
            const active = activeCategory === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveCategory(tab.id)}
                className={`relative px-3 py-1.5 text-xs font-medium rounded-xl ios-spring whitespace-nowrap ${
                  active
                    ? 'text-[#14532D] dark:text-emerald-300'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="azkar-active-tab"
                    transition={{ type: 'spring', stiffness: 450, damping: 34 }}
                    className="absolute inset-0 rounded-xl bg-white/85 dark:bg-white/[0.12] border border-white/80 dark:border-white/15 shadow-xs"
                  />
                )}
                <span className="relative z-10">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {dailyStreak && (() => {
        const sView = getNormalizedStreakView(dailyStreak, getStreakDateKey());
        return (
          <div className="rounded-2xl ios-glass-card px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-stone-700 dark:text-stone-200 tabular-nums">
              <Flame className="w-4 h-4 text-[#9A742E] dark:text-amber-400 shrink-0" />
              <span>
                سلسلة المواظبة الحالية:{' '}
                <strong className="text-[#14532D] dark:text-emerald-300">
                  {toArabicDigits(sView.effectiveStreak)} يوم متتالي
                </strong>
                {' · '}
                {sView.todayLog.tasbeehDone
                  ? 'تم احتساب التسبيح والذكر في مكافأة اليوم ✓'
                  : 'سبّح أو اذكر الله اليوم لتسجيل يومك نحو تحدي الـ ٧ أيام'}
              </span>
            </div>
            <span className="text-[#9A742E] dark:text-amber-300 font-semibold tabular-nums">
              نقاط المواظبة: {toArabicDigits(dailyStreak.totalStreakPoints)}
            </span>
          </div>
        );
      })()}

      {/* Digital Tasbeeh View */}
      {activeCategory === 'tasbeeh' ? (
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Phrase Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {TASBEEH_PRESETS.map((preset) => {
              const active = preset.id === selectedPresetId;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setSelectedPresetId(preset.id);
                    applyTargetCount(preset.target);
                    setSessionCount(0);
                    setCompletedRounds(0);
                  }}
                  className={`text-right p-3.5 rounded-2xl ios-spring ${
                    active
                      ? 'border border-[#14532D]/60 bg-emerald-900/[0.10] dark:border-emerald-400/50 dark:bg-emerald-500/[0.16] backdrop-blur-xl shadow-sm'
                      : 'ios-glass-card hover:border-stone-300 dark:hover:border-stone-700'
                  }`}
                >
                  <div className="font-amiri text-lg font-bold text-stone-900 dark:text-stone-100">
                    {preset.phrase}
                  </div>
                  <div className="text-xs text-stone-500 dark:text-stone-400 tabular-nums mt-0.5">
                    الهدف الافتراضي: {toArabicDigits(preset.target)} مرة
                  </div>
                </button>
              );
            })}
          </div>

          {/* Mode & Target Controls Card */}
          <div className="p-4 sm:p-5 rounded-3xl ios-glass-card space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Countdown vs Countup Switcher */}
              <div className="flex items-center p-1 rounded-xl ios-glass-input">
                {(
                  [
                    { id: 'countdown', label: 'العد التنازلي' },
                    { id: 'countup', label: 'العد التصاعدي' },
                  ] as const
                ).map((m) => {
                  const active = tasbeehMode === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setTasbeehMode(m.id)}
                      className={`relative px-3.5 py-1.5 text-xs font-medium rounded-lg ios-spring whitespace-nowrap ${
                        active
                          ? 'text-[#14532D] dark:text-emerald-300'
                          : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId="tasbeeh-mode-pill"
                          transition={{
                            type: 'spring',
                            stiffness: 450,
                            damping: 32,
                          }}
                          className="absolute inset-0 rounded-lg bg-white/90 dark:bg-stone-800 shadow-xs"
                        />
                      )}
                      <span className="relative z-10">{m.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Haptic Feedback Toggle */}
              <button
                type="button"
                onClick={() => {
                  const next = !hapticEnabled;
                  setHapticEnabled(next);
                  if (next) triggerHaptic(20);
                }}
                className={`ios-spring inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border whitespace-nowrap ${
                  hapticEnabled
                    ? 'border-[#14532D]/40 bg-[#14532D]/12 text-[#14532D] dark:border-emerald-500/40 dark:bg-emerald-500/20 dark:text-emerald-300'
                    : 'ios-glass-input text-stone-500 dark:text-stone-400'
                }`}
              >
                <Vibrate className="w-3.5 h-3.5" />
                <span>{hapticEnabled ? 'الهزاز مفعّل' : 'الهزاز متوقف'}</span>
              </button>
            </div>

            {/* Target Adjustment Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-stone-200/60 dark:border-white/10">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-medium text-stone-600 dark:text-stone-300 ml-1">
                  المستهدف:
                </span>
                {QUICK_TARGETS.map((val) => {
                  const active = targetCount === val;
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => applyTargetCount(val)}
                      className={`ios-spring px-2.5 py-1 text-xs font-medium rounded-lg border tabular-nums ${
                        active
                          ? 'border-[#14532D] bg-[#14532D] text-white dark:bg-emerald-700'
                          : 'ios-glass-input text-stone-700 dark:text-stone-300'
                      }`}
                    >
                      {toArabicDigits(val)}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-label="إنقاص الهدف"
                  onClick={() => applyTargetCount(targetCount - 1)}
                  className="ios-spring w-8 h-8 rounded-lg ios-glass-input flex items-center justify-center text-stone-700 dark:text-stone-200"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <input
                  type="number"
                  min={1}
                  max={10000}
                  aria-label="العدد المستهدف المخصص"
                  value={customTargetInput}
                  onChange={(e) => {
                    setCustomTargetInput(e.target.value);
                    const parsed = Number(e.target.value);
                    if (parsed >= 1 && parsed <= 10000) {
                      setTargetCount(Math.round(parsed));
                      setCycleCount(0);
                      setJustCompleted(false);
                    }
                  }}
                  className="w-20 text-center text-xs font-semibold rounded-lg ios-glass-input py-1.5 text-stone-900 dark:text-stone-100 tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
                />
                <button
                  type="button"
                  aria-label="زيادة الهدف"
                  onClick={() => applyTargetCount(targetCount + 1)}
                  className="ios-spring w-8 h-8 rounded-lg ios-glass-input flex items-center justify-center text-stone-700 dark:text-stone-200"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Interactive Counter Stage with Visual Progress Ring */}
          <div className="p-6 sm:p-8 rounded-3xl ios-glass-card text-center space-y-6 relative overflow-hidden">
            <p className="font-amiri text-2xl sm:text-3xl font-bold text-[#1C1917] dark:text-[#F2EFE8]">
              {currentPreset.phrase}
            </p>

            {/* Circular Progress Ring Wrapper */}
            <motion.div
              animate={
                justCompleted
                  ? {
                      scale: [1, 1.05, 0.98, 1.02, 1],
                      rotate: [0, -2, 2, -1.5, 1.5, 0],
                    }
                  : { scale: 1, rotate: 0 }
              }
              transition={{ duration: 0.55 }}
              className="relative w-56 h-56 mx-auto flex items-center justify-center"
            >
              {/* Soft celebratory aura on completion */}
              <AnimatePresence>
                {justCompleted && (
                  <motion.div
                    initial={{ opacity: 0.75, scale: 0.85 }}
                    animate={{ opacity: 0, scale: 1.25 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.9, ease: 'easeOut' }}
                    aria-hidden="true"
                    className="absolute inset-0 rounded-full bg-emerald-500/30 dark:bg-emerald-400/25 pointer-events-none"
                  />
                )}
              </AnimatePresence>

              {/* SVG Progress Ring */}
              <svg
                viewBox="0 0 220 220"
                aria-hidden="true"
                className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none"
              >
                {/* Background Track */}
                <circle
                  cx="110"
                  cy="110"
                  r={RING_RADIUS}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="10"
                  className="text-stone-200/75 dark:text-stone-800/80"
                />
                {/* Animated Progress Arc */}
                <motion.circle
                  cx="110"
                  cy="110"
                  r={RING_RADIUS}
                  fill="none"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={RING_CIRCUMFERENCE}
                  animate={{ strokeDashoffset }}
                  transition={{ type: 'spring', stiffness: 260, damping: 28 }}
                  className={
                    isRoundCompleted
                      ? 'stroke-[#9A742E] dark:stroke-amber-400'
                      : 'stroke-[#14532D] dark:stroke-emerald-400'
                  }
                />
              </svg>

              {/* Center Interactive Liquid Glass Button */}
              <motion.button
                type="button"
                whileTap={{ scale: 0.92 }}
                transition={{ type: 'spring', stiffness: 520, damping: 24 }}
                onClick={handleTasbeehTap}
                aria-label={
                  tasbeehMode === 'countdown'
                    ? `تبقى ${remainingInRound} من ${safeTarget}، اضغط للتسبيح`
                    : `العدد الحالي ${sessionCount}، اضغط للتسبيح`
                }
                className={`relative z-10 w-44 h-44 rounded-full ios-glass-input flex flex-col items-center justify-center gap-1 select-none shadow-lg border transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-700/30 ${
                  isRoundCompleted
                    ? 'border-amber-500/60 bg-amber-500/10 dark:border-amber-400/50 dark:bg-amber-400/10'
                    : 'border-white/60 dark:border-white/15 hover:border-[#14532D]/50 dark:hover:border-emerald-400/50'
                }`}
              >
                <span
                  className={`text-5xl font-bold tabular-nums leading-none ${
                    isRoundCompleted
                      ? 'text-[#9A742E] dark:text-amber-300'
                      : 'text-[#14532D] dark:text-emerald-300'
                  }`}
                >
                  {toArabicDigits(
                    tasbeehMode === 'countdown' ? remainingInRound : sessionCount
                  )}
                </span>

                <span className="text-[11px] font-medium text-stone-500 dark:text-stone-400 tabular-nums mt-1">
                  {tasbeehMode === 'countdown'
                    ? isRoundCompleted
                      ? 'تم الهدف بحمد الله ✓'
                      : `متبقي من ${toArabicDigits(safeTarget)}`
                    : `${toArabicDigits(cycleCount)} / ${toArabicDigits(safeTarget)}`}
                </span>

                <span className="text-[11px] text-stone-400 dark:text-stone-500">
                  {isRoundCompleted ? 'اضغط لدورة جديدة' : 'اضغط للتسبيح'}
                </span>
              </motion.button>
            </motion.div>

            {/* Completion Feedback Banner */}
            <AnimatePresence>
              {isRoundCompleted && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-600/12 dark:bg-amber-500/20 text-[#9A742E] dark:text-amber-300 text-xs font-semibold"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>
                    تقبل الله تسبيحك! أتممت {toArabicDigits(safeTarget)} تسبيحة
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Stats & Progress Summary */}
            <div className="max-w-sm mx-auto space-y-2 pt-1">
              <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400 tabular-nums">
                <span>التقدم: {toArabicDigits(progressPct)}٪</span>
                <span>
                  {toArabicDigits(cycleCount)} / {toArabicDigits(safeTarget)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400 tabular-nums pt-1 border-t border-stone-200/50 dark:border-white/10">
                <span>الدورات المكتملة: {toArabicDigits(completedRounds)}</span>
                <span>جلسة اليوم: {toArabicDigits(sessionCount)}</span>
                <span>الإجمالي: {toArabicDigits(totalTasbeehCount)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleResetTasbeeh}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-xl ios-glass-input ios-spring text-stone-700 dark:text-stone-300"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>تصفير العداد الحالي</span>
            </button>
          </div>
        </div>
      ) : (
        /* Azkar List View */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-stone-500 dark:text-stone-400 tabular-nums">
              اضغط على زر العد لتسجيل كل ذكر ({toArabicDigits(filteredAzkar.length)} أذكار)
            </span>
            <button
              type="button"
              onClick={handleResetCategory}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>إعادة ضبط العدادات</span>
            </button>
          </div>

          <div className="space-y-4">
            {filteredAzkar.map((item) => {
              const remaining = remainingMap[item.id] ?? item.count;
              const isCompleted = remaining === 0;
              return (
                <div
                  key={item.id}
                  className={`p-5 sm:p-6 rounded-2xl transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-5 ${
                    isCompleted
                      ? 'border border-[#14532D]/30 bg-emerald-900/[0.05] dark:border-emerald-500/30 dark:bg-emerald-500/[0.08] opacity-80 backdrop-blur-md'
                      : 'ios-glass-card'
                  }`}
                >
                  <div className="space-y-2.5 flex-1">
                    <p className="font-amiri text-xl sm:text-2xl leading-[2] text-stone-900 dark:text-stone-100">
                      {item.text}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                      <span>{item.reference}</span>
                      {item.benefit && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{item.benefit}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleZikrTap(item)}
                    disabled={isCompleted}
                    className={`min-w-[88px] h-14 px-4 rounded-2xl font-medium ios-spring flex flex-col items-center justify-center shrink-0 tabular-nums ${
                      isCompleted
                        ? 'bg-[#14532D] text-white dark:bg-emerald-600 cursor-default shadow-sm'
                        : 'ios-glass-input text-stone-900 dark:text-stone-100 hover:border-[#14532D]'
                    }`}
                  >
                    {isCompleted ? (
                      <span className="inline-flex items-center gap-1 text-xs">
                        <Check className="w-4 h-4" />
                        تم بحمد الله
                      </span>
                    ) : (
                      <>
                        <span className="text-lg font-bold text-[#14532D] dark:text-emerald-300">
                          {toArabicDigits(remaining)}
                        </span>
                        <span className="text-[11px] text-stone-500 dark:text-stone-400">
                          من {toArabicDigits(item.count)}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
