import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, PanInfo } from 'motion/react';
import {
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  FileText,
  Pause,
  Play,
  Repeat,
} from 'lucide-react';
import { TAFSIR_OPTIONS } from '../data/quranMeta';
import {
  AppSettings,
  AyahItem,
  BookmarkItem,
  HifzHideMode,
  LoadedPage,
  ReflectionNote,
  SurahMeta,
} from '../types/quran';
import { stripLeadingBismillah, toArabicDigits } from '../utils/arabic';
import { AyahEndRosette, MushafPageSurahStrip } from './IslamicOrnament';

interface MushafPageViewProps {
  pageNumber: number;
  loadedPage: LoadedPage | null;
  loading: boolean;
  error: string | null;
  highlightAyahGlobalNumber: number | null;
  playingAyahGlobalNumber: number | null;
  isPlaying: boolean;
  settings: AppSettings;
  bookmarks: BookmarkItem[];
  notes: ReflectionNote[];
  onChangePage: (pageNumber: number) => void;
  onPlayAyah: (ayah: AyahItem) => void;
  onToggleBookmark: (ayah: AyahItem, surahMeta: SurahMeta) => void;
  onSaveNote: (surahMeta: SurahMeta, ayahNumberInSurah: number, text: string) => void;
  onDeleteNote: (id: string) => void;
  onMarkPageReadInKhatmah: (pageNumber: number) => void;
  onRetry: () => void;
  hifzModeEnabled?: boolean;
  hifzHideMode?: HifzHideMode;
  revealedAyahNumbers?: Set<number>;
  hifzTargetGlobalAyah?: number | null;
  onToggleRevealAyah?: (globalAyahNumber: number) => void;
  onSelectHifzTargetAyah?: (ayah: AyahItem) => void;
}

interface SurahSegment {
  surah: SurahMeta;
  startsHere: boolean;
  ayahs: AyahItem[];
}

