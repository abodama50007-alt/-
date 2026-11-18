import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  BellRing,
  BookOpen,
  Compass,
  Headphones,
  LogIn,
  Sparkles,
  Volume2,
  X,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { useLanguage } from '../i18n/LanguageContext';

interface WelcomeOverlayProps {
  open: boolean;
  user: User | null;
  authLoading: boolean;
  onGoogleSignIn: () => Promise<void> | void;
  onContinueAsGuest: () => void;
}

export const WelcomeOverlay: React.FC<WelcomeOverlayProps> = ({
  open,
  user,
  authLoading,
  onGoogleSignIn,
  onContinueAsGuest,
}) => {
  const { isRTL, t } = useLanguage();

  const highlights = [
    {
      icon: BookOpen,
      title: t('welcomeFeature1Title'),
      desc: t('welcomeFeature1Desc'),
    },
    {
      icon: Headphones,
      title: t('welcomeFeature2Title'),
      desc: t('welcomeFeature2Desc'),
    },
    {
      icon: BellRing,
      title: t('welcomeFeature3Title'),
      desc: t('welcomeFeature3Desc'),
    },
    {
      icon: Compass,
      title: t('welcomeFeature4Title'),
      desc: t('welcomeFeature4Desc'),
    },
  ];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="welcome-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-stone-950/55 backdrop-blur-md overflow-y-auto"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: 'spring', stiffness: 360, damping: 30 }}
            className="relative w-full max-w-2xl rounded-3xl ios-glass-card p-6 sm:p-8 shadow-2xl border border-white/50 dark:border-white/15 my-auto"
          >
            {/* Close / Skip Button */}
            <button
              type="button"
              onClick={onContinueAsGuest}
              aria-label={t('welcomeCloseAria')}
              className={`ios-spring absolute top-4 w-9 h-9 rounded-xl ios-glass-input flex items-center justify-center text-stone-600 dark:text-stone-300 hover:bg-white/70 dark:hover:bg-white/10 ${
                isRTL ? 'left-4' : 'right-4'
              }`}
            >
              <X className="w-4 h-4" />
            </button>

            {/* Ornamental Header */}
            <div className="text-center space-y-3 pt-2">
              <div
                dir="rtl"
                className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#14532D]/12 dark:bg-emerald-500/20 text-[#14532D] dark:text-emerald-300 text-xs font-medium"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{t('bismillah')}</span>
              </div>

              <h1
                id="welcome-title"
                className="font-amiri text-3xl sm:text-4xl font-bold text-[#14532D] dark:text-emerald-300"
              >
                {t('welcomeTitle')}
              </h1>

              <p className="text-sm sm:text-base text-stone-600 dark:text-stone-300 max-w-lg mx-auto leading-relaxed">
                {t('welcomeSubtitle')}
              </p>
            </div>

            {/* Feature Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
              {highlights.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="rounded-2xl ios-glass-input p-4 flex items-start gap-3 text-start"
                  >
                    <div className="w-9 h-9 rounded-xl bg-[#14532D]/12 dark:bg-emerald-500/20 text-[#14532D] dark:text-emerald-300 flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                        {item.title}
                      </div>
                      <p className="text-xs text-stone-600 dark:text-stone-400 mt-1 leading-relaxed">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Actions */}
            <div className="mt-7 space-y-3">
              {user ? (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl ios-glass-input p-3.5">
                  <div className="flex items-center gap-3 min-w-0">
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt={user.displayName ?? t('userLabel')}
                        className="w-10 h-10 rounded-full object-cover border border-emerald-500/30"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-[#14532D] text-white flex items-center justify-center font-bold">
                        {(user.displayName || 'U')[0]}
                      </div>
                    )}
                    <div className="min-w-0 text-start">
                      <div className="text-sm font-semibold text-stone-900 dark:text-stone-100 truncate">
                        {t('welcomeUserGreeting', {
                          name: user.displayName || t('welcomeUserDefaultName'),
                        })}
                      </div>
                      <div className="text-xs text-emerald-700 dark:text-emerald-300">
                        {t('welcomeCloudLinked')}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onContinueAsGuest}
                    className="ios-spring w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#14532D] hover:bg-[#114224] dark:bg-emerald-700 dark:hover:bg-emerald-600 text-[#FBF8F1] text-sm font-semibold whitespace-nowrap"
                  >
                    {t('welcomeEnterMushaf')}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <button
                    type="button"
                    disabled={authLoading}
                    onClick={() => void onGoogleSignIn()}
                    className="ios-spring w-full sm:flex-1 inline-flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl bg-[#14532D] hover:bg-[#114224] dark:bg-emerald-700 dark:hover:bg-emerald-600 text-[#FBF8F1] text-sm font-semibold shadow-sm disabled:opacity-60 whitespace-nowrap"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>
                      {authLoading
                        ? t('welcomeSigningIn')
                        : t('welcomeGoogleBtn')}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={onContinueAsGuest}
                    className="ios-spring w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl ios-glass-input text-stone-800 dark:text-stone-200 hover:bg-white/70 dark:hover:bg-stone-800/70 text-sm font-medium whitespace-nowrap"
                  >
                    <Volume2 className="w-4 h-4 text-[#14532D] dark:text-emerald-400" />
                    <span>{t('welcomeStartGuestBtn')}</span>
                  </button>
                </div>
              )}

              <p className="text-center text-[11px] text-stone-500 dark:text-stone-400">
                {t('welcomeFooterNote')}
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
