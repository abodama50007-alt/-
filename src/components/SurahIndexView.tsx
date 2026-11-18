import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Bookmark, FileText, Search, Trash2 } from 'lucide-react';
import { JUZ_LIST } from '../data/quranMeta';
import { useLanguage } from '../i18n/LanguageContext';
import { BookmarkItem, ReflectionNote, SurahMeta } from '../types/quran';
import { normalizeArabicForSearch } from '../utils/arabic';

interface SurahIndexViewProps {
  surahList: SurahMeta[];
  loading: boolean;
  bookmarks: BookmarkItem[];
  notes: ReflectionNote[];
  onOpenSurah: (surahNumber: number, ayahNumber?: number) => void;
  onOpenJuz: (juzNumber: number) => void;
  onRemoveBookmark: (id: string) => void;
  onDeleteNote: (id: string) => void;
}

type IndexTab = 'surahs' | 'juz' | 'bookmarks';
type RevelationFilter = 'all' | 'Meccan' | 'Medinan';

export const SurahIndexView: React.FC<SurahIndexViewProps> = ({
  surahList,
  loading,
  bookmarks,
  notes,
  onOpenSurah,
  onOpenJuz,
  onRemoveBookmark,
  onDeleteNote,
}) => {
  const { language, isRTL, t, formatNumber, getRevelationLabel } =
    useLanguage();
  const [activeTab, setActiveTab] = useState<IndexTab>('surahs');
  const [query, setQuery] = useState('');
  const [revFilter, setRevFilter] = useState<RevelationFilter>('all');

  const filteredSurahs = useMemo(() => {
    const q = normalizeArabicForSearch(query).toLowerCase();
    return surahList.filter((s) => {
      if (revFilter !== 'all' && s.revelationType !== revFilter) return false;
      if (!q) return true;
      const arName = normalizeArabicForSearch(s.name).toLowerCase();
      const enName = s.englishName.toLowerCase();
      return (
        arName.includes(q) ||
        enName.includes(q) ||
        String(s.number) === q
      );
    });
  }, [surahList, query, revFilter]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-28 space-y-8">
      {/* Page Title & Segmented Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-stone-200 dark:border-stone-800 pb-6">
        <div className="text-start">
          <h1 className="font-amiri text-3xl sm:text-4xl font-bold text-stone-900 dark:text-stone-100">
            {t('indexTitle')}
          </h1>
          <p className="mt-1.5 text-sm text-stone-600 dark:text-stone-400">
            {t('indexSubtitle')}
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-2xl ios-glass-input self-start">
          {(
            [
              {
                id: 'surahs',
                label: t('indexTabSurahs', { count: formatNumber(114) }),
              },
              {
                id: 'juz',
                label: t('indexTabJuz', { count: formatNumber(30) }),
              },
              {
                id: 'bookmarks',
                label: t('indexTabBookmarks', {
                  count: formatNumber(bookmarks.length + notes.length),
                }),
              },
            ] as const
          ).map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`relative px-3.5 py-1.5 text-xs sm:text-sm font-medium rounded-xl ios-spring whitespace-nowrap ${
                  active
                    ? 'text-[#14532D] dark:text-emerald-300'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="index-active-tab"
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

      {/* TAB 1: 114 Surahs */}
      {activeTab === 'surahs' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search
                className={`w-4 h-4 text-stone-400 absolute top-1/2 -translate-y-1/2 pointer-events-none ${
                  isRTL ? 'right-3.5' : 'left-3.5'
                }`}
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('indexSearchPlaceholder')}
                aria-label={t('indexSearchAria')}
                className={`w-full py-2.5 text-sm rounded-2xl ios-glass-input text-stone-900 dark:text-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 ${
                  isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'
                }`}
              />
            </div>

            <div className="flex items-center gap-1 p-1 rounded-2xl ios-glass-input self-start">
              {(
                [
                  { id: 'all', label: t('all') },
                  { id: 'Meccan', label: t('meccan') },
                  { id: 'Medinan', label: t('medinan') },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setRevFilter(opt.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-xl ios-spring whitespace-nowrap ${
                    revFilter === opt.id
                      ? 'bg-white/85 dark:bg-white/[0.14] text-[#14532D] dark:text-emerald-300 shadow-xs'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="py-16 text-center text-sm text-stone-500">
              {t('indexLoading')}
            </div>
          ) : filteredSurahs.length === 0 ? (
            <div className="py-16 text-center text-sm text-stone-500 dark:text-stone-400">
              {t('indexEmpty')}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSurahs.map((surah) => (
                <button
                  key={surah.number}
                  type="button"
                  onClick={() => onOpenSurah(surah.number)}
                  className="group text-start p-4 rounded-2xl ios-glass-card ios-spring hover:border-[#14532D]/50 dark:hover:border-emerald-500/40 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-lg border border-[#D8CEBA] dark:border-stone-700 bg-[#F4EFE3] dark:bg-stone-900 flex items-center justify-center text-sm font-semibold text-[#14532D] dark:text-emerald-300 tabular-nums shrink-0">
                      {formatNumber(surah.number)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-amiri text-xl font-bold text-stone-900 dark:text-stone-100 group-hover:text-[#14532D] dark:group-hover:text-emerald-300 transition-colors truncate">
                        {language === 'en' ? surah.englishName : surah.name}
                      </div>
                      <div className="text-xs text-stone-500 dark:text-stone-400 flex items-center gap-2 tabular-nums">
                        <span>{getRevelationLabel(surah.revelationType)}</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {formatNumber(surah.numberOfAyahs)} {t('ayahs')}
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-stone-400 dark:text-stone-500 shrink-0 font-ui">
                    {language === 'en' ? surah.name : surah.englishName}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: 30 Juz */}
      {activeTab === 'juz' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {JUZ_LIST.map((juz) => (
            <button
              key={juz.number}
              type="button"
              onClick={() => onOpenJuz(juz.number)}
              className="group text-start p-4 rounded-2xl ios-glass-card ios-spring hover:border-[#14532D]/50 dark:hover:border-emerald-500/40 flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-lg border border-[#D8CEBA] dark:border-stone-700 bg-[#F4EFE3] dark:bg-stone-900 flex items-center justify-center text-sm font-semibold text-[#9A742E] dark:text-amber-400 tabular-nums shrink-0">
                  {formatNumber(juz.number)}
                </div>
                <div>
                  <div className="font-amiri text-xl font-bold text-stone-900 dark:text-stone-100 group-hover:text-[#14532D] dark:group-hover:text-emerald-300 transition-colors">
                    {t('indexJuzTitle', {
                      num: formatNumber(juz.number),
                      name: juz.name,
                    })}
                  </div>
                  <div className="text-xs text-stone-500 dark:text-stone-400 flex items-center gap-2 tabular-nums">
                    <span>
                      {t('indexJuzStartsFrom', { surah: juz.startSurah })}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {t('page')} {formatNumber(juz.startPage)}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* TAB 3: Bookmarks & Reflection Notes */}
      {activeTab === 'bookmarks' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Bookmarks */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-base font-semibold text-stone-900 dark:text-stone-100">
              <Bookmark className="w-4 h-4 text-[#9A742E] dark:text-amber-400" />
              <h2>
                {t('indexBookmarksTitle', {
                  count: formatNumber(bookmarks.length),
                })}
              </h2>
            </div>

            {bookmarks.length === 0 ? (
              <p className="p-6 rounded-xl border border-stone-200 dark:border-stone-800 text-sm text-stone-500 dark:text-stone-400 text-start">
                {t('indexBookmarksEmpty')}
              </p>
            ) : (
              <div className="divide-y divide-stone-200/70 dark:divide-stone-800/70 rounded-2xl ios-glass-card overflow-hidden">
                {bookmarks.map((bm) => (
                  <div
                    key={bm.id}
                    className="p-4 flex items-start justify-between gap-3"
                  >
                    <button
                      type="button"
                      onClick={() => onOpenSurah(bm.surahNumber, bm.ayahNumberInSurah)}
                      className="text-start flex-1 min-w-0 space-y-1"
                    >
                      <div className="text-xs font-medium text-[#14532D] dark:text-emerald-300 tabular-nums">
                        {t('indexBookmarkMeta', {
                          surah: bm.surahName,
                          ayah: formatNumber(bm.ayahNumberInSurah),
                          page: formatNumber(bm.page),
                        })}
                      </div>
                      <p
                        dir="rtl"
                        className="font-quran text-lg text-stone-900 dark:text-stone-100 truncate text-right"
                      >
                        {bm.ayahPreview}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveBookmark(bm.id)}
                      aria-label={t('indexDeleteBookmarkAria')}
                      className="p-2 rounded-lg text-stone-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-stone-200/50 dark:hover:bg-stone-800 transition-colors shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Reflection Notes */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-base font-semibold text-stone-900 dark:text-stone-100">
              <FileText className="w-4 h-4 text-[#14532D] dark:text-emerald-400" />
              <h2>
                {t('indexNotesTitle', { count: formatNumber(notes.length) })}
              </h2>
            </div>

            {notes.length === 0 ? (
              <p className="p-6 rounded-xl border border-stone-200 dark:border-stone-800 text-sm text-stone-500 dark:text-stone-400 text-start">
                {t('indexNotesEmpty')}
              </p>
            ) : (
              <div className="divide-y divide-stone-200/70 dark:divide-stone-800/70 rounded-2xl ios-glass-card overflow-hidden">
                {notes.map((n) => (
                  <div
                    key={n.id}
                    className="p-4 flex items-start justify-between gap-3"
                  >
                    <button
                      type="button"
                      onClick={() => onOpenSurah(n.surahNumber, n.ayahNumberInSurah)}
                      className="text-start flex-1 min-w-0 space-y-1.5"
                    >
                      <div className="text-xs font-medium text-[#14532D] dark:text-emerald-300 tabular-nums">
                        {t('indexNoteMeta', {
                          surah: n.surahName,
                          ayah: formatNumber(n.ayahNumberInSurah),
                        })}
                      </div>
                      <p className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed">
                        {n.note}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteNote(n.id)}
                      aria-label={t('indexDeleteNoteAria')}
                      className="p-2 rounded-lg text-stone-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-stone-200/50 dark:hover:bg-stone-800 transition-colors shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
