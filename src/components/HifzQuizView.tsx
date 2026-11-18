import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Award,
  BookOpen,
  CheckCircle2,
  Eye,
  EyeOff,
  Flame,
  HelpCircle,
  Keyboard,
  Layers,
  ListChecks,
  Loader2,
  Play,
  RefreshCw,
  Sparkles,
  Trophy,
  XCircle,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { JUZ_LIST } from '../data/quranMeta';
import { awardCompetitionPoints } from '../firebase';
import { fetchJuzAyahs, fetchSurahWithTafsir } from '../services/quranApi';
import {
  AyahItem,
  HifzQuizAchievementRecord,
  LastReadPosition,
  SurahMeta,
} from '../types/quran';
import {
  normalizeArabicForSearch,
  stripLeadingBismillah,
  toArabicDigits,
} from '../utils/arabic';
import { CertificateData } from './CertificateModal';

export type HifzQuizScope = 'surah' | 'juz';
export type HifzQuizHideMode = 'partial' | 'full';
export type HifzQuizAnswerStyle = 'mcq' | 'type';

interface HifzQuizQuestion {
  id: string;
  surahNumber: number;
  surahName: string;
  juzNumber: number;
  ayahNumberInSurah: number;
  fullAyahText: string;
  previousAyahText: string | null;
  // For partial mode
  tokens: string[];
  maskedIndices: number[];
  targetText: string;
  hintFirstLetter: string;
  options: string[];
  correctOptionIndex: number;
}

interface HifzQuizViewProps {
  user: User | null;
  lastRead: LastReadPosition;
  surahList: SurahMeta[];
  achievementRecord: HifzQuizAchievementRecord;
  onUpdateAchievementRecord: (next: HifzQuizAchievementRecord) => void;
  onLocalPointsEarned?: (deltaPoints: number, isWin: boolean) => void;
  onHifzQuizCompleted?: () => void;
  onOpenSurah: (surahNumber: number, ayahNumber?: number) => void;
  onOpenCertificate?: (cert: CertificateData) => void;
  onShowToast: (msg: string) => void;
}

const DEFAULT_FALLBACK_WORDS = [
  'ٱللَّهُ',
  'ٱلرَّحْمَٰنِ',
  'ٱلْعَلِيمُ',
  'ٱلْحَكِيمُ',
  'ٱلْمُؤْمِنِينَ',
  'ٱلصَّٰلِحَٰتِ',
  'يَعْلَمُونَ',
  'تَتَّقُونَ',
];

