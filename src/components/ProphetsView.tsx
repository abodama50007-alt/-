import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Headphones,
  ImagePlus,
  Loader2,
  Minus,
  Pause,
  Play,
  Plus,
  ScrollText,
  Search,
  Sparkles,
  Square,
  Volume2,
  X,
} from 'lucide-react';
import { PROPHETS_STORIES } from '../data/prophetsData';
import { ProphetEra, ProphetStory } from '../types/quran';
import { normalizeArabicForSearch, toArabicDigits } from '../utils/arabic';
import {
  fetchProphetNarrationAudio,
  NARRATOR_VOICES,
  NarratorVoiceId,
  selectBestArabicSpeechVoice,
  splitArabicTextForSpeech,
} from '../services/prophetNarrator';
import {
  generateProphetAiIllustration,
  loadCachedProphetAiImages,
} from '../services/prophetIllustrator';
import {
  PROPHETS_HERO_IMAGE,
  ProphetIllustration,
} from './ProphetIllustration';

type ProphetFilterTab =
  | 'all'
  | 'ulul_azm'
  | ProphetEra
  | 'completed';

interface ProphetsViewProps {
  onOpenSurah: (surahNumber: number, ayahNumber?: number) => void;
  onShowToast: (msg: string) => void;
}

const STORAGE_KEY = 'quran_prophets_read_v1';
const VOICE_STORAGE_KEY = 'quran_prophets_narrator_voice_v1';

const ERA_LABELS: Record<ProphetEra, string> = {
  early: 'الأنبياء الأوائل',
  arab_nations: 'الرسل العرب',
  bani_israil: 'أنبياء بني إسرائيل',
  final_seal: 'خاتم المرسلين',
};

const FILTER_TABS: { id: ProphetFilterTab; label: string }[] = [
  { id: 'all', label: 'الكل (٢٥)' },
  { id: 'ulul_azm', label: 'أولو العزم (٥)' },
  { id: 'early', label: 'الأنبياء الأوائل' },
  { id: 'arab_nations', label: 'الرسل العرب' },
  { id: 'bani_israil', label: 'بنو إسرائيل' },
  { id: 'final_seal', label: 'خاتم المرسلين' },
  { id: 'completed', label: 'تمت قراءتها' },
];

const PLAYBACK_RATES = [0.85, 1, 1.15, 1.25] as const;

interface NarrationSegment {
  id: string;
  label: string;
  chapterIndex: number | null; // null = intro summary
  text: string;
}

function buildNarrationSegments(prophet: ProphetStory): NarrationSegment[] {
  const introText = `قصة ${prophet.name}. ${prophet.title}. ${prophet.summary}`;
  const segments: NarrationSegment[] = [
    {
      id: 'intro',
      label: 'مقدمة القصة',
      chapterIndex: null,
      text: introText,
    },
  ];
  prophet.chapters.forEach((ch, idx) => {
    segments.push({
      id: `chapter-${idx}`,
      label: `الفصل ${toArabicDigits(idx + 1)}: ${ch.heading}`,
      chapterIndex: idx,
      text: `${ch.heading}. ${ch.content}`,
    });
  });
  return segments;
}

function loadReadProphetIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadSavedVoice(): NarratorVoiceId {
  try {
    const raw = localStorage.getItem(VOICE_STORAGE_KEY) as NarratorVoiceId | null;
    if (raw && NARRATOR_VOICES.some((v) => v.id === raw)) {
      return raw;
    }
  } catch {
    // ignore
  }
  return 'Charon';
}