const PAGE_SLIDE_VARIANTS = {
  enter: (direction: number) => ({
    x: direction >= 0 ? -70 : 70,
    opacity: 0,
    scale: 0.985,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
  },
  exit: (direction: number) => ({
    x: direction >= 0 ? 70 : -70,
    opacity: 0,
    scale: 0.985,
  }),
};

export const MushafPageView: React.FC<MushafPageViewProps> = ({
  pageNumber,
  loadedPage,
  loading,
  error,
  highlightAyahGlobalNumber,
  playingAyahGlobalNumber,
  isPlaying,
  settings,
  bookmarks,
  notes,
  onChangePage,
  onPlayAyah,
  onToggleBookmark,
  onSaveNote,
  onDeleteNote,
  onMarkPageReadInKhatmah,
  onRetry,
  hifzModeEnabled = false,
  hifzHideMode = 'full',
  revealedAyahNumbers,
  hifzTargetGlobalAyah,
  onToggleRevealAyah,
  onSelectHifzTargetAyah,
}) => {
  const [direction, setDirection] = useState(1);
  const [selectedAyah, setSelectedAyah] = useState<AyahItem | null>(null);
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [copiedAyahNumber, setCopiedAyahNumber] = useState<number | null>(null);

  useEffect(() => {
    setSelectedAyah(null);
    setEditingNote(false);
  }, [pageNumber]);

  const navigateToPage = (target: number) => {
    const clamped = Math.max(1, Math.min(604, target));
    if (clamped === pageNumber) return;
    setDirection(clamped > pageNumber ? 1 : -1);
    onChangePage(clamped);
  };

  // Keyboard Arrow Navigation (RTL: Left = Next page, Right = Previous page)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'ArrowLeft') {
        if (pageNumber < 604) {
          e.preventDefault();
          navigateToPage(pageNumber + 1);
        }
      } else if (e.key === 'ArrowRight') {
        if (pageNumber > 1) {
          e.preventDefault();
          navigateToPage(pageNumber - 1);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pageNumber]);

  const handleDragEnd = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) => {
    // RTL Arabic Mushaf: drag right (+x) reveals next page from the left; drag left (-x) reveals previous page from the right
    if (info.offset.x > 60 || info.velocity.x > 320) {
      if (pageNumber < 604) {
        navigateToPage(pageNumber + 1);
      }
    } else if (info.offset.x < -60 || info.velocity.x < -320) {
      if (pageNumber > 1) {
        navigateToPage(pageNumber - 1);
      }
    }
  };

  const segments = useMemo<SurahSegment[]>(() => {
    if (!loadedPage) return [];
    const grouped: SurahSegment[] = [];
    for (const ayah of loadedPage.ayahs) {
      const surahMeta: SurahMeta = ayah.surah ?? {
        number: 1,
        name: 'القرآن الكريم',
        englishName: '',
        englishNameTranslation: '',
        numberOfAyahs: 0,
        revelationType: 'Meccan',
      };
      const last = grouped[grouped.length - 1];
      if (!last || last.surah.number !== surahMeta.number) {
        grouped.push({
          surah: surahMeta,
          startsHere: ayah.numberInSurah === 1,
          ayahs: [ayah],
        });
      } else {
        last.ayahs.push(ayah);
      }
    }
    return grouped;
  }, [loadedPage]);

  const firstAyah = loadedPage?.ayahs[0];
  const primarySurahName =
    segments.length > 0
      ? segments.map((s) => s.surah.name).join(' · ')
      : '';
  const juzNumber = firstAyah?.juz ?? 1;
  const hizbNumber = firstAyah
    ? Math.ceil(firstAyah.hizbQuarter / 4)
    : 1;

  const isOddPage = pageNumber % 2 === 1;
  const isSpecialCenteredPage = pageNumber === 1 || pageNumber === 2;

  const isBookmarked = (globalNumber: number) =>
    bookmarks.some((b) => b.globalAyahNumber === globalNumber);

  const selectedSurahMeta: SurahMeta | undefined = selectedAyah?.surah;
  const existingNote =
    selectedAyah && selectedSurahMeta
      ? notes.find(
          (n) =>
            n.surahNumber === selectedSurahMeta.number &&
            n.ayahNumberInSurah === selectedAyah.numberInSurah
        )
      : undefined;

  const handleCopySelected = async () => {
    if (!selectedAyah || !selectedSurahMeta) return;
    const cleanText = stripLeadingBismillah(
      selectedAyah.text,
      selectedSurahMeta.number,
      selectedAyah.numberInSurah
    );
    const formatted = `﴿${cleanText}﴾ [${selectedSurahMeta.name}: ${toArabicDigits(selectedAyah.numberInSurah)}]`;
    try {
      await navigator.clipboard.writeText(formatted);
      setCopiedAyahNumber(selectedAyah.number);
      setTimeout(() => setCopiedAyahNumber(null), 1800);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Quick Action Strip for Current Page */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-stone-600 dark:text-stone-400">
        <div className="flex items-center gap-2 tabular-nums">
          <span className="font-semibold text-[#14532D] dark:text-emerald-300">
            صفحة {toArabicDigits(pageNumber)} من ٦٠٤
          </span>
          <span aria-hidden="true">·</span>
          <span>الجزء {toArabicDigits(juzNumber)}</span>
          <span aria-hidden="true">·</span>
          <span>الحزب {toArabicDigits(hizbNumber)}</span>
        </div>

        <div className="flex items-center gap-2">
          {firstAyah && (
            <button
              type="button"
              onClick={() => onPlayAyah(firstAyah)}
              className="ios-spring inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl bg-[#14532D] hover:bg-[#114224] dark:bg-emerald-700 dark:hover:bg-emerald-600 text-[#FBF8F1] shadow-xs whitespace-nowrap"
            >
              <Play className="w-3.5 h-3.5" />
              <span>استماع للصفحة</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onMarkPageReadInKhatmah(pageNumber)}
            className="ios-spring inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl ios-glass-input text-stone-700 dark:text-stone-200 whitespace-nowrap"
          >
            <Check className="w-3.5 h-3.5" />
            <span>حفظ في الختمة</span>
          </button>
        </div>
      </div>

      {/* Swipeable Printed Mushaf Page Stage */}
      <div className="relative overflow-hidden rounded-3xl">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={pageNumber}
            custom={direction}
            variants={PAGE_SLIDE_VARIANTS}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: 'spring', stiffness: 360, damping: 32 },
              opacity: { duration: 0.18 },
              scale: { duration: 0.2 },
            }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.26}
            dragDirectionLock
            onDragEnd={handleDragEnd}
            style={{ touchAction: 'pan-y' }}
            className="relative cursor-grab active:cursor-grabbing select-text"
          >
            {/* Outer Paper Mushaf Frame */}
            <div
              className={`relative rounded-3xl p-2 sm:p-3.5 border border-[#CDBE9B] dark:border-[#2C3A33] bg-[#F8F1E1] dark:bg-[#101613] shadow-[0_18px_48px_-14px_rgba(45,35,15,0.18)] dark:shadow-[0_22px_52px_-14px_rgba(0,0,0,0.65)] transition-colors ${
                isOddPage
                  ? 'before:left-0 before:bg-gradient-to-r'
                  : 'before:right-0 before:bg-gradient-to-l'
              } before:pointer-events-none before:absolute before:inset-y-3 before:w-6 before:from-black/[0.045] dark:before:from-black/30 before:to-transparent before:rounded-3xl`}
            >
              {/* Inner Ornamental Double Hairline Border */}
              <div className="relative rounded-2xl border border-[#C6B388]/85 dark:border-[#35463E] bg-[#FCF8EE] dark:bg-[#131B17] px-4 sm:px-9 py-5 sm:py-7 min-h-[540px] flex flex-col justify-between">
                {/* Geometric Corner Accents */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-1.5 rounded-xl border border-[#9A742E]/20 dark:border-amber-400/15"
                />

                {/* Top Running Page Header (like Printed Madinah Mushaf) */}
                <div className="relative z-10 flex items-center justify-between gap-4 pb-3 mb-4 border-b border-[#D8C9A7]/70 dark:border-[#2B3932] text-xs font-medium text-[#6B5427] dark:text-amber-300/80">
                  <span className="truncate font-amiri text-sm sm:text-base">
                    {primarySurahName || 'المصحف الشريف'}
                  </span>
                  <span className="tabular-nums shrink-0">
                    الجزء {toArabicDigits(juzNumber)} · الحزب {toArabicDigits(hizbNumber)}
                  </span>
                </div>

                {/* Page Body Content */}
                <div className="relative z-10 flex-1 flex flex-col justify-center">
                  {(!loadedPage || loadedPage.pageNumber !== pageNumber) && loading ? (
                    <div className="py-24 text-center space-y-3">
                      <div className="w-7 h-7 border-2 border-[#14532D]/30 border-t-[#14532D] dark:border-emerald-400/30 dark:border-t-emerald-400 rounded-full animate-spin mx-auto" />
                      <p className="text-xs text-stone-500 dark:text-stone-400">
                        جاري فتح الصفحة {toArabicDigits(pageNumber)}...
                      </p>
                    </div>
                  ) : error ? (
                    <div className="py-20 text-center space-y-4">
                      <p className="text-sm text-stone-700 dark:text-stone-300">
                        {error}
                      </p>
                      <button
                        type="button"
                        onClick={onRetry}
                        className="ios-spring px-4 py-2 text-xs font-medium rounded-xl bg-[#14532D] text-[#FBF8F1]"
                      >
                        إعادة المحاولة
                      </button>
                    </div>
                  ) : (
                    <div
                      className={`space-y-4 ${
                        isSpecialCenteredPage ? 'max-w-2xl mx-auto w-full py-4' : ''
                      }`}
                    >
                      {segments.map((seg) => (
                        <div key={`${pageNumber}_${seg.surah.number}`} className="space-y-3">
                          {seg.startsHere && (
                            <>
                              <MushafPageSurahStrip
                                surahName={seg.surah.name}
                                revelationType={seg.surah.revelationType}
                                ayahCount={seg.surah.numberOfAyahs}
                              />
                              {seg.surah.number !== 1 && seg.surah.number !== 9 && (
                                <p className="text-center font-quran text-xl sm:text-2xl text-[#1C1917] dark:text-[#F2EFE8] py-1">
                                  بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
                                </p>
                              )}
                            </>
                          )}

                          <p
                            className={`font-quran text-[#1C1917] dark:text-[#F2EFE8] leading-[2.45] ${
                              isSpecialCenteredPage ? 'text-center' : 'text-justify'
                            }`}
                            style={{ fontSize: `${settings.fontSize}px` }}
                          >
                            {seg.ayahs.map((ayah) => {
                              const isCurrentPlaying =
                                playingAyahGlobalNumber === ayah.number;
                              const isHighlighted =
                                highlightAyahGlobalNumber === ayah.number;
                              const isHifzTarget =
                                hifzModeEnabled &&
                                hifzTargetGlobalAyah === ayah.number;
                              const isSelected = selectedAyah?.number === ayah.number;
                              const cleanText = stripLeadingBismillah(
                                ayah.text,
                                seg.surah.number,
                                ayah.numberInSurah
                              );
                              const isRevealed =
                                !hifzModeEnabled ||
                                hifzHideMode === 'visible' ||
                                Boolean(revealedAyahNumbers?.has(ayah.number));
                              const words = cleanText.split(/\s+/);
                              const cueText = words.slice(0, 2).join(' ');
                              const restText = words.slice(2).join(' ');

                              return (
                                <span
                                  key={ayah.number}
                                  onClick={() => {
                                    setSelectedAyah(ayah);
                                    setEditingNote(false);
                                    if (
                                      hifzModeEnabled &&
                                      hifzHideMode !== 'visible' &&
                                      onToggleRevealAyah
                                    ) {
                                      onToggleRevealAyah(ayah.number);
                                    }
                                  }}
                                  role="button"
                                  tabIndex={0}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      setSelectedAyah(ayah);
                                      setEditingNote(false);
                                      if (
                                        hifzModeEnabled &&
                                        hifzHideMode !== 'visible' &&
                                        onToggleRevealAyah
                                      ) {
                                        onToggleRevealAyah(ayah.number);
                                      }
                                    }
                                  }}
                                  className={`cursor-pointer rounded-md px-0.5 transition-colors ${
                                    isCurrentPlaying
                                      ? 'bg-emerald-900/15 dark:bg-emerald-500/25 text-[#14532D] dark:text-emerald-200'
                                      : isHifzTarget
                                      ? 'bg-emerald-900/10 dark:bg-emerald-500/15 ring-1 ring-[#14532D]/30 dark:ring-emerald-400/30'
                                      : isSelected || isHighlighted
                                      ? 'bg-amber-900/12 dark:bg-amber-400/20'
                                      : 'hover:bg-stone-800/[0.05] dark:hover:bg-white/[0.06]'
                                  }`}
                                >
                                  {isRevealed ? (
                                    cleanText
                                  ) : hifzHideMode === 'first-word' ? (
                                    <>
                                      <span>{cueText} </span>
                                      {restText && (
                                        <span className="blur-[7px] opacity-30 select-none transition-all">
                                          {restText}
                                        </span>
                                      )}
                                    </>
                                  ) : (
                                    <span className="blur-[7px] opacity-25 select-none transition-all">
                                      {cleanText}
                                    </span>
                                  )}
                                  <AyahEndRosette
                                    numberInSurah={ayah.numberInSurah}
                                    active={isCurrentPlaying || isHifzTarget}
                                  />
                                </span>
                              );
                            })}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Bottom Ornamental Page Number inside the Mushaf Frame */}
                <div className="relative z-10 pt-4 mt-5 border-t border-[#D8C9A7]/70 dark:border-[#2B3932] flex items-center justify-center">
                  <span className="inline-flex items-center gap-2 font-amiri text-sm font-bold text-[#6B5427] dark:text-amber-300/90 tabular-nums">
                    <span aria-hidden="true">❧</span>
                    <span>{toArabicDigits(pageNumber)}</span>
                    <span aria-hidden="true">☙</span>
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Selected Ayah Inspection Card (Tap any ayah on the page) */}
      <AnimatePresence>
        {selectedAyah && selectedSurahMeta && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="p-5 rounded-2xl ios-glass-card space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-stone-600 dark:text-stone-400 tabular-nums">
                <span className="font-semibold text-[#14532D] dark:text-emerald-300">
                  {selectedSurahMeta.name} — الآية{' '}
                  {toArabicDigits(selectedAyah.numberInSurah)}
                </span>
                <span className="mx-2" aria-hidden="true">
                  ·
                </span>
                <span>صفحة {toArabicDigits(selectedAyah.page)}</span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onPlayAyah(selectedAyah)}
                  className="ios-spring inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl bg-[#14532D] text-[#FBF8F1] hover:bg-[#114224]"
                >
                  {playingAyahGlobalNumber === selectedAyah.number && isPlaying ? (
                    <>
                      <Pause className="w-3.5 h-3.5" />
                      <span>إيقاف</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      <span>استماع</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => onToggleBookmark(selectedAyah, selectedSurahMeta)}
                  className="ios-spring inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl ios-glass-input text-stone-700 dark:text-stone-200"
                >
                  <Bookmark
                    className="w-3.5 h-3.5"
                    fill={isBookmarked(selectedAyah.number) ? 'currentColor' : 'none'}
                  />
                  <span>{isBookmarked(selectedAyah.number) ? 'محفوظة' : 'حفظ'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setNoteDraft(existingNote?.note ?? '');
                    setEditingNote((v) => !v);
                  }}
                  className="ios-spring inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl ios-glass-input text-stone-700 dark:text-stone-200"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>تدبر</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopySelected}
                  className="ios-spring inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl ios-glass-input text-stone-700 dark:text-stone-200"
                >
                  {copiedAyahNumber === selectedAyah.number ? (
                    <Check className="w-3.5 h-3.5 text-[#14532D] dark:text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedAyahNumber === selectedAyah.number ? 'تم النسخ' : 'نسخ'}</span>
                </button>

                {hifzModeEnabled && onToggleRevealAyah && hifzHideMode !== 'visible' && (
                  <button
                    type="button"
                    onClick={() => onToggleRevealAyah(selectedAyah.number)}
                    className="ios-spring inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl ios-glass-input text-[#14532D] dark:text-emerald-300"
                  >
                    {revealedAyahNumbers?.has(selectedAyah.number) ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>إخفاء الآية</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        <span>كشف الآية</span>
                      </>
                    )}
                  </button>
                )}

                {hifzModeEnabled && onSelectHifzTargetAyah && (
                  <button
                    type="button"
                    onClick={() => onSelectHifzTargetAyah(selectedAyah)}
                    className={`ios-spring inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl ${
                      hifzTargetGlobalAyah === selectedAyah.number
                        ? 'bg-[#14532D] dark:bg-emerald-700 text-white'
                        : 'ios-glass-input text-[#14532D] dark:text-emerald-300'
                    }`}
                  >
                    <Repeat className="w-3.5 h-3.5" />
                    <span>تحديد للتكرار</span>
                  </button>
                )}
              </div>
            </div>

            {selectedAyah.tafsir && (
              <div className="pt-2.5 border-t border-stone-200/70 dark:border-stone-800/70 space-y-1">
                <div className="text-[11px] font-medium text-stone-500 dark:text-stone-400">
                  {TAFSIR_OPTIONS.find((t) => t.id === settings.tafsirEdition)?.name ?? 'التفسير'}
                </div>
                <p
                  dir={settings.tafsirEdition === 'en.sahih' ? 'ltr' : 'rtl'}
                  className={`text-sm leading-relaxed text-stone-700 dark:text-stone-300 ${
                    settings.tafsirEdition === 'en.sahih' ? 'text-left' : 'text-right'
                  }`}
                >
                  {selectedAyah.tafsir}
                </p>
              </div>
            )}

            {existingNote && !editingNote && (
              <div className="p-3 rounded-xl ios-glass-input flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-medium text-[#14532D] dark:text-emerald-300 mb-0.5">
                    خاطرة وتدبر
                  </div>
                  <p className="text-xs sm:text-sm text-stone-700 dark:text-stone-300 leading-relaxed">
                    {existingNote.note}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setNoteDraft(existingNote.note);
                    setEditingNote(true);
                  }}
                  className="text-xs text-stone-500 hover:text-stone-900 dark:text-stone-400"
                >
                  تعديل
                </button>
              </div>
            )}

            {editingNote && (
              <div className="p-3.5 rounded-xl ios-glass-input space-y-2.5">
                <textarea
                  rows={2}
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  placeholder="اكتب خاطرتك حول هذه الآية..."
                  className="w-full rounded-xl ios-glass-input p-2.5 text-sm text-stone-900 dark:text-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
                />
                <div className="flex items-center justify-between gap-2">
                  <div>
                    {existingNote && (
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteNote(existingNote.id);
                          setEditingNote(false);
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
                      onClick={() => setEditingNote(false)}
                      className="px-3 py-1.5 text-xs font-medium rounded-xl ios-glass-input text-stone-700 dark:text-stone-300"
                    >
                      إلغاء
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (noteDraft.trim()) {
                          onSaveNote(
                            selectedSurahMeta,
                            selectedAyah.numberInSurah,
                            noteDraft.trim()
                          );
                        }
                        setEditingNote(false);
                      }}
                      className="px-3.5 py-1.5 text-xs font-medium rounded-xl bg-[#14532D] text-[#FBF8F1]"
                    >
                      حفظ
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Mushaf Page Navigation & Scrubber Bar */}
      <div className="p-3.5 sm:p-4 rounded-2xl ios-glass-card space-y-3">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={pageNumber <= 1}
            onClick={() => navigateToPage(pageNumber - 1)}
            className="ios-spring inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-medium rounded-xl ios-glass-input text-stone-800 dark:text-stone-200 disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap"
          >
            <ChevronRight className="w-4 h-4" />
            <span>الصفحة السابقة</span>
          </button>

          <div className="text-center tabular-nums">
            <div className="text-xs sm:text-sm font-semibold text-stone-900 dark:text-stone-100">
              صفحة {toArabicDigits(pageNumber)} / ٦٠٤
            </div>
            <div className="text-[11px] text-stone-500 dark:text-stone-400">
              اسحب الصفحة يميناً أو يساراً للتقليب
            </div>
          </div>

          <button
            type="button"
            disabled={pageNumber >= 604}
            onClick={() => navigateToPage(pageNumber + 1)}
            className="ios-spring inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-medium rounded-xl ios-glass-input text-stone-800 dark:text-stone-200 disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap"
          >
            <span>الصفحة التالية</span>
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Instant 1..604 Mushaf Page Slider */}
        <div className="flex items-center gap-3 px-1">
          <span className="text-[11px] text-stone-500 dark:text-stone-400 tabular-nums shrink-0">
            ١
          </span>
          <input
            type="range"
            min={1}
            max={604}
            value={pageNumber}
            onChange={(e) => navigateToPage(Number(e.target.value))}
            aria-label="شريط التنقل السريع بين صفحات المصحف"
            className="w-full accent-[#14532D] dark:accent-emerald-400 cursor-pointer h-1.5 rounded-full"
          />
          <span className="text-[11px] text-stone-500 dark:text-stone-400 tabular-nums shrink-0">
            ٦٠٤
          </span>
        </div>
      </div>
    </div>
  );
};
