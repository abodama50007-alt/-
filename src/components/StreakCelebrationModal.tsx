import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Award, BookOpen, Flame, Share2, Sparkles, X } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { DailyStreakState } from '../types/quran';
import { APP_SHARE_URL, shareNativeOrCopy } from '../utils/share';
import { getSevenDayMotivationalMessage } from '../utils/streak';

interface StreakCelebrationModalProps {
  open: boolean;
  milestoneDays: number;
  streak: DailyStreakState;
  onClose: () => void;
  onOpenMushaf: () => void;
  onShowToast?: (msg: string) => void;
}

export const StreakCelebrationModal: React.FC<StreakCelebrationModalProps> = ({
  open,
  milestoneDays,
  streak,
  onClose,
  onOpenMushaf,
  onShowToast,
}) => {
  const { language, isRTL, t, formatNumber } = useLanguage();

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  const effectiveMilestone = Math.max(7, milestoneDays || 7);
  const message = getSevenDayMotivationalMessage(effectiveMilestone, language);

  const handleShareAchievement = () => {
    const shareText =
      language === 'en'
        ? `Alhamdulillah! I completed ${effectiveMilestone} consecutive days of reading Quran and Tasbeeh on Al-Mushaf Al-Jami!`
        : `بحمد الله أتممت ${formatNumber(
            effectiveMilestone
          )} أيام متتالية في قراءة القرآن والتسبيح عبر تطبيق «المصحف الجامع»! انضم إلينا في رحلة الذكر والقرآن.`;
    void shareNativeOrCopy({
      title: t('appName'),
      text: shareText,
      url: APP_SHARE_URL,
    }).then((res) => {
      if (res === 'copied') {
        onShowToast?.(t('streakCelebrationShareCopied'));
      } else if (res === 'failed') {
        onShowToast?.(t('streakCelebrationShareFailed'));
      }
    });
  };

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="streak-celebration-title"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-stone-950/55 backdrop-blur-md"
          />

          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
            className="relative z-10 w-full max-w-xl rounded-3xl ios-glass-dock p-6 sm:p-8 space-y-6 text-center"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label={t('streakCelebrationCloseAria')}
              className={`ios-spring absolute top-5 w-10 h-10 rounded-xl ios-glass-input inline-flex items-center justify-center text-stone-600 dark:text-stone-300 ${
                isRTL ? 'left-5' : 'right-5'
              }`}
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-[#9A742E]/25 to-[#14532D]/20 border border-[#9A742E]/40 dark:border-amber-400/40 flex items-center justify-center text-[#9A742E] dark:text-amber-300 shadow-lg">
              <Award className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#9A742E] dark:text-amber-300">
                <Flame className="w-4 h-4" />
                <span>
                  {t('streakCelebrationBadge', {
                    days: formatNumber(effectiveMilestone),
                  })}
                </span>
              </div>

              <h2
                id="streak-celebration-title"
                className="font-amiri text-2xl sm:text-3xl font-bold text-[#1C1917] dark:text-[#F2EFE8] leading-snug"
              >
                {message.headline}
              </h2>
            </div>

            <div className="rounded-2xl ios-glass-input p-5 space-y-2.5 text-center">
              <p className="font-amiri text-xl sm:text-2xl font-bold text-[#14532D] dark:text-emerald-300 leading-relaxed">
                {message.hadith}
              </p>
              <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
                {message.subtext}
              </p>
            </div>

            {/* Clean Milestone Stats Row */}
            <div className="grid grid-cols-3 gap-3 py-3 border-y border-stone-200/70 dark:border-white/10 tabular-nums">
              <div>
                <div className="text-[11px] text-stone-500 dark:text-stone-400">
                  {t('streakCelebrationConsecDays')}
                </div>
                <div className="text-lg font-bold text-[#9A742E] dark:text-amber-300">
                  {formatNumber(Math.max(effectiveMilestone, streak.currentStreak))}{' '}
                  {t('day')}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-stone-500 dark:text-stone-400">
                  {t('streakTotalDaysLabel')}
                </div>
                <div className="text-lg font-bold text-stone-900 dark:text-stone-100">
                  {formatNumber(streak.totalActiveDays)} {t('day')}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-stone-500 dark:text-stone-400">
                  {t('streakPointsLabel')}
                </div>
                <div className="text-lg font-bold text-[#14532D] dark:text-emerald-300">
                  {formatNumber(streak.totalStreakPoints)} {t('points')}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenMushaf();
                }}
                className="ios-spring min-h-[44px] inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#14532D] hover:bg-[#114224] dark:bg-emerald-700 dark:hover:bg-emerald-600 text-[#FBF8F1] text-sm font-semibold whitespace-nowrap"
              >
                <BookOpen className="w-4 h-4" />
                <span>{t('streakCelebrationContinueBtn')}</span>
              </button>

              <button
                type="button"
                onClick={handleShareAchievement}
                className="ios-spring min-h-[44px] inline-flex items-center gap-2 px-4 py-2.5 rounded-xl ios-glass-input text-[#9A742E] dark:text-amber-300 text-sm font-medium whitespace-nowrap"
              >
                <Share2 className="w-4 h-4" />
                <span>{t('streakCelebrationShareBtn')}</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="ios-spring min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl ios-glass-input text-stone-700 dark:text-stone-300 text-sm font-medium whitespace-nowrap"
              >
                <Sparkles className="w-4 h-4" />
                <span>{t('streakCelebrationAlhamdulillah')}</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
