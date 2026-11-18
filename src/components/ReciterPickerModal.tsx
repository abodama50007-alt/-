import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Headphones, Search, Sparkles, X } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { Reciter } from '../types/quran';

interface ReciterPickerModalProps {
  open: boolean;
  reciters: Reciter[];
  selectedReciterId: string;
  onSelect: (reciterId: string) => void;
  onClose: () => void;
}

type ReciterFilter = 'all' | 'versebyverse' | 'surahbysurah';

export const ReciterPickerModal: React.FC<ReciterPickerModalProps> = ({
  open,
  reciters,
  selectedReciterId,
  onSelect,
  onClose,
}) => {
  const { language, isRTL, t, formatNumber } = useLanguage();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ReciterFilter>('all');

  const counts = useMemo(() => {
    let verse = 0;
    let surah = 0;
    for (const r of reciters) {
      if (r.type === 'versebyverse') verse += 1;
      else surah += 1;
    }
    return { total: reciters.length, verse, surah };
  }, [reciters]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reciters.filter((r) => {
      if (filter !== 'all' && r.type !== filter) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        (r.englishName && r.englishName.toLowerCase().includes(q)) ||
        r.style.toLowerCase().includes(q)
      );
    });
  }, [reciters, filter, query]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reciter-modal-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/55 backdrop-blur-md"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl max-h-[86vh] flex flex-col rounded-3xl ios-glass-card shadow-2xl border border-white/50 dark:border-white/15 overflow-hidden"
          >
            {/* Header */}
            <div className="px-5 sm:px-6 py-4 border-b border-stone-200/70 dark:border-white/10 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-start">
                <div className="w-10 h-10 rounded-xl bg-[#14532D]/12 dark:bg-emerald-500/20 text-[#14532D] dark:text-emerald-300 flex items-center justify-center shrink-0">
                  <Headphones className="w-5 h-5" />
                </div>
                <div>
                  <h2
                    id="reciter-modal-title"
                    className="font-amiri text-xl sm:text-2xl font-bold text-stone-900 dark:text-stone-100"
                  >
                    {t('reciterPickerTitle')}
                  </h2>
                  <p className="text-xs text-stone-500 dark:text-stone-400 tabular-nums">
                    {t('reciterPickerSubtitle', {
                      count: formatNumber(counts.total),
                    })}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label={t('reciterPickerCloseAria')}
                className="ios-spring w-9 h-9 rounded-xl ios-glass-input flex items-center justify-center text-stone-600 dark:text-stone-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search & Filter Tabs */}
            <div className="px-5 sm:px-6 py-3.5 space-y-3 border-b border-stone-200/60 dark:border-white/10">
              <div className="relative">
                <Search
                  className={`w-4 h-4 text-stone-400 absolute top-1/2 -translate-y-1/2 pointer-events-none ${
                    isRTL ? 'right-3.5' : 'left-3.5'
                  }`}
                />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('reciterPickerSearchPlaceholder')}
                  aria-label={t('reciterPickerSearchAria')}
                  className={`w-full py-2.5 text-sm rounded-xl ios-glass-input text-stone-900 dark:text-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 ${
                    isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'
                  }`}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {(
                  [
                    {
                      id: 'all',
                      label: t('reciterFilterAll', {
                        count: formatNumber(counts.total),
                      }),
                    },
                    {
                      id: 'versebyverse',
                      label: t('reciterFilterVerse', {
                        count: formatNumber(counts.verse),
                      }),
                    },
                    {
                      id: 'surahbysurah',
                      label: t('reciterFilterSurah', {
                        count: formatNumber(counts.surah),
                      }),
                    },
                  ] as const
                ).map((tab) => {
                  const active = filter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setFilter(tab.id)}
                      className={`ios-spring px-3 py-1.5 text-xs font-medium rounded-xl border transition-colors whitespace-nowrap ${
                        active
                          ? 'border-[#14532D]/40 bg-[#14532D] text-[#FBF8F1] dark:border-emerald-500/40 dark:bg-emerald-700'
                          : 'ios-glass-input text-stone-700 dark:text-stone-300'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Reciters Grid */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {filtered.length === 0 ? (
                <div className="py-12 text-center text-sm text-stone-500 dark:text-stone-400">
                  {t('reciterPickerEmpty')}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {filtered.map((reciter) => {
                    const isSelected = reciter.id === selectedReciterId;
                    const primaryName =
                      language === 'en' && reciter.englishName
                        ? reciter.englishName
                        : reciter.name;
                    const secondaryName =
                      language === 'en' ? reciter.name : reciter.englishName;
                    return (
                      <button
                        key={reciter.id}
                        type="button"
                        onClick={() => {
                          onSelect(reciter.id);
                          onClose();
                        }}
                        className={`ios-spring text-start p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition-all ${
                          isSelected
                            ? 'border-[#14532D] bg-[#14532D]/12 dark:border-emerald-500 dark:bg-emerald-500/18'
                            : 'ios-glass-input hover:border-[#14532D]/40 dark:hover:border-emerald-500/40'
                        }`}
                      >
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-sm text-stone-900 dark:text-stone-100 truncate">
                              {primaryName}
                            </span>
                            {reciter.featured && (
                              <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                            )}
                          </div>
                          {secondaryName && secondaryName !== primaryName && (
                            <div className="text-[11px] text-stone-500 dark:text-stone-400 truncate">
                              {secondaryName}
                            </div>
                          )}
                          <div className="flex items-center gap-2 pt-0.5">
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${
                                reciter.type === 'versebyverse'
                                  ? 'bg-emerald-900/10 text-[#14532D] dark:bg-emerald-500/20 dark:text-emerald-300'
                                  : 'bg-amber-700/10 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300'
                              }`}
                            >
                              {reciter.type === 'versebyverse'
                                ? t('reciterBadgeVerse')
                                : t('reciterBadgeSurah')}
                            </span>
                          </div>
                        </div>

                        {isSelected && (
                          <span className="w-7 h-7 rounded-xl bg-[#14532D] dark:bg-emerald-600 text-white flex items-center justify-center shrink-0">
                            <Check className="w-4 h-4" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
