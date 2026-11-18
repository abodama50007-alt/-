import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  BarChart3,
  CheckCircle2,
  CloudDownload,
  LogIn,
  LogOut,
  Menu,
  Settings,
  Users,
  WifiOff,
  X,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { isAdminUser } from '../firebase';
import { useLanguage } from '../i18n/LanguageContext';
import { TranslationKey } from '../i18n/translations';
import { AppSection, LastReadPosition } from '../types/quran';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  activeSection: AppSection;
  onNavigate: (section: AppSection) => void;
  lastRead: LastReadPosition;
  onResumeLastRead: () => void;
  onOpenStats: () => void;
  onOpenOffline: () => void;
  hasFullQuranOffline: boolean;
  isOnline: boolean;
  user: User | null;
  authLoading: boolean;
  onSignIn: () => Promise<void> | void;
  onSignOut: () => Promise<void> | void;
  onOpenAdminUsers?: () => void;
  onOpenSettings: () => void;
}

const NAV_ITEMS: { id: AppSection; labelKey: TranslationKey }[] = [
  { id: 'home', labelKey: 'navHome' },
  { id: 'mushaf', labelKey: 'navMushaf' },
  { id: 'index', labelKey: 'navIndex' },
  { id: 'khatmah', labelKey: 'navKhatmah' },
  { id: 'prayers', labelKey: 'navPrayers' },
  { id: 'qibla', labelKey: 'navQibla' },
  { id: 'azkar', labelKey: 'navAzkar' },
  { id: 'hisn', labelKey: 'navHisn' },
  { id: 'duas', labelKey: 'navDuas' },
  { id: 'prophets', labelKey: 'navProphets' },
  { id: 'competitions', labelKey: 'navCompetitions' },
  { id: 'promo_video', labelKey: 'navPromoVideo' },
];

