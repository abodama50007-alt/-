import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Mic,
  MicOff,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { searchQuran } from '../services/quranApi';
import { SearchMatch, SurahMeta } from '../types/quran';
import { normalizeArabicForSearch } from '../utils/arabic';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}

interface SpeechRecognitionErrorEventLike {
  error: string;
  message?: string;
}

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

interface WindowWithSpeech extends Window {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

interface SearchViewProps {
  initialQuery?: string;
  surahList?: SurahMeta[];
  onOpenMatch: (surahNumber: number, ayahNumberInSurah: number) => void;
}

const SUGGESTED_QUERIES = [
  'الرحمن',
  'سورة الكهف',
  'الصبر',
  'التقوى',
  'الهدى',
  'سورة يس',
  'الرزق',
  'الشكر',
];

const EASTERN_TO_WESTERN_MAP: Record<string, string> = {
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
};

function cleanSpokenTranscript(raw: string): string {
  return raw
    .replace(/[،,.؟?!؛:«»"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toWesternDigits(input: string): string {
  return input.replace(/[٠-٩]/g, (d) => EASTERN_TO_WESTERN_MAP[d] ?? d);
}

function findMatchingSurahs(term: string, surahList: SurahMeta[]): SurahMeta[] {
  if (!surahList.length) return [];
  const trimmed = term.trim();
  if (!trimmed) return [];

  const numericStr = toWesternDigits(trimmed).replace(/[^\d]/g, '');
  const numericQuery =
    /^(سورة\s*)?[\d٠-٩]+$/.test(trimmed) && numericStr
      ? Number(numericStr)
      : null;

  const normalized = normalizeArabicForSearch(trimmed).toLowerCase();
  const withoutSurahPrefix = normalized
    .replace(/^سوره\s+/, '')
    .replace(/^سوره(?=[ا-ي])/, '')
    .trim();

  if (!withoutSurahPrefix && !numericQuery) return [];

  const exactMatches: SurahMeta[] = [];
  const partialMatches: SurahMeta[] = [];

  for (const surah of surahList) {
    if (numericQuery !== null && surah.number === numericQuery) {
      exactMatches.push(surah);
      continue;
    }

    const normAr = normalizeArabicForSearch(surah.name);
    const normArBare = normAr.replace(/^سوره\s+/, '').trim();
    const normEn = surah.englishName.toLowerCase();
    const normEnTranslation = surah.englishNameTranslation.toLowerCase();

    if (
      withoutSurahPrefix === normArBare ||
      normalized === normAr ||
      withoutSurahPrefix === normEn
    ) {
      exactMatches.push(surah);
    } else if (
      withoutSurahPrefix.length >= 2 &&
      (normArBare.includes(withoutSurahPrefix) ||
        normAr.includes(normalized) ||
        normEn.includes(withoutSurahPrefix) ||
        normEnTranslation.includes(withoutSurahPrefix))
    ) {
      partialMatches.push(surah);
    }
  }

  return [...exactMatches, ...partialMatches].slice(0, 8);
}

function getSpeechErrorMessage(code: string): string {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'يرجى السماح للتطبيق بالوصول إلى الميكروفون من إعدادات المتصفح لتفعيل البحث الصوتي.';
    case 'no-speech':
      return 'لم يتم التقاط أي صوت. يرجى التحدث بوضوح بالقرب من الميكروفون والمحاولة مجدداً.';
    case 'audio-capture':
      return 'تعذر العثور على ميكروفون متصل بجهازك.';
    case 'network':
      return 'حدث انقطاع في اتصال التعرف الصوتي، يرجى المحاولة مرة أخرى.';
    case 'aborted':
      return '';
    default:
      return 'تعذر إتمام التعرف الصوتي، يمكنك الكتابة مباشرة أو إعادة المحاولة.';
  }
}

export const SearchView: React.FC<SearchViewProps> = ({
  initialQuery,
  surahList = [],
  onOpenMatch,
}) => {
  const { language, isRTL, t, formatNumber, getRevelationLabel } = useLanguage();
  const [query, setQuery] = useState(initialQuery ?? '');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SearchMatch[]>([]);
  const [matchedSurahs, setMatchedSurahs] = useState<SurahMeta[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);

  // Voice search state
  const [speechSupported] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const w = window as WindowWithSpeech;
    return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
  });
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [lastSearchedByVoice, setLastSearchedByVoice] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const latestTranscriptRef = useRef<string>('');
  const finalDispatchedRef = useRef<boolean>(false);
  const searchRequestIdRef = useRef<number>(0);

