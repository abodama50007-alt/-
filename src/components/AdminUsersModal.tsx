import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Clock,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  ADMIN_EMAIL,
  fetchRegisteredUsers,
  isAdminUser,
  RegisteredUserRecord,
} from '../firebase';
import { toArabicDigits } from '../utils/arabic';

interface AdminUsersModalProps {
  open: boolean;
  onClose: () => void;
  currentUser: User | null;
}

function formatArabicDateTime(ms: number): string {
  if (!ms) return 'غير محدد';
  try {
    return new Intl.DateTimeFormat('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(ms));
  } catch {
    return new Date(ms).toLocaleString();
  }
}

function formatRelativeArabic(ms: number): string {
  if (!ms) return '';
  const diffSec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (diffSec < 60) return 'الآن';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `منذ ${toArabicDigits(diffMin)} د`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `منذ ${toArabicDigits(diffHours)} س`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'أمس';
  if (diffDays < 30) return `منذ ${toArabicDigits(diffDays)} يوم`;
  const diffMonths = Math.floor(diffDays / 30);
  return `منذ ${toArabicDigits(diffMonths)} شهر`;
}

export const AdminUsersModal: React.FC<AdminUsersModalProps> = ({
  open,
  onClose,
  currentUser,
}) => {
  const [users, setUsers] = useState<RegisteredUserRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const authorized = isAdminUser(currentUser);

  const loadUsers = useCallback(async () => {
    if (!authorized) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const list = await fetchRegisteredUsers();
      setUsers(list);
    } catch {
      setErrorMsg('تعذر جلب قائمة المستخدمين حالياً. تأكد من الاتصال وحاول مجدداً.');
    } finally {
      setLoading(false);
    }
  }, [authorized]);

  useEffect(() => {
    if (open && authorized) {
      void loadUsers();
    }
  }, [open, authorized, loadUsers]);

  const stats = useMemo(() => {
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    return {
      total: users.length,
      activeToday: users.filter((u) => u.updatedAtMs >= dayAgo).length,
      newThisWeek: users.filter((u) => u.createdAtMs >= weekAgo).length,
    };
  }, [users]);

  const filteredUsers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.displayName.toLowerCase().includes(q) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        u.uid.toLowerCase().includes(q)
    );
  }, [users, searchTerm]);

  return (
    <AnimatePresence>
      {open && authorized && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 bg-stone-950/45 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 360, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-users-title"
            className="w-full sm:max-w-3xl max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-3xl ios-glass-card overflow-hidden"
          >
            {/* Header */}
            <div className="px-5 sm:px-6 py-4 border-b border-white/40 dark:border-white/10 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-[#14532D]/12 dark:bg-emerald-500/20 text-[#14532D] dark:text-emerald-300 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h2
                    id="admin-users-title"
                    className="font-amiri text-xl font-bold text-stone-900 dark:text-stone-100 truncate"
                  >
                    سجل المسجلين في التطبيق
                  </h2>
                  <p className="text-xs text-stone-600 dark:text-stone-400 truncate">
                    لوحة خاصة بالمشرف • يتم تحديثها عند كل دخول عبر Google
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => void loadUsers()}
                  disabled={loading}
                  aria-label="تحديث القائمة"
                  title="تحديث القائمة"
                  className="ios-spring inline-flex items-center gap-1.5 px-3 py-2 rounded-xl ios-glass-input text-xs font-medium text-[#14532D] dark:text-emerald-300 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">تحديث</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="إغلاق"
                  className="ios-spring w-9 h-9 rounded-xl ios-glass-input flex items-center justify-center text-stone-600 dark:text-stone-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Summary KPIs */}
            <div className="px-5 sm:px-6 pt-4 grid grid-cols-3 gap-2.5 sm:gap-3 shrink-0">
              <div className="rounded-2xl ios-glass-input p-3 text-center">
                <div className="flex items-center justify-center gap-1 text-[11px] text-stone-500 dark:text-stone-400 mb-1">
                  <Users className="w-3.5 h-3.5 text-[#14532D] dark:text-emerald-300" />
                  <span>إجمالي المسجلين</span>
                </div>
                <div className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-stone-100">
                  {toArabicDigits(stats.total)}
                </div>
              </div>

              <div className="rounded-2xl ios-glass-input p-3 text-center">
                <div className="flex items-center justify-center gap-1 text-[11px] text-stone-500 dark:text-stone-400 mb-1">
                  <Clock className="w-3.5 h-3.5 text-[#C59B27]" />
                  <span>نشط اليوم</span>
                </div>
                <div className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-stone-100">
                  {toArabicDigits(stats.activeToday)}
                </div>
              </div>

              <div className="rounded-2xl ios-glass-input p-3 text-center">
                <div className="flex items-center justify-center gap-1 text-[11px] text-stone-500 dark:text-stone-400 mb-1">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>جدد هذا الأسبوع</span>
                </div>
                <div className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-stone-100">
                  {toArabicDigits(stats.newThisWeek)}
                </div>
              </div>
            </div>

            {/* Search Input */}
            <div className="px-5 sm:px-6 py-3 shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 text-stone-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="ابحث بالاسم أو البريد الإلكتروني..."
                  className="w-full pr-10 pl-4 py-2.5 text-sm rounded-2xl ios-glass-input text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-700/50"
                />
              </div>
            </div>

            {/* Users List */}
            <div className="flex-1 overflow-y-auto px-5 sm:px-6 pb-5 space-y-2.5">
              {errorMsg ? (
                <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-center space-y-2">
                  <p className="text-sm text-rose-700 dark:text-rose-300">{errorMsg}</p>
                  <button
                    type="button"
                    onClick={() => void loadUsers()}
                    className="ios-spring px-4 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-medium"
                  >
                    إعادة المحاولة
                  </button>
                </div>
              ) : loading && users.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <RefreshCw className="w-6 h-6 mx-auto text-[#14532D] dark:text-emerald-300 animate-spin" />
                  <p className="text-sm text-stone-600 dark:text-stone-400">
                    جاري تحميل سجل المستخدمين...
                  </p>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="py-12 text-center text-sm text-stone-500 dark:text-stone-400">
                  {users.length === 0
                    ? 'لا توجد حسابات مسجلة حتى الآن.'
                    : 'لا توجد نتائج مطابقة لبحثك.'}
                </div>
              ) : (
                filteredUsers.map((record) => {
                  const isAdminRecord =
                    record.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
                  return (
                    <div
                      key={record.uid}
                      className="rounded-2xl ios-glass-input p-3.5 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {record.photoURL ? (
                          <img
                            src={record.photoURL}
                            alt={record.displayName}
                            className="w-10 h-10 rounded-full object-cover shrink-0 border border-white/60 dark:border-white/10"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-[#14532D]/15 dark:bg-emerald-500/20 text-[#14532D] dark:text-emerald-300 flex items-center justify-center font-bold text-sm shrink-0">
                            {record.displayName[0] || 'م'}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-stone-900 dark:text-stone-100 truncate">
                              {record.displayName}
                            </span>
                            {isAdminRecord && (
                              <span className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-[#C59B27]/15 text-[#9A7411] dark:text-amber-300">
                                المشرف
                              </span>
                            )}
                          </div>
                          <p
                            dir="ltr"
                            className="text-xs text-stone-600 dark:text-stone-400 truncate text-right"
                          >
                            {record.email || record.uid}
                          </p>
                        </div>
                      </div>

                      <div className="text-left shrink-0 space-y-0.5">
                        <div className="text-xs font-medium text-[#14532D] dark:text-emerald-300">
                          {formatRelativeArabic(record.updatedAtMs)}
                        </div>
                        <div className="text-[11px] text-stone-500 dark:text-stone-400">
                          آخر دخول: {formatArabicDateTime(record.updatedAtMs)}
                        </div>
                        <div className="text-[10px] text-stone-400 dark:text-stone-500">
                          أول تسجيل: {formatArabicDateTime(record.createdAtMs)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