export const Header: React.FC<HeaderProps> = ({
  activeSection,
  onNavigate,
  lastRead,
  onResumeLastRead,
  onOpenStats,
  onOpenOffline,
  hasFullQuranOffline,
  isOnline,
  user,
  authLoading,
  onSignIn,
  onSignOut,
  onOpenAdminUsers,
  onOpenSettings,
}) => {
  const { t, formatNumber } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);
  const canViewAdminTools = isAdminUser(user);
  const showAdminAction = Boolean(onOpenAdminUsers && canViewAdminTools);
  const visibleNavItems = canViewAdminTools
    ? NAV_ITEMS
    : NAV_ITEMS.filter((item) => item.id !== 'promo_video');

  const handleNav = (id: AppSection) => {
    onNavigate(id);
    setMobileOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-white/50 dark:border-white/10 ios-glass">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3 lg:gap-5">
        {/* Zone 1: Single-line Brand Wordmark */}
        <button
          type="button"
          onClick={() => handleNav('home')}
          className="ios-spring font-amiri text-xl sm:text-2xl font-bold tracking-tight text-[#14532D] dark:text-emerald-300 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 rounded-md px-1"
        >
          {t('appName')}
        </button>

        {/* Zone 2: Concise single-line text links */}
        <nav
          aria-label={t('navMainAria')}
          className="hidden lg:flex items-center gap-2.5 xl:gap-4 text-xs font-medium"
        >
          {visibleNavItems.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className={`relative py-2 transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 rounded-sm ${
                  isActive
                    ? 'text-[#14532D] dark:text-emerald-300 font-semibold'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
                }`}
              >
                {t(item.labelKey)}
                {isActive && (
                  <motion.span
                    layoutId="ios-header-underline"
                    transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-[17px] h-[2px] bg-[#14532D] dark:bg-emerald-400 rounded-full"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Quick Stats + Offline + Install + Auth + Primary Action */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <PWAInstallButton compact />

          <button
            type="button"
            onClick={onOpenOffline}
            aria-label={t('offlineWorkAria')}
            title={
              hasFullQuranOffline
                ? t('offlineSavedTitle')
                : t('offlineDownloadTitle')
            }
            className={`ios-spring inline-flex items-center justify-center gap-1.5 px-2.5 py-2 text-xs font-medium rounded-xl whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 ${
              !isOnline
                ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/35'
                : hasFullQuranOffline
                ? 'ios-glass-input text-[#14532D] dark:text-emerald-300'
                : 'ios-glass-input text-stone-700 dark:text-stone-200'
            }`}
          >
            {!isOnline ? (
              <WifiOff className="w-4 h-4" />
            ) : hasFullQuranOffline ? (
              <CheckCircle2 className="w-4 h-4 text-[#14532D] dark:text-emerald-300" />
            ) : (
              <CloudDownload className="w-4 h-4 text-[#14532D] dark:text-emerald-300" />
            )}
            <span className="hidden xl:inline">
              {!isOnline
                ? t('statusOffline')
                : hasFullQuranOffline
                ? t('statusSavedLocally')
                : t('statusWithoutInternet')}
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenStats}
            aria-label={t('statsAria')}
            title={t('statsAria')}
            className="ios-spring inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs sm:text-sm font-medium rounded-xl ios-glass-input text-stone-700 dark:text-stone-200 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
          >
            <BarChart3 className="w-4 h-4 text-[#14532D] dark:text-emerald-300" />
            <span className="hidden xl:inline">{t('statsShort')}</span>
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            aria-label={t('settingsLabel')}
            title={t('settingsLabel')}
            className="ios-spring inline-flex items-center justify-center gap-1.5 px-2.5 py-2 text-xs sm:text-sm font-medium rounded-xl ios-glass-input text-stone-700 dark:text-stone-200 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
          >
            <Settings className="w-4 h-4 text-[#14532D] dark:text-emerald-300" />
            <span className="hidden xl:inline">{t('settingsLabel')}</span>
          </button>

          {user ? (
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-xl ios-glass-input">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName ?? t('userLabel')}
                  className="w-6 h-6 rounded-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="w-6 h-6 rounded-full bg-[#14532D] text-white text-xs flex items-center justify-center font-bold">
                  {(user.displayName || 'U')[0]}
                </span>
              )}
              <span className="hidden lg:inline text-xs font-medium text-stone-800 dark:text-stone-200 max-w-[96px] truncate">
                {user.displayName?.split(' ')[0] || t('myAccount')}
              </span>
              {showAdminAction && (
                <button
                  type="button"
                  onClick={onOpenAdminUsers}
                  title={t('adminUsersTitle')}
                  aria-label={t('adminUsersTitle')}
                  className="p-1 rounded-lg text-[#14532D] hover:bg-emerald-900/10 dark:text-emerald-300 dark:hover:bg-emerald-500/15"
                >
                  <Users className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => void onSignOut()}
                title={t('signOut')}
                aria-label={t('signOut')}
                className="p-1 rounded-lg text-stone-500 hover:text-rose-600 dark:text-stone-400 dark:hover:text-rose-400"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={authLoading}
              onClick={() => void onSignIn()}
              className="ios-spring hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl ios-glass-input text-[#14532D] dark:text-emerald-300 hover:bg-white/70 dark:hover:bg-stone-800/70 whitespace-nowrap shrink-0 disabled:opacity-60"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>{t('signIn')}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onResumeLastRead}
            title={t('resumeReadingWithSurah', {
              surah: lastRead.surahName,
              ayah: formatNumber(lastRead.ayahNumberInSurah),
            })}
            className="ios-spring hidden sm:inline-flex items-center justify-center px-3.5 py-2 text-xs sm:text-sm font-medium rounded-xl bg-[#14532D] hover:bg-[#114224] dark:bg-emerald-700 dark:hover:bg-emerald-600 text-[#FBF8F1] shadow-xs whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
          >
            {t('resumeReading')}
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label={mobileOpen ? t('closeMenu') : t('openMenu')}
            aria-expanded={mobileOpen}
            className="ios-spring lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-xl ios-glass-input text-stone-700 dark:text-stone-300"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Smooth Mobile Navigation Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="lg:hidden border-t border-white/40 dark:border-white/10 ios-glass px-4 py-3 space-y-1"
          >
            {visibleNavItems.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNav(item.id)}
                  className={`ios-spring w-full text-start px-3 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap ${
                    isActive
                      ? 'bg-emerald-900/12 dark:bg-emerald-500/20 text-[#14532D] dark:text-emerald-300'
                      : 'text-stone-700 dark:text-stone-300 hover:bg-stone-900/5 dark:hover:bg-white/5'
                  }`}
                >
                  {t(item.labelKey)}
                </button>
              );
            })}
            <div className="pt-2 border-t border-stone-200/60 dark:border-white/10 space-y-2">
              <div className="flex items-center justify-center">
                <PWAInstallButton />
              </div>

              <button
                type="button"
                onClick={() => {
                  onOpenOffline();
                  setMobileOpen(false);
                }}
                className="ios-spring w-full px-4 py-2 text-xs font-medium rounded-xl ios-glass-input text-[#14532D] dark:text-emerald-300 flex items-center justify-center gap-2"
              >
                <CloudDownload className="w-3.5 h-3.5" />
                <span>
                  {hasFullQuranOffline
                    ? t('offlineSavedTitle')
                    : t('offlineDownloadTitle')}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onOpenSettings();
                  setMobileOpen(false);
                }}
                className="ios-spring w-full px-4 py-2 text-xs font-medium rounded-xl ios-glass-input text-stone-800 dark:text-stone-200 flex items-center justify-center gap-2"
              >
                <Settings className="w-3.5 h-3.5 text-[#14532D] dark:text-emerald-300" />
                <span>{t('appSettingsTitle')}</span>
              </button>

              {showAdminAction && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenAdminUsers?.();
                    setMobileOpen(false);
                  }}
                  className="ios-spring w-full px-4 py-2 text-xs font-medium rounded-xl ios-glass-input text-[#14532D] dark:text-emerald-300 flex items-center justify-center gap-2"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>{t('adminUsersTitle')}</span>
                </button>
              )}

              {user ? (
                <button
                  type="button"
                  onClick={() => {
                    void onSignOut();
                    setMobileOpen(false);
                  }}
                  className="ios-spring w-full px-4 py-2 text-xs font-medium rounded-xl ios-glass-input text-rose-700 dark:text-rose-300 flex items-center justify-center gap-2"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>
                    {t('signOut')} ({user.displayName || t('myAccount')})
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={authLoading}
                  onClick={() => {
                    void onSignIn();
                    setMobileOpen(false);
                  }}
                  className="ios-spring w-full px-4 py-2 text-xs font-medium rounded-xl ios-glass-input text-[#14532D] dark:text-emerald-300 flex items-center justify-center gap-2"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>{t('signInGoogle')}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  onResumeLastRead();
                  setMobileOpen(false);
                }}
                className="ios-spring w-full px-4 py-2.5 text-sm font-medium rounded-xl bg-[#14532D] dark:bg-emerald-700 text-[#FBF8F1] text-center whitespace-nowrap"
              >
                {t('resumeReadingShortWithSurah', { surah: lastRead.surahName })}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};
