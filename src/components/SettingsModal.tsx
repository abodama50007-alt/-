import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Bell,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  CloudDownload,
  Compass,
  Headphones,
  Languages,
  LayoutGrid,
  LogIn,
  LogOut,
  MapPin,
  Maximize2,
  Moon,
  Palette,
  PictureInPicture2,
  Play,
  RotateCcw,
  Settings,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Square,
  Store,
  Sun,
  Volume2,
  X,
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  ADHAN_VOICES,
  PRAYER_CALC_METHODS,
  TAFSIR_OPTIONS,
} from '../data/quranMeta';
import { isAdminUser } from '../firebase';
import { useLanguage } from '../i18n/LanguageContext';
import {
  AppSettings,
  Reciter,
  ReminderSettings,
  RepeatMode,
  SavedGeoLocation,
  ThemeMode,
} from '../types/quran';
import { PWAInstallButton } from './PWAInstallButton';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (partial: Partial<AppSettings>) => void;
  reminders: ReminderSettings;
  onUpdateReminders: (partial: Partial<ReminderSettings>) => void;
  location: SavedGeoLocation;
  prayerMethodId: number;
  onChangePrayerMethod: (id: number) => void;
  reciters: Reciter[];
  previewAdhanId: string | null;
  onTogglePreviewAdhan: (id: string) => void;
  hasFullQuranOffline: boolean;
  user: User | null;
  authLoading: boolean;
  onSignIn: () => Promise<void> | void;
  onSignOut: () => Promise<void> | void;
  onOpenReciterPicker: () => void;
  onOpenOffline: () => void;
  onOpenPrayers: () => void;
  onOpenWelcome: () => void;
  onOpenAdminUsers?: () => void;
  onOpenStorePublish?: () => void;
  onOpenWidgetStudio?: () => void;
  onLaunchFloatingWidget?: () => void;
  onOpenStandaloneWidget?: () => void;
  onResetDefaults: () => void;
}

interface SwitchRowProps {
  label: string;
  description?: string;
  checked: boolean;
  isRTL: boolean;
  onChange: (next: boolean) => void;
}

