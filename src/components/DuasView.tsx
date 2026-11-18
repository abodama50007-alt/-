import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  BookHeart,
  Check,
  Copy,
  Heart,
  Search,
  Share2,
  Sparkles,
  X,
} from 'lucide-react';
import { DUAS_COLLECTION } from '../data/duasData';
import { DuaCategory, DuaItem } from '../types/quran';
import { normalizeArabicForSearch, toArabicDigits } from '../utils/arabic';

type DuaFilterTab = 'all' | 'favorites' | DuaCategory;

interface DuasViewProps {
  favoriteIds: string[];
  onToggleFavorite: (id: string) => void;
  onShowToast: (msg: string) => void;
}

const FILTER_TABS: { id: DuaFilterTab; label: string }[] = [
  { id: 'all', label: 'الكل' },
  { id: 'favorites', label: 'المفضلة' },
  { id: 'quran', label: 'من القرآن الكريم' },
  { id: 'sunnah', label: 'من السنة النبوية' },
  { id: 'prophets', label: 'أدعية الأنبياء' },
  { id: 'daily', label: 'تفريج الكرب والحياة' },
];

const CATEGORY_LABELS: Record<DuaCategory, string> = {
  quran: 'قرآن كريم',
  sunnah: 'سنة نبوية',
  prophets: 'أدعية الأنبياء',
  daily: 'أدعية يومية',
};