  const runSearch = useCallback(
    async (term: string, options?: { fromVoice?: boolean }) => {
      const cleaned = cleanSpokenTranscript(term);
      if (!cleaned) return;

      const requestId = ++searchRequestIdRef.current;
      const surahHits = findMatchingSurahs(cleaned, surahList);

      setQuery(cleaned);
      setSubmittedQuery(cleaned);
      setMatchedSurahs(surahHits);
      setLoading(true);
      setError(null);
      setVoiceError(null);
      setHasSearched(true);
      setLastSearchedByVoice(Boolean(options?.fromVoice));

      // Strip optional "سورة " prefix when querying verse search if there is more text,
      // while keeping full query when it isn't just a surah prefix
      const ayahSearchTerm = cleaned;

      try {
        const data = await searchQuran(ayahSearchTerm);
        if (requestId !== searchRequestIdRef.current) return;
        setResults(data.matches);
        setTotalCount(data.count);
      } catch (err) {
        if (requestId !== searchRequestIdRef.current) return;
        // If Surahs matched locally, show them cleanly without blocking the whole view with an error
        if (surahHits.length > 0) {
          setResults([]);
          setTotalCount(0);
          setError(null);
        } else {
          setError(
            err instanceof Error
              ? err.message
              : 'حدث خطأ أثناء البحث، يرجى المحاولة مجدداً'
          );
          setResults([]);
          setTotalCount(0);
        }
      } finally {
        if (requestId === searchRequestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [surahList]
  );

  useEffect(() => {
    if (initialQuery && initialQuery.trim()) {
      void runSearch(initialQuery);
    }
  }, [initialQuery, runSearch]);

  // Cleanup active speech recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
        recognitionRef.current = null;
      }
    };
  }, []);

  const stopVoiceSearch = useCallback((triggerSearchOnStop = false) => {
    const recognition = recognitionRef.current;
    if (triggerSearchOnStop && latestTranscriptRef.current.trim() && !finalDispatchedRef.current) {
      finalDispatchedRef.current = true;
      const captured = latestTranscriptRef.current;
      setIsListening(false);
      setInterimTranscript('');
      void runSearch(captured, { fromVoice: true });
    }
    if (recognition) {
      try {
        if (triggerSearchOnStop) {
          recognition.stop();
        } else {
          recognition.abort();
        }
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    if (!triggerSearchOnStop) {
      setIsListening(false);
      setInterimTranscript('');
    }
  }, [runSearch]);

  const startVoiceSearch = useCallback(() => {
    if (typeof window === 'undefined') return;
    const w = window as WindowWithSpeech;
    const SpeechRec = w.SpeechRecognition || w.webkitSpeechRecognition;

    if (!SpeechRec) {
      setVoiceError('المتصفح الحالي لا يدعم البحث الصوتي، يمكنك استخدام Chrome أو Edge أو Safari الحديث.');
      return;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }

    setVoiceError(null);
    setInterimTranscript('');
    latestTranscriptRef.current = '';
    finalDispatchedRef.current = false;

    try {
      const recognition = new SpeechRec();
      recognition.lang = 'ar-SA';
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        setVoiceError(null);
      };

      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        let interimText = '';
        let finalText = '';

        for (let i = 0; i < event.results.length; i++) {
          const res = event.results[i];
          const transcript = res[0]?.transcript ?? '';
          if (res.isFinal) {
            finalText += `${transcript} `;
          } else {
            interimText += `${transcript} `;
          }
        }

        const combined = cleanSpokenTranscript(finalText || interimText);
        if (combined) {
          latestTranscriptRef.current = combined;
          setQuery(combined);
          setInterimTranscript(combined);
        }

        if (finalText.trim() && !finalDispatchedRef.current) {
          finalDispatchedRef.current = true;
          const cleanedFinal = cleanSpokenTranscript(finalText);
          setIsListening(false);
          setInterimTranscript('');
          if (cleanedFinal) {
            void runSearch(cleanedFinal, { fromVoice: true });
          }
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
        setIsListening(false);
        setInterimTranscript('');
        recognitionRef.current = null;
        const msg = getSpeechErrorMessage(event.error);
        if (msg) {
          setVoiceError(msg);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        recognitionRef.current = null;
        const leftover = cleanSpokenTranscript(latestTranscriptRef.current);
        if (leftover && !finalDispatchedRef.current) {
          finalDispatchedRef.current = true;
          setInterimTranscript('');
          void runSearch(leftover, { fromVoice: true });
        } else {
          setInterimTranscript('');
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListening(false);
      recognitionRef.current = null;
      setVoiceError('تعذر تشغيل الميكروفون، يرجى التحقق من أذونات المتصفح.');
    }
  }, [runSearch]);

  const toggleVoiceSearch = () => {
    if (isListening) {
      stopVoiceSearch(true);
    } else {
      startVoiceSearch();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isListening) {
      stopVoiceSearch(false);
    }
    void runSearch(query, { fromVoice: false });
  };

  const renderHighlightedText = (text: string, term: string) => {
    if (!term.trim()) return text;
    const escaped = term.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, idx) =>
      idx % 2 === 1 ? (
        <mark
          key={idx}
          className="bg-emerald-900/15 dark:bg-emerald-500/25 text-[#14532D] dark:text-emerald-200 px-1 rounded-xs"
        >
          {part}
        </mark>
      ) : (
        <React.Fragment key={idx}>{part}</React.Fragment>
      )
    );
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-28 space-y-8">
      <div className="border-b border-stone-200 dark:border-stone-800 pb-6 space-y-4">
        <div className="text-start">
          <h1 className="font-amiri text-3xl sm:text-4xl font-bold text-stone-900 dark:text-stone-100">
            {t('searchTitle')}
          </h1>
          <p className="mt-1.5 text-sm text-stone-600 dark:text-stone-400">
            {t('searchSubtitle')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search
              className={`w-4 h-4 text-stone-400 absolute top-1/2 -translate-y-1/2 pointer-events-none ${
                isRTL ? 'right-3.5' : 'left-3.5'
              }`}
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('searchPlaceholder')}
              aria-label={t('searchInputAria')}
              className={`w-full py-3 text-sm sm:text-base rounded-2xl ios-glass-input text-stone-900 dark:text-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 ${
                isRTL ? 'pr-10 pl-12' : 'pl-10 pr-12'
              }`}
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setInterimTranscript('');
                }}
                aria-label={t('searchClearAria')}
                className={`absolute top-1/2 -translate-y-1/2 p-1 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors ${
                  isRTL ? 'left-3' : 'right-3'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={toggleVoiceSearch}
            title={
              isListening
                ? t('searchVoiceStop')
                : speechSupported
                ? t('searchVoiceLabel')
                : t('searchVoiceLabel')
            }
            aria-label={
              isListening ? t('searchVoiceStop') : t('searchVoiceLabel')
            }
            aria-pressed={isListening}
            className={`relative px-3.5 py-3 rounded-2xl ios-spring shrink-0 flex items-center justify-center gap-2 border transition-all ${
              isListening
                ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-500 shadow-md'
                : 'ios-glass-input text-[#14532D] dark:text-emerald-300 hover:border-[#14532D]/50 dark:hover:border-emerald-500/50'
            }`}
          >
            {isListening && (
              <span className="absolute -inset-1 rounded-2xl border-2 border-rose-400/70 animate-ping pointer-events-none" />
            )}
            {isListening ? (
              <MicOff className="w-5 h-5 relative" />
            ) : (
              <Mic className="w-5 h-5 relative" />
            )}
            <span className="hidden sm:inline text-xs font-semibold whitespace-nowrap relative">
              {isListening ? t('searchVoiceStop') : t('searchVoiceLabel')}
            </span>
          </button>

          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="px-5 py-3 text-sm font-medium rounded-2xl bg-[#14532D] hover:bg-[#114224] dark:bg-emerald-700 dark:hover:bg-emerald-600 text-[#FBF8F1] disabled:opacity-50 ios-spring shadow-sm whitespace-nowrap shrink-0"
          >
            {loading ? t('searching') : t('searchBtn')}
          </button>
        </form>

        {/* Live Voice Listening Panel */}
        {isListening && (
          <div className="p-4 rounded-2xl ios-glass-card border border-rose-500/30 bg-rose-500/[0.05] dark:bg-rose-500/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3 min-w-0 text-start">
              <span className="mt-1 sm:mt-0 w-3 h-3 rounded-full bg-rose-500 animate-pulse shrink-0" />
              <div className="min-w-0 space-y-0.5">
                <p className="text-xs font-semibold text-rose-700 dark:text-rose-300">
                  {t('searchVoiceListeningTitle')}
                </p>
                <p className="text-sm font-amiri text-stone-800 dark:text-stone-100 truncate">
                  {interimTranscript
                    ? `«${interimTranscript}»`
                    : t('searchVoiceWaiting')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {interimTranscript && (
                <button
                  type="button"
                  onClick={() => stopVoiceSearch(true)}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-[#14532D] text-[#FBF8F1] hover:bg-[#114224] dark:bg-emerald-700 dark:hover:bg-emerald-600 ios-spring whitespace-nowrap"
                >
                  {t('searchVoiceNowBtn')}
                </button>
              )}
              <button
                type="button"
                onClick={() => stopVoiceSearch(false)}
                className="px-3 py-1.5 text-xs font-medium rounded-xl ios-glass-input text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white ios-spring whitespace-nowrap"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        )}

        {/* Voice Error Alert */}
        {voiceError && !isListening && (
          <div className="p-3.5 rounded-2xl ios-glass-card border border-amber-500/30 bg-amber-500/[0.06] flex items-center justify-between gap-3 text-xs text-amber-800 dark:text-amber-300">
            <span>{voiceError}</span>
            <button
              type="button"
              onClick={() => setVoiceError(null)}
              aria-label={t('closeAlert')}
              className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Quick Topic Suggestions */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-stone-500 dark:text-stone-400">
            {t('searchSuggestionsLabel')}
          </span>
          {SUGGESTED_QUERIES.map((term) => (
            <button
              key={term}
              type="button"
              onClick={() => void runSearch(term, { fromVoice: false })}
              className="px-3 py-1 rounded-xl ios-glass-input ios-spring text-stone-700 dark:text-stone-300 hover:border-[#14532D]/50 hover:text-[#14532D] dark:hover:text-emerald-300"
            >
              {term}
            </button>
          ))}
        </div>
      </div>

      {/* Results Area */}
      {loading && (
        <div className="py-16 text-center space-y-3">
          <div className="w-7 h-7 border-2 border-[#14532D]/30 border-t-[#14532D] dark:border-emerald-400/30 dark:border-t-emerald-400 rounded-full animate-spin mx-auto" />
          <p className="text-sm text-stone-500 dark:text-stone-400">
            {t('searchLoadingText')}
          </p>
        </div>
      )}

      {!loading && error && (
        <div className="p-6 rounded-2xl ios-glass-card text-center text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {!loading && !error && hasSearched && (
        <div className="space-y-6">
          {/* Summary header */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm text-stone-600 dark:text-stone-400 tabular-nums">
            <div>
              {matchedSurahs.length > 0 || totalCount > 0 ? (
                <>
                  <span>{t('searchResultsFor', { query: submittedQuery })}</span>
                  {matchedSurahs.length > 0 && (
                    <>
                      {' · '}
                      <span className="font-semibold text-[#14532D] dark:text-emerald-300">
                        {formatNumber(matchedSurahs.length)}
                      </span>{' '}
                      {t('surah')}
                    </>
                  )}
                  {totalCount > 0 && (
                    <>
                      {' · '}
                      <span className="font-semibold text-stone-900 dark:text-stone-100">
                        {formatNumber(totalCount)}
                      </span>{' '}
                      {t('ayah')}
                      {results.length < totalCount &&
                        ` ${t('searchFirstCountShown', {
                          count: formatNumber(results.length),
                        })}`}
                    </>
                  )}
                </>
              ) : (
                <>{t('searchNoResults', { query: submittedQuery })}</>
              )}
            </div>
            {lastSearchedByVoice && (
              <span className="inline-flex items-center gap-1.5 text-xs text-[#14532D] dark:text-emerald-300">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{t('searchVoiceResultsBadge')}</span>
              </span>
            )}
          </div>

          {/* Matching Surahs Section */}
          {matchedSurahs.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-stone-700 dark:text-stone-300">
                <BookOpen className="w-4 h-4 text-[#14532D] dark:text-emerald-300" />
                <span>{t('searchMatchingSurahs')}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {matchedSurahs.map((surah) => (
                  <button
                    key={surah.number}
                    type="button"
                    onClick={() => onOpenMatch(surah.number, 1)}
                    className="p-4 rounded-2xl ios-glass-card ios-spring hover:border-[#14532D]/40 dark:hover:border-emerald-500/40 text-start flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-9 h-9 rounded-xl bg-[#14532D]/10 dark:bg-emerald-500/15 text-[#14532D] dark:text-emerald-300 font-semibold text-sm flex items-center justify-center shrink-0 tabular-nums">
                        {formatNumber(surah.number)}
                      </span>
                      <div className="min-w-0">
                        <div className="font-amiri text-xl font-bold text-stone-900 dark:text-stone-100 truncate">
                          {language === 'en' ? surah.englishName : surah.name}
                        </div>
                        <div className="text-xs text-stone-500 dark:text-stone-400 tabular-nums">
                          {getRevelationLabel(surah.revelationType)} ·{' '}
                          {formatNumber(surah.numberOfAyahs)} {t('ayahs')}
                        </div>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-[#14532D] dark:text-emerald-300 shrink-0 whitespace-nowrap">
                      <span>{t('read')}</span>
                      <ArrowLeft
                        className={`w-3.5 h-3.5 transition-transform ${
                          isRTL
                            ? 'group-hover:-translate-x-0.5'
                            : 'rotate-180 group-hover:translate-x-0.5'
                        }`}
                      />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Matching Ayahs Section */}
          {results.length > 0 && (
            <div className="space-y-2.5">
              {matchedSurahs.length > 0 && (
                <div className="text-xs font-semibold text-stone-700 dark:text-stone-300 text-start">
                  {t('searchMatchingAyahs')}
                </div>
              )}
              <div className="divide-y divide-stone-200/70 dark:divide-stone-800/70 rounded-2xl ios-glass-card overflow-hidden">
                {results.slice(0, 80).map((match) => (
                  <button
                    key={match.number}
                    type="button"
                    onClick={() =>
                      onOpenMatch(match.surah.number, match.numberInSurah)
                    }
                    className="w-full text-start p-5 hover:bg-stone-900/[0.03] dark:hover:bg-white/[0.04] ios-spring flex flex-col gap-2.5 group"
                  >
                    <div className="w-full flex items-center justify-between gap-3 text-xs text-stone-500 dark:text-stone-400 tabular-nums">
                      <span className="font-semibold text-[#14532D] dark:text-emerald-300">
                        {language === 'en'
                          ? match.surah.englishName
                          : match.surah.name}{' '}
                        · {t('ayah')} {formatNumber(match.numberInSurah)}
                      </span>
                      <span className="inline-flex items-center gap-1 text-stone-500 group-hover:text-[#14532D] dark:group-hover:text-emerald-300 transition-colors">
                        <span>{t('openInMushaf')}</span>
                        <ArrowLeft
                          className={`w-3.5 h-3.5 ${
                            !isRTL ? 'rotate-180' : ''
                          }`}
                        />
                      </span>
                    </div>
                    <p
                      dir="rtl"
                      className="w-full text-right font-amiri text-xl sm:text-2xl leading-relaxed text-stone-900 dark:text-stone-100"
                    >
                      {renderHighlightedText(match.text, submittedQuery)}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