const IOSSwitchRow: React.FC<SwitchRowProps> = ({
  label,
  description,
  checked,
  isRTL,
  onChange,
}) => (
  <div className="flex items-center justify-between gap-4 py-2.5">
    <div className="min-w-0 text-start">
      <div className="text-sm font-medium text-stone-900 dark:text-stone-100">
        {label}
      </div>
      {description && (
        <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 leading-relaxed">
          {description}
        </p>
      )}
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 ${
        checked
          ? 'bg-[#14532D] dark:bg-emerald-600'
          : 'bg-stone-300/90 dark:bg-stone-700'
      }`}
    >
      <span
        className={`inline-block h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked
            ? isRTL
              ? '-translate-x-5'
              : 'translate-x-5'
            : 'translate-x-0'
        }`}
      />
    </button>
  </div>
);

export const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  onClose,
  settings,
  onUpdateSettings,
  reminders,
  onUpdateReminders,
  location,
  prayerMethodId,
  onChangePrayerMethod,
  reciters,
  previewAdhanId,
  onTogglePreviewAdhan,
  hasFullQuranOffline,
  user,
  authLoading,
  onSignIn,
  onSignOut,
  onOpenReciterPicker,
  onOpenOffline,
  onOpenPrayers,
  onOpenWelcome,
  onOpenAdminUsers,
  onOpenStorePublish,
  onOpenWidgetStudio,
  onLaunchFloatingWidget,
  onOpenStandaloneWidget,
  onResetDefaults,
}) => {
  const { language, setLanguage, isRTL, t, formatNumber, getReciterName } =
    useLanguage();
  const [confirmReset, setConfirmReset] = useState(false);
  const [widgetGuideOpen, setWidgetGuideOpen] = useState(true);

  const activeReciter = useMemo(
    () => reciters.find((r) => r.id === settings.reciterId),
    [reciters, settings.reciterId]
  );

  const themeOptions: {
    id: ThemeMode;
    label: string;
    Icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'auto', label: t('themeAuto'), Icon: Sparkles },
    { id: 'light', label: t('themeLight'), Icon: Sun },
    { id: 'dark', label: t('themeDark'), Icon: Moon },
  ];

  const speedOptions = [0.75, 1, 1.25, 1.5];
  const repeatOptions: { id: RepeatMode; label: string }[] = [
    { id: 'none', label: t('repeatNone') },
    { id: 'ayah-3', label: t('repeatAyah3') },
    { id: 'ayah-loop', label: t('repeatAyahLoop') },
    { id: 'surah', label: t('repeatSurah') },
  ];

  const handleToggleNotifications = (next: boolean) => {
    if (
      next &&
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'default'
    ) {
      void Notification.requestPermission();
    }
    onUpdateReminders({ notificationsEnabled: next });
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 bg-stone-950/45 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => {
            setConfirmReset(false);
            onClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 360, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="app-settings-title"
            className="w-full sm:max-w-2xl max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-3xl ios-glass-card overflow-hidden"
          >
            {/* Header */}
            <div className="px-5 sm:px-6 py-4 border-b border-white/40 dark:border-white/10 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-[#14532D]/12 dark:bg-emerald-500/20 text-[#14532D] dark:text-emerald-300 flex items-center justify-center shrink-0">
                  <Settings className="w-5 h-5" />
                </div>
                <div className="min-w-0 text-start">
                  <h2
                    id="app-settings-title"
                    className="font-amiri text-xl font-bold text-stone-900 dark:text-stone-100 truncate"
                  >
                    {t('appSettingsTitle')}
                  </h2>
                  <p className="text-xs text-stone-600 dark:text-stone-400 truncate">
                    {t('settingsSubtitle')}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setConfirmReset(false);
                  onClose();
                }}
                aria-label={t('settingsCloseAria')}
                className="ios-spring w-9 h-9 rounded-xl ios-glass-input flex items-center justify-center text-stone-600 dark:text-stone-300 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-5">
              {/* 1. Language, Appearance & Display */}
              <section className="rounded-2xl ios-glass-input p-4 space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#14532D] dark:text-emerald-300">
                  <Palette className="w-4 h-4" />
                  <span>{t('settingsSectionAppearance')}</span>
                </div>

                {/* Language Switcher */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-stone-600 dark:text-stone-400">
                    <Languages className="w-3.5 h-3.5 text-[#14532D] dark:text-emerald-300" />
                    <span>{t('settingsLanguageLabel')}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-stone-200/60 dark:bg-stone-900/60">
                    <button
                      type="button"
                      onClick={() => setLanguage('ar')}
                      aria-pressed={language === 'ar'}
                      className={`ios-spring flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold ${
                        language === 'ar'
                          ? 'bg-white dark:bg-stone-800 text-[#14532D] dark:text-emerald-300 shadow-xs'
                          : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                      }`}
                    >
                      <span>{t('settingsLanguageAr')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setLanguage('en')}
                      aria-pressed={language === 'en'}
                      className={`ios-spring flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold ${
                        language === 'en'
                          ? 'bg-white dark:bg-stone-800 text-[#14532D] dark:text-emerald-300 shadow-xs'
                          : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                      }`}
                    >
                      <span>{t('settingsLanguageEn')}</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-2 pt-1 border-t border-stone-200/60 dark:border-white/10">
                  <div className="text-xs font-medium text-stone-600 dark:text-stone-400">
                    {t('settingsThemeLabel')}
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-stone-200/60 dark:bg-stone-900/60">
                    {themeOptions.map(({ id, label, Icon }) => {
                      const active = settings.themeMode === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => onUpdateSettings({ themeMode: id })}
                          className={`ios-spring flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-medium ${
                            active
                              ? 'bg-white dark:bg-stone-800 text-[#14532D] dark:text-emerald-300 shadow-xs'
                              : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2 pt-1 border-t border-stone-200/60 dark:border-white/10">
                  <div className="text-xs font-medium text-stone-600 dark:text-stone-400">
                    {t('settingsReadingModeLabel')}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-stone-200/60 dark:bg-stone-900/60">
                    <button
                      type="button"
                      onClick={() => onUpdateSettings({ readingMode: 'verses' })}
                      className={`ios-spring flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-medium ${
                        settings.readingMode === 'verses'
                          ? 'bg-white dark:bg-stone-800 text-[#14532D] dark:text-emerald-300 shadow-xs'
                          : 'text-stone-600 dark:text-stone-400'
                      }`}
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>{t('readingModeVerses')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateSettings({ readingMode: 'page' })}
                      className={`ios-spring flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-medium ${
                        settings.readingMode === 'page'
                          ? 'bg-white dark:bg-stone-800 text-[#14532D] dark:text-emerald-300 shadow-xs'
                          : 'text-stone-600 dark:text-stone-400'
                      }`}
                    >
                      <Compass className="w-3.5 h-3.5" />
                      <span>{t('readingModePage')}</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-2.5 pt-1 border-t border-stone-200/60 dark:border-white/10">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-stone-700 dark:text-stone-300">
                      {t('settingsFontSizeLabel')}
                    </span>
                    <span className="font-semibold text-[#14532D] dark:text-emerald-300 tabular-nums">
                      {formatNumber(settings.fontSize)} px
                    </span>
                  </div>
                  <input
                    type="range"
                    min={18}
                    max={48}
                    step={2}
                    value={settings.fontSize}
                    onChange={(e) =>
                      onUpdateSettings({ fontSize: Number(e.target.value) })
                    }
                    aria-label={t('settingsFontSizeLabel')}
                    className="w-full accent-[#14532D] dark:accent-emerald-500 cursor-pointer"
                  />
                  <div
                    dir="rtl"
                    className="rounded-xl bg-white/55 dark:bg-stone-900/55 border border-stone-200/60 dark:border-white/10 px-4 py-3 text-center font-quran text-stone-900 dark:text-stone-100 leading-loose"
                    style={{ fontSize: `${Math.min(38, settings.fontSize)}px` }}
                  >
                    بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
                  </div>
                </div>
              </section>

              {/* 2. Tafsir & Audio */}
              <section className="rounded-2xl ios-glass-input p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#14532D] dark:text-emerald-300">
                  <Headphones className="w-4 h-4" />
                  <span>{t('settingsSectionTafsirAudio')}</span>
                </div>

                <IOSSwitchRow
                  label={t('settingsShowTafsirInline')}
                  description={t('settingsShowTafsirInlineDesc')}
                  checked={settings.showTafsirInline}
                  isRTL={isRTL}
                  onChange={(next) =>
                    onUpdateSettings({ showTafsirInline: next })
                  }
                />

                <div className="space-y-1.5 pt-2 border-t border-stone-200/60 dark:border-white/10">
                  <label
                    htmlFor="settings-tafsir-select"
                    className="block text-xs font-medium text-stone-600 dark:text-stone-400"
                  >
                    {t('settingsTafsirSelectLabel')}
                  </label>
                  <select
                    id="settings-tafsir-select"
                    value={settings.tafsirEdition}
                    onChange={(e) =>
                      onUpdateSettings({
                        tafsirEdition: e.target.value as AppSettings['tafsirEdition'],
                      })
                    }
                    className="w-full px-3 py-2.5 text-sm rounded-xl bg-white/75 dark:bg-stone-900/75 border border-stone-200/80 dark:border-white/10 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  >
                    {TAFSIR_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.name} — {opt.author}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pt-2 border-t border-stone-200/60 dark:border-white/10 flex items-center justify-between gap-3">
                  <div className="min-w-0 text-start">
                    <div className="text-xs text-stone-500 dark:text-stone-400">
                      {t('settingsDefaultReciter')}
                    </div>
                    <div className="text-sm font-semibold text-stone-900 dark:text-stone-100 truncate">
                      {getReciterName(activeReciter, settings.reciterId)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenReciterPicker();
                    }}
                    className="ios-spring px-3.5 py-2 rounded-xl bg-[#14532D] hover:bg-[#114224] dark:bg-emerald-700 text-white text-xs font-medium shrink-0"
                  >
                    {t('change')} ({formatNumber(reciters.length)})
                  </button>
                </div>

                <div className="space-y-2 pt-2 border-t border-stone-200/60 dark:border-white/10">
                  <div className="text-xs font-medium text-stone-600 dark:text-stone-400">
                    {t('settingsPlaybackSpeed')}
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 p-1 rounded-2xl bg-stone-200/60 dark:bg-stone-900/60">
                    {speedOptions.map((spd) => (
                      <button
                        key={spd}
                        type="button"
                        onClick={() => onUpdateSettings({ playbackSpeed: spd })}
                        className={`ios-spring py-1.5 rounded-xl text-xs font-medium tabular-nums ${
                          settings.playbackSpeed === spd
                            ? 'bg-white dark:bg-stone-800 text-[#14532D] dark:text-emerald-300 shadow-xs'
                            : 'text-stone-600 dark:text-stone-400'
                        }`}
                      >
                        {formatNumber(spd)}×
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  <div className="text-xs font-medium text-stone-600 dark:text-stone-400">
                    {t('settingsRepeatMode')}
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 p-1 rounded-2xl bg-stone-200/60 dark:bg-stone-900/60">
                    {repeatOptions.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => onUpdateSettings({ repeatMode: opt.id })}
                        className={`ios-spring py-1.5 px-1 rounded-xl text-xs font-medium ${
                          settings.repeatMode === opt.id
                            ? 'bg-white dark:bg-stone-800 text-[#14532D] dark:text-emerald-300 shadow-xs'
                            : 'text-stone-600 dark:text-stone-400'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              {/* 3. Prayers, Adhan & Reminders */}
              <section className="rounded-2xl ios-glass-input p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#14532D] dark:text-emerald-300">
                  <Bell className="w-4 h-4" />
                  <span>{t('settingsSectionPrayers')}</span>
                </div>

                <div className="flex items-center justify-between gap-3 py-1">
                  <div className="flex items-center gap-2 min-w-0 text-start">
                    <MapPin className="w-4 h-4 text-[#9A742E] dark:text-amber-400 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs text-stone-500 dark:text-stone-400">
                        {t('settingsCurrentLocation')}
                      </div>
                      <div className="text-sm font-medium text-stone-900 dark:text-stone-100 truncate">
                        {location.label}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenPrayers();
                    }}
                    className="ios-spring px-3 py-1.5 rounded-xl bg-white/75 dark:bg-stone-900/75 border border-stone-200/80 dark:border-white/10 text-xs font-medium text-[#14532D] dark:text-emerald-300 shrink-0"
                  >
                    {t('settingsChangeLocation')}
                  </button>
                </div>

                {(onOpenWidgetStudio ||
                  onOpenStandaloneWidget ||
                  onLaunchFloatingWidget) && (
                  <div className="pt-3 border-t border-stone-200/60 dark:border-white/10 space-y-3">
                    <div className="rounded-2xl bg-white/60 dark:bg-stone-900/55 border border-stone-200/75 dark:border-white/10 p-3.5 space-y-3 text-start">
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-[#14532D]/12 dark:bg-emerald-500/20 text-[#14532D] dark:text-emerald-300 flex items-center justify-center shrink-0 mt-0.5">
                            <LayoutGrid className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-stone-900 dark:text-stone-100">
                              {t('settingsWidgetLabel')}
                            </div>
                            <p className="text-[11px] text-stone-600 dark:text-stone-400 mt-0.5 leading-relaxed">
                              {t('settingsWidgetDesc')}
                            </p>
                          </div>
                        </div>

                        {onOpenWidgetStudio && (
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onOpenWidgetStudio();
                            }}
                            className="ios-spring px-3 py-1.5 rounded-xl bg-[#14532D] dark:bg-emerald-700 text-white text-xs font-semibold shrink-0"
                          >
                            {t('settingsWidgetBtn')}
                          </button>
                        )}
                      </div>

                      {/* Quick Widget Launch Actions */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {onOpenStandaloneWidget && (
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onOpenStandaloneWidget();
                            }}
                            className="ios-spring flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-amber-600/12 dark:bg-amber-500/15 border border-amber-600/25 text-[#9A742E] dark:text-amber-300 text-xs font-semibold"
                          >
                            <Maximize2 className="w-3.5 h-3.5 shrink-0" />
                            <span>{t('settingsWidgetBtnStandalone')}</span>
                          </button>
                        )}

                        {onLaunchFloatingWidget && (
                          <button
                            type="button"
                            onClick={() => {
                              onLaunchFloatingWidget();
                            }}
                            className="ios-spring flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#14532D]/10 dark:bg-emerald-500/15 border border-[#14532D]/20 dark:border-emerald-500/25 text-[#14532D] dark:text-emerald-300 text-xs font-semibold"
                          >
                            <PictureInPicture2 className="w-3.5 h-3.5 shrink-0" />
                            <span>{t('settingsWidgetBtnFloating')}</span>
                          </button>
                        )}
                      </div>

                      {/* Step-by-Step Guide Toggle */}
                      <button
                        type="button"
                        onClick={() => setWidgetGuideOpen((v) => !v)}
                        aria-expanded={widgetGuideOpen}
                        className="w-full flex items-center justify-between gap-2 pt-2 border-t border-stone-200/60 dark:border-white/10 text-xs font-semibold text-[#14532D] dark:text-emerald-300"
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <Smartphone className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            {widgetGuideOpen
                              ? t('settingsWidgetGuideToggleHide')
                              : t('settingsWidgetGuideToggleShow')}
                          </span>
                        </span>
                        <ChevronDown
                          className={`w-4 h-4 transition-transform duration-200 ${
                            widgetGuideOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </button>

                      {widgetGuideOpen && (
                        <div className="space-y-2.5 pt-1 text-[11px] leading-relaxed text-stone-700 dark:text-stone-300">
                          <div className="font-bold text-stone-900 dark:text-stone-100">
                            {t('settingsWidgetStepsTitle')}
                          </div>

                          <div className="rounded-xl bg-stone-100/80 dark:bg-stone-950/60 p-2.5 space-y-1">
                            <div className="font-semibold text-[#14532D] dark:text-emerald-300">
                              {t('settingsWidgetStep1Title')}
                            </div>
                            <p>{t('settingsWidgetStep1Desc')}</p>
                            <div className="pt-1">
                              <PWAInstallButton />
                            </div>
                          </div>

                          <div className="rounded-xl bg-stone-100/80 dark:bg-stone-950/60 p-2.5 space-y-1.5">
                            <div className="font-semibold text-[#14532D] dark:text-emerald-300">
                              {t('settingsWidgetStep2Title')}
                            </div>
                            <ul className="space-y-1 list-disc list-inside">
                              <li>{t('settingsWidgetStep2Android')}</li>
                              <li>{t('settingsWidgetStep2IOS')}</li>
                              <li>{t('settingsWidgetStep2Desktop')}</li>
                            </ul>
                          </div>

                          <div className="rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-500/20 p-2.5 space-y-0.5">
                            <div className="font-semibold text-[#14532D] dark:text-emerald-300">
                              {t('settingsWidgetStep3Title')}
                            </div>
                            <p>{t('settingsWidgetStep3Desc')}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="space-y-1.5 pt-2 border-t border-stone-200/60 dark:border-white/10">
                  <label
                    htmlFor="settings-prayer-method"
                    className="block text-xs font-medium text-stone-600 dark:text-stone-400"
                  >
                    {t('settingsPrayerMethodLabel')}
                  </label>
                  <select
                    id="settings-prayer-method"
                    value={prayerMethodId}
                    onChange={(e) => onChangePrayerMethod(Number(e.target.value))}
                    className="w-full px-3 py-2.5 text-sm rounded-xl bg-white/75 dark:bg-stone-900/75 border border-stone-200/80 dark:border-white/10 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  >
                    {PRAYER_CALC_METHODS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-stone-200/60 dark:border-white/10">
                  <label
                    htmlFor="settings-adhan-voice"
                    className="block text-xs font-medium text-stone-600 dark:text-stone-400"
                  >
                    {t('settingsAdhanVoiceLabel')}
                  </label>
                  <div className="flex items-center gap-2">
                    <select
                      id="settings-adhan-voice"
                      value={reminders.adhanId}
                      onChange={(e) =>
                        onUpdateReminders({ adhanId: e.target.value })
                      }
                      className="flex-1 px-3 py-2.5 text-sm rounded-xl bg-white/75 dark:bg-stone-900/75 border border-stone-200/80 dark:border-white/10 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                    >
                      {ADHAN_VOICES.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name} ({v.muezzin})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => onTogglePreviewAdhan(reminders.adhanId)}
                      aria-label={
                        previewAdhanId === reminders.adhanId
                          ? t('settingsPreviewAdhanStop')
                          : t('settingsPreviewAdhanPlay')
                      }
                      className="ios-spring inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-[#14532D] dark:bg-emerald-700 text-white text-xs font-medium shrink-0"
                    >
                      {previewAdhanId === reminders.adhanId ? (
                        <>
                          <Square className="w-3.5 h-3.5 fill-current" />
                          <span>{t('stop')}</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>{t('listen')}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="divide-y divide-stone-200/60 dark:divide-white/10 pt-1">
                  <IOSSwitchRow
                    label={t('settingsPrayerNotifLabel')}
                    description={t('settingsPrayerNotifDesc')}
                    checked={reminders.notificationsEnabled}
                    isRTL={isRTL}
                    onChange={handleToggleNotifications}
                  />
                  <IOSSwitchRow
                    label={t('settingsAutoAdhanLabel')}
                    description={t('settingsAutoAdhanDesc')}
                    checked={reminders.autoPlayAdhan}
                    isRTL={isRTL}
                    onChange={(next) =>
                      onUpdateReminders({ autoPlayAdhan: next })
                    }
                  />
                  <IOSSwitchRow
                    label={t('settingsFajrAdhanLabel')}
                    description={t('settingsFajrAdhanDesc')}
                    checked={reminders.fajrAdhanDedicated}
                    isRTL={isRTL}
                    onChange={(next) =>
                      onUpdateReminders({ fajrAdhanDedicated: next })
                    }
                  />
                  <IOSSwitchRow
                    label={t('settingsAzkarReminderLabel')}
                    checked={
                      reminders.azkarMorningEnabled &&
                      reminders.azkarEveningEnabled
                    }
                    isRTL={isRTL}
                    onChange={(next) =>
                      onUpdateReminders({
                        azkarMorningEnabled: next,
                        azkarEveningEnabled: next,
                      })
                    }
                  />
                  <IOSSwitchRow
                    label={t('settingsKhatmahReminderLabel')}
                    description={t('settingsKhatmahReminderDesc')}
                    checked={
                      reminders.khatmahReminderEnabled &&
                      reminders.kahfFridayEnabled
                    }
                    isRTL={isRTL}
                    onChange={(next) =>
                      onUpdateReminders({
                        khatmahReminderEnabled: next,
                        kahfFridayEnabled: next,
                      })
                    }
                  />
                </div>
              </section>

              {/* 4. Offline & Account */}
              <section className="rounded-2xl ios-glass-input p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#14532D] dark:text-emerald-300">
                  <Volume2 className="w-4 h-4" />
                  <span>{t('settingsSectionOfflineAccount')}</span>
                </div>

                <div className="flex items-center justify-between gap-3 py-1">
                  <div className="flex items-center gap-2.5 min-w-0 text-start">
                    {hasFullQuranOffline ? (
                      <CheckCircle2 className="w-4 h-4 text-[#14532D] dark:text-emerald-400 shrink-0" />
                    ) : (
                      <CloudDownload className="w-4 h-4 text-[#9A742E] dark:text-amber-400 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-stone-900 dark:text-stone-100">
                        {hasFullQuranOffline
                          ? t('settingsFullQuranSaved')
                          : t('settingsOfflineMode')}
                      </div>
                      <div className="text-xs text-stone-500 dark:text-stone-400 truncate">
                        {t('settingsOfflineDesc')}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenOffline();
                    }}
                    className="ios-spring px-3 py-1.5 rounded-xl bg-white/75 dark:bg-stone-900/75 border border-stone-200/80 dark:border-white/10 text-xs font-medium text-[#14532D] dark:text-emerald-300 shrink-0"
                  >
                    {t('manage')}
                  </button>
                </div>

                <div className="pt-2 border-t border-stone-200/60 dark:border-white/10 flex items-center justify-between gap-3">
                  {user ? (
                    <>
                      <div className="flex items-center gap-2.5 min-w-0 text-start">
                        {user.photoURL ? (
                          <img
                            src={user.photoURL}
                            alt={user.displayName ?? t('userLabel')}
                            className="w-9 h-9 rounded-full object-cover shrink-0"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <span className="w-9 h-9 rounded-full bg-[#14532D] text-white text-xs font-bold flex items-center justify-center shrink-0">
                            {(user.displayName || 'U')[0]}
                          </span>
                        )}
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-stone-900 dark:text-stone-100 truncate">
                            {user.displayName || t('googleAccount')}
                          </div>
                          <div
                            dir="ltr"
                            className={`text-xs text-stone-500 dark:text-stone-400 truncate ${
                              isRTL ? 'text-right' : 'text-left'
                            }`}
                          >
                            {user.email}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void onSignOut()}
                        className="ios-spring inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/10 text-rose-700 dark:text-rose-300 text-xs font-medium shrink-0"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>{t('signOutShort')}</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="min-w-0 text-start">
                        <div className="text-sm font-medium text-stone-900 dark:text-stone-100">
                          {t('settingsCloudSyncTitle')}
                        </div>
                        <div className="text-xs text-stone-500 dark:text-stone-400">
                          {t('settingsCloudSyncDesc')}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={authLoading}
                        onClick={() => void onSignIn()}
                        className="ios-spring inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#14532D] dark:bg-emerald-700 text-white text-xs font-medium shrink-0 disabled:opacity-60"
                      >
                        <LogIn className="w-3.5 h-3.5" />
                        <span>{t('signInFull')}</span>
                      </button>
                    </>
                  )}
                </div>

                {isAdminUser(user) && onOpenAdminUsers && (
                  <div className="pt-2 border-t border-stone-200/60 dark:border-white/10 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs font-medium text-[#14532D] dark:text-emerald-300">
                      <ShieldCheck className="w-4 h-4" />
                      <span>{t('settingsAdminLabel')}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenAdminUsers();
                      }}
                      className="ios-spring px-3 py-1.5 rounded-xl bg-[#14532D]/12 dark:bg-emerald-500/20 text-[#14532D] dark:text-emerald-300 text-xs font-semibold shrink-0"
                    >
                      {t('settingsViewLog')}
                    </button>
                  </div>
                )}

                {isAdminUser(user) && onOpenStorePublish && (
                  <div className="pt-2 border-t border-stone-200/60 dark:border-white/10 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs font-medium text-[#9A742E] dark:text-amber-400">
                      <Store className="w-4 h-4 shrink-0" />
                      <span>{t('settingsStorePublishLabel')}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenStorePublish();
                      }}
                      className="ios-spring px-3 py-1.5 rounded-xl bg-[#9A742E]/15 dark:bg-amber-500/20 text-[#9A742E] dark:text-amber-300 text-xs font-semibold shrink-0"
                    >
                      {t('settingsStorePublishBtn')}
                    </button>
                  </div>
                )}

                <div className="pt-2 border-t border-stone-200/60 dark:border-white/10 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenWelcome();
                      }}
                      className="ios-spring px-3 py-2 rounded-xl bg-white/65 dark:bg-stone-900/65 border border-stone-200/80 dark:border-white/10 text-xs font-medium text-stone-700 dark:text-stone-300"
                    >
                      {t('settingsShowWelcome')}
                    </button>
                    <PWAInstallButton />
                  </div>

                  {!confirmReset ? (
                    <button
                      type="button"
                      onClick={() => setConfirmReset(true)}
                      className="ios-spring inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-stone-600 dark:text-stone-400 hover:text-rose-600 dark:hover:text-rose-400"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{t('settingsResetDefaults')}</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          onResetDefaults();
                          setConfirmReset(false);
                        }}
                        className="ios-spring px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-medium"
                      >
                        {t('settingsConfirmReset')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmReset(false)}
                        className="ios-spring px-2.5 py-1.5 rounded-xl ios-glass-input text-xs text-stone-600 dark:text-stone-300"
                      >
                        {t('cancel')}
                      </button>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
