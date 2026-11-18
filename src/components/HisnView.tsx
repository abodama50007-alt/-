import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  Check,
  CheckCircle2,
  Copy,
  RotateCcw,
  Search,
  Shield,
  Sparkles,
  Vibrate,
  X,
} from 'lucide-react';
import { HISN_AZKAR, HISN_CATEGORIES } from '../data/hisnData';
import { HisnCategoryId, HisnZikrItem } from '../types/quran';
import { normalizeArabicForSearch, toArabicDigits } from '../utils/arabic';

interface HisnViewProps {
  todayDateKey: string;
  onIncrementTotalTasbeeh: () => void;
  onShowToast: (msg: string) => void;
}

const STORAGE_KEY = 'quran_hisn_daily_progress_v1';

interface StoredHisnState {
  date: string;
  counts: Record<string, number>; // remaining count per zikr id
}

function createInitialRemainingMap(): Record<string, number> {
  const map: Record<string, number> = {};
  for (const item of HISN_AZKAR) {
    map[item.id] = item.count;
  }
  return map;
}

function loadDailyRemaining(todayDateKey: string): Record<string, number> {
  const defaults = createInitialRemainingMap();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as StoredHisnState;
    if (parsed.date !== todayDateKey || !parsed.counts) {
      return defaults;
    }
    return { ...defaults, ...parsed.counts };
  } catch {
    return defaults;
  }
}

