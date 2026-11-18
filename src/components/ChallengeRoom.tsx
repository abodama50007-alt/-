import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Award,
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Crown,
  Link2,
  LogIn,
  Medal,
  MessageCircle,
  PlusCircle,
  Radio,
  RefreshCw,
  Send,
  Share2,
  Sparkles,
  Trash2,
  Trophy,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  CompetitionMode,
  getQuestionsByIds,
  selectSeededQuestions,
} from '../data/competitionsData';
import {
  advanceLiveRoomQuestion,
  awardCompetitionPoints,
  CompanionMessageRecord,
  CompanionRoomRecord,
  createCompanionRoom,
  deleteCompanionRoom,
  fetchMyCompanionRooms,
  getCurrentWeekKey,
  joinCompanionRoom,
  LeaderboardEntryRecord,
  normalizeRoomCode,
  sendRoomMessage,
  shareRoomAyah,
  startRoomRematch,
  submitLiveRoomAnswer,
  subscribeToCompanionRoom,
  subscribeToLeaderboard,
  subscribeToRoomMessages,
} from '../firebase';
import { LastReadPosition, SurahMeta } from '../types/quran';
import { toArabicDigits } from '../utils/arabic';
import { APP_DEFAULT_SHARE_TEXT, APP_SHARE_URL, shareNativeOrCopy } from '../utils/share';
import type { CertificateData } from './CertificateModal';

export interface ChallengeRoomProps {
  user: User | null;
  authLoading: boolean;
  lastRead: LastReadPosition;
  surahList: SurahMeta[];
  initialRoomCode?: string | null;
  onSignIn: () => Promise<void> | void;
  onOpenSurah: (surahNumber: number, ayahNumber?: number) => void;
  onOpenLeaderboard?: () => void;
  onOpenCertificate?: (cert: CertificateData) => void;
  onLocalPointsEarned?: (
    delta: number,
    isWin: boolean,
    isRoundComplete?: boolean
  ) => void;
  onShowToast: (msg: string) => void;
}

const ROOM_CODE_STORAGE_KEY = 'quran_active_room_code_v2';
const QUESTION_DURATION_SEC = 25;

const QUICK_NUDGES = [
  'السلام عليكم! مستعد للمنافسة الحية؟',
  'هيّا نبدأ ورد الحفظ الآن!',
  'ما شاء الله، بارك الله في حفظك وتثبيتك',
  'اللهم اجعل القرآن ربيع قلوبنا',
];

function getModeLabel(mode: CompetitionMode): string {
  if (mode === 'hifz') return 'حفظ كتاب الله';
  if (mode === 'sunnah') return 'السنة النبوية والسيرة';
  return 'شامل (القرآن والسنة)';
}