export const ProphetsView: React.FC<ProphetsViewProps> = ({
  onOpenSurah,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<ProphetFilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProphetId, setSelectedProphetId] = useState<string | null>(null);
  const [readIds, setReadIds] = useState<string[]>(() => loadReadProphetIds());
  const [readerFontSize, setReaderFontSize] = useState<number>(18);
  const [heroImgError, setHeroImgError] = useState(false);
  const [showIllustrationModal, setShowIllustrationModal] = useState(false);
  const [aiImages, setAiImages] = useState<Record<string, string>>({});
  const [generatingArtId, setGeneratingArtId] = useState<string | null>(null);
  const [batchArtRunning, setBatchArtRunning] = useState(false);
  const [batchArtProgress, setBatchArtProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const batchArtAbortRef = useRef(false);

  // Story audio narrator state
  const [narratorVoice, setNarratorVoice] = useState<NarratorVoiceId>(() =>
    loadSavedVoice()
  );
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [narrationState, setNarrationState] = useState<
    'idle' | 'loading' | 'playing' | 'paused'
  >('idle');
  const [activeSegmentIdx, setActiveSegmentIdx] = useState<number | null>(null);
  const [usingOfflineFallback, setUsingOfflineFallback] = useState(false);
  const [pendingAutoPlayId, setPendingAutoPlayId] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const narrationSessionRef = useRef<number>(0);
  const speechActiveRef = useRef<boolean>(false);
  const playbackRateRef = useRef<number>(playbackRate);
  const voiceRef = useRef<NarratorVoiceId>(narratorVoice);

  useEffect(() => {
    void loadCachedProphetAiImages().then((cached) => {
      if (Object.keys(cached).length > 0) {
        setAiImages(cached);
      }
    });
  }, []);

  const handleGenerateAiArt = useCallback(
    async (prophet: ProphetStory, forceRefresh = false) => {
      if (generatingArtId || batchArtRunning) return;
      setGeneratingArtId(prophet.id);
      try {
        const url = await generateProphetAiIllustration({
          prophetId: prophet.id,
          prophetName: prophet.name,
          forceRefresh,
        });
        setAiImages((prev) => ({ ...prev, [prophet.id]: url }));
        onShowToast(`تم توليد اللوحة الفنية لقصة ${prophet.name}`);
      } catch (err) {
        onShowToast(
          err instanceof Error
            ? err.message
            : 'تعذر توليد اللوحة بالذكاء الاصطناعي حالياً'
        );
      } finally {
        setGeneratingArtId(null);
      }
    },
    [batchArtRunning, generatingArtId, onShowToast]
  );

  const handleStopBatchArt = useCallback(() => {
    batchArtAbortRef.current = true;
    setBatchArtRunning(false);
    setGeneratingArtId(null);
    setBatchArtProgress(null);
  }, []);

  const handleGenerateAllMissingAiArt = useCallback(async () => {
    if (batchArtRunning || generatingArtId) return;
    const missing = PROPHETS_STORIES.filter((p) => !aiImages[p.id]);
    if (missing.length === 0) {
      onShowToast('تم توليد رسومات الذكاء الاصطناعي لجميع القصص الـ ٢٥ بالفعل');
      return;
    }

    batchArtAbortRef.current = false;
    setBatchArtRunning(true);
    setBatchArtProgress({ done: 0, total: missing.length });

    let successCount = 0;
    for (let i = 0; i < missing.length; i++) {
      if (batchArtAbortRef.current) break;
      const prophet = missing[i];
      setGeneratingArtId(prophet.id);
      try {
        const url = await generateProphetAiIllustration({
          prophetId: prophet.id,
          prophetName: prophet.name,
        });
        setAiImages((prev) => ({ ...prev, [prophet.id]: url }));
        successCount += 1;
        setBatchArtProgress({ done: i + 1, total: missing.length });
      } catch (err) {
        onShowToast(
          err instanceof Error
            ? err.message
            : 'توقف التوليد التلقائي للرسومات؛ تأكد من إعداد مفتاح API في Settings > Secrets'
        );
        break;
      }
    }

    setGeneratingArtId(null);
    setBatchArtRunning(false);
    setBatchArtProgress(null);
    if (successCount > 0 && !batchArtAbortRef.current) {
      onShowToast(`تم توليد ${toArabicDigits(successCount)} لوحة فنية جديدة`);
    }
  }, [aiImages, batchArtRunning, generatingArtId, onShowToast]);

  useEffect(() => {
    playbackRateRef.current = playbackRate;
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  useEffect(() => {
    voiceRef.current = narratorVoice;
    try {
      localStorage.setItem(VOICE_STORAGE_KEY, narratorVoice);
    } catch {
      // ignore
    }
  }, [narratorVoice]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(readIds));
    } catch {
      // ignore storage quota errors
    }
  }, [readIds]);

  const stopNarration = useCallback(() => {
    narrationSessionRef.current += 1;
    speechActiveRef.current = false;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
      } catch {
        // ignore
      }
      audioRef.current = null;
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }

    setNarrationState('idle');
    setActiveSegmentIdx(null);
    setUsingOfflineFallback(false);
  }, []);

  // Stop narration cleanly on unmount
  useEffect(() => {
    return () => {
      stopNarration();
    };
  }, [stopNarration]);

  const readSet = useMemo(() => new Set(readIds), [readIds]);

  const selectedProphet = useMemo<ProphetStory | null>(() => {
    if (!selectedProphetId) return null;
    return PROPHETS_STORIES.find((p) => p.id === selectedProphetId) ?? null;
  }, [selectedProphetId]);

  const narrationSegments = useMemo<NarrationSegment[]>(() => {
    if (!selectedProphet) return [];
    return buildNarrationSegments(selectedProphet);
  }, [selectedProphet]);

  const playSegmentSequence = useCallback(
    async (
      prophet: ProphetStory,
      startIndex: number,
      overrideVoice?: NarratorVoiceId
    ) => {
      const segments = buildNarrationSegments(prophet);
      if (startIndex < 0 || startIndex >= segments.length) {
        stopNarration();
        return;
      }

      stopNarration();
      const sessionId = ++narrationSessionRef.current;
      const chosenVoice = overrideVoice ?? voiceRef.current;

      const speakWithBrowser = (
        segIndex: number,
        showFallbackBadge: boolean
      ): Promise<void> => {
        return new Promise((resolve) => {
          if (
            typeof window === 'undefined' ||
            !('speechSynthesis' in window)
          ) {
            onShowToast('القارئ الصوتي غير متوفر في هذا المتصفح');
            resolve();
            return;
          }

          const segment = segments[segIndex];
          const chunks = splitArabicTextForSpeech(segment.text);
          if (!chunks.length) {
            resolve();
            return;
          }

          setUsingOfflineFallback(showFallbackBadge);
          setNarrationState('playing');
          speechActiveRef.current = true;

          const voice = selectBestArabicSpeechVoice();
          let chunkIdx = 0;

          const speakNextChunk = () => {
            if (
              narrationSessionRef.current !== sessionId ||
              !speechActiveRef.current
            ) {
              resolve();
              return;
            }
            if (chunkIdx >= chunks.length) {
              resolve();
              return;
            }

            const utterance = new SpeechSynthesisUtterance(chunks[chunkIdx]);
            utterance.lang = 'ar-SA';
            if (voice) utterance.voice = voice;
            utterance.rate = playbackRateRef.current;

            utterance.onend = () => {
              chunkIdx += 1;
              speakNextChunk();
            };
            utterance.onerror = () => {
              chunkIdx += 1;
              speakNextChunk();
            };

            window.speechSynthesis.speak(utterance);
          };

          speakNextChunk();
        });
      };

      for (let idx = startIndex; idx < segments.length; idx++) {
        if (narrationSessionRef.current !== sessionId) return;

        const segment = segments[idx];
        setActiveSegmentIdx(idx);

        // Scroll chapter smoothly into view if reading chapters
        if (segment.chapterIndex !== null) {
          const el = document.getElementById(`chapter-${segment.chapterIndex}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }

        if (chosenVoice === 'browser') {
          await speakWithBrowser(idx, false);
          continue;
        }

        setNarrationState('loading');
        setUsingOfflineFallback(false);

        try {
          const controller = new AbortController();
          abortControllerRef.current = controller;

          const audioUrl = await fetchProphetNarrationAudio({
            text: segment.text,
            voiceName: chosenVoice,
            prophetName: prophet.name,
            chapterHeading: segment.label,
            signal: controller.signal,
          });

          if (narrationSessionRef.current !== sessionId) return;

          await new Promise<void>((resolve, reject) => {
            const audio = new Audio(audioUrl);
            audio.playbackRate = playbackRateRef.current;
            audioRef.current = audio;

            audio.onended = () => {
              resolve();
            };
            audio.onerror = () => {
              reject(new Error('AUDIO_PLAYBACK_ERROR'));
            };

            setNarrationState('playing');
            audio.play().catch(reject);
          });
        } catch (err) {
          if (narrationSessionRef.current !== sessionId) return;
          if (err instanceof DOMException && err.name === 'AbortError') return;

          // Seamless automatic fallback to Arabic browser reader so narration never fails silently
          await speakWithBrowser(idx, true);
        }
      }

      if (narrationSessionRef.current === sessionId) {
        stopNarration();
        onShowToast(`انتهت التلاوة الصوتية لقصة ${prophet.name}`);
      }
    },
    [onShowToast, stopNarration]
  );

  // Trigger immediate playback if user clicked "استماع" from a catalog card
  useEffect(() => {
    if (selectedProphet && pendingAutoPlayId === selectedProphet.id) {
      setPendingAutoPlayId(null);
      void playSegmentSequence(selectedProphet, 0);
    }
  }, [pendingAutoPlayId, playSegmentSequence, selectedProphet]);

  const handleTogglePlayPause = () => {
    if (!selectedProphet) return;

    if (narrationState === 'idle') {
      void playSegmentSequence(selectedProphet, 0);
      return;
    }

    if (narrationState === 'playing') {
      if (audioRef.current) {
        audioRef.current.pause();
        setNarrationState('paused');
      } else if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.pause();
        setNarrationState('paused');
      }
      return;
    }

    if (narrationState === 'paused') {
      if (audioRef.current) {
        void audioRef.current.play();
        setNarrationState('playing');
      } else if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.resume();
        setNarrationState('playing');
      }
    }
  };

  const handleVoiceChange = (nextVoice: NarratorVoiceId) => {
    setNarratorVoice(nextVoice);
    if (
      selectedProphet &&
      (narrationState === 'playing' ||
        narrationState === 'paused' ||
        narrationState === 'loading')
    ) {
      const resumeIndex = activeSegmentIdx ?? 0;
      void playSegmentSequence(selectedProphet, resumeIndex, nextVoice);
    }
  };

  const filteredProphets = useMemo(() => {
    const q = normalizeArabicForSearch(searchQuery).toLowerCase();
    return PROPHETS_STORIES.filter((prophet) => {
      if (activeTab === 'ulul_azm' && !prophet.isUlulAzm) return false;
      if (activeTab === 'completed' && !readSet.has(prophet.id)) return false;
      if (
        activeTab !== 'all' &&
        activeTab !== 'ulul_azm' &&
        activeTab !== 'completed' &&
        prophet.era !== activeTab
      ) {
        return false;
      }

      if (!q) return true;
      const chaptersBlob = prophet.chapters
        .map((c) => `${c.heading} ${c.content}`)
        .join(' ');
      const haystack = normalizeArabicForSearch(
        `${prophet.name} ${prophet.title} ${prophet.peopleOrPlace} ${prophet.summary} ${chaptersBlob}`
      ).toLowerCase();
      return haystack.includes(q);
    });
  }, [activeTab, readSet, searchQuery]);

  const toggleProphetRead = (id: string) => {
    setReadIds((prev) => {
      const exists = prev.includes(id);
      onShowToast(
        exists
          ? 'تمت إزالة القصة من سجل المقروءة'
          : 'تم تسجيل إتمام قراءة القصة'
      );
      return exists ? prev.filter((item) => item !== id) : [...prev, id];
    });
  };

  const openProphetStory = (id: string, autoListen = false) => {
    stopNarration();
    setShowIllustrationModal(false);
    if (autoListen) {
      setPendingAutoPlayId(id);
    }
    setSelectedProphetId(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const readCount = readIds.filter((id) =>
    PROPHETS_STORIES.some((p) => p.id === id)
  ).length;
  const readProgressPct = Math.round(
    (readCount / PROPHETS_STORIES.length) * 100
  );

  // Full Story Editorial Reader View
  if (selectedProphet) {
    const currentIndex = PROPHETS_STORIES.findIndex(
      (p) => p.id === selectedProphet.id
    );
    const prevProphet =
      currentIndex > 0 ? PROPHETS_STORIES[currentIndex - 1] : null;
    const nextProphet =
      currentIndex < PROPHETS_STORIES.length - 1
        ? PROPHETS_STORIES[currentIndex + 1]
        : null;
    const isCompleted = readSet.has(selectedProphet.id);
    const activeSegment =
      activeSegmentIdx !== null
        ? narrationSegments[activeSegmentIdx] ?? null
        : null;

    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-7 sm:py-10 pb-28 space-y-6">
        {/* Top Reader Utility Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              stopNarration();
              setShowIllustrationModal(false);
              setSelectedProphetId(null);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="ios-spring inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-medium rounded-xl ios-glass-input text-stone-800 dark:text-stone-200 hover:bg-white/80 dark:hover:bg-stone-800/80 whitespace-nowrap"
          >
            <ArrowRight className="w-4 h-4" />
            <span>العودة لقائمة الأنبياء</span>
          </button>

          <div className="flex flex-wrap items-center gap-2">
            {/* Font size controls */}
            <div className="flex items-center ios-glass-input rounded-xl">
              <button
                type="button"
                aria-label="تصغير خط القراءة"
                onClick={() =>
                  setReaderFontSize((s) => Math.max(15, s - 1))
                }
                className="ios-spring p-2 text-stone-600 dark:text-stone-300 hover:bg-stone-900/5 dark:hover:bg-white/10 rounded-r-xl"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="px-2.5 text-xs text-stone-600 dark:text-stone-400 tabular-nums select-none whitespace-nowrap">
                حجم {toArabicDigits(readerFontSize)}
              </span>
              <button
                type="button"
                aria-label="تكبير خط القراءة"
                onClick={() =>
                  setReaderFontSize((s) => Math.min(24, s + 1))
                }
                className="ios-spring p-2 text-stone-600 dark:text-stone-300 hover:bg-stone-900/5 dark:hover:bg-white/10 rounded-l-xl"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              type="button"
              disabled={generatingArtId === selectedProphet.id}
              onClick={() =>
                void handleGenerateAiArt(
                  selectedProphet,
                  Boolean(aiImages[selectedProphet.id])
                )
              }
              className="ios-spring inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-medium rounded-xl ios-glass-input text-[#9A742E] dark:text-amber-300 hover:bg-white/80 dark:hover:bg-stone-800/80 disabled:opacity-60 whitespace-nowrap"
            >
              {generatingArtId === selectedProphet.id ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري الرسم (AI)...</span>
                </>
              ) : (
                <>
                  <ImagePlus className="w-4 h-4" />
                  <span>
                    {aiImages[selectedProphet.id]
                      ? 'إعادة رسم (AI)'
                      : 'توليد رسم (AI)'}
                  </span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => toggleProphetRead(selectedProphet.id)}
              className={`ios-spring inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-medium rounded-xl whitespace-nowrap transition-colors ${
                isCompleted
                  ? 'bg-[#14532D] dark:bg-emerald-700 text-white shadow-xs'
                  : 'ios-glass-input text-[#14532D] dark:text-emerald-300 hover:bg-white/80 dark:hover:bg-stone-800/80'
              }`}
            >
              {isCompleted ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>تمت قراءة القصة</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>تسجيل كمقروءة</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Main Story Article */}
        <article className="rounded-3xl ios-glass-card p-5 sm:p-10 space-y-6">
          {/* Bespoke Illustrated Plate for this Prophet */}
          <ProphetIllustration
            prophet={selectedProphet}
            variant="hero"
            aiImageUrl={aiImages[selectedProphet.id] ?? null}
            isGeneratingArt={generatingArtId === selectedProphet.id}
            onGenerateAiArt={() =>
              void handleGenerateAiArt(
                selectedProphet,
                Boolean(aiImages[selectedProphet.id])
              )
            }
            onOpenLightbox={() => setShowIllustrationModal(true)}
          />

          {/* Editorial Header */}
          <header className="space-y-3 pb-5 border-b border-stone-200/80 dark:border-white/10">
            <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 dark:text-stone-400 tabular-nums">
              <span className="font-semibold text-[#9A742E] dark:text-amber-400">
                النبي {toArabicDigits(selectedProphet.order)} من ٢٥
              </span>
              <span aria-hidden="true">·</span>
              <span>{ERA_LABELS[selectedProphet.era]}</span>
              {selectedProphet.isUlulAzm && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-medium text-[#14532D] dark:text-emerald-300">
                    من أولي العزم من الرسل
                  </span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span>{selectedProphet.peopleOrPlace}</span>
              <span aria-hidden="true">·</span>
              <span>
                قراءة ~{toArabicDigits(selectedProphet.estimatedReadMinutes)} دقائق
              </span>
            </div>

            <h1 className="font-amiri text-3xl sm:text-5xl font-bold text-[#1C1917] dark:text-[#F2EFE8] leading-snug text-balance">
              {selectedProphet.name}
            </h1>

            <p className="text-base sm:text-lg font-medium text-[#14532D] dark:text-emerald-300">
              {selectedProphet.title}
            </p>

            <p
              className={`text-sm sm:text-base leading-relaxed max-w-3xl pt-1 transition-colors ${
                activeSegment?.id === 'intro'
                  ? 'text-[#14532D] dark:text-emerald-200 font-medium'
                  : 'text-stone-600 dark:text-stone-300'
              }`}
            >
              {selectedProphet.summary}
            </p>
          </header>

          {/* Integrated Audio Narrator Control Strip */}
          <section
            aria-label="الراوي الصوتي للقصة"
            className="rounded-2xl ios-glass-input p-4 sm:p-5 space-y-3.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-10 h-10 rounded-xl bg-[#14532D]/12 dark:bg-emerald-500/20 text-[#14532D] dark:text-emerald-300 flex items-center justify-center shrink-0">
                  <Headphones className="w-5 h-5" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm sm:text-base font-bold text-stone-900 dark:text-stone-100">
                      السرد الصوتي للقصة (TTS)
                    </h2>
                    {usingOfflineFallback && narrationState !== 'idle' && (
                      <span className="text-[11px] text-[#9A742E] dark:text-amber-400">
                        · القارئ المدمج
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-600 dark:text-stone-400 truncate">
                    {narrationState === 'loading'
                      ? `جاري تحضير الصوت: ${activeSegment?.label ?? ''}`
                      : narrationState === 'playing'
                      ? `يُقرأ الآن: ${activeSegment?.label ?? selectedProphet.name}`
                      : narrationState === 'paused'
                      ? `متوقف مؤقتاً عند: ${activeSegment?.label ?? ''}`
                      : 'استمع لقصة النبي كاملة بصوت عربي واضح فصلاً تلو الآخر'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleTogglePlayPause}
                  className="ios-spring inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#14532D] hover:bg-[#114224] dark:bg-emerald-700 dark:hover:bg-emerald-600 text-[#FBF8F1] text-xs sm:text-sm font-semibold whitespace-nowrap shadow-xs"
                >
                  {narrationState === 'loading' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري التحميل...</span>
                    </>
                  ) : narrationState === 'playing' ? (
                    <>
                      <Pause className="w-4 h-4" />
                      <span>إيقاف مؤقت</span>
                    </>
                  ) : narrationState === 'paused' ? (
                    <>
                      <Play className="w-4 h-4" />
                      <span>متابعة القراءة</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-4 h-4" />
                      <span>استمع للقصة كاملة</span>
                    </>
                  )}
                </button>

                {narrationState !== 'idle' && (
                  <button
                    type="button"
                    onClick={stopNarration}
                    aria-label="إيقاف القراءة الصوتية"
                    className="ios-spring inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-stone-300/80 dark:border-white/15 text-xs font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-900/5 dark:hover:bg-white/10 whitespace-nowrap"
                  >
                    <Square className="w-3.5 h-3.5" />
                    <span>إيقاف</span>
                  </button>
                )}
              </div>
            </div>

            {/* Voice Persona & Reading Speed Controls */}
            <div className="pt-3 border-t border-stone-200/70 dark:border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-stone-500 dark:text-stone-400 ml-1">
                  صوت القارئ:
                </span>
                {NARRATOR_VOICES.map((voice) => {
                  const selected = narratorVoice === voice.id;
                  return (
                    <button
                      key={voice.id}
                      type="button"
                      onClick={() => handleVoiceChange(voice.id)}
                      title={voice.subtitle}
                      className={`ios-spring px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
                        selected
                          ? 'bg-[#14532D] dark:bg-emerald-700 text-white'
                          : 'bg-white/55 dark:bg-white/[0.05] text-stone-700 dark:text-stone-300 hover:bg-white/85 dark:hover:bg-white/10'
                      }`}
                    >
                      {voice.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-stone-500 dark:text-stone-400 ml-1">
                  السرعة:
                </span>
                {PLAYBACK_RATES.map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => setPlaybackRate(rate)}
                    className={`ios-spring px-2.5 py-1 rounded-lg tabular-nums font-medium whitespace-nowrap transition-colors ${
                      playbackRate === rate
                        ? 'bg-[#9A742E] dark:bg-amber-600 text-white'
                        : 'bg-white/55 dark:bg-white/[0.05] text-stone-700 dark:text-stone-300 hover:bg-white/85 dark:hover:bg-white/10'
                    }`}
                  >
                    {toArabicDigits(rate)}×
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* 2-Column Editorial Canvas: Story Narrative + Margin Notes & Quran Refs */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
            {/* Main Narrative Column */}
            <div className="lg:col-span-8 space-y-8">
              {selectedProphet.chapters.map((chapter, idx) => {
                const isChapterReading =
                  activeSegment?.chapterIndex === idx &&
                  narrationState !== 'idle';
                return (
                  <section
                    key={chapter.heading}
                    id={`chapter-${idx}`}
                    className={`${
                      idx > 0
                        ? 'pt-7 border-t border-stone-200/75 dark:border-white/10 space-y-3'
                        : 'space-y-3'
                    } ${
                      isChapterReading
                        ? 'rounded-2xl bg-[#14532D]/[0.05] dark:bg-emerald-500/[0.08] p-4 sm:p-5 border border-[#14532D]/25 dark:border-emerald-400/25 transition-colors'
                        : ''
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="font-amiri text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100">
                        <span className="text-[#9A742E] dark:text-amber-400 tabular-nums ml-2">
                          {toArabicDigits(idx + 1)}.
                        </span>
                        {chapter.heading}
                      </h2>

                      <button
                        type="button"
                        onClick={() => {
                          if (isChapterReading && narrationState === 'playing') {
                            handleTogglePlayPause();
                          } else {
                            // idx + 1 corresponds to segment index (0 = intro)
                            void playSegmentSequence(selectedProphet, idx + 1);
                          }
                        }}
                        className={`ios-spring inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                          isChapterReading
                            ? 'bg-[#14532D] dark:bg-emerald-700 text-white'
                            : 'ios-glass-input text-[#14532D] dark:text-emerald-300 hover:bg-white/80 dark:hover:bg-stone-800/80'
                        }`}
                      >
                        {isChapterReading && narrationState === 'loading' ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>تحضير...</span>
                          </>
                        ) : isChapterReading && narrationState === 'playing' ? (
                          <>
                            <Pause className="w-3.5 h-3.5" />
                            <span>إيقاف مؤقت</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-3.5 h-3.5" />
                            <span>استمع للفصل</span>
                          </>
                        )}
                      </button>
                    </div>

                    <p
                      className="text-[#1C1917] dark:text-[#EFECE6] leading-[2.05] max-w-prose select-text"
                      style={{ fontSize: `${readerFontSize}px` }}
                    >
                      {chapter.content}
                    </p>
                  </section>
                );
              })}
            </div>

            {/* Margin Sidebar: Chapter Jump, Miracles, Lessons, Direct Mushaf Refs */}
            <aside className="lg:col-span-4 space-y-6 lg:sticky lg:top-24 pt-6 lg:pt-0 border-t lg:border-t-0 lg:border-r border-stone-200/75 dark:border-white/10 lg:pr-7">
              {/* Chapter Index */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-semibold text-stone-500 dark:text-stone-400">
                  فصول القصة
                </h3>
                <ul className="space-y-1.5 text-sm">
                  {selectedProphet.chapters.map((ch, idx) => (
                    <li key={ch.heading}>
                      <a
                        href={`#chapter-${idx}`}
                        className={`inline-flex items-baseline gap-2 transition-colors ${
                          activeSegment?.chapterIndex === idx
                            ? 'font-semibold text-[#14532D] dark:text-emerald-300'
                            : 'text-stone-700 dark:text-stone-300 hover:text-[#14532D] dark:hover:text-emerald-300'
                        }`}
                      >
                        <span className="text-xs text-[#9A742E] dark:text-amber-400 tabular-nums">
                          {toArabicDigits(idx + 1)}.
                        </span>
                        <span>{ch.heading}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Miracles */}
              <div className="pt-5 border-t border-stone-200/75 dark:border-white/10 space-y-2.5">
                <h3 className="text-xs font-semibold text-stone-500 dark:text-stone-400">
                  المعجزات والآيات
                </h3>
                <ul className="space-y-2 text-xs sm:text-sm text-stone-700 dark:text-stone-300 leading-relaxed">
                  {selectedProphet.miracles.map((m) => (
                    <li key={m} className="flex items-start gap-2">
                      <span
                        aria-hidden="true"
                        className="text-[#9A742E] dark:text-amber-400 mt-1 text-xs"
                      >
                        ◆
                      </span>
                      <span>{m}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Lessons */}
              <div className="pt-5 border-t border-stone-200/75 dark:border-white/10 space-y-2.5">
                <h3 className="text-xs font-semibold text-stone-500 dark:text-stone-400">
                  العِبر والدروس المستفادة
                </h3>
                <ul className="space-y-2 text-xs sm:text-sm text-stone-700 dark:text-stone-300 leading-relaxed">
                  {selectedProphet.lessons.map((l) => (
                    <li key={l} className="flex items-start gap-2">
                      <span
                        aria-hidden="true"
                        className="text-[#14532D] dark:text-emerald-400 mt-0.5 text-xs"
                      >
                        ✓
                      </span>
                      <span>{l}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Quranic References linking directly to Mushaf Reader */}
              <div className="pt-5 border-t border-stone-200/75 dark:border-white/10 space-y-3">
                <h3 className="text-xs font-semibold text-stone-500 dark:text-stone-400">
                  من آيات القصة في القرآن الكريم
                </h3>
                <div className="space-y-3">
                  {selectedProphet.quranRefs.map((ref) => (
                    <div
                      key={`${ref.surahNumber}_${ref.ayahNumber}`}
                      className="rounded-2xl ios-glass-input p-3.5 space-y-2"
                    >
                      <p className="font-quran text-lg leading-[2] text-[#1C1917] dark:text-[#F2EFE8]">
                        ﴿{ref.ayahText}﴾
                      </p>
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <span className="text-[11px] text-stone-500 dark:text-stone-400 tabular-nums">
                          {ref.surahName} · آية {toArabicDigits(ref.ayahNumber)}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            onOpenSurah(ref.surahNumber, ref.ayahNumber)
                          }
                          className="ios-spring inline-flex items-center gap-1 text-[11px] font-semibold text-[#14532D] dark:text-emerald-300 hover:underline whitespace-nowrap"
                        >
                          <BookOpen className="w-3 h-3" />
                          <span>فتح في المصحف</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </article>

        {/* Bottom Sequential Prophet Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          {prevProphet ? (
            <button
              type="button"
              onClick={() => openProphetStory(prevProphet.id)}
              className="ios-spring inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-medium rounded-xl ios-glass-input text-stone-800 dark:text-stone-200 hover:bg-white/80 dark:hover:bg-stone-800/80 whitespace-nowrap"
            >
              <ChevronRight className="w-4 h-4" />
              <span>السابق: {prevProphet.name}</span>
            </button>
          ) : (
            <div />
          )}

          {nextProphet && (
            <button
              type="button"
              onClick={() => openProphetStory(nextProphet.id)}
              className="ios-spring inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-medium rounded-xl bg-[#14532D] hover:bg-[#114224] dark:bg-emerald-700 dark:hover:bg-emerald-600 text-[#FBF8F1] whitespace-nowrap"
            >
              <span>التالي: {nextProphet.name}</span>
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Full Artwork Lightbox Modal */}
        {showIllustrationModal && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`لوحة قصة ${selectedProphet.name}`}
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowIllustrationModal(false)}
          >
            <div
              className="w-full max-w-3xl rounded-3xl ios-glass-card p-5 sm:p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-amiri text-xl sm:text-2xl font-bold text-stone-900 dark:text-stone-100">
                  {selectedProphet.name}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIllustrationModal(false)}
                  aria-label="إغلاق اللوحة"
                  className="p-2 rounded-xl ios-glass-input text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ProphetIllustration
                prophet={selectedProphet}
                variant="lightbox"
                aiImageUrl={aiImages[selectedProphet.id] ?? null}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  // Catalog / Index View of All 25 Prophets
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 pb-28 space-y-6">
      {/* Header Exhibition Banner with Painterly Art */}
      <section className="rounded-3xl ios-glass-card overflow-hidden">
        <div
          className="relative min-h-[210px] sm:min-h-[240px] flex flex-col justify-end p-6 sm:p-8"
          style={{
            background:
              'linear-gradient(135deg, #102A1E 0%, #1C3A2C 55%, #3B2F1D 100%)',
          }}
        >
          {!heroImgError && (
            <img
              src={PROPHETS_HERO_IMAGE}
              alt="لوحة مخطوطات ومصابيح لقصص الأنبياء كاملة"
              referrerPolicy="no-referrer"
              onError={() => setHeroImgError(true)}
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/50 to-black/25" />

          <div className="relative z-10 flex flex-wrap items-end justify-between gap-5">
            <div className="space-y-1.5 max-w-2xl">
              <div className="inline-flex items-center gap-2 text-xs font-medium text-amber-300">
                <ScrollText className="w-4 h-4" />
                <span>الموسوعة القرآنية المصوّرة والمسموعة لجميع الأنبياء</span>
              </div>
              <h1 className="font-amiri text-3xl sm:text-4xl font-bold text-[#FBF8F1] text-balance">
                قصص الأنبياء كاملة
              </h1>
              <p className="text-sm text-stone-200/90 leading-relaxed">
                سير وقصص جميع الأنبياء الخمسة والعشرين المذكورين في القرآن الكريم من آدم عليه السلام إلى محمد ﷺ، مزودة بلوحة تعبيرية خاصة لكل قصة وقارئ صوتي يقرأ القصة كاملة.
              </p>
            </div>

            <div className="rounded-2xl bg-black/45 backdrop-blur-md border border-white/15 px-4 py-3 min-w-[175px] space-y-1.5">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="text-stone-300">سجل القراءة</span>
                <span className="font-bold text-amber-300 tabular-nums">
                  {toArabicDigits(readCount)} / {toArabicDigits(PROPHETS_STORIES.length)}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-white/15 overflow-hidden">
                <div
                  className="h-full bg-emerald-400 transition-[width] duration-300"
                  style={{ width: `${readProgressPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Search & Era Filters */}
        <div className="p-5 sm:p-6 space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث باسم النبي أو الحدث أو المكان (مثال: يوسف، السفينة، مدين، النار، الطور)..."
              aria-label="البحث في قصص الأنبياء"
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

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {FILTER_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
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
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Results Count + Batch AI Illustration Generator */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-stone-600 dark:text-stone-400">
        <div className="flex flex-wrap items-center gap-2 tabular-nums">
          <span>
            عرض {toArabicDigits(filteredProphets.length)} من أصل{' '}
            {toArabicDigits(PROPHETS_STORIES.length)} نبياً ورسولاً
          </span>
          <span aria-hidden="true">·</span>
          <span>
            لوحات AI المحفوظة: {toArabicDigits(Object.keys(aiImages).length)} /{' '}
            {toArabicDigits(PROPHETS_STORIES.length)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {batchArtRunning ? (
            <button
              type="button"
              onClick={handleStopBatchArt}
              className="ios-spring inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-medium whitespace-nowrap"
            >
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>
                جاري توليد {toArabicDigits(batchArtProgress?.done ?? 0)} /{' '}
                {toArabicDigits(batchArtProgress?.total ?? 0)} · إيقاف
              </span>
            </button>
          ) : (
            <button
              type="button"
              disabled={Boolean(generatingArtId)}
              onClick={() => void handleGenerateAllMissingAiArt()}
              className="ios-spring inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl ios-glass-input text-[#9A742E] dark:text-amber-300 hover:border-[#9A742E]/50 disabled:opacity-60 font-medium whitespace-nowrap"
            >
              <ImagePlus className="w-3.5 h-3.5" />
              <span>توليد صور AI لجميع القصص</span>
            </button>
          )}

          {(searchQuery || activeTab !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setActiveTab('all');
              }}
              className="text-[#14532D] dark:text-emerald-300 font-medium hover:underline whitespace-nowrap"
            >
              عرض جميع الأنبياء
            </button>
          )}
        </div>
      </div>

      {/* Empty State or 25-Prophet Illustrated Grid */}
      {filteredProphets.length === 0 ? (
        <div className="rounded-3xl ios-glass-card p-10 text-center space-y-3">
          <Sparkles className="w-8 h-8 mx-auto text-[#9A742E] dark:text-amber-400" />
          <h2 className="font-amiri text-xl font-bold text-stone-900 dark:text-stone-100">
            {activeTab === 'completed' && readCount === 0
              ? 'لم تسجل قراءة أي قصة بعد'
              : 'لم يتم العثور على قصص مطابقة للبحث'}
          </h2>
          <p className="text-sm text-stone-600 dark:text-stone-400 max-w-md mx-auto">
            {activeTab === 'completed' && readCount === 0
              ? 'اختر أي قصة لقراءتها أو الاستماع إليها ثم اضغط على «تسجيل كمقروءة» لحفظ تقدمك.'
              : 'جرّب البحث باسم نبي آخر أو عرض جميع الأنبياء والمرسلين.'}
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setActiveTab('all');
            }}
            className="ios-spring px-4 py-2 rounded-xl bg-[#14532D] dark:bg-emerald-700 text-white text-xs font-medium"
          >
            عرض جميع الأنبياء
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProphets.map((prophet) => {
            const isRead = readSet.has(prophet.id);
            return (
              <motion.article
                key={prophet.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                className="ios-spring group rounded-3xl ios-glass-card hover:border-[#14532D]/45 dark:hover:border-emerald-500/40 p-4 sm:p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-3.5">
                  {/* Bespoke Story Illustration */}
                  <button
                    type="button"
                    onClick={() => openProphetStory(prophet.id)}
                    aria-label={`فتح لوحة وقصة ${prophet.name}`}
                    className="w-full block text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 rounded-2xl"
                  >
                    <ProphetIllustration
                      prophet={prophet}
                      variant="card"
                      aiImageUrl={aiImages[prophet.id] ?? null}
                      isGeneratingArt={generatingArtId === prophet.id}
                    />
                  </button>

                  {/* Quiet Unboxed Editorial Metadata */}
                  <div className="flex items-center justify-between gap-2 text-xs text-stone-500 dark:text-stone-400 tabular-nums">
                    <div className="flex items-center gap-1.5 min-w-0 truncate">
                      <span className="font-semibold text-[#9A742E] dark:text-amber-400">
                        {toArabicDigits(prophet.order).padStart(2, '٠')}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">
                        {prophet.isUlulAzm
                          ? 'من أولي العزم'
                          : ERA_LABELS[prophet.era]}
                      </span>
                    </div>
                    {isRead && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#14532D] dark:text-emerald-300 shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>مقروءة</span>
                      </span>
                    )}
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={() => openProphetStory(prophet.id)}
                      className="text-right w-full group/title focus-visible:outline-none"
                    >
                      <h2 className="font-amiri text-2xl font-bold text-stone-900 dark:text-stone-100 group-hover:text-[#14532D] dark:group-hover:text-emerald-300 transition-colors">
                        {prophet.name}
                      </h2>
                    </button>
                    <div className="text-xs font-medium text-[#14532D] dark:text-emerald-300 mt-0.5">
                      {prophet.title}
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 leading-relaxed line-clamp-3">
                    {prophet.summary}
                  </p>
                </div>

                {/* Card Footer Actions: TTS Narration + AI Illustration + Read */}
                <div className="pt-3 border-t border-stone-200/65 dark:border-white/10 flex items-center justify-between gap-2 text-xs w-full">
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => openProphetStory(prophet.id, true)}
                      className="ios-spring inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl ios-glass-input text-stone-700 dark:text-stone-200 hover:border-[#9A742E]/60 hover:text-[#9A742E] dark:hover:text-amber-300 font-medium whitespace-nowrap shrink-0"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>استماع</span>
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(generatingArtId) || batchArtRunning}
                      onClick={() =>
                        void handleGenerateAiArt(
                          prophet,
                          Boolean(aiImages[prophet.id])
                        )
                      }
                      title={
                        aiImages[prophet.id]
                          ? 'إعادة توليد لوحة الذكاء الاصطناعي'
                          : 'توليد لوحة بالذكاء الاصطناعي لهذه القصة'
                      }
                      className="ios-spring inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl ios-glass-input text-stone-700 dark:text-stone-200 hover:border-[#14532D]/60 hover:text-[#14532D] dark:hover:text-emerald-300 disabled:opacity-50 font-medium whitespace-nowrap shrink-0"
                    >
                      <ImagePlus className="w-3.5 h-3.5" />
                      <span>{aiImages[prophet.id] ? 'تحديث AI' : 'رسم AI'}</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => openProphetStory(prophet.id)}
                    className="ios-spring inline-flex items-center gap-1 font-semibold text-[#14532D] dark:text-emerald-300 hover:underline whitespace-nowrap shrink-0"
                  >
                    <span>قراءة القصة</span>
                    <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
                  </button>
                </div>
              </motion.article>
            );
          })}
        </div>
      )}
    </div>
  );
};