export const HisnView: React.FC<HisnViewProps> = ({
  todayDateKey,
  onIncrementTotalTasbeeh,
  onShowToast,
}) => {
  const [activeCategory, setActiveCategory] = useState<HisnCategoryId | 'all'>(
    'sleep_wake'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [hapticEnabled, setHapticEnabled] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const loadedDateRef = useRef<string>(todayDateKey);
  const [remainingMap, setRemainingMap] = useState<Record<string, number>>(() =>
    loadDailyRemaining(todayDateKey)
  );

  // Sync changes to localStorage scoped to todayDateKey, resetting on midnight rollover
  useEffect(() => {
    if (loadedDateRef.current !== todayDateKey) {
      loadedDateRef.current = todayDateKey;
      setRemainingMap(loadDailyRemaining(todayDateKey));
      return;
    }
    try {
      const payload: StoredHisnState = {
        date: todayDateKey,
        counts: remainingMap,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore storage quota errors
    }
  }, [remainingMap, todayDateKey]);

  const triggerHaptic = (completed: boolean) => {
    if (!hapticEnabled) return;
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(completed ? [35, 40, 55] : 14);
      } catch {
        // ignore unsupported browser
      }
    }
  };

  const handleCountZikr = (item: HisnZikrItem) => {
    const current = remainingMap[item.id] ?? item.count;
    if (current <= 0) return;
    const next = current - 1;
    setRemainingMap((prev) => ({ ...prev, [item.id]: next }));
    onIncrementTotalTasbeeh();
    triggerHaptic(next === 0);
  };

  const handleResetSingle = (item: HisnZikrItem) => {
    setRemainingMap((prev) => ({ ...prev, [item.id]: item.count }));
  };

  const handleResetCategory = () => {
    setRemainingMap((prev) => {
      const next = { ...prev };
      for (const item of HISN_AZKAR) {
        if (activeCategory === 'all' || item.category === activeCategory) {
          next[item.id] = item.count;
        }
      }
      return next;
    });
    onShowToast('تمت إعادة ضبط عدادات القسم');
  };

  const handleCopy = async (item: HisnZikrItem) => {
    const formatted = `${item.occasion}\n${item.text}\n(${item.reference})`;
    try {
      await navigator.clipboard.writeText(formatted);
      setCopiedId(item.id);
      onShowToast('تم نسخ الذكر');
      window.setTimeout(() => {
        setCopiedId((prev) => (prev === item.id ? null : prev));
      }, 1800);
    } catch {
      onShowToast('تعذر النسخ التلقائي');
    }
  };

  const completedTotal = useMemo(
    () =>
      HISN_AZKAR.filter((item) => (remainingMap[item.id] ?? item.count) === 0)
        .length,
    [remainingMap]
  );

  const overallPct = Math.round((completedTotal / HISN_AZKAR.length) * 100);

  const categoryProgress = useMemo(() => {
    const map: Record<string, { total: number; done: number }> = {};
    for (const cat of HISN_CATEGORIES) {
      map[cat.id] = { total: 0, done: 0 };
    }
    for (const item of HISN_AZKAR) {
      map[item.category].total += 1;
      if ((remainingMap[item.id] ?? item.count) === 0) {
        map[item.category].done += 1;
      }
    }
    return map;
  }, [remainingMap]);

  const filteredItems = useMemo(() => {
    const q = normalizeArabicForSearch(searchQuery).toLowerCase();
    return HISN_AZKAR.filter((item) => {
      if (!q && activeCategory !== 'all' && item.category !== activeCategory) {
        return false;
      }
      if (!q) return true;
      const hay = normalizeArabicForSearch(
        `${item.occasion} ${item.text} ${item.reference} ${item.virtue ?? ''}`
      ).toLowerCase();
      return hay.includes(q);
    });
  }, [activeCategory, searchQuery]);

  const activeCategoryMeta = HISN_CATEGORIES.find(
    (c) => c.id === activeCategory
  );

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 pb-28 space-y-6">
      {/* Header Card */}
      <section className="rounded-3xl ios-glass-card p-6 sm:p-8 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 text-xs font-medium text-[#14532D] dark:text-emerald-300">
              <Shield className="w-4 h-4" />
              <span>أذكار المسلم اليومية حسب الأوقات والأحوال</span>
            </div>
            <h1 className="font-amiri text-3xl sm:text-4xl font-bold text-stone-900 dark:text-stone-100">
              حصن المسلم
            </h1>
            <p className="text-sm text-stone-600 dark:text-stone-400">
              اضغط على الذكر أو زر العداد لتسجيل التكرار تلقائياً مع حفظ تقدمك طوال اليوم
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setHapticEnabled((v) => !v)}
              aria-pressed={hapticEnabled}
              title={hapticEnabled ? 'الاهتزاز مفعّل' : 'الاهتزاز متوقف'}
              className={`ios-spring inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium ${
                hapticEnabled
                  ? 'bg-[#14532D]/12 dark:bg-emerald-500/20 text-[#14532D] dark:text-emerald-300'
                  : 'ios-glass-input text-stone-500 dark:text-stone-400'
              }`}
            >
              <Vibrate className="w-3.5 h-3.5" />
              <span>اهتزاز</span>
            </button>

            <button
              type="button"
              onClick={handleResetCategory}
              className="ios-spring inline-flex items-center gap-1.5 px-3 py-2 rounded-xl ios-glass-input text-xs font-medium text-stone-700 dark:text-stone-300"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>إعادة القسم</span>
            </button>
          </div>
        </div>

        {/* Daily Progress Bar */}
        <div className="rounded-2xl ios-glass-input p-3.5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-stone-700 dark:text-stone-300">
              إنجاز أذكار حصن المسلم اليوم
            </span>
            <span className="font-semibold text-[#14532D] dark:text-emerald-300 tabular-nums">
              {toArabicDigits(completedTotal)} من {toArabicDigits(HISN_AZKAR.length)}{' '}
              ({toArabicDigits(overallPct)}٪)
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-stone-200/80 dark:bg-stone-800 overflow-hidden">
            <div
              className="h-full bg-[#14532D] dark:bg-emerald-500 transition-[width] duration-300"
              style={{ width: `${overallPct}%` }}
            />
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-stone-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث في حصن المسلم (مثال: النوم، السفر، المسجد، المطر، الهم)..."
            aria-label="البحث في أذكار حصن المسلم"
            className="w-full pr-10 pl-10 py-2.5 text-sm rounded-2xl ios-glass-input text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="مسح البحث"
              className="absolute left-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Occasion / Time Category Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setActiveCategory('all')}
            className={`ios-spring px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 ${
              activeCategory === 'all' && !searchQuery
                ? 'bg-[#14532D] dark:bg-emerald-700 text-white shadow-xs'
                : 'ios-glass-input text-stone-700 dark:text-stone-300'
            }`}
          >
            الكل ({toArabicDigits(HISN_AZKAR.length)})
          </button>

          {HISN_CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.id && !searchQuery;
            const prog = categoryProgress[cat.id];
            const catDone = prog.done === prog.total && prog.total > 0;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setActiveCategory(cat.id);
                }}
                className={`ios-spring inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-[#14532D] dark:bg-emerald-700 text-white shadow-xs'
                    : 'ios-glass-input text-stone-700 dark:text-stone-300 hover:bg-white/70 dark:hover:bg-stone-800/70'
                }`}
              >
                {catDone && (
                  <CheckCircle2
                    className={`w-3.5 h-3.5 ${
                      isActive
                        ? 'text-emerald-200'
                        : 'text-[#14532D] dark:text-emerald-400'
                    }`}
                  />
                )}
                <span>{cat.label}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-md text-[10px] tabular-nums ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-stone-200/80 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
                  }`}
                >
                  {toArabicDigits(prog.done)}/{toArabicDigits(prog.total)}
                </span>
              </button>
            );
          })}
        </div>

        {activeCategoryMeta && !searchQuery && (
          <p className="text-xs text-stone-500 dark:text-stone-400">
            {activeCategoryMeta.label}: {activeCategoryMeta.subtitle}
          </p>
        )}
      </section>

      {/* Azkar Cards with Interactive Per-Zikr Counter */}
      {filteredItems.length === 0 ? (
        <div className="rounded-3xl ios-glass-card p-10 text-center space-y-3">
          <Sparkles className="w-8 h-8 mx-auto text-[#9A742E] dark:text-amber-400" />
          <p className="text-sm text-stone-600 dark:text-stone-400">
            لم يتم العثور على أذكار مطابقة للبحث.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setActiveCategory('all');
            }}
            className="ios-spring px-4 py-2 rounded-xl bg-[#14532D] dark:bg-emerald-700 text-white text-xs font-medium"
          >
            عرض جميع الأذكار
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredItems.map((item) => {
            const remaining = remainingMap[item.id] ?? item.count;
            const completedCount = item.count - remaining;
            const done = remaining === 0;
            const pct = Math.min(
              100,
              Math.round((completedCount / item.count) * 100)
            );
            const isCopied = copiedId === item.id;

            return (
              <motion.article
                key={item.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`rounded-3xl p-5 sm:p-6 space-y-4 transition-colors ${
                  done
                    ? 'border border-[#14532D]/40 bg-emerald-900/[0.07] dark:border-emerald-500/40 dark:bg-emerald-500/[0.10] backdrop-blur-md'
                    : 'ios-glass-card'
                }`}
              >
                {/* Top Occasion + Tools */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-amiri text-xl font-bold text-stone-900 dark:text-stone-100">
                        {item.occasion}
                      </h2>
                      {done && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#14532D] dark:bg-emerald-700 text-white">
                          <Check className="w-3 h-3" />
                          <span>مكتمل</span>
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-medium text-[#9A742E] dark:text-amber-400">
                      {item.reference}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => void handleCopy(item)}
                      aria-label="نسخ الذكر"
                      title="نسخ الذكر"
                      className="ios-spring w-9 h-9 rounded-xl ios-glass-input flex items-center justify-center text-stone-600 dark:text-stone-300"
                    >
                      {isCopied ? (
                        <Check className="w-4 h-4 text-[#14532D] dark:text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                    {completedCount > 0 && (
                      <button
                        type="button"
                        onClick={() => handleResetSingle(item)}
                        aria-label="إعادة عداد الذكر"
                        title="إعادة عداد الذكر"
                        className="ios-spring w-9 h-9 rounded-xl ios-glass-input flex items-center justify-center text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Zikr Text (tappable when incomplete) */}
                <div
                  onClick={() => {
                    if (!done) handleCountZikr(item);
                  }}
                  className={done ? '' : 'cursor-pointer select-none'}
                >
                  <p className="font-quran text-xl sm:text-2xl leading-[2.2] text-[#1C1917] dark:text-[#F2EFE8]">
                    {item.text}
                  </p>
                </div>

                {item.virtue && (
                  <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
                    {item.virtue}
                  </p>
                )}

                {/* Per-Zikr Counter Bar */}
                <div className="pt-2 border-t border-stone-200/60 dark:border-white/10 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex-1 min-w-[160px] space-y-1.5">
                    <div className="flex items-center justify-between text-xs tabular-nums">
                      <span className="text-stone-500 dark:text-stone-400">
                        التكرار المطلوب: {toArabicDigits(item.count)}
                      </span>
                      <span className="font-semibold text-[#14532D] dark:text-emerald-300">
                        {toArabicDigits(completedCount)} /{' '}
                        {toArabicDigits(item.count)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-stone-200/80 dark:bg-stone-800 overflow-hidden">
                      <div
                        className="h-full bg-[#14532D] dark:bg-emerald-500 transition-[width] duration-200"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  <motion.button
                    type="button"
                    whileTap={done ? undefined : { scale: 0.93 }}
                    disabled={done}
                    onClick={() => handleCountZikr(item)}
                    className={`ios-spring inline-flex items-center justify-center gap-2 min-w-[132px] px-4 py-2.5 rounded-2xl text-sm font-semibold tabular-nums shrink-0 ${
                      done
                        ? 'bg-[#14532D]/15 dark:bg-emerald-500/20 text-[#14532D] dark:text-emerald-300 cursor-default'
                        : 'bg-[#14532D] hover:bg-[#114224] dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white shadow-sm'
                    }`}
                  >
                    {done ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>أُتمَّ الذكر</span>
                      </>
                    ) : (
                      <span>
                        عدّ ({toArabicDigits(remaining)})
                      </span>
                    )}
                  </motion.button>
                </div>
              </motion.article>
            );
          })}
        </div>
      )}
    </div>
  );
};
