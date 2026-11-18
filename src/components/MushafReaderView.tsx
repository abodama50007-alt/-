import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Bookmark,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  FileText,
  Headphones,
  Minus,
  Monitor,
  Moon,
  Pause,
  Play,
  Plus,
  Repeat,
  RotateCcw,
  Sun,
} from 'lucide-react';
import { JUZ_LIST, TAFSIR_OPTIONS } from '../data/quranMeta';
import {
  AppSettings,
  AyahItem,
  BookmarkItem,
  HifzHideMode,
  LoadedPage,
  LoadedSurah,
  Reciter,
  ReflectionNote,
  SurahMeta,
  TafsirEditionId,
} from '../types/quran';
import {
  formatRevelationType,
  stripLeadingBismillah,
  toArabicDigits,
} from '../utils/arabic';
import { AyahEndRosette, SurahHeaderBanner } from './IslamicOrnament';
import { MushafPageView } from './MushafPageView';

interface MushafReaderViewProps {
  surahList: SurahMeta[];
  loadedSurah: LoadedSurah | null;
  loading: boolean;
  error: string | null;
  activeSurahNumber: number;
  activePageNumber: number;
  loadedPage: LoadedPage | null;
  pageLoading: boolean;
  pageError: string | null;
  highlightAyahNumber: number | null;
  highlightAyahGlobalNumber: number | null;
  playingAyahGlobalNumber: number | null;
  isPlaying: boolean;
  settings: AppSettings;
  reciters: Reciter[];
  bookmarks: BookmarkItem[];
  notes: ReflectionNote[];
  onSelectSurah: (surahNumber: number, targetAyah?: number) => void;
  onChangePage: (pageNumber: number) => void;
  onJumpToJuz: (juzNumber: number) => void;
  onJumpToPage: (pageNumber: number) => void;
  onUpdateSettings: (partial: Partial<AppSettings>) => void;
  onOpenReciterPicker: () => void;
  onPlayAyah: (ayah: AyahItem) => void;
  onToggleBookmark: (ayah: AyahItem, surahMeta: SurahMeta) => void;
  onSaveNote: (surahMeta: SurahMeta, ayahNumberInSurah: number, text: string) => void;
  onDeleteNote: (id: string) => void;
  onMarkSurahReadInKhatmah: (pageNumber: number) => void;
  onRetry: () => void;
  onRetryPage: () => void;
  hifzModeEnabled: boolean;
  hifzHideMode: HifzHideMode;
  revealedAyahNumbers: Set<number>;
  hifzTargetGlobalAyah: number | null;
  hifzRepeatTarget: number;
  hifzRepeatDone: number;
  hifzAudioRepeatActive: boolean;
  onToggleHifzMode: () => void;
  onChangeHifzHideMode: (mode: HifzHideMode) => void;
  onToggleRevealAyah: (globalAyahNumber: number) => void;
  onRevealAllAyahs: (ayahNumbers: number[]) => void;
  onHideAllAyahs: () => void;
  onSelectHifzTargetAyah: (ayah: AyahItem) => void;
  onChangeHifzRepeatTarget: (count: number) => void;
  onIncrementHifzRepeatManual: () => void;
  onResetHifzCounter: () => void;
  onToggleHifzAudioRepeat: () => void;
}