export const DuasView: React.FC<DuasViewProps> = ({
  favoriteIds,
  onToggleFavorite,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<DuaFilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  const filteredDuas = useMemo(() => {
    const normalizedQuery = normalizeArabicForSearch(searchQuery).toLowerCase();

    return DUAS_COLLECTION.filter((dua) => {
      if (activeTab === 'favorites' && !favoriteSet.has(dua.id)) {
        return false;
      }
      if (
        activeTab !== 'all' &&
        activeTab !== 'favorites' &&
        dua.category !== activeTab
      ) {
        return false;
      }

      if (!normalizedQuery) return true;

      const haystack = normalizeArabicForSearch(
        `${dua.title} ${dua.text} ${dua.reference} ${dua.benefit ?? ''}`
      ).toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [activeTab, favoriteSet, searchQuery]);

  const handleCopy = async (dua: DuaItem) => {
    const formatted = `${dua.title}\n${dua.text}\n(${dua.reference})`;
    try {
      await navigator.clipboard.writeText(formatted);
      setCopiedId(dua.id);
      onShowToast('تم نسخ الدعاء إلى الحافظة');
      window.setTimeout(() => {
        setCopiedId((prev) => (prev === dua.id ? null : prev));
      }, 1800);
    } catch {
      onShowToast('تعذر النسخ التلقائي');
    }
  };

  const handleShare = async (dua: DuaItem) => {
    const shareText = `${dua.title}\n\n${dua.text}\n\n— ${dua.reference}`;
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: dua.title,
          text: shareText,
        });
        return;
      } catch {
        // user cancelled or unsupported -> fallback to copy
      }
    }
    await handleCopy(dua);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 pb-12 space-y-6">
      {/* Header Banner */}
      <section className="rounded-3xl ios-glass-card p-6 sm:p-8 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 text-xs font-medium text-[#14532D] dark:text-emerald-300">
              <BookHeart className="w-4 h-4" />
              <span>جوامع الكلم والدعاء الصحيح</span>
            </div>
            <h1 className="font-amiri text-3xl sm:text-4xl font-bold text-stone-900 dark:text-stone-100">
              الأدعية المأثورة
            </h1>
            <p className="text-sm text-stone-600 dark:text-stone-400">
              مختارات موثقة من القرآن الكريم والسنة النبوية الصحيحة مع البحث والحفظ في المفضلة
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <div className="rounded-2xl ios-glass-input px-4 py-2.5 text-center">
              <div className="text-[11px] text-stone-500 dark:text-stone-400">
                إجمالي الأدعية
              </div>
              <div className="text-lg font-bold text-stone-900 dark:text-stone-100 tabular-nums">
                {toArabicDigits(DUAS_COLLECTION.length)}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('favorites')}
              className="ios-spring rounded-2xl ios-glass-input px-4 py-2.5 text-center hover:border-rose-400/50"
            >
              <div className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center justify-center gap-1">
                <Heart className="w-3 h-3 text-rose-500 fill-rose-500" />
                <span>المفضلة</span>
              </div>
              <div className="text-lg font-bold text-[#14532D] dark:text-emerald-300 tabular-nums">
                {toArabicDigits(favoriteIds.length)}
              </div>
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-stone-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث في الأدعية بالعنوان أو نص الدعاء أو الفضل (مثال: الكرب، الرزق، الوالدين)..."
            aria-label="البحث في الأدعية المأثورة"
            className="w-full pr-10 pl-10 py-3 text-sm rounded-2xl ios-glass-input text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
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

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {FILTER_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const isFavTab = tab.id === 'favorites';
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`ios-spring inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 transition-colors ${
                  isActive
                    ? 'bg-[#14532D] dark:bg-emerald-700 text-white shadow-xs'
                    : 'ios-glass-input text-stone-700 dark:text-stone-300 hover:bg-white/70 dark:hover:bg-stone-800/70'
                }`}
              >
                {isFavTab && (
                  <Heart
                    className={`w-3.5 h-3.5 ${
                      isActive
                        ? 'fill-white text-white'
                        : 'text-rose-500 fill-rose-500'
                    }`}
                  />
                )}
                <span>{tab.label}</span>
                {isFavTab && (
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[10px] tabular-nums ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-stone-200/80 dark:bg-stone-800 text-stone-700 dark:text-stone-300'
                    }`}
                  >
                    {toArabicDigits(favoriteIds.length)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Results Count */}
      <div className="flex items-center justify-between px-1 text-xs text-stone-600 dark:text-stone-400">
        <span>
          عرض {toArabicDigits(filteredDuas.length)} من أصل{' '}
          {toArabicDigits(DUAS_COLLECTION.length)} دعاءً مأثوراً
        </span>
        {(searchQuery || activeTab !== 'all') && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setActiveTab('all');
            }}
            className="text-[#14532D] dark:text-emerald-300 font-medium hover:underline"
          >
            عرض جميع الأدعية
          </button>
        )}
      </div>

      {/* Duas List */}
      {filteredDuas.length === 0 ? (
        <div className="rounded-3xl ios-glass-card p-10 text-center space-y-3">
          <Sparkles className="w-8 h-8 mx-auto text-[#9A742E] dark:text-amber-400" />
          <h2 className="font-amiri text-xl font-bold text-stone-900 dark:text-stone-100">
            {activeTab === 'favorites' && favoriteIds.length === 0
              ? 'قائمة المفضلة فارغة حالياً'
              : 'لم يتم العثور على أدعية مطابقة'}
          </h2>
          <p className="text-sm text-stone-600 dark:text-stone-400 max-w-md mx-auto">
            {activeTab === 'favorites' && favoriteIds.length === 0
              ? 'اضغط على أيقونة القلب بجانب أي دعاء لحفظه في مفضلتك والرجوع إليه بسرعة.'
              : 'جرّب البحث بكلمة أخرى أو تصفح جميع أقسام الأدعية المأثورة.'}
          </p>
          {activeTab !== 'all' && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setActiveTab('all');
              }}
              className="ios-spring px-4 py-2 rounded-xl bg-[#14532D] dark:bg-emerald-700 text-white text-xs font-medium"
            >
              تصفح جميع الأدعية
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredDuas.map((dua) => {
            const isFav = favoriteSet.has(dua.id);
            const isCopied = copiedId === dua.id;
            return (
              <motion.article
                key={dua.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="rounded-3xl ios-glass-card p-5 sm:p-6 space-y-4"
              >
                {/* Top Metadata & Actions */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-amiri text-xl font-bold text-stone-900 dark:text-stone-100">
                        {dua.title}
                      </h2>
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#14532D]/10 dark:bg-emerald-500/15 text-[#14532D] dark:text-emerald-300">
                        {CATEGORY_LABELS[dua.category]}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-[#9A742E] dark:text-amber-400">
                      {dua.reference}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.88 }}
                      onClick={() => onToggleFavorite(dua.id)}
                      aria-label={isFav ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
                      title={isFav ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
                      className={`ios-spring w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                        isFav
                          ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-400/30'
                          : 'ios-glass-input text-stone-500 dark:text-stone-400 hover:text-rose-500'
                      }`}
                    >
                      <Heart
                        className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`}
                      />
                    </motion.button>

                    <button
                      type="button"
                      onClick={() => void handleCopy(dua)}
                      aria-label="نسخ الدعاء"
                      title="نسخ الدعاء"
                      className="ios-spring w-9 h-9 rounded-xl ios-glass-input flex items-center justify-center text-stone-600 dark:text-stone-300 hover:text-[#14532D] dark:hover:text-emerald-300"
                    >
                      {isCopied ? (
                        <Check className="w-4 h-4 text-[#14532D] dark:text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleShare(dua)}
                      aria-label="مشاركة الدعاء"
                      title="مشاركة الدعاء"
                      className="ios-spring w-9 h-9 rounded-xl ios-glass-input flex items-center justify-center text-stone-600 dark:text-stone-300 hover:text-[#14532D] dark:hover:text-emerald-300"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Vocalized Dua Text */}
                <p className="font-quran text-xl sm:text-2xl leading-[2.2] text-[#1C1917] dark:text-[#F2EFE8] select-text">
                  {dua.text}
                </p>

                {/* Benefit / Context */}
                {dua.benefit && (
                  <div className="rounded-2xl ios-glass-input px-4 py-2.5 text-xs sm:text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
                    {dua.benefit}
                  </div>
                )}
              </motion.article>
            );
          })}
        </div>
      )}
    </div>
  );
};
