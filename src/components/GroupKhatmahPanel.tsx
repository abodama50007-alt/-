import React, { useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Copy,
  LogIn,
  LogOut,
  Plus,
  RefreshCw,
  Share2,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { JUZ_LIST } from '../data/quranMeta';
import {
  createGroupKhatmah,
  deleteGroupKhatmah,
  fetchMyGroupKhatmahs,
  joinGroupKhatmah,
  leaveGroupKhatmah,
  normalizeGroupCode,
  subscribeToGroupKhatmah,
  subscribeToGroupKhatmahMembers,
  updateGroupKhatmahStatus,
  updateGroupMemberProgress,
} from '../firebase';
import {
  GroupKhatmahMemberRecord,
  GroupKhatmahRecord,
  KhatmahState,
} from '../types/quran';
import { toArabicDigits } from '../utils/arabic';
import { shareNativeOrCopy } from '../utils/share';

interface GroupKhatmahPanelProps {
  user: User | null;
  authLoading: boolean;
  personalKhatmah: KhatmahState;
  initialGroupCode?: string | null;
  onSignIn: () => void;
  onOpenJuz: (juzNumber: number) => void;
  onOpenPage: (pageNumber: number) => void;
  onShowToast?: (msg: string) => void;
}

const TARGET_DAY_OPTIONS = [7, 15, 30, 60];

export const GroupKhatmahPanel: React.FC<GroupKhatmahPanelProps> = ({
  user,
  authLoading,
  personalKhatmah,
  initialGroupCode,
  onSignIn,
  onOpenJuz,
  onOpenPage,
  onShowToast,
}) => {
  const [myGroups, setMyGroups] = useState<GroupKhatmahRecord[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);

  const [activeGroupCode, setActiveGroupCode] = useState<string | null>(null);
  const [activeGroup, setActiveGroup] = useState<GroupKhatmahRecord | null>(
    null
  );
  const [members, setMembers] = useState<GroupKhatmahMemberRecord[]>([]);
  const [subError, setSubError] = useState<string | null>(null);

  // Create form state
  const [createTitle, setCreateTitle] = useState('ختمة جماعية مباركة');
  const [createDesc, setCreateDesc] = useState('');
  const [createDays, setCreateDays] = useState(30);
  const [syncPersonalOnCreate, setSyncPersonalOnCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  // Join form state
  const [joinCodeInput, setJoinCodeInput] = useState(
    initialGroupCode ? normalizeGroupCode(initialGroupCode) : ''
  );
  const [joining, setJoining] = useState(false);

  // Active group actions
  const [savingProgress, setSavingProgress] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);
  const [pageInput, setPageInput] = useState<string>('1');

  const refreshMyGroups = async (uid: string) => {
    setLoadingGroups(true);
    try {
      const list = await fetchMyGroupKhatmahs(uid);
      setMyGroups(list);
    } catch {
      // handled cleanly by firebase wrapper
    } finally {
      setLoadingGroups(false);
    }
  };

  useEffect(() => {
    if (!user) {
      setMyGroups([]);
      setActiveGroupCode(null);
      setActiveGroup(null);
      setMembers([]);
      return;
    }
    void refreshMyGroups(user.uid);
  }, [user]);

  // Auto-open/join if deep-link ?khatmah=CODE is provided
  useEffect(() => {
    if (!user || !initialGroupCode) return;
    const cleaned = normalizeGroupCode(initialGroupCode);
    if (cleaned.length < 6) return;
    setJoinCodeInput(cleaned);
    let active = true;
    joinGroupKhatmah({ user, rawCode: cleaned })
      .then((group) => {
        if (!active) return;
        setActiveGroupCode(group.groupCode);
        void refreshMyGroups(user.uid);
      })
      .catch((err) => {
        if (!active) return;
        onShowToast?.(
          err instanceof Error ? err.message : 'تعذر الانضمام إلى الختمة الجماعية'
        );
      });
    return () => {
      active = false;
    };
  }, [initialGroupCode, user]);

  // Real-time subscriptions to active group and all its members
  useEffect(() => {
    if (!user || !activeGroupCode) {
      setActiveGroup(null);
      setMembers([]);
      return;
    }
    setSubError(null);
    const unsubGroup = subscribeToGroupKhatmah(
      activeGroupCode,
      (group) => {
        setActiveGroup(group);
        if (!group) {
          onShowToast?.('لم تعد هذه المجموعة موجودة');
          setActiveGroupCode(null);
        }
      },
      () => setSubError('تعذر مزامنة بيانات المجموعة لحظياً')
    );

    const unsubMembers = subscribeToGroupKhatmahMembers(
      activeGroupCode,
      (list) => {
        setMembers(list);
      },
      () => setSubError('تعذر تحميل تقدم الأعضاء لحظياً')
    );

    return () => {
      unsubGroup();
      unsubMembers();
    };
  }, [activeGroupCode, user]);

  const myMember = useMemo(
    () => (user ? members.find((m) => m.uid === user.uid) ?? null : null),
    [members, user]
  );

  useEffect(() => {
    if (myMember) {
      setPageInput(String(myMember.currentPage));
    }
  }, [myMember?.currentPage]);

  // Collective progress metrics across all members
  const {
    unionCompletedJuz,
    overallPercentage,
    juzHoldersMap,
    sortedMembers,
    totalMemberJuzReads,
  } = useMemo(() => {
    const unionSet = new Set<number>();
    const holders = new Map<number, GroupKhatmahMemberRecord[]>();
    let cumulative = 0;

    for (const m of members) {
      cumulative += m.completedJuz.length;
      for (const juzNum of m.completedJuz) {
        if (juzNum >= 1 && juzNum <= 30) {
          unionSet.add(juzNum);
          const list = holders.get(juzNum) ?? [];
          list.push(m);
          holders.set(juzNum, list);
        }
      }
    }

    const unionArr = Array.from(unionSet).sort((a, b) => a - b);
    const pct = Math.min(100, Math.round((unionArr.length / 30) * 100));
    const ordered = [...members].sort((a, b) => {
      if (b.completedJuz.length !== a.completedJuz.length) {
        return b.completedJuz.length - a.completedJuz.length;
      }
      return b.currentPage - a.currentPage;
    });

    return {
      unionCompletedJuz: unionArr,
      overallPercentage: pct,
      juzHoldersMap: holders,
      sortedMembers: ordered,
      totalMemberJuzReads: cumulative,
    };
  }, [members]);

  // Sync group status to completed when all 30 Juzs are achieved collectively
  useEffect(() => {
    if (
      !activeGroup ||
      !user ||
      !activeGroup.memberUids.includes(user.uid) ||
      members.length === 0
    ) {
      return;
    }
    if (unionCompletedJuz.length === 30 && activeGroup.status !== 'completed') {
      updateGroupKhatmahStatus(activeGroup.groupCode, 'completed').catch(
        () => {}
      );
    } else if (
      unionCompletedJuz.length < 30 &&
      activeGroup.status === 'completed'
    ) {
      updateGroupKhatmahStatus(activeGroup.groupCode, 'active').catch(() => {});
    }
  }, [activeGroup, members.length, unionCompletedJuz.length, user]);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setCreating(true);
    try {
      const created = await createGroupKhatmah({
        user,
        title: createTitle,
        description: createDesc,
        targetDays: createDays,
        initialCompletedJuz: syncPersonalOnCreate
          ? personalKhatmah.completedJuz
          : [],
        initialCurrentPage: syncPersonalOnCreate
          ? personalKhatmah.currentPage
          : 1,
      });
      setActiveGroupCode(created.groupCode);
      setCreateDesc('');
      onShowToast?.(`تم إنشاء الختمة الجماعية برمز ${created.groupCode}`);
      void refreshMyGroups(user.uid);
    } catch (err) {
      onShowToast?.(
        err instanceof Error ? err.message : 'تعذر إنشاء الختمة الجماعية'
      );
    } finally {
      setCreating(false);
    }
  };

  const handleJoinGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const cleaned = normalizeGroupCode(joinCodeInput);
    if (cleaned.length < 6) {
      onShowToast?.('أدخل رمز مجموعة صحيحاً مكوّناً من ٦ أحرف أو أرقام');
      return;
    }
    setJoining(true);
    try {
      const joined = await joinGroupKhatmah({
        user,
        rawCode: cleaned,
      });
      setActiveGroupCode(joined.groupCode);
      onShowToast?.(`تم انضمامك إلى «${joined.title}» بنجاح`);
      void refreshMyGroups(user.uid);
    } catch (err) {
      onShowToast?.(
        err instanceof Error ? err.message : 'تعذر الانضمام إلى المجموعة'
      );
    } finally {
      setJoining(false);
    }
  };

  const handleToggleMyJuz = async (juzNumber: number) => {
    if (!user || !activeGroup) return;
    const existingJuz = myMember?.completedJuz ?? [];
    const exists = existingJuz.includes(juzNumber);
    const nextJuz = exists
      ? existingJuz.filter((n) => n !== juzNumber)
      : [...existingJuz, juzNumber].sort((a, b) => a - b);

    setSavingProgress(true);
    try {
      await updateGroupMemberProgress({
        groupCode: activeGroup.groupCode,
        user,
        completedJuz: nextJuz,
        currentPage: myMember?.currentPage ?? 1,
      });
      onShowToast?.(
        exists
          ? `تم إلغاء تحديد الجزء ${toArabicDigits(juzNumber)}`
          : `بارك الله فيك! تم تسجيل إتمام الجزء ${toArabicDigits(juzNumber)}`
      );
    } catch {
      onShowToast?.('تعذر حفظ التقدم الآن، حاول مرة أخرى');
    } finally {
      setSavingProgress(false);
    }
  };

  const handleUpdateMyPage = async (targetPage: number) => {
    if (!user || !activeGroup) return;
    const clamped = Math.max(1, Math.min(604, Math.round(targetPage || 1)));
    setPageInput(String(clamped));
    setSavingProgress(true);
    try {
      await updateGroupMemberProgress({
        groupCode: activeGroup.groupCode,
        user,
        completedJuz: myMember?.completedJuz ?? [],
        currentPage: clamped,
      });
      onShowToast?.(
        `تم تحديث صفحتك في المجموعة إلى ص ${toArabicDigits(clamped)}`
      );
    } catch {
      onShowToast?.('تعذر تحديث الصفحة في المجموعة');
    } finally {
      setSavingProgress(false);
    }
  };

  const handleSyncFromPersonal = async () => {
    if (!user || !activeGroup) return;
    setSavingProgress(true);
    try {
      await updateGroupMemberProgress({
        groupCode: activeGroup.groupCode,
        user,
        completedJuz: personalKhatmah.completedJuz,
        currentPage: personalKhatmah.currentPage,
      });
      onShowToast?.('تمت مزامنة تقدم ختمتك الفردية مع المجموعة');
    } catch {
      onShowToast?.('تعذر مزامنة التقدم الفردي');
    } finally {
      setSavingProgress(false);
    }
  };

  const handleCopyInviteCode = async (code: string) => {
    const res = await shareNativeOrCopy({
      title: 'رمز دعوة الختمة الجماعية',
      text: code,
      url: code,
    });
    if (res !== 'failed') {
      onShowToast?.(`تم نسخ رمز المجموعة: ${code}`);
    }
  };

  const handleShareInviteLink = async (group: GroupKhatmahRecord) => {
    const inviteUrl = `${window.location.origin}?khatmah=${group.groupCode}`;
    const res = await shareNativeOrCopy({
      title: `دعوة لختمة جماعية: ${group.title}`,
      text: `شاركني في ختمة القرآن الجماعية «${group.title}» عبر تطبيق المصحف الجامع. رمز المجموعة: ${group.groupCode}`,
      url: inviteUrl,
    });
    if (res === 'copied') {
      onShowToast?.('تم نسخ رابط الدعوة للختمة الجماعية');
    } else if (res === 'failed') {
      onShowToast?.('تعذر نسخ رابط الدعوة تلقائياً');
    }
  };

  const handleConfirmLeave = async () => {
    if (!user || !activeGroup) return;
    try {
      await leaveGroupKhatmah(activeGroup.groupCode, user);
      setConfirmLeaveOpen(false);
      setActiveGroupCode(null);
      onShowToast?.('تمت مغادرة الختمة الجماعية');
      void refreshMyGroups(user.uid);
    } catch (err) {
      onShowToast?.(
        err instanceof Error ? err.message : 'تعذر مغادرة المجموعة'
      );
    }
  };

  const handleConfirmDelete = async () => {
    if (!user || !activeGroup) return;
    try {
      await deleteGroupKhatmah(activeGroup.groupCode, activeGroup.memberUids);
      setConfirmDeleteOpen(false);
      setActiveGroupCode(null);
      onShowToast?.('تم حذف الختمة الجماعية');
      void refreshMyGroups(user.uid);
    } catch {
      onShowToast?.('تعذر حذف الختمة الجماعية');
    }
  };

  // Sign-In Gate
  if (!user) {
    return (
      <section className="rounded-3xl ios-glass-card p-8 text-center space-y-5 max-w-2xl mx-auto">
        <div className="w-14 h-14 rounded-2xl bg-[#14532D]/12 dark:bg-emerald-500/20 text-[#14532D] dark:text-emerald-300 flex items-center justify-center mx-auto">
          <Users className="w-7 h-7" />
        </div>
        <div className="space-y-2">
          <h2 className="font-amiri text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100">
            الختمات الجماعية مع الأهل والأصدقاء
          </h2>
          <p className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed max-w-lg mx-auto">
            أنشئ مجموعة قراءة مشتركة أو انضم برمز دعوة لتتبع إنجاز كل عضو في
            أجزاء القرآن الكريم لحظياً ومشاهدة نسبة الإنجاز الإجمالية للمجموعة.
            الميزة مجانية بالكامل.
          </p>
        </div>

        <button
          type="button"
          onClick={onSignIn}
          disabled={authLoading}
          className="ios-spring inline-flex items-center gap-2 px-6 py-3 min-h-[44px] rounded-xl bg-[#14532D] hover:bg-[#114224] dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white text-sm font-medium disabled:opacity-60"
        >
          <LogIn className="w-4 h-4" />
          <span>
            {authLoading
              ? 'جاري تسجيل الدخول...'
              : 'تسجيل الدخول بحساب جوجل للبدء'}
          </span>
        </button>
      </section>
    );
  }

  // Active Group View
  if (activeGroupCode && activeGroup) {
    const isCreator = activeGroup.creatorUid === user.uid;
    const isCompleted =
      unionCompletedJuz.length === 30 || activeGroup.status === 'completed';

    return (
      <div className="space-y-6">
        {/* Top Navigation + Invite Bar */}
        <div className="rounded-3xl ios-glass-card p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => {
                  setActiveGroupCode(null);
                  setConfirmDeleteOpen(false);
                  setConfirmLeaveOpen(false);
                  void refreshMyGroups(user.uid);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#14532D] dark:text-emerald-300 hover:underline min-h-[36px]"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>العودة إلى مجموعات الختمة</span>
              </button>

              <h2 className="font-amiri text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100">
                {activeGroup.title}
              </h2>

              <p className="text-xs text-stone-500 dark:text-stone-400 tabular-nums">
                أنشأها {activeGroup.creatorName} ·{' '}
                {toArabicDigits(members.length || activeGroup.memberUids.length)}{' '}
                مشارك · الهدف {toArabicDigits(activeGroup.targetDays)} يوماً ·{' '}
                {isCompleted ? 'مكتملة بحمد الله' : 'نشطة الآن'}
              </p>

              {activeGroup.description && (
                <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 pt-1">
                  {activeGroup.description}
                </p>
              )}
            </div>

            {/* Invite Code & Share Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="px-3.5 py-2 rounded-xl ios-glass-input flex items-center gap-2">
                <span className="text-xs text-stone-500 dark:text-stone-400">
                  رمز الدعوة:
                </span>
                <span
                  dir="ltr"
                  className="font-mono text-sm font-bold tracking-wider text-[#14532D] dark:text-emerald-300"
                >
                  {activeGroup.groupCode}
                </span>
              </div>

              <button
                type="button"
                onClick={() => void handleCopyInviteCode(activeGroup.groupCode)}
                className="ios-spring inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[44px] rounded-xl ios-glass-input text-xs font-medium text-stone-800 dark:text-stone-200"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>نسخ الرمز</span>
              </button>

              <button
                type="button"
                onClick={() => void handleShareInviteLink(activeGroup)}
                className="ios-spring inline-flex items-center gap-1.5 px-4 py-2 min-h-[44px] rounded-xl bg-[#14532D] hover:bg-[#114224] dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white text-xs font-medium"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>دعوة الأصدقاء</span>
              </button>

              {isCreator ? (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteOpen((v) => !v)}
                  className="ios-spring inline-flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-xl ios-glass-input text-xs font-medium text-rose-700 dark:text-rose-300"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>حذف</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmLeaveOpen((v) => !v)}
                  className="ios-spring inline-flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-xl ios-glass-input text-xs font-medium text-stone-700 dark:text-stone-300"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>مغادرة</span>
                </button>
              )}
            </div>
          </div>

          {/* Inline confirmations without window.confirm */}
          {confirmDeleteOpen && isCreator && (
            <div className="rounded-2xl border border-rose-400/40 bg-rose-500/10 p-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs sm:text-sm text-rose-800 dark:text-rose-200 font-medium">
                هل تريد بالتأكيد حذف هذه الختمة الجماعية وجميع بياناتها؟
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleConfirmDelete()}
                  className="px-4 py-2 min-h-[40px] rounded-xl bg-rose-600 text-white text-xs font-medium"
                >
                  تأكيد الحذف
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteOpen(false)}
                  className="px-4 py-2 min-h-[40px] rounded-xl ios-glass-input text-xs font-medium text-stone-700 dark:text-stone-200"
                >
                  إلغاء
                </button>
              </div>
            </div>
          )}

          {confirmLeaveOpen && !isCreator && (
            <div className="rounded-2xl border border-amber-400/40 bg-amber-500/10 p-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs sm:text-sm text-amber-900 dark:text-amber-200 font-medium">
                هل تريد مغادرة هذه المجموعة؟ يمكنك العودة لاحقاً برمز الدعوة.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleConfirmLeave()}
                  className="px-4 py-2 min-h-[40px] rounded-xl bg-amber-700 text-white text-xs font-medium"
                >
                  تأكيد المغادرة
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmLeaveOpen(false)}
                  className="px-4 py-2 min-h-[40px] rounded-xl ios-glass-input text-xs font-medium text-stone-700 dark:text-stone-200"
                >
                  إلغاء
                </button>
              </div>
            </div>
          )}

          {subError && (
            <div className="text-xs text-rose-700 dark:text-rose-300">
              {subError}
            </div>
          )}
        </div>

        {/* Overall Collective Progress Card */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-3xl ios-glass-card p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-xs font-medium text-[#9A742E] dark:text-amber-400">
                  نسبة الإنجاز الإجمالية للمجموعة
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100 tabular-nums mt-1">
                  {toArabicDigits(unionCompletedJuz.length)} من{' '}
                  {toArabicDigits(30)} جزءاً
                </div>
              </div>

              <div className="text-left tabular-nums">
                <div className="text-3xl font-bold text-[#14532D] dark:text-emerald-300">
                  {toArabicDigits(overallPercentage)}٪
                </div>
                <div className="text-xs text-stone-500 dark:text-stone-400">
                  المتبقي {toArabicDigits(30 - unionCompletedJuz.length)} أجزاء
                </div>
              </div>
            </div>

            <div className="h-3 w-full rounded-full bg-stone-200/80 dark:bg-stone-800 overflow-hidden">
              <div
                className="h-full bg-[#14532D] dark:bg-emerald-500 transition-[width] duration-300"
                style={{ width: `${overallPercentage}%` }}
              />
            </div>

            {isCompleted ? (
              <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-3.5 flex items-center gap-2.5 text-xs sm:text-sm font-medium text-[#14532D] dark:text-emerald-300">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>
                  ما شاء الله! أتمّت المجموعة جميع الأجزاء الثلاثين للقرآن
                  الكريم — تقبل الله منكم.
                </span>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-600 dark:text-stone-400 tabular-nums">
                <span>
                  إجمالي الأجزاء المقروءة بمشاركة الأعضاء:{' '}
                  {toArabicDigits(totalMemberJuzReads)} قراءة جزء
                </span>
                <span>تُحدّث النسبة لحظياً فور إنجاز أي عضو</span>
              </div>
            )}
          </div>

          {/* My Progress Sync Box */}
          <div className="rounded-3xl ios-glass-card p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                تقدمي الشخصي بالمجموعة
              </div>
              <span className="text-xs font-semibold text-[#14532D] dark:text-emerald-300 tabular-nums">
                {toArabicDigits(myMember?.completedJuz.length ?? 0)} / ٣٠ جزءاً
              </span>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="group-my-page-input"
                className="block text-xs text-stone-600 dark:text-stone-400"
              >
                صفحتك الحالية في المصحف (١ إلى ٦٠٤)
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="group-my-page-input"
                  type="number"
                  min={1}
                  max={604}
                  value={pageInput}
                  onChange={(e) => setPageInput(e.target.value)}
                  className="flex-1 px-3 py-2.5 text-sm rounded-xl ios-glass-input text-stone-900 dark:text-stone-100 tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
                <button
                  type="button"
                  disabled={savingProgress}
                  onClick={() => void handleUpdateMyPage(Number(pageInput))}
                  className="ios-spring px-4 py-2.5 min-h-[44px] rounded-xl bg-[#14532D] dark:bg-emerald-700 text-white text-xs font-medium disabled:opacity-60 whitespace-nowrap"
                >
                  حفظ الصفحة
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                disabled={savingProgress}
                onClick={() => void handleSyncFromPersonal()}
                className="ios-spring flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 min-h-[44px] rounded-xl ios-glass-input text-xs font-medium text-[#14532D] dark:text-emerald-300"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>مزامنة من ختمتي الفردية</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenPage(myMember?.currentPage ?? 1)}
                className="ios-spring inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 min-h-[44px] rounded-xl ios-glass-input text-xs font-medium text-stone-800 dark:text-stone-200"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>اقرأ الآن</span>
              </button>
            </div>
          </div>
        </div>

        {/* Members Progress Tracker */}
        <section className="rounded-3xl ios-glass-card p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-lg font-semibold text-stone-900 dark:text-stone-100">
                تقدم الأعضاء في إكمال الأجزاء ({toArabicDigits(sortedMembers.length)})
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                متابعة مباشرة لنسبة إنجاز كل عضو والأجزاء التي أتمّ قراءتها
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sortedMembers.map((member) => {
              const memberPct = Math.round(
                (member.completedJuz.length / 30) * 100
              );
              const isMe = member.uid === user.uid;
              const isGroupCreator = member.uid === activeGroup.creatorUid;
              const initialChar =
                member.displayName.trim().slice(0, 1) || 'ق';

              return (
                <div
                  key={member.uid}
                  className={`p-4 rounded-2xl space-y-3 border ${
                    isMe
                      ? 'bg-[#14532D]/[0.06] dark:bg-emerald-500/[0.1] border-[#14532D]/35 dark:border-emerald-500/35'
                      : 'ios-glass-input border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {member.photoURL ? (
                        <img
                          src={member.photoURL}
                          alt={member.displayName}
                          className="w-10 h-10 rounded-full object-cover shrink-0 border border-stone-200 dark:border-stone-700"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-[#14532D]/15 dark:bg-emerald-500/20 text-[#14532D] dark:text-emerald-300 flex items-center justify-center font-bold text-sm shrink-0">
                          {initialChar}
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-stone-900 dark:text-stone-100 truncate">
                          {member.displayName}
                          {isMe ? ' (أنت)' : ''}
                        </div>
                        <div className="text-xs text-stone-500 dark:text-stone-400 tabular-nums">
                          {isGroupCreator ? 'منشئ المجموعة · ' : ''}
                          وصل إلى صفحة {toArabicDigits(member.currentPage)}
                        </div>
                      </div>
                    </div>

                    <div className="text-left tabular-nums shrink-0">
                      <div className="text-sm font-bold text-[#14532D] dark:text-emerald-300">
                        {toArabicDigits(memberPct)}٪
                      </div>
                      <div className="text-[11px] text-stone-500 dark:text-stone-400">
                        {toArabicDigits(member.completedJuz.length)} / ٣٠ جزءاً
                      </div>
                    </div>
                  </div>

                  <div className="h-2 w-full rounded-full bg-stone-200/80 dark:bg-stone-800 overflow-hidden">
                    <div
                      className="h-full bg-[#14532D] dark:bg-emerald-500 transition-[width] duration-300"
                      style={{ width: `${memberPct}%` }}
                    />
                  </div>

                  <div className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed tabular-nums">
                    {member.completedJuz.length > 0 ? (
                      <span>
                        الأجزاء المكتملة:{' '}
                        {member.completedJuz
                          .map((j) => toArabicDigits(j))
                          .join('، ')}
                      </span>
                    ) : (
                      <span className="text-stone-500 dark:text-stone-400">
                        لم يسجل أجزاءً مكتملة بعد
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Collective 30-Juz Tracking Board */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-lg font-semibold text-stone-900 dark:text-stone-100">
                سجل الأجزاء الجماعي ({toArabicDigits(unionCompletedJuz.length)} /{' '}
                {toArabicDigits(30)})
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                حدّد الأجزاء التي أتممت قراءتها لتظهر فوراً لجميع أعضاء المجموعة
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-3">
            {JUZ_LIST.map((juz) => {
              const holders = juzHoldersMap.get(juz.number) ?? [];
              const iCompleted =
                myMember?.completedJuz.includes(juz.number) ?? false;
              const groupCompleted = holders.length > 0;
              const holdersNames = holders
                .map((h) => h.displayName.split(' ')[0])
                .slice(0, 2)
                .join('، ');
              const extraHoldersCount = Math.max(0, holders.length - 2);

              return (
                <div
                  key={juz.number}
                  className={`p-3 rounded-2xl transition-colors flex flex-col justify-between gap-2.5 border ${
                    iCompleted
                      ? 'border-[#14532D]/50 bg-emerald-900/[0.09] dark:border-emerald-500/50 dark:bg-emerald-500/[0.14]'
                      : groupCompleted
                      ? 'border-[#9A742E]/40 bg-amber-500/[0.06] dark:border-amber-500/35 dark:bg-amber-500/[0.08]'
                      : 'ios-glass-card border-transparent'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs text-stone-500 dark:text-stone-400 tabular-nums">
                        الجزء {toArabicDigits(juz.number)}
                      </div>
                      <div className="font-amiri text-base font-bold text-stone-900 dark:text-stone-100 truncate">
                        {juz.name}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={savingProgress}
                      onClick={() => void handleToggleMyJuz(juz.number)}
                      aria-label={
                        iCompleted
                          ? `إلغاء إتمامي للجزء ${juz.number}`
                          : `تسجيل إتمامي للجزء ${juz.number}`
                      }
                      className={`w-8 h-8 rounded-lg border flex items-center justify-center ios-spring shrink-0 ${
                        iCompleted
                          ? 'bg-[#14532D] border-[#14532D] text-white dark:bg-emerald-600 dark:border-emerald-600'
                          : 'border-stone-300/80 dark:border-stone-700 text-transparent hover:border-[#14532D]'
                      }`}
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="text-[11px] text-stone-600 dark:text-stone-400 truncate">
                    {groupCompleted
                      ? `أتمّه: ${holdersNames}${
                          extraHoldersCount > 0
                            ? ` +${toArabicDigits(extraHoldersCount)}`
                            : ''
                        }`
                      : 'بانتظار الإنجاز'}
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenJuz(juz.number)}
                    className="text-right text-[11px] font-medium text-[#14532D] dark:text-emerald-300 hover:underline"
                  >
                    قراءة الجزء ←
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    );
  }

  // Lobby: Create / Join / List My Groups
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Create New Group Khatmah */}
        <form
          onSubmit={handleCreateGroup}
          className="rounded-3xl ios-glass-card p-6 space-y-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#14532D]/12 dark:bg-emerald-500/20 text-[#14532D] dark:text-emerald-300 flex items-center justify-center shrink-0">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-amiri text-xl font-bold text-stone-900 dark:text-stone-100">
                إنشاء ختمة جماعية جديدة
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                أنشئ مجموعة وشارك رمز الدعوة مع أهلك وأصدقائك
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="group-khatmah-title"
              className="block text-xs font-medium text-stone-700 dark:text-stone-300"
            >
              عنوان الختمة الجماعية
            </label>
            <input
              id="group-khatmah-title"
              type="text"
              required
              maxLength={100}
              value={createTitle}
              onChange={(e) => setCreateTitle(e.target.value)}
              placeholder="مثال: ختمة العائلة في شهر الخيرات"
              className="w-full px-3.5 py-2.5 text-sm rounded-xl ios-glass-input text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-700"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="group-khatmah-desc"
              className="block text-xs font-medium text-stone-700 dark:text-stone-300"
            >
              ملاحظة أو نية مشتركة (اختياري)
            </label>
            <input
              id="group-khatmah-desc"
              type="text"
              maxLength={200}
              value={createDesc}
              onChange={(e) => setCreateDesc(e.target.value)}
              placeholder="مثال: كل مشارك يقرأ جزءاً في الأسبوع..."
              className="w-full px-3.5 py-2.5 text-sm rounded-xl ios-glass-input text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-700"
            />
          </div>

          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-stone-700 dark:text-stone-300">
              المدة المستهدفة لإتمام الختمة
            </span>
            <div className="grid grid-cols-4 gap-1.5 p-1 rounded-2xl ios-glass-input">
              {TARGET_DAY_OPTIONS.map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setCreateDays(days)}
                  className={`py-2 text-xs font-medium rounded-xl ios-spring tabular-nums ${
                    createDays === days
                      ? 'bg-white/90 dark:bg-white/[0.14] text-[#14532D] dark:text-emerald-300 shadow-xs'
                      : 'text-stone-600 dark:text-stone-400'
                  }`}
                >
                  {toArabicDigits(days)} يوم
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2.5 text-xs text-stone-700 dark:text-stone-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={syncPersonalOnCreate}
              onChange={(e) => setSyncPersonalOnCreate(e.target.checked)}
              className="w-4 h-4 rounded accent-[#14532D]"
            />
            <span>
              تضمين أجزائي المكتملة حالياً (
              {toArabicDigits(personalKhatmah.completedJuz.length)} جزء) عند
              الإنشاء
            </span>
          </label>

          <button
            type="submit"
            disabled={creating}
            className="ios-spring w-full py-3 min-h-[44px] rounded-xl bg-[#14532D] hover:bg-[#114224] dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white text-sm font-medium disabled:opacity-60"
          >
            {creating ? 'جاري الإنشاء...' : 'إنشاء المجموعة وتوليد رمز الدعوة'}
          </button>
        </form>

        {/* Join Existing Group by Invite Code */}
        <form
          onSubmit={handleJoinGroup}
          className="rounded-3xl ios-glass-card p-6 space-y-5 flex flex-col justify-between"
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#9A742E]/15 dark:bg-amber-500/20 text-[#9A742E] dark:text-amber-300 flex items-center justify-center shrink-0">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-amiri text-xl font-bold text-stone-900 dark:text-stone-100">
                  الانضمام إلى ختمة جماعية
                </h2>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  أدخل رمز المجموعة الذي شاركه معك صديقك أو أحد أفراد أسرتك
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="join-group-code-input"
                className="block text-xs font-medium text-stone-700 dark:text-stone-300"
              >
                رمز الدعوة (٦ أحرف أو أرقام)
              </label>
              <input
                id="join-group-code-input"
                type="text"
                dir="ltr"
                maxLength={12}
                value={joinCodeInput}
                onChange={(e) =>
                  setJoinCodeInput(normalizeGroupCode(e.target.value))
                }
                placeholder="مثال: QUR48K"
                className="w-full px-4 py-3 text-base font-mono tracking-widest uppercase text-center rounded-xl ios-glass-input text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </div>

            <div className="rounded-2xl ios-glass-input p-4 text-xs text-stone-600 dark:text-stone-300 leading-relaxed space-y-1">
              <div className="font-semibold text-stone-800 dark:text-stone-100">
                كيف تعمل الختمة الجماعية؟
              </div>
              <p>
                بعد الانضمام يمكنك الاطلاع على تقدم كل عضو في المجموعة لحظياً،
                وتحديد الأجزاء التي أنجزتها لترتفع نسبة إكمال الختمة الجماعية
                من ٠٪ إلى ١٠٠٪.
              </p>
            </div>
          </div>

          <button
            type="submit"
            disabled={joining}
            className="ios-spring w-full py-3 min-h-[44px] rounded-xl bg-[#9A742E] hover:bg-[#806024] dark:bg-amber-600 dark:hover:bg-amber-500 text-white text-sm font-medium disabled:opacity-60"
          >
            {joining ? 'جاري الانضمام...' : 'دخول إلى الختمة الجماعية'}
          </button>
        </form>
      </div>

      {/* User's Joined Groups List */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-semibold text-stone-900 dark:text-stone-100">
            مجموعاتك في الختمة الجماعية ({toArabicDigits(myGroups.length)})
          </h3>
          <button
            type="button"
            onClick={() => void refreshMyGroups(user.uid)}
            disabled={loadingGroups}
            className="ios-spring inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl ios-glass-input text-xs font-medium text-stone-700 dark:text-stone-300"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loadingGroups ? 'animate-spin' : ''}`}
            />
            <span>تحديث</span>
          </button>
        </div>

        {myGroups.length === 0 ? (
          <div className="rounded-2xl ios-glass-card p-6 text-center text-sm text-stone-500 dark:text-stone-400">
            {loadingGroups
              ? 'جاري تحميل مجموعاتك...'
              : 'لم تنضم إلى أي ختمة جماعية بعد. أنشئ مجموعة جديدة أو أدخل رمز دعوة أعلاه.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {myGroups.map((group) => (
              <button
                key={group.groupCode}
                type="button"
                onClick={() => setActiveGroupCode(group.groupCode)}
                className="ios-spring text-right p-5 rounded-2xl ios-glass-card hover:border-[#14532D]/45 dark:hover:border-emerald-500/45 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-amiri text-xl font-bold text-stone-900 dark:text-stone-100 truncate">
                    {group.title}
                  </div>
                  <span
                    dir="ltr"
                    className="font-mono text-xs font-semibold text-[#14532D] dark:text-emerald-300 shrink-0"
                  >
                    {group.groupCode}
                  </span>
                </div>

                {group.description && (
                  <p className="text-xs text-stone-600 dark:text-stone-400 line-clamp-2">
                    {group.description}
                  </p>
                )}

                <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400 tabular-nums pt-1 border-t border-stone-200/70 dark:border-stone-800/70">
                  <span>
                    {toArabicDigits(group.memberUids.length)} عضو ·{' '}
                    {group.status === 'completed' ? 'مكتملة' : 'نشطة'}
                  </span>
                  <span className="font-medium text-[#14532D] dark:text-emerald-300">
                    متابعة التقدم ←
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