function buildInviteLink(roomCode: string): string {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}/?room=${encodeURIComponent(roomCode)}`;
}

export const ChallengeRoom: React.FC<ChallengeRoomProps> = ({
  user,
  authLoading,
  lastRead,
  surahList,
  initialRoomCode,
  onSignIn,
  onOpenSurah,
  onOpenLeaderboard,
  onOpenCertificate,
  onLocalPointsEarned,
  onShowToast,
}) => {
  const [newRoomTitle, setNewRoomTitle] = useState('مجلس مراجعة ومنافسة حية');
  const [newRoomMode, setNewRoomMode] = useState<CompetitionMode>('mixed');
  const [newRoomCount, setNewRoomCount] = useState<number>(6);
  const [joinCodeInput, setJoinCodeInput] = useState(() =>
    initialRoomCode ? normalizeRoomCode(initialRoomCode) : ''
  );
  const [activeRoomCode, setActiveRoomCode] = useState<string | null>(() => {
    try {
      return localStorage.getItem(ROOM_CODE_STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const [roomData, setRoomData] = useState<CompanionRoomRecord | null>(null);
  const [roomMessages, setRoomMessages] = useState<CompanionMessageRecord[]>([]);
  const [myRooms, setMyRooms] = useState<CompanionRoomRecord[]>([]);
  const [liveLeaderboard, setLiveLeaderboard] = useState<LeaderboardEntryRecord[]>([]);
  const [roomBusy, setRoomBusy] = useState(false);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [chatText, setChatText] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Optimistic local answer & countdown for active question
  const [pendingOption, setPendingOption] = useState<number | null>(null);
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [advancingQuestion, setAdvancingQuestion] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number>(QUESTION_DURATION_SEC);
  const [duelAwardBanner, setDuelAwardBanner] = useState<{
    roundKey: string;
    points: number;
    isWin: boolean;
    isTie: boolean;
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const autoJoinedCodeRef = useRef<string | null>(null);
  const awardedRoundKeyRef = useRef<string | null>(null);
  const timeoutSubmittedForIdxRef = useRef<number>(-1);

  useEffect(() => {
    if (initialRoomCode) {
      setJoinCodeInput(normalizeRoomCode(initialRoomCode));
    }
  }, [initialRoomCode]);

  useEffect(() => {
    try {
      if (activeRoomCode) {
        localStorage.setItem(ROOM_CODE_STORAGE_KEY, activeRoomCode);
      } else {
        localStorage.removeItem(ROOM_CODE_STORAGE_KEY);
      }
    } catch {
      // ignore
    }
  }, [activeRoomCode]);

  // Auto-join once when opened via invite URL (?room=CODE)
  useEffect(() => {
    const cleanInvite = initialRoomCode ? normalizeRoomCode(initialRoomCode) : '';
    if (
      !user ||
      cleanInvite.length < 6 ||
      autoJoinedCodeRef.current === cleanInvite ||
      activeRoomCode === cleanInvite
    ) {
      return;
    }
    autoJoinedCodeRef.current = cleanInvite;
    setRoomBusy(true);
    setRoomError(null);
    joinCompanionRoom(user, cleanInvite)
      .then((joined) => {
        setActiveRoomCode(joined.roomCode);
        setJoinCodeInput('');
        onShowToast(`تم الانضمام لغرفة التحدي: ${joined.roomCode}`);
      })
      .catch((err) => {
        setRoomError(err instanceof Error ? err.message : 'تعذر الانضمام لغرفة الدعوة');
      })
      .finally(() => {
        setRoomBusy(false);
      });
  }, [user, initialRoomCode, activeRoomCode, onShowToast]);

  // Load recent rooms
  useEffect(() => {
    if (!user) {
      setMyRooms([]);
      return;
    }
    let active = true;
    fetchMyCompanionRooms(user.uid)
      .then((list) => {
        if (active) setMyRooms(list);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [user, activeRoomCode]);

  // Real-time room, messages, AND live leaderboard subscriptions
  useEffect(() => {
    if (!user) {
      setLiveLeaderboard([]);
      return;
    }
    const unsubLb = subscribeToLeaderboard(
      (entries) => setLiveLeaderboard(entries),
      () => {},
      { period: 'weekly', maxEntries: 50 }
    );
    return () => unsubLb();
  }, [user]);

  useEffect(() => {
    if (!user || !activeRoomCode) {
      setRoomData(null);
      setRoomMessages([]);
      return;
    }
    setRoomError(null);
    const unsubRoom = subscribeToCompanionRoom(
      activeRoomCode,
      (room) => {
        setRoomData(room);
        if (!room) {
          setActiveRoomCode(null);
          onShowToast('تم إغلاق الغرفة من قِبل المنشئ');
        }
      },
      () => {
        setRoomError('تعذر الاتصال بالغرفة. تأكد من صلاحية الرمز أو إعادة المحاولة.');
      }
    );
    const unsubMsgs = subscribeToRoomMessages(
      activeRoomCode,
      (msgs) => {
        setRoomMessages(msgs);
      },
      () => {}
    );
    return () => {
      unsubRoom();
      unsubMsgs();
    };
  }, [user, activeRoomCode, onShowToast]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [roomMessages.length]);

  const roomQuestions = useMemo(
    () => (roomData ? getQuestionsByIds(roomData.questionIds) : []),
    [roomData]
  );

  const isHost = Boolean(user && roomData && roomData.hostUid === user.uid);
  const isGuest = Boolean(user && roomData && roomData.guestUid === user.uid);

  const syncedQIdx = roomData?.currentQuestionIndex ?? 0;
  const currentRoomQuestion = roomQuestions[syncedQIdx] ?? null;

  const myServerAnswer = roomData
    ? isHost
      ? roomData.hostAnswerForCurrent
      : roomData.guestAnswerForCurrent
    : -1;
  const friendServerAnswer = roomData
    ? isHost
      ? roomData.guestAnswerForCurrent
      : roomData.hostAnswerForCurrent
    : -1;

  const effectiveMyAnswer = myServerAnswer !== -1 ? myServerAnswer : pendingOption;
  const iHaveAnswered = effectiveMyAnswer !== null && effectiveMyAnswer !== -1;
  const friendHasAnswered = friendServerAnswer !== -1;
  const bothAnsweredCurrent =
    myServerAnswer !== -1 && friendServerAnswer !== -1;

  // Reset optimistic selection and rematch banner when round becomes active again
  useEffect(() => {
    setPendingOption(null);
    setAdvancingQuestion(false);
    timeoutSubmittedForIdxRef.current = -1;
    if (roomData?.status !== 'finished') {
      setDuelAwardBanner(null);
      awardedRoundKeyRef.current = null;
    }
  }, [roomData?.roomCode, syncedQIdx, roomData?.status]);

  // Synchronized countdown timer derived from Firestore questionStartedAtMs
  useEffect(() => {
    if (
      !user ||
      !roomData ||
      roomData.status !== 'active' ||
      !currentRoomQuestion ||
      bothAnsweredCurrent
    ) {
      return;
    }

    const computeRemaining = () => {
      const startedAt = roomData.questionStartedAtMs || Date.now();
      const elapsedSec = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
      return Math.max(0, QUESTION_DURATION_SEC - elapsedSec);
    };

    setSecondsLeft(computeRemaining());

    const timer = window.setInterval(() => {
      const rem = computeRemaining();
      setSecondsLeft(rem);
      if (
        rem <= 0 &&
        myServerAnswer === -1 &&
        pendingOption === null &&
        timeoutSubmittedForIdxRef.current !== syncedQIdx
      ) {
        timeoutSubmittedForIdxRef.current = syncedQIdx;
        void submitLiveRoomAnswer({
          roomCode: roomData.roomCode,
          user,
          questionIndex: syncedQIdx,
          optionIdx: -2,
          isCorrect: false,
        }).catch(() => {});
      }
    }, 500);

    return () => window.clearInterval(timer);
  }, [
    user,
    roomData,
    currentRoomQuestion,
    bothAnsweredCurrent,
    myServerAnswer,
    pendingOption,
    syncedQIdx,
  ]);

  // Auto-advance synchronized question cleanly 3.2s after BOTH players answer
  useEffect(() => {
    if (
      !user ||
      !roomData ||
      roomData.status !== 'active' ||
      !bothAnsweredCurrent ||
      !isHost
    ) {
      return;
    }
    const qIdxSnapshot = syncedQIdx;
    const roomCodeSnapshot = roomData.roomCode;
    const timer = window.setTimeout(() => {
      void advanceLiveRoomQuestion({
        roomCode: roomCodeSnapshot,
        expectedQuestionIndex: qIdxSnapshot,
      }).catch(() => {});
    }, 3200);
    return () => window.clearTimeout(timer);
  }, [user, roomData, bothAnsweredCurrent, isHost, syncedQIdx]);

  // Award match winner/tie/completion bonus ONCE when room reaches 'finished'
  useEffect(() => {
    if (!user || !roomData || roomData.status !== 'finished') return;
    if (!isHost && !isGuest) return;
    if (roomData.guestUid === '') return;

    const roundKey = `room_bonus_${roomData.roomCode}_${roomData.questionStartedAtMs}_${roomData.questionIds.join('_')}`;
    if (awardedRoundKeyRef.current === roundKey) return;
    awardedRoundKeyRef.current = roundKey;

    const myScore = isHost ? roomData.hostScore : roomData.guestScore;
    const friendScore = isHost ? roomData.guestScore : roomData.hostScore;
    const isWin = myScore > friendScore;
    const isTie = myScore === friendScore;
    const bonus = isWin ? 50 : isTie ? 25 : 15;

    awardCompetitionPoints({
      user,
      pointsEarned: bonus,
      isWin,
      roundKey,
    })
      .then((res) => {
        if (res.awarded) {
          onLocalPointsEarned?.(res.deltaPoints, isWin, true);
          setDuelAwardBanner({
            roundKey,
            points: res.deltaPoints,
            isWin,
            isTie,
          });
          onShowToast(
            isWin
              ? `مبارك الفوز! أُضيف +${toArabicDigits(res.deltaPoints)} نقطة مكافأة فوز للوحة الصدارة`
              : isTie
              ? `تعادل رائع! أُضيف +${toArabicDigits(res.deltaPoints)} نقطة للوحة الصدارة`
              : `أُضيف +${toArabicDigits(res.deltaPoints)} نقطة مكافأة إتمام الجولة للوحة الصدارة`
          );
        }
      })
      .catch((err) => {
        console.error('Failed to award duel bonus points:', err);
        awardedRoundKeyRef.current = null;
        onShowToast('تعذر حفظ نقاط الجولة في لوحة الصدارة السحابية حالياً');
      });
  }, [user, roomData, isHost, isGuest, onLocalPointsEarned, onShowToast]);

  const sharedSurahName = useMemo(() => {
    if (!roomData) return '';
    return (
      surahList.find((s) => s.number === roomData.sharedSurahNumber)?.name ??
      `سورة رقم ${toArabicDigits(roomData.sharedSurahNumber)}`
    );
  }, [roomData, surahList]);

  // Weekly live leaderboard slice synced via onSnapshot
  const currentWeekKey = getCurrentWeekKey();
  const liveWeeklyRankings = useMemo(() => {
    return liveLeaderboard
      .map((entry) => ({
        ...entry,
        weekScore: entry.weekKey === currentWeekKey ? entry.weeklyPoints : 0,
      }))
      .filter((e) => e.weekScore > 0)
      .sort((a, b) => {
        if (b.weekScore !== a.weekScore) return b.weekScore - a.weekScore;
        return b.totalPoints - a.totalPoints;
      })
      .slice(0, 6);
  }, [liveLeaderboard, currentWeekKey]);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setRoomBusy(true);
    setRoomError(null);
    try {
      const qs = selectSeededQuestions(newRoomMode, newRoomCount);
      const created = await createCompanionRoom({
        user,
        title: newRoomTitle,
        mode: newRoomMode,
        questionIds: qs.map((q) => q.id),
        sharedSurahNumber: lastRead.surahNumber,
        sharedAyahNumber: lastRead.ayahNumberInSurah,
      });
      setPendingOption(null);
      setActiveRoomCode(created.roomCode);
      onShowToast(`تم إنشاء غرفة التنافس الحي برمز: ${created.roomCode}`);
    } catch (err) {
      setRoomError(
        err instanceof Error ? err.message : 'تعذر إنشاء الغرفة، حاول مجدداً'
      );
    } finally {
      setRoomBusy(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const cleaned = normalizeRoomCode(joinCodeInput);
    if (cleaned.length < 6) {
      setRoomError('يرجى إدخال رمز الغرفة المكون من ٦ أحرف/أرقام');
      return;
    }
    setRoomBusy(true);
    setRoomError(null);
    try {
      const joined = await joinCompanionRoom(user, cleaned);
      setPendingOption(null);
      setActiveRoomCode(joined.roomCode);
      setJoinCodeInput('');
      onShowToast('تم الانضمام لغرفة التحدي الحية بنجاح!');
    } catch (err) {
      setRoomError(err instanceof Error ? err.message : 'تعذر الانضمام للغرفة');
    } finally {
      setRoomBusy(false);
    }
  };

  const handleCopyInviteCode = async () => {
    if (!roomData) return;
    try {
      await navigator.clipboard.writeText(roomData.roomCode);
      setCopiedCode(true);
      onShowToast(`تم نسخ رمز الدعوة: ${roomData.roomCode}`);
      window.setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      onShowToast(`رمز الدعوة: ${roomData.roomCode}`);
    }
  };

  const handleCopyInviteLink = async () => {
    if (!roomData) return;
    const link = buildInviteLink(roomData.roomCode);
    try {
      await navigator.clipboard.writeText(link);
      setCopiedLink(true);
      onShowToast('تم نسخ رابط الدعوة المباشر لمشاركته مع صديقك');
      window.setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      onShowToast(`رمز الدعوة: ${roomData.roomCode}`);
    }
  };

  const handleShareInvite = async () => {
    if (!roomData) return;
    const inviteLink = buildInviteLink(roomData.roomCode);
    const shareText = `أدعوك لمنافستي الآن مباشرة في حفظ القرآن الكريم والسنة النبوية!\nرمز الغرفة: ${roomData.roomCode}\nرابط الدخول المباشر: ${inviteLink}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'دعوة تحدٍ حي في المصحف الجامع',
          text: shareText,
          url: inviteLink,
        });
        return;
      } catch {
        // fallback to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(shareText);
      onShowToast('تم نسخ رسالة الدعوة والرمز والرابط لمشاركتها مع صديقك');
    } catch {
      onShowToast(`شارك الرمز مع صديقك: ${roomData.roomCode}`);
    }
  };

  const handleAnswerLiveQuestion = async (optionIdx: number) => {
    if (
      !user ||
      !roomData ||
      !currentRoomQuestion ||
      roomData.status !== 'active' ||
      iHaveAnswered ||
      submittingAnswer
    ) {
      return;
    }
    setPendingOption(optionIdx);
    setSubmittingAnswer(true);
    const isCorrect = optionIdx === currentRoomQuestion.correctIndex;
    try {
      const res = await submitLiveRoomAnswer({
        roomCode: roomData.roomCode,
        user,
        questionIndex: syncedQIdx,
        optionIdx,
        isCorrect,
      });
      if (res.submitted && res.pointsEarned > 0) {
        onLocalPointsEarned?.(res.pointsEarned, false, false);
        onShowToast(
          `+${toArabicDigits(res.pointsEarned)} نقطة! تم تحديث لوحة الصدارة فوراً`
        );
      }
    } catch {
      setPendingOption(null);
      onShowToast('تعذر إرسال إجابتك، تحقق من الاتصال');
    } finally {
      setSubmittingAnswer(false);
    }
  };

  const handleAdvanceQuestionNow = async () => {
    if (!roomData || !bothAnsweredCurrent || advancingQuestion) return;
    setAdvancingQuestion(true);
    try {
      await advanceLiveRoomQuestion({
        roomCode: roomData.roomCode,
        expectedQuestionIndex: syncedQIdx,
      });
    } catch {
      onShowToast('تعذر الانتقال للسؤال التالي، حاول مجدداً');
    } finally {
      setAdvancingQuestion(false);
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !roomData || !chatText.trim()) return;
    const msg = chatText.trim();
    setChatText('');
    try {
      await sendRoomMessage({
        roomCode: roomData.roomCode,
        user,
        kind: 'chat',
        text: msg,
        surahNumber: roomData.sharedSurahNumber,
        ayahNumber: roomData.sharedAyahNumber,
      });
    } catch {
      onShowToast('تعذر إرسال الرسالة');
    }
  };

  const handleSendNudge = async (text: string) => {
    if (!user || !roomData) return;
    try {
      await sendRoomMessage({
        roomCode: roomData.roomCode,
        user,
        kind: 'nudge',
        text,
        surahNumber: roomData.sharedSurahNumber,
        ayahNumber: roomData.sharedAyahNumber,
      });
    } catch {
      onShowToast('تعذر إرسال التحية');
    }
  };

  const handleShareCurrentReading = async () => {
    if (!user || !roomData) return;
    try {
      await shareRoomAyah({
        room: roomData,
        user,
        surahNumber: lastRead.surahNumber,
        surahName: lastRead.surahName,
        ayahNumber: lastRead.ayahNumberInSurah,
      });
      onShowToast('تمت مشاركة موضع قراءتك مع صديقك');
    } catch {
      onShowToast('تعذر مشاركة الآية');
    }
  };

  const handleRematch = async () => {
    if (!roomData || !isHost) return;
    const fresh = selectSeededQuestions(roomData.mode, roomData.questionIds.length || 6);
    try {
      setPendingOption(null);
      setDuelAwardBanner(null);
      await startRoomRematch({
        room: roomData,
        mode: roomData.mode,
        questionIds: fresh.map((q) => q.id),
      });
      onShowToast('بدأت جولة تنافس حي جديدة!');
    } catch {
      onShowToast('تعذر بدء جولة جديدة');
    }
  };

  const handleDeleteRoom = async (code: string) => {
    try {
      await deleteCompanionRoom(code);
      if (activeRoomCode === code) {
        setActiveRoomCode(null);
      }
      setMyRooms((prev) => prev.filter((r) => r.roomCode !== code));
      onShowToast('تم حذف الغرفة');
    } catch {
      onShowToast('تعذر حذف الغرفة');
    }
  };

  if (!user) {
    return (
      <div className="rounded-3xl ios-glass-card p-8 sm:p-12 text-center max-w-2xl mx-auto space-y-5">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-[#14532D]/12 dark:bg-emerald-500/20 flex items-center justify-center text-[#14532D] dark:text-emerald-300">
          <Users className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="font-amiri text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100">
            سجّل دخولك لبدء التنافس الحي مع صديقك
          </h2>
          <p className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
            {joinCodeInput
              ? `لديك دعوة للانضمام إلى الغرفة (${joinCodeInput}). سجّل دخولك عبر Google لبدء المنافسة المباشرة ومزامنة لوحة الصدارة فوراً.`
              : 'التنافس الحي في الغرفة ومزامنة الأسئلة والوقت وتحديث لوحة الصدارة لحظياً عبر Firestore يتطلب تسجيل الدخول بحساب Google.'}
          </p>
        </div>
        <button
          type="button"
          disabled={authLoading}
          onClick={() => void onSignIn()}
          className="ios-spring inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#14532D] hover:bg-[#114224] dark:bg-emerald-700 dark:hover:bg-emerald-600 text-[#FBF8F1] text-sm font-semibold whitespace-nowrap shrink-0 disabled:opacity-60"
        >
          <LogIn className="w-4 h-4" />
          <span>تسجيل الدخول عبر Google</span>
        </button>
      </div>
    );
  }

  if (!activeRoomCode || !roomData) {
    return (
      <div className="space-y-6">
        {roomError && (
          <div
            role="alert"
            className="rounded-2xl bg-rose-500/12 border border-rose-500/35 px-4 py-3 text-sm text-rose-800 dark:text-rose-200"
          >
            {roomError}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          {/* Create Room */}
          <form
            onSubmit={(e) => void handleCreateRoom(e)}
            className="rounded-3xl ios-glass-card p-6 sm:p-7 flex flex-col justify-between space-y-5"
          >
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#14532D]/12 dark:bg-emerald-500/20 flex items-center justify-center text-[#14532D] dark:text-emerald-300 shrink-0">
                  <PlusCircle className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-amiri text-2xl font-bold text-stone-900 dark:text-stone-100">
                    إنشاء غرفة تنافس حي
                  </h2>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    أنشئ الغرفة وشارك رمز الدعوة لتتنافس مع صديقك على نفس السؤال لحظة بلحظة
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="challenge-room-title"
                  className="block text-xs font-medium text-stone-700 dark:text-stone-300"
                >
                  اسم الغرفة أو المجلس
                </label>
                <input
                  id="challenge-room-title"
                  type="text"
                  maxLength={80}
                  value={newRoomTitle}
                  onChange={(e) => setNewRoomTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl ios-glass-input text-stone-900 dark:text-stone-100"
                />
              </div>

              <div className="space-y-2">
                <div className="text-xs font-medium text-stone-700 dark:text-stone-300">
                  مسار التنافس في الغرفة
                </div>
                <div className="flex flex-wrap gap-2">
                  {(['hifz', 'sunnah', 'mixed'] as CompetitionMode[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setNewRoomMode(m)}
                      className={`ios-spring px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 ${
                        newRoomMode === m
                          ? 'bg-[#14532D] dark:bg-emerald-700 text-[#FBF8F1]'
                          : 'ios-glass-input text-stone-700 dark:text-stone-200'
                      }`}
                    >
                      {getModeLabel(m)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-medium text-stone-700 dark:text-stone-300">
                  عدد أسئلة التحدي الحي
                </div>
                <div className="flex flex-wrap gap-2">
                  {[5, 8, 10].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewRoomCount(c)}
                      className={`ios-spring px-3.5 py-2 rounded-xl text-xs font-medium tabular-nums whitespace-nowrap shrink-0 ${
                        newRoomCount === c
                          ? 'bg-[#14532D] dark:bg-emerald-700 text-[#FBF8F1]'
                          : 'ios-glass-input text-stone-700 dark:text-stone-200'
                      }`}
                    >
                      {toArabicDigits(c)} أسئلة
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={roomBusy}
              className="ios-spring w-full py-3 rounded-xl bg-[#14532D] hover:bg-[#114224] dark:bg-emerald-700 dark:hover:bg-emerald-600 text-[#FBF8F1] font-semibold text-sm disabled:opacity-60 whitespace-nowrap"
            >
              {roomBusy ? 'جاري إنشاء الغرفة وتوليد الرمز...' : 'إنشاء الغرفة وتوليد رمز الدعوة'}
            </button>
          </form>

          {/* Join Room */}
          <form
            onSubmit={(e) => void handleJoinRoom(e)}
            className="rounded-3xl ios-glass-card p-6 sm:p-7 flex flex-col justify-between space-y-5"
          >
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center text-[#9A742E] dark:text-amber-400 shrink-0">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-amiri text-2xl font-bold text-stone-900 dark:text-stone-100">
                    الانضمام عبر رمز الدعوة
                  </h2>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    أدخل الرمز الذي شاركه معك صديقك لتبدأ المسابقة الحية بينكما فوراً
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="challenge-join-code"
                  className="block text-xs font-medium text-stone-700 dark:text-stone-300"
                >
                  رمز الدعوة (٦ إلى ١٢ حرفاً أو رقماً)
                </label>
                <input
                  id="challenge-join-code"
                  type="text"
                  dir="ltr"
                  maxLength={12}
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(normalizeRoomCode(e.target.value))}
                  placeholder="مثال: KRM74P"
                  className="w-full px-4 py-3 text-center tracking-[0.28em] font-mono text-lg font-bold rounded-xl ios-glass-input text-stone-900 dark:text-stone-100 uppercase"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={roomBusy || joinCodeInput.length < 6}
              className="ios-spring w-full py-3 rounded-xl bg-[#9A742E] hover:bg-[#826023] dark:bg-amber-600 dark:hover:bg-amber-500 text-white font-semibold text-sm disabled:opacity-50 whitespace-nowrap"
            >
              {roomBusy ? 'جاري الاتصال بالغرفة...' : 'دخول الغرفة وبدء التحدي الحي'}
            </button>
          </form>
        </div>

        {/* Previous / Active Rooms */}
        {myRooms.length > 0 && (
          <section className="rounded-3xl ios-glass-card p-6 space-y-4">
            <h3 className="font-amiri text-xl font-bold text-stone-900 dark:text-stone-100">
              غرف التحدي النشطة والسابقة ({toArabicDigits(myRooms.length)})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {myRooms.map((r) => (
                <div
                  key={r.roomCode}
                  className="rounded-2xl ios-glass-input p-4 flex items-center justify-between gap-3"
                >
                  <button
                    type="button"
                    onClick={() => setActiveRoomCode(r.roomCode)}
                    className="text-right min-w-0 flex-1 space-y-1"
                  >
                    <div className="text-sm font-bold text-stone-900 dark:text-stone-100 truncate">
                      {r.title}
                    </div>
                    <div className="text-xs text-stone-500 dark:text-stone-400 tabular-nums">
                      الرمز: <span className="font-mono font-semibold">{r.roomCode}</span> ·{' '}
                      {r.guestName
                        ? `مع ${r.hostUid === user.uid ? r.guestName : r.hostName}`
                        : 'بانتظار صديق'}
                    </div>
                  </button>
                  {r.hostUid === user.uid && (
                    <button
                      type="button"
                      onClick={() => void handleDeleteRoom(r.roomCode)}
                      aria-label="حذف الغرفة"
                      className="p-2 rounded-xl text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Connected Room & Synchronized Live Scoreboard */}
      <div className="rounded-3xl ios-glass-card p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
              <span className="inline-flex items-center gap-1 text-[#14532D] dark:text-emerald-300 font-semibold">
                <Radio className="w-3.5 h-3.5" />
                <span>تزامن حي عبر Firestore</span>
              </span>
              <span aria-hidden="true">·</span>
              <span>{getModeLabel(roomData.mode)}</span>
              <span aria-hidden="true">·</span>
              <span>
                {roomData.status === 'finished'
                  ? 'انتهت الجولة'
                  : roomData.guestUid
                  ? 'منافسة ثنائية نشطة الآن'
                  : 'بانتظار دخول صديقك'}
              </span>
            </div>
            <h2 className="font-amiri text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100">
              {roomData.title}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleCopyInviteCode()}
              className="ios-spring inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl ios-glass-input text-xs font-medium text-stone-800 dark:text-stone-200 whitespace-nowrap shrink-0"
            >
              {copiedCode ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>نسخ الرمز ({roomData.roomCode})</span>
            </button>

            <button
              type="button"
              onClick={() => void handleCopyInviteLink()}
              className="ios-spring inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl ios-glass-input text-xs font-medium text-stone-800 dark:text-stone-200 whitespace-nowrap shrink-0"
            >
              {copiedLink ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Link2 className="w-3.5 h-3.5" />
              )}
              <span>نسخ رابط الدعوة</span>
            </button>

            <button
              type="button"
              onClick={() => void handleShareInvite()}
              className="ios-spring inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#14532D] dark:bg-emerald-700 text-[#FBF8F1] text-xs font-medium whitespace-nowrap shrink-0"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>مشاركة الدعوة</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveRoomCode(null)}
              className="ios-spring px-3.5 py-2 rounded-xl ios-glass-input text-xs font-medium text-stone-600 dark:text-stone-300 whitespace-nowrap shrink-0"
            >
              تبديل الغرفة
            </button>
          </div>
        </div>

        {/* Live Match Event Ticker */}
        {roomData.liveEventText && (
          <div className="rounded-2xl bg-[#14532D]/8 dark:bg-emerald-500/12 border border-[#14532D]/20 dark:border-emerald-400/25 px-4 py-2.5 text-xs font-medium text-[#14532D] dark:text-emerald-200 flex items-center justify-between gap-3">
            <span>{roomData.liveEventText}</span>
            <span className="text-[11px] opacity-80 tabular-nums shrink-0">
              السؤال {toArabicDigits(Math.min(syncedQIdx + 1, Math.max(1, roomQuestions.length)))} /{' '}
              {toArabicDigits(roomQuestions.length)}
            </span>
          </div>
        )}

        {/* Live Two-Player Race Scoreboard */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-2xl ios-glass-input p-4 space-y-2">
            <div className="flex items-center justify-between text-sm font-bold text-stone-900 dark:text-stone-100">
              <span>
                {roomData.hostName} {isHost ? '(أنت)' : ''}
              </span>
              <span className="text-[#14532D] dark:text-emerald-300 tabular-nums">
                {toArabicDigits(roomData.hostScore)} نقطة
              </span>
            </div>
            <div className="h-2 rounded-full bg-stone-200/80 dark:bg-stone-800/80 overflow-hidden">
              <div
                className="h-full bg-[#14532D] dark:bg-emerald-500 transition-[width] duration-300"
                style={{
                  width: `${Math.round(
                    (roomData.hostAnsweredCount / Math.max(1, roomQuestions.length)) * 100
                  )}%`,
                }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400 tabular-nums">
              <span>
                أجاب عن {toArabicDigits(roomData.hostAnsweredCount)} من{' '}
                {toArabicDigits(roomQuestions.length)}
              </span>
              {roomData.status === 'active' && (
                <span
                  className={
                    roomData.hostAnswerForCurrent !== -1
                      ? 'text-emerald-700 dark:text-emerald-300 font-semibold'
                      : 'text-amber-700 dark:text-amber-300'
                  }
                >
                  {roomData.hostAnswerForCurrent !== -1 ? 'أجاب على السؤال ✓' : 'يفكر الآن...'}
                </span>
              )}
            </div>
          </div>

          <div className="rounded-2xl ios-glass-input p-4 space-y-2">
            <div className="flex items-center justify-between text-sm font-bold text-stone-900 dark:text-stone-100">
              <span>
                {roomData.guestUid
                  ? `${roomData.guestName} ${isGuest ? '(أنت)' : ''}`
                  : 'في انتظار انضمام صديقك...'}
              </span>
              <span className="text-[#9A742E] dark:text-amber-400 tabular-nums">
                {toArabicDigits(roomData.guestScore)} نقطة
              </span>
            </div>
            <div className="h-2 rounded-full bg-stone-200/80 dark:bg-stone-800/80 overflow-hidden">
              <div
                className="h-full bg-[#9A742E] dark:bg-amber-500 transition-[width] duration-300"
                style={{
                  width: `${Math.round(
                    (roomData.guestAnsweredCount / Math.max(1, roomQuestions.length)) * 100
                  )}%`,
                }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400 tabular-nums">
              <span>
                {roomData.guestUid
                  ? `أجاب عن ${toArabicDigits(roomData.guestAnsweredCount)} من ${toArabicDigits(roomQuestions.length)}`
                  : `شارك الرمز (${roomData.roomCode})`}
              </span>
              {roomData.status === 'active' && roomData.guestUid && (
                <span
                  className={
                    roomData.guestAnswerForCurrent !== -1
                      ? 'text-emerald-700 dark:text-emerald-300 font-semibold'
                      : 'text-amber-700 dark:text-amber-300'
                  }
                >
                  {roomData.guestAnswerForCurrent !== -1 ? 'أجاب على السؤال ✓' : 'يفكر الآن...'}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Synchronized Quiz (7 cols) + Live Leaderboard & Companion Chat (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Quiz Panel */}
        <div className="lg:col-span-7 rounded-3xl ios-glass-card p-6 space-y-5">
          {roomData.status === 'waiting' && !roomData.guestUid ? (
            <div className="py-6 text-center space-y-5">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-[#14532D]/12 dark:bg-emerald-500/20 flex items-center justify-center text-[#14532D] dark:text-emerald-300">
                <Users className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="font-amiri text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100">
                  الغرفة جاهزة! بانتظار دخول صديقك لبدء التنافس الحي
                </h3>
                <p className="text-sm text-stone-600 dark:text-stone-300 max-w-md mx-auto leading-relaxed">
                  أول ما يدخل صديقك برمز الدعوة أو الرابط المباشر، سيظهر السؤال الأول لكما معاً في نفس اللحظة مع عداد ٢٥ ثانية ومكافأة سرعة للإجابة الأسرع!
                </p>
              </div>
              <div
                dir="ltr"
                className="inline-block font-mono text-3xl font-bold tracking-[0.28em] text-[#14532D] dark:text-emerald-200 px-6 py-3 rounded-2xl ios-glass-input border border-[#14532D]/25"
              >
                {roomData.roomCode}
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={() => void handleShareInvite()}
                  className="ios-spring inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#14532D] dark:bg-emerald-700 text-[#FBF8F1] text-sm font-medium whitespace-nowrap shrink-0"
                >
                  <Share2 className="w-4 h-4" />
                  <span>إرسال دعوة لصديقي</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleCopyInviteCode()}
                  className="ios-spring inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl ios-glass-input text-sm font-medium text-stone-800 dark:text-stone-200 whitespace-nowrap shrink-0"
                >
                  <Copy className="w-4 h-4" />
                  <span>نسخ الرمز</span>
                </button>
              </div>
            </div>
          ) : roomData.status === 'finished' ? (
            <div className="py-6 text-center space-y-5">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-[#14532D]/12 dark:bg-emerald-500/20 flex items-center justify-center text-[#14532D] dark:text-emerald-300">
                <Trophy className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="font-amiri text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100">
                  {roomData.hostScore === roomData.guestScore
                    ? 'تعادل إيماني رائع بينكما!'
                    : (isHost && roomData.hostScore > roomData.guestScore) ||
                      (isGuest && roomData.guestScore > roomData.hostScore)
                    ? 'أنت الفائز في هذه المنافسة — مبارك لك!'
                    : `فاز ${isHost ? roomData.guestName : roomData.hostName} بهذه الجولة — حظاً أوفر في القادمة!`}
                </h3>
                <p className="text-sm text-stone-600 dark:text-stone-300 tabular-nums">
                  النتيجة النهائية: {roomData.hostName} ({toArabicDigits(roomData.hostScore)}) —{' '}
                  {roomData.guestName || 'الصديق'} ({toArabicDigits(roomData.guestScore)})
                </p>
                {duelAwardBanner &&
                  duelAwardBanner.roundKey ===
                    `room_bonus_${roomData.roomCode}_${roomData.questionIds.join('_')}` && (
                    <div className="inline-block rounded-2xl bg-[#14532D]/10 dark:bg-emerald-500/15 border border-[#14532D]/25 dark:border-emerald-400/25 px-4 py-2 text-xs font-semibold text-[#14532D] dark:text-emerald-300 tabular-nums">
                      أُضيف +{toArabicDigits(duelAwardBanner.points)} نقطة{' '}
                      {duelAwardBanner.isWin
                        ? 'مكافأة الفوز'
                        : duelAwardBanner.isTie
                        ? 'مكافأة التعادل'
                        : 'مكافأة المشاركة'}{' '}
                      إلى لوحة الصدارة (علاوة على نقاط كل إجابة صحيحة)
                    </div>
                  )}
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2.5">
                {isHost && (
                  <button
                    type="button"
                    onClick={() => void handleRematch()}
                    className="ios-spring inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#14532D] dark:bg-emerald-700 text-[#FBF8F1] text-sm font-medium whitespace-nowrap shrink-0"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>بدء جولة تنافس جديدة</span>
                  </button>
                )}

                {onOpenCertificate && (
                  <button
                    type="button"
                    onClick={() => {
                      const myScore = isHost ? roomData.hostScore : roomData.guestScore;
                      const friendScore = isHost ? roomData.guestScore : roomData.hostScore;
                      const won = myScore > friendScore && roomData.guestUid !== '';
                      onOpenCertificate({
                        recipientName:
                          user.displayName ||
                          (isHost ? roomData.hostName : roomData.guestName) ||
                          'قارئ كتاب الله',
                        title: won
                          ? 'شهادة فوز وتميّز في تحدي الأصدقاء'
                          : 'شهادة مشاركة وإتقان في تحدي الأصدقاء',
                        achievementLabel: `للمنافسة الحية في غرفة «${roomData.title}» (${getModeLabel(
                          roomData.mode
                        )}) وتحقيق ${toArabicDigits(myScore)} نقطة.`,
                        points: myScore + (duelAwardBanner ? duelAwardBanner.points : 0),
                        winsCount: won ? 1 : 0,
                        roundsCount: 1,
                        periodLabel: `غرفة التحدي (${roomData.roomCode})`,
                      });
                    }}
                    className="ios-spring inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#9A742E] hover:bg-[#826023] text-white text-sm font-medium whitespace-nowrap shrink-0"
                  >
                    <Award className="w-4 h-4" />
                    <span>شهادة تقدير افتراضية</span>
                  </button>
                )}

                {onOpenLeaderboard && (
                  <button
                    type="button"
                    onClick={onOpenLeaderboard}
                    className="ios-spring inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl ios-glass-input text-xs sm:text-sm font-medium text-stone-800 dark:text-stone-200 whitespace-nowrap shrink-0"
                  >
                    <Trophy className="w-4 h-4 text-[#9A742E] dark:text-amber-400" />
                    <span>لوحة الصدارة الكاملة</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    void shareNativeOrCopy({
                      title: 'تحدي القرآن والسنة — المصحف الجامع',
                      text: APP_DEFAULT_SHARE_TEXT,
                      url: APP_SHARE_URL,
                    }).then((res) => {
                      if (res === 'copied') {
                        onShowToast('تم نسخ رابط مشاركة التطبيق');
                      }
                    });
                  }}
                  className="ios-spring inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl ios-glass-input text-xs sm:text-sm font-medium text-stone-800 dark:text-stone-200 whitespace-nowrap shrink-0"
                >
                  <Share2 className="w-4 h-4" />
                  <span>مشاركة التطبيق</span>
                </button>
              </div>
            </div>
          ) : currentRoomQuestion ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500 dark:text-stone-400 tabular-nums">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#14532D] dark:text-emerald-300">
                    السؤال المتزامن {toArabicDigits(syncedQIdx + 1)} من{' '}
                    {toArabicDigits(roomQuestions.length)}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {currentRoomQuestion.category === 'hifz'
                      ? 'مسابقة الحفظ'
                      : 'السنة النبوية'}
                  </span>
                </div>

                {!bothAnsweredCurrent && (
                  <span
                    className={`inline-flex items-center gap-1 font-bold ${
                      secondsLeft <= 7
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-[#9A742E] dark:text-amber-300'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>{toArabicDigits(secondsLeft)} ث</span>
                  </span>
                )}
              </div>

              <div className="h-1.5 w-full rounded-full bg-stone-200/80 dark:bg-stone-800/80 overflow-hidden">
                <div
                  className={`h-full transition-[width] duration-300 ${
                    secondsLeft <= 7
                      ? 'bg-rose-600 dark:bg-rose-400'
                      : 'bg-[#14532D] dark:bg-emerald-500'
                  }`}
                  style={{
                    width: `${Math.round(
                      ((bothAnsweredCurrent ? QUESTION_DURATION_SEC : secondsLeft) /
                        QUESTION_DURATION_SEC) *
                        100
                    )}%`,
                  }}
                />
              </div>

              <h3 className="font-amiri text-2xl font-bold leading-relaxed text-[#1C1917] dark:text-[#F2EFE8]">
                {currentRoomQuestion.prompt}
              </h3>

              <div className="space-y-2.5">
                {currentRoomQuestion.options.map((opt, idx) => {
                  const isCorrectOpt = idx === currentRoomQuestion.correctIndex;
                  const isMyPick = idx === effectiveMyAnswer;
                  const isFriendPick =
                    bothAnsweredCurrent && idx === friendServerAnswer;

                  let cls =
                    'ios-glass-input hover:bg-white/75 dark:hover:bg-stone-800/75 border-transparent text-stone-800 dark:text-stone-200';
                  if (bothAnsweredCurrent) {
                    if (isCorrectOpt) {
                      cls =
                        'bg-emerald-600/15 dark:bg-emerald-500/20 border-emerald-600 dark:border-emerald-400 text-[#14532D] dark:text-emerald-200 font-semibold';
                    } else if (isMyPick) {
                      cls =
                        'bg-rose-600/15 dark:bg-rose-500/20 border-rose-600 dark:border-rose-400 text-rose-800 dark:text-rose-200';
                    } else {
                      cls = 'ios-glass-input opacity-65 text-stone-500 dark:text-stone-400';
                    }
                  } else if (iHaveAnswered) {
                    if (isMyPick) {
                      cls =
                        'bg-[#14532D]/15 dark:bg-emerald-500/20 border-[#14532D] dark:border-emerald-400 text-[#14532D] dark:text-emerald-200 font-semibold';
                    } else {
                      cls = 'ios-glass-input opacity-60 text-stone-500 dark:text-stone-400';
                    }
                  }

                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={iHaveAnswered || submittingAnswer}
                      onClick={() => void handleAnswerLiveQuestion(idx)}
                      className={`ios-spring w-full text-right p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition-all ${cls}`}
                    >
                      <span className="text-sm sm:text-base">{opt}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isFriendPick && (
                          <span className="text-[11px] font-medium text-[#9A742E] dark:text-amber-300">
                            اختيار صديقك
                          </span>
                        )}
                        {bothAnsweredCurrent && isCorrectOpt && (
                          <CheckCircle2 className="w-5 h-5 text-emerald-700 dark:text-emerald-300" />
                        )}
                        {bothAnsweredCurrent && isMyPick && !isCorrectOpt && (
                          <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Live waiting banner when I answered before my friend */}
              {iHaveAnswered && !bothAnsweredCurrent && (
                <div className="rounded-2xl bg-amber-500/12 border border-amber-500/30 px-4 py-3 text-xs sm:text-sm text-amber-900 dark:text-amber-200 text-center">
                  تم إرسال إجابتك وتحديث لوحة الصدارة! بانتظار إجابة صديقك للكشف عن الحل والانتقال معاً...
                </div>
              )}

              {/* Synchronized Explanation & Advance once BOTH answered */}
              {bothAnsweredCurrent && (
                <div className="rounded-2xl bg-stone-100/80 dark:bg-stone-900/60 border border-stone-200/80 dark:border-stone-800 p-4 space-y-3">
                  <div className="text-xs font-semibold text-[#9A742E] dark:text-amber-400">
                    {currentRoomQuestion.reference}
                  </div>
                  <p className="text-xs sm:text-sm text-stone-700 dark:text-stone-200 leading-relaxed">
                    {currentRoomQuestion.explanation}
                  </p>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    {currentRoomQuestion.surahNumber ? (
                      <button
                        type="button"
                        onClick={() =>
                          onOpenSurah(
                            currentRoomQuestion.surahNumber!,
                            currentRoomQuestion.ayahNumber
                          )
                        }
                        className="ios-spring inline-flex items-center gap-1.5 px-3 py-2 rounded-xl ios-glass-input text-xs font-medium text-[#14532D] dark:text-emerald-300 whitespace-nowrap shrink-0"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>فتح الآية في المصحف</span>
                      </button>
                    ) : (
                      <span />
                    )}

                    <button
                      type="button"
                      disabled={advancingQuestion}
                      onClick={() => void handleAdvanceQuestionNow()}
                      className="ios-spring inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#14532D] dark:bg-emerald-700 text-[#FBF8F1] text-xs font-medium whitespace-nowrap shrink-0 disabled:opacity-60"
                    >
                      <span>
                        {syncedQIdx + 1 < roomQuestions.length
                          ? 'السؤال التالي معاً'
                          : 'عرض النتيجة النهائية'}
                      </span>
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Right Column: Live Global Leaderboard Snapshot + Shared Reading + Chat */}
        <div className="lg:col-span-5 space-y-4">
          {/* Real-Time Weekly Leaderboard Snapshot */}
          <div className="rounded-3xl ios-glass-card p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-bold text-stone-900 dark:text-stone-100">
                <Medal className="w-4 h-4 text-[#9A742E] dark:text-amber-400" />
                <span>لوحة الصدارة الحية (هذا الأسبوع)</span>
              </div>
              {onOpenLeaderboard && (
                <button
                  type="button"
                  onClick={onOpenLeaderboard}
                  className="text-xs font-medium text-[#14532D] dark:text-emerald-300 hover:underline whitespace-nowrap"
                >
                  عرض الكل
                </button>
              )}
            </div>

            {liveWeeklyRankings.length === 0 ? (
              <p className="text-xs text-stone-500 dark:text-stone-400">
                ستظهر النقاط هنا لحظة إجابة أي طرف إجابة صحيحة!
              </p>
            ) : (
              <div className="space-y-2">
                {liveWeeklyRankings.map((entry, idx) => {
                  const isInRoom =
                    entry.uid === roomData.hostUid ||
                    entry.uid === roomData.guestUid;
                  return (
                    <div
                      key={entry.uid}
                      className={`flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-xs ${
                        isInRoom
                          ? 'bg-[#14532D]/10 dark:bg-emerald-500/15 border border-[#14532D]/25 dark:border-emerald-400/25'
                          : 'ios-glass-input'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-bold text-[#9A742E] dark:text-amber-300 tabular-nums shrink-0">
                          {idx === 0 ? (
                            <Crown className="w-3.5 h-3.5 inline" />
                          ) : (
                            `${toArabicDigits(idx + 1)}.`
                          )}
                        </span>
                        <span className="font-semibold text-stone-900 dark:text-stone-100 truncate">
                          {entry.displayName}{' '}
                          {entry.uid === user.uid ? '(أنت)' : ''}
                        </span>
                      </div>
                      <span className="font-bold text-[#14532D] dark:text-emerald-300 tabular-nums shrink-0">
                        {toArabicDigits(entry.weekScore)} نقطة
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Shared Reading Position */}
          <div className="rounded-3xl ios-glass-card p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold text-[#9A742E] dark:text-amber-400">
                ورد القراءة المشترك الآن
              </div>
              <Sparkles className="w-4 h-4 text-[#9A742E] dark:text-amber-400" />
            </div>
            <div className="text-base font-bold text-stone-900 dark:text-stone-100 tabular-nums">
              {sharedSurahName} · الآية {toArabicDigits(roomData.sharedAyahNumber)}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  onOpenSurah(roomData.sharedSurahNumber, roomData.sharedAyahNumber)
                }
                className="ios-spring inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#14532D] dark:bg-emerald-700 text-[#FBF8F1] text-xs font-medium whitespace-nowrap shrink-0"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>افتح الموضع في المصحف</span>
              </button>

              <button
                type="button"
                onClick={() => void handleShareCurrentReading()}
                className="ios-spring px-3 py-2 rounded-xl ios-glass-input text-xs font-medium text-stone-800 dark:text-stone-200 whitespace-nowrap shrink-0"
              >
                مشاركة موضعي ({lastRead.surahName})
              </button>
            </div>
          </div>

          {/* Companion Chat & Encouragement */}
          <div className="rounded-3xl ios-glass-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-[#14532D] dark:text-emerald-300" />
                <span>التواصل والتشجيع المباشر</span>
              </h3>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {QUICK_NUDGES.map((nudge, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => void handleSendNudge(nudge)}
                  className="ios-spring text-right px-2.5 py-1.5 rounded-xl ios-glass-input text-[11px] text-stone-700 dark:text-stone-300 hover:text-[#14532D] dark:hover:text-emerald-300"
                >
                  {nudge}
                </button>
              ))}
            </div>

            <div className="h-56 overflow-y-auto space-y-2.5 pl-1">
              {roomMessages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-stone-500 dark:text-stone-400 text-center px-4">
                  أرسل تحية السلام أو دعوة لمراجعة سورة لتبدأ المحادثة الفورية مع صديقك.
                </div>
              ) : (
                roomMessages.map((m) => {
                  const mine = m.uid === user.uid;
                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${mine ? 'items-start' : 'items-end'}`}
                    >
                      <div
                        className={`max-w-[88%] rounded-2xl px-3.5 py-2 text-xs sm:text-sm space-y-1 ${
                          mine
                            ? 'bg-[#14532D] dark:bg-emerald-700 text-[#FBF8F1]'
                            : 'ios-glass-input text-stone-900 dark:text-stone-100'
                        }`}
                      >
                        <div className="text-[10px] opacity-75 font-medium">
                          {m.senderName}
                        </div>
                        <p className="leading-relaxed">{m.text}</p>
                        {m.kind === 'ayah_share' && (
                          <button
                            type="button"
                            onClick={() => onOpenSurah(m.surahNumber, m.ayahNumber)}
                            className={`inline-flex items-center gap-1 text-[11px] underline mt-0.5 ${
                              mine ? 'text-amber-200' : 'text-[#14532D] dark:text-emerald-300'
                            }`}
                          >
                            <BookOpen className="w-3 h-3" />
                            <span>انتقال للآية</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <form
              onSubmit={(e) => void handleSendChat(e)}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                maxLength={350}
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                placeholder="اكتب رسالة لصديقك..."
                className="flex-1 px-3.5 py-2 text-xs sm:text-sm rounded-xl ios-glass-input text-stone-900 dark:text-stone-100"
              />
              <button
                type="submit"
                disabled={!chatText.trim()}
                aria-label="إرسال"
                className="ios-spring p-2.5 rounded-xl bg-[#14532D] dark:bg-emerald-700 text-[#FBF8F1] disabled:opacity-50 shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
export default ChallengeRoom;