export const MushafReaderView: React.FC<MushafReaderViewProps> = ({
  surahList,
  loadedSurah,
  loading,
  error,
  activeSurahNumber,
  activePageNumber,
  loadedPage,
  pageLoading,
  pageError,
  highlightAyahNumber,
  highlightAyahGlobalNumber,
  playingAyahGlobalNumber,
  isPlaying,
  settings,
  reciters,
  bookmarks,
  notes,
  onSelectSurah,
  onChangePage,
  onJumpToJuz,
  onJumpToPage,
  onUpdateSettings,
  onOpenReciterPicker,
  onPlayAyah,
  onToggleBookmark,
  onSaveNote,
  onDeleteNote,
  onMarkSurahReadInKhatmah,
  onRetry,
  onRetryPage,
  hifzModeEnabled,
  hifzHideMode,
  revealedAyahNumbers,
  hifzTargetGlobalAyah,
  hifzRepeatTarget,
  hifzRepeatDone,
  hifzAudioRepeatActive,
  onToggleHifzMode,
  onChangeHifzHideMode,
  onToggleRevealAyah,
  onRevealAllAyahs,
  onHideAllAyahs,
  onSelectHifzTargetAyah,
  onChangeHifzRepeatTarget,
  onIncrementHifzRepeatManual,
  onResetHifzCounter,
  onToggleHifzAudioRepeat,
}) => {
  const [expandedTafsirAyahs, setExpandedTafsirAyahs] = useState<Set<number>>(new Set());
  const [editingNoteAyah, setEditingNoteAyah] = useState<number | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [copiedAyah, setCopiedAyah] = useState<number | null>(null);
  const [pageInput, setPageInput] = useState('');
  const ayahRefs = useRef<Record<number, HTMLDivElement | HTMLSpanElement | null>>({});

  useEffect(() => {
    setEditingNoteAyah(null);
    setExpandedTafsirAyahs(new Set());
  }, [activeSurahNumber]);

  // Scroll to highlighted ayah from search/bookmark or currently playing ayah
  useEffect(() => {
    if (!loadedSurah) return;
    const targetNum = highlightAyahNumber;
    if (targetNum && ayahRefs.current[targetNum]) {
      setTimeout(() => {
        ayahRefs.current[targetNum]?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }, 120);
    }
  }, [highlightAyahNumber, loadedSurah]);

  useEffect(() => {
    if (!loadedSurah || !playingAyahGlobalNumber) return;
    const found = loadedSurah.ayahs.find((a) => a.number === playingAyahGlobalNumber);
    if (found && ayahRefs.current[found.numberInSurah]) {
      ayahRefs.current[found.numberInSurah]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [playingAyahGlobalNumber, loadedSurah]);

  const toggleTafsirForAyah = (numInSurah: number) => {
    setExpandedTafsirAyahs((prev) => {
      const next = new Set(prev);
      if (next.has(numInSurah)) {
        next.delete(numInSurah);
      } else {
        next.add(numInSurah);
      }
      return next;
    });
  };

  const handleCopyAyah = async (ayah: AyahItem, surahName: string) => {
    const cleanText = stripLeadingBismillah(
      ayah.text,
      activeSurahNumber,
      ayah.numberInSurah
    );
    const formatted = `﴿${cleanText}﴾ [${surahName}: ${toArabicDigits(ayah.numberInSurah)}]`;
    try {
      await navigator.clipboard.writeText(formatted);
      setCopiedAyah(ayah.numberInSurah);
      setTimeout(() => setCopiedAyah(null), 1800);
    } catch {
      // ignore clipboard restrictions
    }
  };

  const openNoteEditor = (ayahNumberInSurah: number) => {
    const existing = notes.find(
      (n) =>
        n.surahNumber === activeSurahNumber &&
        n.ayahNumberInSurah === ayahNumberInSurah
    );
    setNoteDraft(existing?.note ?? '');
    setEditingNoteAyah(ayahNumberInSurah);
  };

  const isBookmarked = (globalNumber: number) =>
    bookmarks.some((b) => b.globalAyahNumber === globalNumber);

  const getNoteForAyah = (ayahNumberInSurah: number) =>
    notes.find(
      (n) =>
        n.surahNumber === activeSurahNumber &&
        n.ayahNumberInSurah === ayahNumberInSurah
    );

  const handlePageJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(pageInput);
    if (num >= 1 && num <= 604) {
      onJumpToPage(num);
      setPageInput('');
    }
  };

  const firstAyah = loadedSurah?.ayahs[0];
  const lastAyah = loadedSurah?.ayahs[loadedSurah.ayahs.length - 1];

  const currentVisibleAyahs: AyahItem[] =
    settings.readingMode === 'page'
      ? loadedPage?.ayahs ?? []
      : loadedSurah?.ayahs ?? [];

  const allCurrentAyahsRevealed =
    currentVisibleAyahs.length > 0 &&
    currentVisibleAyahs.every((a) => revealedAyahNumbers.has(a.number));

  const selectedHifzAyah =
    currentVisibleAyahs.find((a) => a.number === hifzTargetGlobalAyah) ??
    currentVisibleAyahs[0] ??
    null;

  const hifzProgressPct = Math.min(
    100,
    Math.round((hifzRepeatDone / Math.max(1, hifzRepeatTarget)) * 100)
  );

  return (
    <div className="pb-12">
      {/* Workspace Toolbar */}
      <div className="border-b border-stone-200/70 dark:border-white/10 ios-glass">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
          {/* Navigation Jumpers: Surah, Juz, Page */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="اختر السورة"
              value={activeSurahNumber}
              onChange={(e) => onSelectSurah(Number(e.target.value))}
              className="text-sm font-medium rounded-xl ios-glass-input text-stone-900 dark:text-stone-100 px-3 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
            >
              {surahList.length > 0 ? (
                surahList.map((s) => (
                  <option key={s.number} value={s.number}>
                    {toArabicDigits(s.number)}. {s.name}
                  </option>
                ))
              ) : (
                <option value={activeSurahNumber}>
                  سورة رقم {toArabicDigits(activeSurahNumber)}
                </option>
              )}
            </select>

            <select
              aria-label="الانتقال إلى جزء"
              value=""
              onChange={(e) => {
                if (e.target.value) onJumpToJuz(Number(e.target.value));
              }}
              className="text-xs sm:text-sm rounded-xl ios-glass-input text-stone-700 dark:text-stone-300 px-2.5 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
            >
              <option value="">الانتقال لجزء...</option>
              {JUZ_LIST.map((j) => (
                <option key={j.number} value={j.number}>
                  الجزء {toArabicDigits(j.number)} — {j.name}
                </option>
              ))}
            </select>

            <form
              onSubmit={handlePageJumpSubmit}
              className={`${
                settings.readingMode === 'page' ? 'flex' : 'hidden lg:flex'
              } items-center gap-1`}
            >
              <input
                type="number"
                min={1}
                max={604}
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                placeholder="صفحة ١–٦٠٤"
                aria-label="رقم صفحة المصحف"
                className="w-24 sm:w-28 text-xs rounded-xl ios-glass-input text-stone-800 dark:text-stone-200 px-2.5 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
              />
              <button
                type="submit"
                className="ios-spring px-2.5 py-1.5 text-xs font-medium rounded-xl ios-glass-input text-stone-700 dark:text-stone-200 hover:bg-white/70 dark:hover:bg-stone-800/70 whitespace-nowrap"
              >
                انتقال
              </button>
            </form>
          </div>

          {/* Reading & Audio Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Segmented Mode Control: Verses Study vs Paper Mushaf Page View */}
            <div className="flex items-center p-0.5 rounded-xl ios-glass-input">
              {(
                [
                  { id: 'verses', label: 'القراءة بالآيات' },
                  { id: 'page', label: 'القراءة بالصفحة' },
                ] as const
              ).map((mode) => {
                const active = settings.readingMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => onUpdateSettings({ readingMode: mode.id })}
                    className={`relative ios-spring px-3 py-1 text-xs font-medium rounded-lg whitespace-nowrap ${
                      active
                        ? 'text-[#14532D] dark:text-emerald-300'
                        : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="mushaf-reading-mode-pill"
                        transition={{ type: 'spring', stiffness: 450, damping: 34 }}
                        className="absolute inset-0 rounded-lg bg-white/90 dark:bg-stone-800 shadow-xs"
                      />
                    )}
                    <span className="relative z-10">{mode.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Tafsir Selector */}
            <select
              aria-label="اختر التفسير"
              value={settings.tafsirEdition}
              onChange={(e) =>
                onUpdateSettings({ tafsirEdition: e.target.value as TafsirEditionId })
              }
              className="text-xs rounded-xl ios-glass-input text-stone-700 dark:text-stone-300 px-2.5 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
            >
              {TAFSIR_OPTIONS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>

            {settings.readingMode === 'verses' && (
              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({ showTafsirInline: !settings.showTafsirInline })
                }
                className={`ios-spring inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-xl border whitespace-nowrap ${
                  settings.showTafsirInline
                    ? 'border-[#14532D]/40 bg-[#14532D]/12 text-[#14532D] dark:border-emerald-500/40 dark:bg-emerald-500/20 dark:text-emerald-300'
                    : 'ios-glass-input text-stone-700 dark:text-stone-300'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>التفسير تلقائياً</span>
              </button>
            )}

            {/* Font Size Controls */}
            <div className="flex items-center ios-glass-input rounded-xl">
              <button
                type="button"
                aria-label="تصغير الخط"
                onClick={() =>
                  onUpdateSettings({ fontSize: Math.max(20, settings.fontSize - 2) })
                }
                className="ios-spring p-1.5 text-stone-600 dark:text-stone-300 hover:bg-stone-900/5 dark:hover:bg-white/10 rounded-r-xl"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="px-2 text-xs text-stone-600 dark:text-stone-400 tabular-nums select-none">
                {toArabicDigits(settings.fontSize)}
              </span>
              <button
                type="button"
                aria-label="تكبير الخط"
                onClick={() =>
                  onUpdateSettings({ fontSize: Math.min(44, settings.fontSize + 2) })
                }
                className="ios-spring p-1.5 text-stone-600 dark:text-stone-300 hover:bg-stone-900/5 dark:hover:bg-white/10 rounded-l-xl"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Reciter Picker Trigger (170+ Reciters) */}
            <button
              type="button"
              onClick={onOpenReciterPicker}
              title="اختيار القارئ من المكتبة الشاملة"
              className="ios-spring inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-xl ios-glass-input text-stone-700 dark:text-stone-200 hover:bg-white/70 dark:hover:bg-stone-800/70 max-w-[170px] whitespace-nowrap"
            >
              <Headphones className="w-3.5 h-3.5 text-[#14532D] dark:text-emerald-400 shrink-0" />
              <span className="truncate">
                {reciters.find((r) => r.id === settings.reciterId)?.name ?? 'القارئ'}
              </span>
            </button>

            {/* Hifz / Memorization Mode Toggle */}
            <button
              type="button"
              onClick={onToggleHifzMode}
              title="وضع الحفظ: إخفاء الآيات وتكرار آية محددة مع عداد"
              className={`ios-spring inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-xl border whitespace-nowrap ${
                hifzModeEnabled
                  ? 'border-[#14532D]/50 bg-[#14532D] text-[#FBF8F1] dark:border-emerald-500/50 dark:bg-emerald-700'
                  : 'ios-glass-input text-stone-700 dark:text-stone-200 hover:bg-white/70 dark:hover:bg-stone-800/70'
              }`}
            >
              <EyeOff className="w-3.5 h-3.5" />
              <span>وضع الحفظ</span>
            </button>

            {/* Auto / Light / Dark Mode Toggle */}
            <button
              type="button"
              onClick={() => {
                const order = ['auto', 'light', 'dark'] as const;
                const nextMode =
                  order[(order.indexOf(settings.themeMode) + 1) % order.length];
                onUpdateSettings({ themeMode: nextMode });
              }}
              aria-label="تغيير مظهر القراءة (تلقائي / نهاري / ليلي)"
              title="المظهر: تلقائي حسب وقت الغروب والشروق والنظام، أو نهاري، أو ليلي"
              className="ios-spring inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-xl ios-glass-input text-stone-700 dark:text-stone-200 hover:bg-white/70 dark:hover:bg-stone-800/70 whitespace-nowrap"
            >
              {settings.themeMode === 'auto' ? (
                <>
                  <Monitor className="w-3.5 h-3.5 text-[#14532D] dark:text-emerald-400" />
                  <span className="hidden sm:inline">تلقائي</span>
                </>
              ) : settings.darkMode ? (
                <>
                  <Moon className="w-3.5 h-3.5 text-emerald-300" />
                  <span className="hidden sm:inline">ليلي</span>
                </>
              ) : (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-600" />
                  <span className="hidden sm:inline">نهاري</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Reading Container */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Memorization & Repetition Control Panel */}
        <AnimatePresence>
          {hifzModeEnabled && (
            <motion.section
              initial={{ opacity: 0, y: -8, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.99 }}
              transition={{ duration: 0.2 }}
              aria-label="لوحة وضع الحفظ والتكرار"
              className="mb-6 p-4 sm:p-5 rounded-3xl ios-glass-card border border-[#14532D]/25 dark:border-emerald-500/25 space-y-4"
            >
              {/* Top Header + Hide Mode Selector */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-[#14532D]/12 dark:bg-emerald-500/20 text-[#14532D] dark:text-emerald-300">
                      <Repeat className="w-4 h-4" />
                    </span>
                    <h2 className="text-sm sm:text-base font-bold text-stone-900 dark:text-stone-100">
                      وضع الحفظ والتكرار
                    </h2>
                  </div>
                  <p className="text-xs text-stone-600 dark:text-stone-400">
                    اضغط على أي آية لكشفها أو إخفائها، وحدد آية لتكرارها صوتياً أو بالتسميع اليدوي.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Hide Mode Segmented Pills */}
                  <div className="flex items-center p-0.5 rounded-xl ios-glass-input">
                    {(
                      [
                        { id: 'full', label: 'إخفاء كلي' },
                        { id: 'first-word', label: 'أول كلمتين' },
                        { id: 'visible', label: 'إظهار الكل' },
                      ] as const
                    ).map((mode) => {
                      const active = hifzHideMode === mode.id;
                      return (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => onChangeHifzHideMode(mode.id)}
                          className={`ios-spring px-2.5 py-1 text-xs font-medium rounded-lg whitespace-nowrap ${
                            active
                              ? 'bg-[#14532D] text-[#FBF8F1] dark:bg-emerald-700 shadow-xs'
                              : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white'
                          }`}
                        >
                          {mode.label}
                        </button>
                      );
                    })}
                  </div>

                  {hifzHideMode !== 'visible' && currentVisibleAyahs.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (allCurrentAyahsRevealed) {
                          onHideAllAyahs();
                        } else {
                          onRevealAllAyahs(currentVisibleAyahs.map((a) => a.number));
                        }
                      }}
                      className="ios-spring inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl ios-glass-input text-[#14532D] dark:text-emerald-300 whitespace-nowrap"
                    >
                      {allCurrentAyahsRevealed ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5" />
                          <span>إخفاء الجميع</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5" />
                          <span>كشف الجميع</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Ayah Selector + Repeat Target + Counter */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 pt-3 border-t border-stone-200/70 dark:border-white/10 items-center">
                {/* Target Ayah Selector */}
                <div className="lg:col-span-5 space-y-1">
                  <label
                    htmlFor="hifz-target-ayah-select"
                    className="block text-[11px] font-medium text-stone-500 dark:text-stone-400"
                  >
                    الآية المستهدفة للتكرار
                  </label>
                  <select
                    id="hifz-target-ayah-select"
                    value={selectedHifzAyah?.number ?? ''}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      const found = currentVisibleAyahs.find((a) => a.number === val);
                      if (found) onSelectHifzTargetAyah(found);
                    }}
                    disabled={currentVisibleAyahs.length === 0}
                    className="w-full text-xs sm:text-sm rounded-xl ios-glass-input text-stone-800 dark:text-stone-100 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
                  >
                    {currentVisibleAyahs.length === 0 ? (
                      <option value="">جاري تحميل الآيات...</option>
                    ) : (
                      currentVisibleAyahs.map((a) => {
                        const surahNum = a.surah?.number ?? activeSurahNumber;
                        const snippetWords = stripLeadingBismillah(
                          a.text,
                          surahNum,
                          a.numberInSurah
                        )
                          .split(/\s+/)
                          .slice(0, 4)
                          .join(' ');
                        const prefix =
                          settings.readingMode === 'page' && a.surah?.name
                            ? `${a.surah.name} — `
                            : '';
                        return (
                          <option key={a.number} value={a.number}>
                            {prefix}آية {toArabicDigits(a.numberInSurah)} ({snippetWords}...)
                          </option>
                        );
                      })
                    )}
                  </select>
                </div>

                {/* Target Count Selector */}
                <div className="lg:col-span-4 space-y-1">
                  <span className="block text-[11px] font-medium text-stone-500 dark:text-stone-400">
                    عدد التكرارات المطلوب
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[3, 5, 7, 10, 15, 20].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => onChangeHifzRepeatTarget(num)}
                        className={`ios-spring px-2.5 py-1 text-xs font-semibold rounded-lg tabular-nums ${
                          hifzRepeatTarget === num
                            ? 'bg-[#14532D] text-[#FBF8F1] dark:bg-emerald-700'
                            : 'ios-glass-input text-stone-700 dark:text-stone-300'
                        }`}
                      >
                        {toArabicDigits(num)}
                      </button>
                    ))}
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={hifzRepeatTarget}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (Number.isFinite(n) && n >= 1 && n <= 100) {
                          onChangeHifzRepeatTarget(Math.round(n));
                        }
                      }}
                      aria-label="عدد التكرارات المخصص"
                      className="w-14 text-xs text-center rounded-lg ios-glass-input text-stone-800 dark:text-stone-100 px-1.5 py-1 tabular-nums"
                    />
                  </div>
                </div>

                {/* Counter Badge */}
                <div className="lg:col-span-3 flex flex-col justify-center rounded-2xl ios-glass-input px-3.5 py-2.5 space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-stone-600 dark:text-stone-400">
                      التقدم
                    </span>
                    <span className="font-bold text-sm text-[#14532D] dark:text-emerald-300 tabular-nums">
                      {toArabicDigits(hifzRepeatDone)} / {toArabicDigits(hifzRepeatTarget)}
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-stone-200/80 dark:bg-stone-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#14532D] dark:bg-emerald-500 transition-all duration-300"
                      style={{ width: `${hifzProgressPct}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Action Controls Row */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={!selectedHifzAyah}
                    onClick={onToggleHifzAudioRepeat}
                    className="ios-spring inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-[#14532D] hover:bg-[#114224] dark:bg-emerald-700 dark:hover:bg-emerald-600 text-[#FBF8F1] disabled:opacity-40 whitespace-nowrap"
                  >
                    {hifzAudioRepeatActive && isPlaying ? (
                      <>
                        <Pause className="w-3.5 h-3.5" />
                        <span>إيقاف التكرار الصوتي</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5" />
                        <span>تشغيل التكرار الصوتي</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={!selectedHifzAyah}
                    onClick={onIncrementHifzRepeatManual}
                    className="ios-spring inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl ios-glass-input text-[#14532D] dark:text-emerald-300 hover:bg-white/80 dark:hover:bg-stone-800/80 disabled:opacity-40 whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+١ تكرار (تسميع)</span>
                  </button>

                  <button
                    type="button"
                    onClick={onResetHifzCounter}
                    className="ios-spring inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl ios-glass-input text-stone-600 dark:text-stone-300 whitespace-nowrap"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>تصفير العداد</span>
                  </button>
                </div>

                {hifzRepeatDone >= hifzRepeatTarget && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/15 text-[#14532D] dark:text-emerald-300 text-xs font-semibold">
                    <Check className="w-3.5 h-3.5" />
                    <span>أتممت الهدف المطلوب!</span>
                  </span>
                )}
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {settings.readingMode === 'page' ? (
          <MushafPageView
            pageNumber={activePageNumber}
            loadedPage={loadedPage}
            loading={pageLoading}
            error={pageError}
            highlightAyahGlobalNumber={highlightAyahGlobalNumber}
            playingAyahGlobalNumber={playingAyahGlobalNumber}
            isPlaying={isPlaying}
            settings={settings}
            bookmarks={bookmarks}
            notes={notes}
            onChangePage={onChangePage}
            onPlayAyah={onPlayAyah}
            onToggleBookmark={onToggleBookmark}
            onSaveNote={onSaveNote}
            onDeleteNote={onDeleteNote}
            onMarkPageReadInKhatmah={onMarkSurahReadInKhatmah}
            onRetry={onRetryPage}
            hifzModeEnabled={hifzModeEnabled}
            hifzHideMode={hifzHideMode}
            revealedAyahNumbers={revealedAyahNumbers}
            hifzTargetGlobalAyah={hifzTargetGlobalAyah}
            onToggleRevealAyah={onToggleRevealAyah}
            onSelectHifzTargetAyah={onSelectHifzTargetAyah}
          />
        ) : (
          <>
            {loading && (
              <div className="py-20 text-center space-y-4">
                <div className="w-8 h-8 border-2 border-[#14532D]/30 border-t-[#14532D] dark:border-emerald-400/30 dark:border-t-emerald-400 rounded-full animate-spin mx-auto" />
                <p className="text-sm text-stone-600 dark:text-stone-400">
                  جاري تحميل الآيات والتفسير...
                </p>
              </div>
            )}

            {!loading && error && (
              <div className="my-12 p-8 rounded-2xl ios-glass-card text-center space-y-4">
                <p className="text-base font-medium text-stone-900 dark:text-stone-100">
                  {error}
                </p>
                <button
                  type="button"
                  onClick={onRetry}
                  className="ios-spring px-5 py-2 text-sm font-medium rounded-xl bg-[#14532D] text-[#FBF8F1] hover:bg-[#114224]"
                >
                  إعادة المحاولة
                </button>
              </div>
            )}

            {!loading && !error && loadedSurah && (
              <div className="space-y-8">
                {/* Ornamental Surah Header */}
                <SurahHeaderBanner
                  surahName={loadedSurah.meta.name}
                  surahNumber={loadedSurah.meta.number}
                  revelationType={loadedSurah.meta.revelationType}
                  ayahCount={loadedSurah.meta.numberOfAyahs}
                  juzNumber={firstAyah?.juz}
                />

                {/* Quick Surah Action Strip */}
                <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-stone-600 dark:text-stone-400">
                  <div className="flex items-center gap-2 tabular-nums">
                    <span>
                      الصفحات {toArabicDigits(firstAyah?.page ?? 1)}–
                      {toArabicDigits(lastAyah?.page ?? 1)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{formatRevelationType(loadedSurah.meta.revelationType)}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => firstAyah && onPlayAyah(firstAyah)}
                      className="ios-spring inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl bg-[#14532D] hover:bg-[#114224] dark:bg-emerald-700 dark:hover:bg-emerald-600 text-[#FBF8F1] whitespace-nowrap"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>استماع للسورة</span>
                    </button>
                    {lastAyah && (
                      <button
                        type="button"
                        onClick={() => onMarkSurahReadInKhatmah(lastAyah.page)}
                        className="ios-spring inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl ios-glass-input text-stone-700 dark:text-stone-200 whitespace-nowrap"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>تحديث تقدم الختمة</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Bismillah Header (for all surahs except #1 Al-Fatihah and #9 At-Tawbah) */}
                {loadedSurah.meta.number !== 1 && loadedSurah.meta.number !== 9 && (
                  <div className="text-center py-3">
                    <p className="font-quran text-2xl sm:text-3xl text-[#1C1917] dark:text-[#F2EFE8]">
                      بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
                    </p>
                  </div>
                )}

                {/* Verse-by-Verse Study Mode */}
                <div className="divide-y divide-stone-200/85 dark:divide-stone-800/85">
                  {loadedSurah.ayahs.map((ayah) => {
                    const isCurrentPlaying = playingAyahGlobalNumber === ayah.number;
                    const isHighlighted = highlightAyahNumber === ayah.numberInSurah;
                    const isHifzTarget =
                      hifzModeEnabled && hifzTargetGlobalAyah === ayah.number;
                    const isAyahRevealed =
                      !hifzModeEnabled ||
                      hifzHideMode === 'visible' ||
                      revealedAyahNumbers.has(ayah.number);
                    const bookmarked = isBookmarked(ayah.number);
                    const existingNote = getNoteForAyah(ayah.numberInSurah);
                    const showTafsir =
                      settings.showTafsirInline ||
                      expandedTafsirAyahs.has(ayah.numberInSurah);
                    const displayVerseText = stripLeadingBismillah(
                      ayah.text,
                      loadedSurah.meta.number,
                      ayah.numberInSurah
                    );
                    const verseWords = displayVerseText.split(/\s+/);
                    const cueVerseText = verseWords.slice(0, 2).join(' ');
                    const restVerseText = verseWords.slice(2).join(' ');

                    return (
                      <div
                        key={ayah.number}
                        ref={(el) => {
                          ayahRefs.current[ayah.numberInSurah] = el;
                        }}
                        className={`py-7 px-3 sm:px-5 rounded-xl transition-colors duration-200 ${
                          isCurrentPlaying
                            ? 'bg-emerald-900/[0.06] dark:bg-emerald-500/[0.08]'
                            : isHifzTarget
                            ? 'bg-emerald-900/[0.04] dark:bg-emerald-500/[0.06] ring-1 ring-[#14532D]/25 dark:ring-emerald-400/25'
                            : isHighlighted
                            ? 'bg-amber-900/[0.05] dark:bg-amber-400/[0.07]'
                            : ''
                        }`}
                      >
                        {/* Ayah Top Metadata & Action Row */}
                        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                          <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400 tabular-nums">
                            <span className="font-semibold text-[#14532D] dark:text-emerald-300">
                              {toArabicDigits(loadedSurah.meta.number)}:
                              {toArabicDigits(ayah.numberInSurah)}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>الجزء {toArabicDigits(ayah.juz)}</span>
                            <span aria-hidden="true">·</span>
                            <span>صفحة {toArabicDigits(ayah.page)}</span>
                            {ayah.sajda && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="font-medium text-[#9A742E] dark:text-amber-400">
                                  موضع سجدة تلاوة
                                </span>
                              </>
                            )}
                            {isHifzTarget && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="font-semibold text-[#14532D] dark:text-emerald-300">
                                  آية التكرار
                                </span>
                              </>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            {hifzModeEnabled && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => onSelectHifzTargetAyah(ayah)}
                                  title="تحديد الآية للتكرار والحفظ"
                                  aria-label="تحديد للتكرار"
                                  className={`ios-spring inline-flex items-center gap-1 px-2.5 h-8 text-xs font-medium rounded-lg transition-colors ${
                                    isHifzTarget
                                      ? 'bg-[#14532D] text-[#FBF8F1] dark:bg-emerald-700'
                                      : 'text-[#14532D] dark:text-emerald-300 hover:bg-emerald-900/10 dark:hover:bg-emerald-500/15'
                                  }`}
                                >
                                  <Repeat className="w-3.5 h-3.5" />
                                  <span className="hidden sm:inline">تكرار للحفظ</span>
                                </button>

                                {hifzHideMode !== 'visible' && (
                                  <button
                                    type="button"
                                    onClick={() => onToggleRevealAyah(ayah.number)}
                                    title={isAyahRevealed ? 'إخفاء الآية' : 'كشف الآية'}
                                    aria-label={isAyahRevealed ? 'إخفاء الآية' : 'كشف الآية'}
                                    className="ios-spring w-8 h-8 inline-flex items-center justify-center rounded-lg text-stone-500 dark:text-stone-400 hover:bg-stone-200/60 dark:hover:bg-stone-800 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
                                  >
                                    {isAyahRevealed ? (
                                      <EyeOff className="w-3.5 h-3.5" />
                                    ) : (
                                      <Eye className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                )}
                              </>
                            )}

                            <button
                              type="button"
                              onClick={() => onPlayAyah(ayah)}
                              title={isCurrentPlaying && isPlaying ? 'إيقاف' : 'استماع للآية'}
                              aria-label="استماع للآية"
                              className={`ios-spring w-8 h-8 inline-flex items-center justify-center rounded-lg transition-colors ${
                                isCurrentPlaying
                                  ? 'bg-[#14532D] text-[#FBF8F1] dark:bg-emerald-600'
                                  : 'text-stone-500 dark:text-stone-400 hover:bg-stone-200/60 dark:hover:bg-stone-800 hover:text-stone-900 dark:hover:text-stone-100'
                              }`}
                            >
                              {isCurrentPlaying && isPlaying ? (
                                <Pause className="w-3.5 h-3.5" />
                              ) : (
                                <Play className="w-3.5 h-3.5" />
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => toggleTafsirForAyah(ayah.numberInSurah)}
                              title="عرض التفسير"
                              aria-label="عرض التفسير"
                              className={`ios-spring w-8 h-8 inline-flex items-center justify-center rounded-lg transition-colors ${
                                showTafsir
                                  ? 'bg-stone-200/80 dark:bg-stone-800 text-[#14532D] dark:text-emerald-300'
                                  : 'text-stone-500 dark:text-stone-400 hover:bg-stone-200/60 dark:hover:bg-stone-800 hover:text-stone-900 dark:hover:text-stone-100'
                              }`}
                            >
                              <BookOpen className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => onToggleBookmark(ayah, loadedSurah.meta)}
                              title={bookmarked ? 'إزالة العلامة' : 'حفظ علامة مرجعية'}
                              aria-label="علامة مرجعية"
                              className={`ios-spring w-8 h-8 inline-flex items-center justify-center rounded-lg transition-colors ${
                                bookmarked
                                  ? 'text-[#9A742E] dark:text-amber-400 bg-amber-900/10 dark:bg-amber-400/15'
                                  : 'text-stone-500 dark:text-stone-400 hover:bg-stone-200/60 dark:hover:bg-stone-800 hover:text-stone-900 dark:hover:text-stone-100'
                              }`}
                            >
                              <Bookmark
                                className="w-3.5 h-3.5"
                                fill={bookmarked ? 'currentColor' : 'none'}
                              />
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                editingNoteAyah === ayah.numberInSurah
                                  ? setEditingNoteAyah(null)
                                  : openNoteEditor(ayah.numberInSurah)
                              }
                              title="تدوين خاطرة وتدبر"
                              aria-label="ملاحظة تدبر"
                              className={`ios-spring w-8 h-8 inline-flex items-center justify-center rounded-lg transition-colors ${
                                existingNote
                                  ? 'text-[#14532D] dark:text-emerald-300 bg-emerald-900/10 dark:bg-emerald-500/15'
                                  : 'text-stone-500 dark:text-stone-400 hover:bg-stone-200/60 dark:hover:bg-stone-800 hover:text-stone-900 dark:hover:text-stone-100'
                              }`}
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleCopyAyah(ayah, loadedSurah.meta.name)}
                              title="نسخ الآية"
                              aria-label="نسخ الآية"
                              className="ios-spring w-8 h-8 inline-flex items-center justify-center rounded-lg text-stone-500 dark:text-stone-400 hover:bg-stone-200/60 dark:hover:bg-stone-800 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
                            >
                              {copiedAyah === ayah.numberInSurah ? (
                                <Check className="w-3.5 h-3.5 text-[#14532D] dark:text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Quranic Text */}
                        <p
                          onClick={() => {
                            if (hifzModeEnabled && hifzHideMode !== 'visible') {
                              onToggleRevealAyah(ayah.number);
                            }
                          }}
                          title={
                            hifzModeEnabled && hifzHideMode !== 'visible'
                              ? 'اضغط لكشف الآية أو إخفائها'
                              : undefined
                          }
                          className={`font-quran text-[#1C1917] dark:text-[#F2EFE8] leading-[2.35] text-right ${
                            hifzModeEnabled && hifzHideMode !== 'visible'
                              ? 'cursor-pointer rounded-xl px-1 -mx-1 hover:bg-stone-900/[0.03] dark:hover:bg-white/[0.03] transition-colors'
                              : ''
                          }`}
                          style={{ fontSize: `${settings.fontSize}px` }}
                        >
                          {isAyahRevealed ? (
                            displayVerseText
                          ) : hifzHideMode === 'first-word' ? (
                            <>
                              <span>{cueVerseText} </span>
                              {restVerseText && (
                                <span className="blur-[7px] opacity-30 select-none transition-all">
                                  {restVerseText}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="blur-[7px] opacity-25 select-none transition-all">
                              {displayVerseText}
                            </span>
                          )}
                          <AyahEndRosette
                            numberInSurah={ayah.numberInSurah}
                            active={isCurrentPlaying || isHifzTarget}
                          />
                        </p>

                        {/* Tafsir Block */}
                        {showTafsir && ayah.tafsir && (
                          <div className="mt-5 pt-4 border-t border-stone-200/70 dark:border-stone-800/80">
                            <div className="text-xs font-medium text-stone-500 dark:text-stone-400 mb-1.5">
                              {TAFSIR_OPTIONS.find((t) => t.id === settings.tafsirEdition)
                                ?.name ?? 'التفسير'}
                            </div>
                            <p
                              dir={settings.tafsirEdition === 'en.sahih' ? 'ltr' : 'rtl'}
                              className={`text-sm sm:text-[15px] leading-relaxed text-stone-700 dark:text-stone-300 ${
                                settings.tafsirEdition === 'en.sahih' ? 'text-left' : 'text-right'
                              }`}
                            >
                              {ayah.tafsir}
                            </p>
                          </div>
                        )}

                        {/* Saved Reflection Note Display */}
                        {existingNote && editingNoteAyah !== ayah.numberInSurah && (
                          <div className="mt-4 p-3.5 rounded-xl ios-glass-input flex items-start justify-between gap-3">
                            <div>
                              <div className="text-xs font-medium text-[#14532D] dark:text-emerald-300 mb-1">
                                خاطرة وتدبر
                              </div>
                              <p className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed">
                                {existingNote.note}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => openNoteEditor(ayah.numberInSurah)}
                              className="text-xs text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 shrink-0"
                            >
                              تعديل
                            </button>
                          </div>
                        )}

                        {/* Inline Reflection Editor */}
                        {editingNoteAyah === ayah.numberInSurah && (
                          <div className="mt-4 p-4 rounded-xl ios-glass-input space-y-3">
                            <label className="block text-xs font-medium text-stone-700 dark:text-stone-300">
                              خاطرة وتدبر حول الآية {toArabicDigits(ayah.numberInSurah)}
                            </label>
                            <textarea
                              rows={3}
                              value={noteDraft}
                              onChange={(e) => setNoteDraft(e.target.value)}
                              placeholder="اكتب ما فتح الله به عليك من تدبر وفهم..."
                              className="w-full rounded-xl ios-glass-input p-2.5 text-sm text-stone-900 dark:text-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
                            />
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                {existingNote && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onDeleteNote(existingNote.id);
                                      setEditingNoteAyah(null);
                                    }}
                                    className="text-xs text-red-700 dark:text-red-400 hover:underline"
                                  >
                                    حذف الخاطرة
                                  </button>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingNoteAyah(null)}
                                  className="px-3 py-1.5 text-xs font-medium rounded-xl ios-glass-input text-stone-700 dark:text-stone-300"
                                >
                                  إلغاء
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (noteDraft.trim()) {
                                      onSaveNote(
                                        loadedSurah.meta,
                                        ayah.numberInSurah,
                                        noteDraft.trim()
                                      );
                                    }
                                    setEditingNoteAyah(null);
                                  }}
                                  className="px-4 py-1.5 text-xs font-medium rounded-xl bg-[#14532D] text-[#FBF8F1] hover:bg-[#114224]"
                                >
                                  حفظ
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Bottom Surah Pagination */}
                <div className="pt-8 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between gap-4">
                  <button
                    type="button"
                    disabled={activeSurahNumber <= 1}
                    onClick={() => onSelectSurah(activeSurahNumber - 1)}
                    className="ios-spring inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl ios-glass-input text-stone-800 dark:text-stone-200 disabled:opacity-40 disabled:pointer-events-none"
                  >
                    <ChevronRight className="w-4 h-4" />
                    <span>السورة السابقة</span>
                  </button>

                  <button
                    type="button"
                    disabled={activeSurahNumber >= 114}
                    onClick={() => onSelectSurah(activeSurahNumber + 1)}
                    className="ios-spring inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl ios-glass-input text-stone-800 dark:text-stone-200 disabled:opacity-40 disabled:pointer-events-none"
                  >
                    <span>السورة التالية</span>
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