function isPureWaqfOrSymbol(token: string): boolean {
  const stripped = token
    .replace(/[\u06D6-\u06ED۞۩۝﴿﴾،؛؟.,!]/g, '')
    .trim();
  return stripped.length === 0;
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function cleanAyahDisplay(
  text: string,
  surahNumber: number,
  ayahNumberInSurah: number
): string {
  return stripLeadingBismillah(text, surahNumber, ayahNumberInSurah).trim();
}

export const HifzQuizView: React.FC<HifzQuizViewProps> = ({
  user,
  lastRead,
  surahList,
  achievementRecord,
  onUpdateAchievementRecord,
  onLocalPointsEarned,
  onHifzQuizCompleted,
  onOpenSurah,
  onOpenCertificate,
  onShowToast,
}) => {
  // Setup Configuration
  const [scopeType, setScopeType] = useState<HifzQuizScope>('surah');
  const [selectedSurah, setSelectedSurah] = useState<number>(
    () => lastRead.surahNumber || 1
  );
  const [selectedJuz, setSelectedJuz] = useState<number>(
    () => lastRead.juz || 30
  );
  const [hideMode, setHideMode] = useState<HifzQuizHideMode>('partial');
  const [answerStyle, setAnswerStyle] = useState<HifzQuizAnswerStyle>('mcq');
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [showTestedDetails, setShowTestedDetails] = useState(false);

  // Active Quiz Runtime State
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<HifzQuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [wasCorrect, setWasCorrect] = useState<boolean | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [typedInput, setTypedInput] = useState('');
  const [hintUsed, setHintUsed] = useState(false);
  const [fullRevealedForSelfCheck, setFullRevealedForSelfCheck] =
    useState(false);

  // Round Scoring State
  const [roundPoints, setRoundPoints] = useState(0);
  const [roundCorrect, setRoundCorrect] = useState(0);
  const [roundStreak, setRoundStreak] = useState(0);
  const [roundBestStreak, setRoundBestStreak] = useState(0);
  const [lastPointsDelta, setLastPointsDelta] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);
  const [activeScopeLabel, setActiveScopeLabel] = useState('');

  const activeQuestion = questions[currentIndex] ?? null;

  const surahMap = useMemo(() => {
    const map = new Map<number, SurahMeta>();
    for (const s of surahList) {
      map.set(s.number, s);
    }
    return map;
  }, [surahList]);

  const accuracyPct = useMemo(() => {
    if (achievementRecord.totalQuestionsAnswered === 0) return 0;
    return Math.round(
      (achievementRecord.totalCorrect /
        achievementRecord.totalQuestionsAnswered) *
        100
    );
  }, [
    achievementRecord.totalCorrect,
    achievementRecord.totalQuestionsAnswered,
  ]);

  const buildQuizQuestions = (
    ayahs: AyahItem[],
    fallbackSurahMeta?: SurahMeta
  ): HifzQuizQuestion[] => {
    const normalizedAyahs = ayahs.map((a, idx) => {
      const sNum = a.surah?.number ?? fallbackSurahMeta?.number ?? selectedSurah;
      const sName =
        a.surah?.name ??
        fallbackSurahMeta?.name ??
        surahMap.get(sNum)?.name ??
        `سورة ${toArabicDigits(sNum)}`;
      const cleaned = cleanAyahDisplay(a.text, sNum, a.numberInSurah);
      const prevAyah = idx > 0 ? ayahs[idx - 1] : null;
      const prevClean = prevAyah
        ? cleanAyahDisplay(
            prevAyah.text,
            prevAyah.surah?.number ?? sNum,
            prevAyah.numberInSurah
          )
        : null;

      return {
        raw: a,
        surahNumber: sNum,
        surahName: sName,
        juzNumber: a.juz || (scopeType === 'juz' ? selectedJuz : 1),
        cleanedText: cleaned,
        previousText: prevClean,
      };
    });

    // Pool of clean Arabic words across all ayahs in the scope for partial-mode distractors
    const wordPool: string[] = [];
    const wordPoolNormSet = new Set<string>();
    for (const item of normalizedAyahs) {
      const rawTokens = item.cleanedText.split(/\s+/).filter(Boolean);
      for (const tok of rawTokens) {
        if (isPureWaqfOrSymbol(tok)) continue;
        const norm = normalizeArabicForSearch(tok);
        if (norm.length >= 2 && !wordPoolNormSet.has(norm)) {
          wordPoolNormSet.add(norm);
          wordPool.push(tok);
        }
      }
    }

    // Pool of candidate ayahs
    const eligible = normalizedAyahs.filter((item) => {
      const realWords = item.cleanedText
        .split(/\s+/)
        .filter((t) => t && !isPureWaqfOrSymbol(t));
      return realWords.length >= 2;
    });

    if (eligible.length === 0) return [];

    const selectedItems = shuffleArray(eligible).slice(
      0,
      Math.min(questionCount, eligible.length)
    );

    return selectedItems.map((item, qIdx) => {
      const tokens = item.cleanedText.split(/\s+/).filter(Boolean);
      const candidateTokenIndices = tokens
        .map((tok, i) => ({ tok, i }))
        .filter(
          ({ tok }) =>
            !isPureWaqfOrSymbol(tok) &&
            normalizeArabicForSearch(tok).length >= 2
        )
        .map(({ i }) => i);

      const safeIndices =
        candidateTokenIndices.length > 0 ? candidateTokenIndices : [0];

      // Hide 1 word for short verses, or 2 consecutive words for longer verses in partial mode
      let maskedIndices: number[] = [];
      if (hideMode === 'partial') {
        if (safeIndices.length >= 7) {
          const pos = Math.floor(
            Math.random() * Math.max(1, safeIndices.length - 1)
          );
          const firstIdx = safeIndices[pos];
          const secondIdx = safeIndices[pos + 1];
          if (secondIdx === firstIdx + 1) {
            maskedIndices = [firstIdx, secondIdx];
          } else {
            maskedIndices = [firstIdx];
          }
        } else {
          const picked =
            safeIndices[Math.floor(Math.random() * safeIndices.length)];
          maskedIndices = [picked];
        }
      }

      const targetText =
        hideMode === 'partial'
          ? maskedIndices.map((idx) => tokens[idx]).join(' ')
          : item.cleanedText;

      const normalizedTarget = normalizeArabicForSearch(targetText);
      const hintFirstLetter = normalizedTarget.charAt(0) || targetText.charAt(0);

      let options: string[] = [];
      let correctOptionIndex = 0;

      if (hideMode === 'partial') {
        const distractors: string[] = [];
        const usedNorms = new Set<string>([normalizedTarget]);

        if (maskedIndices.length === 2) {
          // Build 2-word distractor phrases from other ayahs or pairs in wordPool
          const shuffledPool = shuffleArray(wordPool);
          for (let i = 0; i < shuffledPool.length - 1 && distractors.length < 3; i++) {
            const pair = `${shuffledPool[i]} ${shuffledPool[i + 1]}`;
            const normPair = normalizeArabicForSearch(pair);
            if (!usedNorms.has(normPair)) {
              usedNorms.add(normPair);
              distractors.push(pair);
            }
          }
        }

        const shuffledWords = shuffleArray([
          ...wordPool,
          ...DEFAULT_FALLBACK_WORDS,
        ]);
        for (const w of shuffledWords) {
          if (distractors.length >= 3) break;
          const normW = normalizeArabicForSearch(w);
          if (normW.length >= 2 && !usedNorms.has(normW)) {
            usedNorms.add(normW);
            distractors.push(w);
          }
        }

        const combined = shuffleArray([targetText, ...distractors.slice(0, 3)]);
        options = combined;
        correctOptionIndex = combined.indexOf(targetText);
      } else {
        // Full Ayah hidden mode: pick 3 distinct ayah texts as distractors
        const otherAyahs = shuffleArray(
          normalizedAyahs.filter(
            (other) =>
              normalizeArabicForSearch(other.cleanedText) !== normalizedTarget &&
              other.cleanedText.length > 0
          )
        );
        const distractors: string[] = [];
        const usedNorms = new Set<string>([normalizedTarget]);

        for (const other of otherAyahs) {
          if (distractors.length >= 3) break;
          const normOther = normalizeArabicForSearch(other.cleanedText);
          if (!usedNorms.has(normOther)) {
            usedNorms.add(normOther);
            distractors.push(other.cleanedText);
          }
        }

        while (distractors.length < 3) {
          const fallbackPhrase = `﴿ ${
            DEFAULT_FALLBACK_WORDS[distractors.length % DEFAULT_FALLBACK_WORDS.length]
          } ... ﴾`;
          distractors.push(fallbackPhrase);
        }

        const combined = shuffleArray([targetText, ...distractors.slice(0, 3)]);
        options = combined;
        correctOptionIndex = combined.indexOf(targetText);
      }

      return {
        id: `hq_${item.surahNumber}_${item.raw.numberInSurah}_${qIdx}`,
        surahNumber: item.surahNumber,
        surahName: item.surahName,
        juzNumber: item.juzNumber,
        ayahNumberInSurah: item.raw.numberInSurah,
        fullAyahText: item.cleanedText,
        previousAyahText: item.previousText,
        tokens,
        maskedIndices,
        targetText,
        hintFirstLetter,
        options,
        correctOptionIndex,
      };
    });
  };

  const handleStartQuiz = async () => {
    setLoadingQuiz(true);
    setLoadError(null);
    try {
      let generated: HifzQuizQuestion[] = [];
      let label = '';

      if (scopeType === 'surah') {
        const loaded = await fetchSurahWithTafsir(selectedSurah, 'ar.muyassar');
        generated = buildQuizQuestions(loaded.ayahs, loaded.meta);
        label = loaded.meta.name;
      } else {
        const ayahs = await fetchJuzAyahs(selectedJuz);
        generated = buildQuizQuestions(ayahs);
        const juzInfo = JUZ_LIST.find((j) => j.number === selectedJuz);
        label = juzInfo ? juzInfo.name : `الجزء ${toArabicDigits(selectedJuz)}`;
      }

      if (generated.length === 0) {
        setLoadError('تعذر توليد أسئلة لهذا الاختيار، جرّب سورة أو جزءاً آخر.');
        return;
      }

      setActiveScopeLabel(label);
      setQuestions(generated);
      setCurrentIndex(0);
      setAnswered(false);
      setWasCorrect(null);
      setSelectedOption(null);
      setTypedInput('');
      setHintUsed(false);
      setFullRevealedForSelfCheck(false);
      setRoundPoints(0);
      setRoundCorrect(0);
      setRoundStreak(0);
      setRoundBestStreak(0);
      setLastPointsDelta(0);
      setQuizFinished(false);
    } catch (err) {
      setLoadError(
        err instanceof Error
          ? err.message
          : 'تعذر تحميل الآيات لبدء الاختبار، تأكد من الاتصال بالإنترنت أو التحميل المسبق.'
      );
    } finally {
      setLoadingQuiz(false);
    }
  };

  const recordAnswerOutcome = (isCorrect: boolean, customPoints?: number) => {
    if (answered || !activeQuestion) return;
    setAnswered(true);
    setWasCorrect(isCorrect);

    if (isCorrect) {
      const nextStreak = roundStreak + 1;
      const base =
        customPoints ?? (hideMode === 'full' ? 15 : 10);
      const streakBonus = nextStreak >= 2 ? 5 : 0;
      const hintPenalty = hintUsed ? 3 : 0;
      const earned = Math.max(4, base + streakBonus - hintPenalty);

      setRoundPoints((p) => p + earned);
      setRoundCorrect((c) => c + 1);
      setRoundStreak(nextStreak);
      setRoundBestStreak((b) => Math.max(b, nextStreak));
      setLastPointsDelta(earned);
    } else {
      setRoundStreak(0);
      setLastPointsDelta(0);
    }
  };

  const handleSelectOption = (idx: number) => {
    if (answered || !activeQuestion) return;
    setSelectedOption(idx);
    const isCorrect = idx === activeQuestion.correctOptionIndex;
    recordAnswerOutcome(isCorrect);
  };

  const handleCheckTypedAnswer = (e: React.FormEvent) => {
    e.preventDefault();
    if (answered || !activeQuestion) return;

    const userNorm = normalizeArabicForSearch(typedInput);
    if (!userNorm) {
      onShowToast('اكتب إجابتك أولاً ثم اضغط تحقق');
      return;
    }

    const targetNorm = normalizeArabicForSearch(activeQuestion.targetText);

    if (hideMode === 'partial') {
      const isMatch = userNorm === targetNorm;
      recordAnswerOutcome(isMatch);
    } else {
      // In full-ayah typing mode, accept full match OR matching the first 2-3 words cleanly
      const targetWords = targetNorm.split(/\s+/).filter(Boolean);
      const minWordsToMatch = Math.min(3, targetWords.length);
      const requiredPrefix = targetWords.slice(0, minWordsToMatch).join(' ');
      const isMatch =
        userNorm === targetNorm ||
        (userNorm.length >= requiredPrefix.length &&
          targetNorm.startsWith(userNorm));
      recordAnswerOutcome(isMatch);
    }
  };

  const handleNextQuestion = () => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((i) => i + 1);
      setAnswered(false);
      setWasCorrect(null);
      setSelectedOption(null);
      setTypedInput('');
      setHintUsed(false);
      setFullRevealedForSelfCheck(false);
      setLastPointsDelta(0);
      return;
    }

    // Complete Quiz & Update Achievement Record
    setQuizFinished(true);
    const totalQ = questions.length;
    const pct = totalQ > 0 ? Math.round((roundCorrect / totalQ) * 100) : 0;
    const isPass = pct >= 60;
    const completionBonus = isPass ? 10 : 0;
    const totalAwarded = roundPoints + completionBonus;
    if (completionBonus > 0) {
      setRoundPoints(totalAwarded);
    }

    const testedSurahsSet = new Set(achievementRecord.testedSurahs);
    const testedJuzsSet = new Set(achievementRecord.testedJuzs);
    for (const q of questions) {
      testedSurahsSet.add(q.surahNumber);
      if (q.juzNumber >= 1 && q.juzNumber <= 30) {
        testedJuzsSet.add(q.juzNumber);
      }
    }
    if (scopeType === 'surah') {
      testedSurahsSet.add(selectedSurah);
    } else {
      testedJuzsSet.add(selectedJuz);
    }

    const nextRecord: HifzQuizAchievementRecord = {
      totalPoints: achievementRecord.totalPoints + totalAwarded,
      quizzesCompleted: achievementRecord.quizzesCompleted + 1,
      totalQuestionsAnswered:
        achievementRecord.totalQuestionsAnswered + totalQ,
      totalCorrect: achievementRecord.totalCorrect + roundCorrect,
      bestScorePct: Math.max(achievementRecord.bestScorePct, pct),
      bestStreak: Math.max(achievementRecord.bestStreak, roundBestStreak),
      testedSurahs: Array.from(testedSurahsSet).sort((a, b) => a - b),
      testedJuzs: Array.from(testedJuzsSet).sort((a, b) => a - b),
      lastTestedLabel: activeScopeLabel,
      updatedAt: Date.now(),
    };

    onUpdateAchievementRecord(nextRecord);
    onLocalPointsEarned?.(totalAwarded, isPass);
    onHifzQuizCompleted?.();

    if (user && totalAwarded > 0) {
      const roundKey = `hifzquiz_${scopeType}_${
        scopeType === 'surah' ? selectedSurah : selectedJuz
      }_${Date.now()}`;
      awardCompetitionPoints({
        user,
        pointsEarned: Math.min(250, totalAwarded),
        isWin: isPass,
        bestStreak: roundBestStreak,
        roundKey,
      })
        .then((res) => {
          if (res.awarded) {
            onShowToast(
              `تم تحديث سجل إنجاز الحفظ وإضافة +${toArabicDigits(res.deltaPoints)} نقطة للوحة الصدارة`
            );
          }
        })
        .catch((err) => {
          console.error('Failed to sync Hifz quiz points:', err);
          onShowToast(
            `تم حفظ نقاط الحفظ محلياً (+${toArabicDigits(totalAwarded)})؛ تعذر المزامنة مع لوحة الصدارة الآن`
          );
        });
    } else {
      onShowToast(
        `تم تحديث سجل إنجاز الحفظ وإضافة +${toArabicDigits(totalAwarded)} نقطة`
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Achievement Summary Header (سجل إنجاز الحفظ) */}
      <section className="rounded-3xl ios-glass-card p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#9A742E] dark:text-amber-400">
              <Sparkles className="w-3.5 h-3.5" />
              <span>سجل الإنجاز في اختبار الحفظ</span>
            </div>
            <h2 className="font-amiri text-2xl font-bold text-stone-900 dark:text-stone-100">
              تثبيت حفظ القرآن الكريم بالاختبار الذكي
            </h2>
          </div>

          <button
            type="button"
            onClick={() => setShowTestedDetails((prev) => !prev)}
            className="ios-spring min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded-xl ios-glass-input text-xs font-medium text-[#14532D] dark:text-emerald-300"
          >
            <Layers className="w-4 h-4" />
            <span>
              {showTestedDetails
                ? 'إخفاء السور والأجزاء المختبرة'
                : 'عرض السور والأجزاء المختبرة'}
            </span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="rounded-2xl ios-glass-input p-3.5 space-y-1">
            <div className="text-xs text-stone-500 dark:text-stone-400">
              نقاط الحفظ التراكمية
            </div>
            <div className="text-xl font-bold text-[#14532D] dark:text-emerald-300 tabular-nums">
              {toArabicDigits(achievementRecord.totalPoints)} نقطة
            </div>
          </div>

          <div className="rounded-2xl ios-glass-input p-3.5 space-y-1">
            <div className="text-xs text-stone-500 dark:text-stone-400">
              الاختبارات والدقة
            </div>
            <div className="text-xl font-bold text-stone-900 dark:text-stone-100 tabular-nums">
              {toArabicDigits(achievementRecord.quizzesCompleted)} ({toArabicDigits(accuracyPct)}٪)
            </div>
          </div>

          <div className="rounded-2xl ios-glass-input p-3.5 space-y-1">
            <div className="text-xs text-stone-500 dark:text-stone-400">
              السور المختبرة
            </div>
            <div className="text-xl font-bold text-[#9A742E] dark:text-amber-400 tabular-nums">
              {toArabicDigits(achievementRecord.testedSurahs.length)} /{' '}
              {toArabicDigits(114)}
            </div>
          </div>

          <div className="rounded-2xl ios-glass-input p-3.5 space-y-1">
            <div className="text-xs text-stone-500 dark:text-stone-400">
              أعلى سلسلة إتقان
            </div>
            <div className="text-xl font-bold text-stone-900 dark:text-stone-100 tabular-nums">
              {toArabicDigits(achievementRecord.bestStreak)} إجابات
            </div>
          </div>
        </div>

        {showTestedDetails && (
          <div className="pt-3 border-t border-stone-200/70 dark:border-stone-800/70 space-y-3 text-xs">
            <div>
              <div className="font-semibold text-stone-700 dark:text-stone-300 mb-2">
                السور التي تم اختبارها ({toArabicDigits(achievementRecord.testedSurahs.length)}):
              </div>
              {achievementRecord.testedSurahs.length === 0 ? (
                <p className="text-stone-500 dark:text-stone-400">
                  لم تُكمل اختبار أي سورة بعد. ابدأ أول جولة الآن!
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {achievementRecord.testedSurahs.map((sNum) => {
                    const meta = surahMap.get(sNum);
                    return (
                      <button
                        key={sNum}
                        type="button"
                        onClick={() => {
                          setScopeType('surah');
                          setSelectedSurah(sNum);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-[#14532D]/10 dark:bg-emerald-500/15 text-[#14532D] dark:text-emerald-300 font-medium hover:bg-[#14532D]/20 transition-colors"
                      >
                        {meta ? meta.name : `سورة ${toArabicDigits(sNum)}`}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <div className="font-semibold text-stone-700 dark:text-stone-300 mb-2">
                الأجزاء التي تم اختبارها ({toArabicDigits(achievementRecord.testedJuzs.length)} / ٣٠):
              </div>
              {achievementRecord.testedJuzs.length === 0 ? (
                <p className="text-stone-500 dark:text-stone-400">
                  لم يتم تسجيل اختبارات في الأجزاء بعد.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {achievementRecord.testedJuzs.map((jNum) => (
                    <button
                      key={jNum}
                      type="button"
                      onClick={() => {
                        setScopeType('juz');
                        setSelectedJuz(jNum);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-[#9A742E]/15 dark:bg-amber-500/15 text-[#9A742E] dark:text-amber-300 font-medium tabular-nums"
                    >
                      الجزء {toArabicDigits(jNum)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ==================== VIEW A: SETUP PANEL ==================== */}
      {questions.length === 0 ? (
        <section className="rounded-3xl ios-glass-card p-6 sm:p-8 space-y-6">
          <div className="space-y-1">
            <h3 className="font-amiri text-2xl font-bold text-stone-900 dark:text-stone-100">
              إعداد اختبار الحفظ
            </h3>
            <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400">
              اختر السورة أو الجزء، وحدد طريقة إخفاء الآية لاختبار قوة حفظك وتحديث رصيدك
            </p>
          </div>

          {/* 1. Scope Selector (Surah vs Juz) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2.5">
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300">
                نطاق الاختبار:
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setScopeType('surah')}
                  className={`ios-spring min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                    scopeType === 'surah'
                      ? 'bg-[#14532D] dark:bg-emerald-700 text-[#FBF8F1] border-transparent'
                      : 'ios-glass-input text-stone-700 dark:text-stone-200 border-transparent'
                  }`}
                >
                  اختبار بسورة
                </button>
                <button
                  type="button"
                  onClick={() => setScopeType('juz')}
                  className={`ios-spring min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                    scopeType === 'juz'
                      ? 'bg-[#14532D] dark:bg-emerald-700 text-[#FBF8F1] border-transparent'
                      : 'ios-glass-input text-stone-700 dark:text-stone-200 border-transparent'
                  }`}
                >
                  اختبار بجزء
                </button>
              </div>
            </div>

            <div className="space-y-2.5">
              {scopeType === 'surah' ? (
                <>
                  <label
                    htmlFor="hifz-surah-select"
                    className="block text-xs font-semibold text-stone-700 dark:text-stone-300"
                  >
                    اختر السورة (١ - ١١٤):
                  </label>
                  <select
                    id="hifz-surah-select"
                    value={selectedSurah}
                    onChange={(e) => setSelectedSurah(Number(e.target.value))}
                    className="w-full min-h-[44px] px-4 py-2.5 rounded-xl ios-glass-input text-sm font-medium text-stone-900 dark:text-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
                  >
                    {surahList.length > 0
                      ? surahList.map((s) => (
                          <option key={s.number} value={s.number}>
                            {toArabicDigits(s.number)}. {s.name} ({toArabicDigits(s.numberOfAyahs)} آية)
                          </option>
                        ))
                      : Array.from({ length: 114 }, (_, i) => i + 1).map(
                          (num) => (
                            <option key={num} value={num}>
                              سورة رقم {toArabicDigits(num)}
                            </option>
                          )
                        )}
                  </select>
                </>
              ) : (
                <>
                  <label
                    htmlFor="hifz-juz-select"
                    className="block text-xs font-semibold text-stone-700 dark:text-stone-300"
                  >
                    اختر الجزء (١ - ٣٠):
                  </label>
                  <select
                    id="hifz-juz-select"
                    value={selectedJuz}
                    onChange={(e) => setSelectedJuz(Number(e.target.value))}
                    className="w-full min-h-[44px] px-4 py-2.5 rounded-xl ios-glass-input text-sm font-medium text-stone-900 dark:text-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
                  >
                    {JUZ_LIST.map((j) => (
                      <option key={j.number} value={j.number}>
                        {toArabicDigits(j.number)}. {j.name} — يبدأ من {j.startSurah}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>
          </div>

          {/* 2. Hide Mode (Partial Words vs Complete Ayah) */}
          <div className="space-y-2.5">
            <div className="text-xs font-semibold text-stone-700 dark:text-stone-300">
              نمط عرض الآية والإخفاء:
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setHideMode('partial')}
                className={`ios-spring text-right p-5 rounded-2xl border transition-all space-y-1.5 ${
                  hideMode === 'partial'
                    ? 'bg-[#14532D]/10 dark:bg-emerald-500/15 border-[#14532D] dark:border-emerald-400'
                    : 'ios-glass-input border-transparent hover:border-stone-300 dark:hover:border-stone-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-base font-bold text-stone-900 dark:text-stone-100">
                    إخفاء بعض الكلمات من الآية
                  </span>
                  <EyeOff className="w-4 h-4 text-[#14532D] dark:text-emerald-300 shrink-0" />
                </div>
                <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
                  تظهر الآية بالرسم العثماني مع إخفاء كلمة أو كلمتين لتُكمل الفراغ الصحيح (+١٠ نقاط لكل إجابة)
                </p>
              </button>

              <button
                type="button"
                onClick={() => setHideMode('full')}
                className={`ios-spring text-right p-5 rounded-2xl border transition-all space-y-1.5 ${
                  hideMode === 'full'
                    ? 'bg-[#14532D]/10 dark:bg-emerald-500/15 border-[#14532D] dark:border-emerald-400'
                    : 'ios-glass-input border-transparent hover:border-stone-300 dark:hover:border-stone-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-base font-bold text-stone-900 dark:text-stone-100">
                    إخفاء الآية كاملة (التسميع الكامل)
                  </span>
                  <Eye className="w-4 h-4 text-[#9A742E] dark:text-amber-400 shrink-0" />
                </div>
                <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
                  تظهر الآية السابقة مع إخفاء الآية المطلوبة تماماً لاختبار الحفظ المتصل (+١٥ نقطة لكل إجابة)
                </p>
              </button>
            </div>
          </div>

          {/* 3. Answer Input Style + Question Count */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-stone-200/70 dark:border-stone-800/70">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                طريقة الإجابة:
              </span>
              <button
                type="button"
                onClick={() => setAnswerStyle('mcq')}
                className={`ios-spring min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold ${
                  answerStyle === 'mcq'
                    ? 'bg-[#14532D] dark:bg-emerald-700 text-[#FBF8F1]'
                    : 'ios-glass-input text-stone-700 dark:text-stone-200'
                }`}
              >
                <ListChecks className="w-4 h-4" />
                <span>اختيار من متعدد</span>
              </button>
              <button
                type="button"
                onClick={() => setAnswerStyle('type')}
                className={`ios-spring min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold ${
                  answerStyle === 'type'
                    ? 'bg-[#14532D] dark:bg-emerald-700 text-[#FBF8F1]'
                    : 'ios-glass-input text-stone-700 dark:text-stone-200'
                }`}
              >
                <Keyboard className="w-4 h-4" />
                <span>
                  {hideMode === 'partial'
                    ? 'كتابة الكلمة المخفية'
                    : 'تسميع كتابي أو شفهي'}
                </span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                عدد الآيات:
              </span>
              {[5, 8, 10].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setQuestionCount(num)}
                  className={`ios-spring min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold tabular-nums ${
                    questionCount === num
                      ? 'bg-[#14532D] dark:bg-emerald-700 text-[#FBF8F1]'
                      : 'ios-glass-input text-stone-700 dark:text-stone-200'
                  }`}
                >
                  {toArabicDigits(num)} آيات
                </button>
              ))}
            </div>
          </div>

          {loadError && (
            <div className="rounded-2xl bg-rose-500/10 border border-rose-500/30 p-4 text-xs sm:text-sm text-rose-700 dark:text-rose-300">
              {loadError}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              disabled={loadingQuiz}
              onClick={() => void handleStartQuiz()}
              className="ios-spring min-h-[44px] inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#14532D] hover:bg-[#114224] dark:bg-emerald-700 dark:hover:bg-emerald-600 text-[#FBF8F1] font-semibold text-sm disabled:opacity-60"
            >
              {loadingQuiz ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري تحضير الآيات...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span>ابدأ اختبار الحفظ</span>
                </>
              )}
            </button>
          </div>
        </section>
      ) : quizFinished ? (
        /* ==================== VIEW B: QUIZ SUMMARY & ACHIEVEMENT UPDATE ==================== */
        <section className="rounded-3xl ios-glass-card p-6 sm:p-10 text-center space-y-6">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-[#14532D]/12 dark:bg-emerald-500/20 flex items-center justify-center text-[#14532D] dark:text-emerald-300">
            <Trophy className="w-9 h-9" />
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold text-[#9A742E] dark:text-amber-400">
              {activeScopeLabel} ·{' '}
              {hideMode === 'partial' ? 'إخفاء الكلمات' : 'إخفاء الآية كاملة'}
            </div>
            <h3 className="font-amiri text-3xl font-bold text-stone-900 dark:text-stone-100">
              {roundCorrect / questions.length >= 0.8
                ? 'حفظٌ راسخ وإتقانٌ مبارك!'
                : roundCorrect / questions.length >= 0.5
                ? 'أحسنت! مراجعة موفقة وواصل التثبيت'
                : 'بداية طيبة! راجع الآيات في المصحف وجرّب مجدداً'}
            </h3>
            <p className="text-sm text-stone-600 dark:text-stone-300 tabular-nums">
              أصبت في {toArabicDigits(roundCorrect)} من أصل{' '}
              {toArabicDigits(questions.length)} آية · مجموع النقاط المكتسبة:{' '}
              <span className="font-bold text-[#14532D] dark:text-emerald-300">
                +{toArabicDigits(roundPoints)} نقطة
              </span>
            </p>
            <div className="inline-block rounded-2xl bg-[#14532D]/10 dark:bg-emerald-500/15 border border-[#14532D]/25 dark:border-emerald-400/25 px-4 py-2 text-xs font-semibold text-[#14532D] dark:text-emerald-300 tabular-nums">
              تم تحديث سجل الإنجاز: إجمالي نقاط الحفظ الآن{' '}
              {toArabicDigits(achievementRecord.totalPoints)} نقطة
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => void handleStartQuiz()}
              className="ios-spring min-h-[44px] inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#14532D] dark:bg-emerald-700 text-[#FBF8F1] text-sm font-medium"
            >
              <RefreshCw className="w-4 h-4" />
              <span>اختبار جديد في نفس النطاق</span>
            </button>

            {onOpenCertificate && (
              <button
                type="button"
                onClick={() =>
                  onOpenCertificate({
                    recipientName: user?.displayName || 'حافظ كتاب الله',
                    title: 'شهادة تثبيت وإتقان الحفظ القرآني',
                    achievementLabel: `لإتمام اختبار الحفظ في (${activeScopeLabel}) بتحقيق ${toArabicDigits(
                      roundCorrect
                    )} من ${toArabicDigits(questions.length)} آيات صحيحة.`,
                    points: roundPoints,
                    winsCount: achievementRecord.quizzesCompleted,
                    roundsCount: achievementRecord.quizzesCompleted,
                    periodLabel: activeScopeLabel,
                  })
                }
                className="ios-spring min-h-[44px] inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#9A742E] hover:bg-[#826023] text-white text-sm font-medium"
              >
                <Award className="w-4 h-4" />
                <span>استخراج شهادة الحفظ</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setQuestions([])}
              className="ios-spring min-h-[44px] px-4 py-2.5 rounded-xl ios-glass-input text-stone-800 dark:text-stone-200 text-sm font-medium"
            >
              اختيار سورة أو جزء آخر
            </button>
          </div>
        </section>
      ) : (
        /* ==================== VIEW C: ACTIVE HIFZ QUESTION CARD ==================== */
        activeQuestion && (
          <section className="rounded-3xl ios-glass-card p-6 sm:p-8 space-y-6">
            {/* Top Status & Progress */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-stone-200/70 dark:border-stone-800/70">
              <div className="flex flex-wrap items-center gap-2 text-xs text-stone-600 dark:text-stone-300 tabular-nums">
                <span className="font-bold text-[#14532D] dark:text-emerald-300">
                  الآية {toArabicDigits(currentIndex + 1)} من{' '}
                  {toArabicDigits(questions.length)}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {activeQuestion.surahName} — آية{' '}
                  {toArabicDigits(activeQuestion.ayahNumberInSurah)}
                </span>
                {roundStreak >= 2 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1 text-[#9A742E] dark:text-amber-400 font-semibold">
                      <Flame className="w-3.5 h-3.5" />
                      سلسلة {toArabicDigits(roundStreak)} إجابات
                    </span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-3 text-xs font-semibold tabular-nums">
                <span className="text-[#14532D] dark:text-emerald-300">
                  نقاط الجولة: {toArabicDigits(roundPoints)}
                </span>
                <button
                  type="button"
                  onClick={() => setQuestions([])}
                  className="text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 font-normal"
                >
                  إنهاء
                </button>
              </div>
            </div>

            <div className="h-1.5 w-full rounded-full bg-stone-200/80 dark:bg-stone-800/80 overflow-hidden">
              <div
                className="h-full bg-[#14532D] dark:bg-emerald-500 transition-[width] duration-300"
                style={{
                  width: `${Math.round(
                    ((currentIndex + 1) / questions.length) * 100
                  )}%`,
                }}
              />
            </div>

            {/* Verse Display Area */}
            {hideMode === 'partial' ? (
              <div className="space-y-3">
                <div className="text-xs font-medium text-stone-500 dark:text-stone-400">
                  أكمل الكلمة الناقصة في الآية الكريمة:
                </div>
                <div className="rounded-2xl ios-glass-input p-5 sm:p-7 font-quran text-2xl sm:text-3xl leading-[2.3] text-[#1C1917] dark:text-[#F2EFE8]">
                  <span>﴿ </span>
                  {activeQuestion.tokens.map((tok, idx) => {
                    const isMasked = activeQuestion.maskedIndices.includes(idx);
                    if (!isMasked) {
                      return <span key={idx}>{tok} </span>;
                    }
                    if (answered) {
                      return (
                        <span
                          key={idx}
                          className={`inline-block px-2.5 py-0.5 mx-1 rounded-lg border ${
                            wasCorrect
                              ? 'bg-emerald-600/15 border-emerald-600 text-[#14532D] dark:text-emerald-300'
                              : 'bg-amber-500/15 border-amber-500 text-amber-800 dark:text-amber-300'
                          }`}
                        >
                          {tok}
                        </span>
                      );
                    }
                    return (
                      <span
                        key={idx}
                        className="inline-block min-w-[78px] text-center px-3 py-0.5 mx-1 rounded-lg border-2 border-dashed border-[#9A742E]/70 dark:border-amber-400/60 bg-[#9A742E]/10 dark:bg-amber-500/10 text-[#9A742E] dark:text-amber-300 font-sans text-base align-middle"
                      >
                        {hintUsed && idx === activeQuestion.maskedIndices[0]
                          ? `${activeQuestion.hintFirstLetter}...`
                          : '؟'}
                      </span>
                    );
                  })}
                  <span> ﴾</span>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {activeQuestion.previousAyahText ? (
                  <div className="rounded-2xl ios-glass-input p-4 sm:p-5 space-y-1.5">
                    <div className="text-xs font-semibold text-stone-500 dark:text-stone-400 tabular-nums">
                      الآية السابقة ({activeQuestion.surahName} — آية{' '}
                      {toArabicDigits(activeQuestion.ayahNumberInSurah - 1)}):
                    </div>
                    <p className="font-quran text-xl sm:text-2xl leading-[2.1] text-stone-700 dark:text-stone-200">
                      ﴿ {activeQuestion.previousAyahText} ﴾
                    </p>
                  </div>
                ) : (
                  <div className="rounded-2xl ios-glass-input p-4 text-xs font-semibold text-stone-600 dark:text-stone-300 tabular-nums">
                    مطلع {activeQuestion.surahName} — استذكر الآية رقم{' '}
                    {toArabicDigits(activeQuestion.ayahNumberInSurah)}
                  </div>
                )}

                <div
                  className={`rounded-2xl p-5 sm:p-7 border transition-all ${
                    answered || fullRevealedForSelfCheck
                      ? 'ios-glass-input border-emerald-600/40'
                      : 'bg-[#14532D]/8 dark:bg-emerald-950/35 border-dashed border-[#14532D]/35 dark:border-emerald-500/35'
                  }`}
                >
                  {answered || fullRevealedForSelfCheck ? (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-[#14532D] dark:text-emerald-300 tabular-nums">
                        الآية {toArabicDigits(activeQuestion.ayahNumberInSurah)}{' '}
                        من {activeQuestion.surahName}:
                      </div>
                      <p className="font-quran text-2xl sm:text-3xl leading-[2.3] text-[#1C1917] dark:text-[#F2EFE8]">
                        ﴿ {activeQuestion.fullAyahText} ﴾
                      </p>
                    </div>
                  ) : (
                    <div className="py-4 text-center space-y-2">
                      <EyeOff className="w-7 h-7 mx-auto text-[#9A742E] dark:text-amber-400" />
                      <div className="font-amiri text-xl font-bold text-stone-800 dark:text-stone-100 tabular-nums">
                        الآية رقم {toArabicDigits(activeQuestion.ayahNumberInSurah)}{' '}
                        مخفية لاختبار الحفظ الكامل
                      </div>
                      <p className="text-xs text-stone-500 dark:text-stone-400">
                        {hintUsed
                          ? `تلميح البداية: "${activeQuestion.fullAyahText
                              .split(/\s+/)
                              .slice(0, 2)
                              .join(' ')} ..."`
                          : 'سمّع الآية من حفظك أو اختر الإكمال الصحيح أدناه'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Optional Hint Button (before answering) */}
            {!answered && !hintUsed && (
              <div className="flex justify-start">
                <button
                  type="button"
                  onClick={() => setHintUsed(true)}
                  className="ios-spring min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl ios-glass-input text-xs font-medium text-[#9A742E] dark:text-amber-400"
                >
                  <HelpCircle className="w-4 h-4" />
                  <span>تلميح ({hideMode === 'partial' ? 'الحرف الأول' : 'بداية الآية'})</span>
                </button>
              </div>
            )}

            {/* Answer Controls */}
            {answerStyle === 'mcq' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {activeQuestion.options.map((opt, idx) => {
                  const isCorrect = idx === activeQuestion.correctOptionIndex;
                  const isPicked = idx === selectedOption;

                  let cardStyle =
                    'ios-glass-input hover:bg-white/75 dark:hover:bg-stone-800/75 border-transparent text-stone-800 dark:text-stone-200';
                  if (answered) {
                    if (isCorrect) {
                      cardStyle =
                        'bg-emerald-600/15 dark:bg-emerald-500/20 border-emerald-600 dark:border-emerald-400 text-[#14532D] dark:text-emerald-200 font-semibold';
                    } else if (isPicked) {
                      cardStyle =
                        'bg-rose-600/15 dark:bg-rose-500/20 border-rose-600 dark:border-rose-400 text-rose-800 dark:text-rose-200';
                    } else {
                      cardStyle =
                        'ios-glass-input opacity-60 text-stone-500 dark:text-stone-400';
                    }
                  }

                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={answered}
                      onClick={() => handleSelectOption(idx)}
                      className={`ios-spring min-h-[44px] text-right p-4 rounded-2xl border flex items-center justify-between gap-3 transition-all ${cardStyle}`}
                    >
                      <span className="font-quran text-lg sm:text-xl leading-relaxed">
                        {opt}
                      </span>
                      {answered && isCorrect && (
                        <CheckCircle2 className="w-5 h-5 text-emerald-700 dark:text-emerald-300 shrink-0" />
                      )}
                      {answered && isPicked && !isCorrect && (
                        <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              /* Typing or Self-Recitation Check */
              !answered && (
                <div className="space-y-4">
                  <form
                    onSubmit={handleCheckTypedAnswer}
                    className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
                  >
                    <input
                      type="text"
                      value={typedInput}
                      onChange={(e) => setTypedInput(e.target.value)}
                      placeholder={
                        hideMode === 'partial'
                          ? 'اكتب الكلمة المخفية هنا (بدون تشكيل)...'
                          : 'اكتب الكلمات الأولى من الآية المخفية (بدون تشكيل)...'
                      }
                      aria-label="إدخال نص التسميع"
                      className="flex-1 min-h-[44px] px-4 py-3 rounded-xl ios-glass-input text-sm sm:text-base text-stone-900 dark:text-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
                    />
                    <button
                      type="submit"
                      className="ios-spring min-h-[44px] px-5 py-3 rounded-xl bg-[#14532D] hover:bg-[#114224] dark:bg-emerald-700 text-[#FBF8F1] text-sm font-semibold whitespace-nowrap shrink-0"
                    >
                      تحقق من الإجابة
                    </button>
                  </form>

                  {hideMode === 'full' && !fullRevealedForSelfCheck && (
                    <div className="flex items-center justify-between gap-3 pt-1">
                      <span className="text-xs text-stone-500 dark:text-stone-400">
                        أو سمّعها شفهياً ثم اكشف الآية للتحقق الذاتي:
                      </span>
                      <button
                        type="button"
                        onClick={() => setFullRevealedForSelfCheck(true)}
                        className="ios-spring min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl ios-glass-input text-xs font-semibold text-[#14532D] dark:text-emerald-300"
                      >
                        <Eye className="w-4 h-4" />
                        <span>كشف الآية للتحقق</span>
                      </button>
                    </div>
                  )}

                  {hideMode === 'full' && fullRevealedForSelfCheck && (
                    <div className="flex flex-wrap items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => recordAnswerOutcome(false)}
                        className="ios-spring min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-600/15 text-rose-700 dark:text-rose-300 text-xs font-semibold"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>أحتاج مراجعتها لاحقاً</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => recordAnswerOutcome(true, 15)}
                        className="ios-spring min-h-[44px] inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#14532D] dark:bg-emerald-700 text-[#FBF8F1] text-xs font-semibold"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>أتممت التسميع بشكل صحيح (+١٥ نقطة)</span>
                      </button>
                    </div>
                  )}
                </div>
              )
            )}

            {/* Answer Feedback & Next Button */}
            {answered && (
              <div className="rounded-2xl bg-stone-100/80 dark:bg-stone-900/60 border border-stone-200/80 dark:border-stone-800 p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div
                    className={`text-sm font-bold flex items-center gap-2 ${
                      wasCorrect
                        ? 'text-[#14532D] dark:text-emerald-300'
                        : 'text-rose-700 dark:text-rose-300'
                    }`}
                  >
                    {wasCorrect ? (
                      <>
                        <CheckCircle2 className="w-5 h-5" />
                        <span>
                          أحسنت! إجابة صحيحة (+{toArabicDigits(lastPointsDelta)} نقطة)
                        </span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-5 h-5" />
                        <span>
                          الإجابة الصحيحة:{' '}
                          <span className="font-quran text-lg">
                            {activeQuestion.targetText}
                          </span>
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      onOpenSurah(
                        activeQuestion.surahNumber,
                        activeQuestion.ayahNumberInSurah
                      )
                    }
                    className="ios-spring min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl ios-glass-input text-xs font-medium text-[#14532D] dark:text-emerald-300"
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>مراجعة الآية في المصحف</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleNextQuestion}
                    className="ios-spring min-h-[44px] inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#14532D] dark:bg-emerald-700 text-[#FBF8F1] text-sm font-medium"
                  >
                    <span>
                      {currentIndex + 1 < questions.length
                        ? 'الآية التالية'
                        : 'عرض النتيجة وتحديث السجل'}
                    </span>
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </section>
        )
      )}
    </div>
  );
};
