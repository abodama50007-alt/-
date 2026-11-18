import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  Bell,
  BellOff,
  BellRing,
  Clock,
  LayoutGrid,
  LocateFixed,
  MapPin,
  Maximize2,
  Moon,
  Pause,
  PictureInPicture2,
  Play,
  RefreshCw,
  Sparkles,
  Sun,
  Sunrise,
  Sunset,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { ADHAN_VOICES, PRAYER_CALC_METHODS } from '../data/quranMeta';
import { useLanguage } from '../i18n/LanguageContext';
import { getNextPrayerInfo, getPrayerLabel } from '../services/prayerApi';
import {
  PrayerKey,
  PrayerTimingsData,
  ReminderSettings,
  SavedGeoLocation,
} from '../types/quran';
import { getCurrentHijriDate } from '../utils/hijri';
import { PRESET_CITIES } from '../utils/qibla';
import { formatWidgetCountdown, formatWidgetTime } from '../utils/widget';

interface PrayersViewProps {
  location: SavedGeoLocation;
  methodId: number;
  timings: PrayerTimingsData | null;
  loading: boolean;
  error: string | null;
  reminders: ReminderSettings;
  previewAdhanId: string | null;
  onChangeLocation: (loc: SavedGeoLocation) => void;
  onChangeMethod: (methodId: number) => void;
  onRetryTimings: () => void;
  onUpdateReminders: (partial: Partial<ReminderSettings>) => void;
  onTogglePreviewAdhan: (adhanId: string) => void;
  onTestReminder: () => void;
  onOpenQibla: () => void;
  onOpenWidgetStudio?: () => void;
  onLaunchFloatingWidget?: () => void;
  onOpenStandaloneWidget?: () => void;
}

const PRAYER_CARDS: Array<{
  key: PrayerKey | 'sunrise';
  isAlertable: boolean;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  { key: 'fajr', isAlertable: true, Icon: Sunrise },
  { key: 'sunrise', isAlertable: false, Icon: Sun },
  { key: 'dhuhr', isAlertable: true, Icon: Sun },
  { key: 'asr', isAlertable: true, Icon: Sunset },
  { key: 'maghrib', isAlertable: true, Icon: Sunset },
  { key: 'isha', isAlertable: true, Icon: Moon },
];

export const PrayersView: React.FC<PrayersViewProps> = ({
  location,
  methodId,
  timings,
  loading,
  error,
  reminders,
  previewAdhanId,
  onChangeLocation,
  onChangeMethod,
  onRetryTimings,
  onUpdateReminders,
  onTogglePreviewAdhan,
  onTestReminder,
  onOpenQibla,
  onOpenWidgetStudio,
  onLaunchFloatingWidget,
  onOpenStandaloneWidget,
}) => {
  const { language, isRTL, t, formatNumber } = useLanguage();
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(() => new Date());
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    () =>
      typeof window !== 'undefined' && 'Notification' in window
        ? Notification.permission
        : 'default'
  );

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const hijriToday = getCurrentHijriDate(nowTick, language);
  const nextPrayer = timings
    ? getNextPrayerInfo(timings, nowTick, language)
    : null;

  const handleDetectGPS = () => {
    if (!('geolocation' in navigator)) {
      setGpsError(t('prayersGpsUnsupported'));
      return;
    }
    setGpsLoading(true);
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChangeLocation({
          lat: Number(pos.coords.latitude.toFixed(4)),
          lng: Number(pos.coords.longitude.toFixed(4)),
          label: t('prayersMyLocationLabel', {
            lat: formatNumber(pos.coords.latitude.toFixed(2)),
            lng: formatNumber(pos.coords.longitude.toFixed(2)),
          }),
          source: 'gps',
        });
        setGpsLoading(false);
      },
      () => {
        setGpsError(t('prayersGpsError'));
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const handleRequestNotifications = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      onUpdateReminders({ notificationsEnabled: !reminders.notificationsEnabled });
      return;
    }
    try {
      const result = await Notification.requestPermission();
      setNotifPermission(result);
      onUpdateReminders({ notificationsEnabled: result === 'granted' });
    } catch {
      onUpdateReminders({ notificationsEnabled: true });
    }
  };

  const togglePrayerAlert = (key: PrayerKey) => {
    onUpdateReminders({
      prayerAlerts: {
        ...reminders.prayerAlerts,
        [key]: !reminders.prayerAlerts[key],
      },
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-12 space-y-8">
      {/* Header + Next Prayer Hero Card */}
      <section className="rounded-3xl ios-glass-card p-6 sm:p-8 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 text-start">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#14532D]/10 dark:bg-emerald-500/20 text-[#14532D] dark:text-emerald-300 text-xs font-medium">
              <Clock className="w-3.5 h-3.5" />
              <span>{t('prayersTitle')}</span>
            </div>
            <h1 className="font-amiri text-3xl sm:text-4xl font-bold text-stone-900 dark:text-stone-100">
              {location.label}
            </h1>
            <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300">
              {hijriToday.formattedFull} · {hijriToday.gregorianFormatted}
            </p>
          </div>

          {nextPrayer && (
            <div className="rounded-2xl bg-[#14532D] dark:bg-emerald-900/70 text-[#FBF8F1] px-6 py-4 flex items-center justify-between gap-6 shadow-md min-w-[260px]">
              <div className="space-y-0.5 text-start">
                <div className="text-xs text-emerald-100/80">
                  {t('prayersNextLabel')}
                </div>
                <div className="font-amiri text-2xl font-bold">
                  {nextPrayer.name}
                </div>
                <div className="text-xs text-emerald-100/90 tabular-nums">
                  {t('prayersAdhanAt', {
                    time: formatWidgetTime(nextPrayer.time, language),
                  })}
                </div>
              </div>
              <div className="text-end">
                <div className="text-[11px] text-emerald-100/80">
                  {t('prayersRemainingLabel')}
                </div>
                <div className="text-2xl sm:text-3xl font-bold tabular-nums tracking-wide">
                  {formatWidgetCountdown(nextPrayer.remainingSeconds, language)}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Location & Calculation Method Controls */}
        <div className="pt-4 border-t border-stone-200/70 dark:border-white/10 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDetectGPS}
              disabled={gpsLoading}
              className="ios-spring w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-medium rounded-xl bg-[#14532D] hover:bg-[#114224] dark:bg-emerald-700 dark:hover:bg-emerald-600 text-[#FBF8F1] disabled:opacity-60 whitespace-nowrap"
            >
              <LocateFixed className="w-4 h-4" />
              <span>
                {gpsLoading ? t('prayersDetectingGps') : t('prayersDetectGps')}
              </span>
            </button>
          </div>

          <div className="relative">
            <MapPin
              className={`w-4 h-4 text-stone-400 absolute top-1/2 -translate-y-1/2 pointer-events-none ${
                isRTL ? 'right-3' : 'left-3'
              }`}
            />
            <select
              aria-label={t('prayersChooseCityAria')}
              value={location.source === 'city' ? location.cityId ?? '' : ''}
              onChange={(e) => {
                const city = PRESET_CITIES.find((c) => c.id === e.target.value);
                if (city) {
                  onChangeLocation({
                    lat: city.lat,
                    lng: city.lng,
                    label: `${city.name}، ${city.country}`,
                    source: 'city',
                    cityId: city.id,
                  });
                }
              }}
              className={`w-full py-2.5 text-xs sm:text-sm rounded-xl ios-glass-input text-stone-800 dark:text-stone-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 ${
                isRTL ? 'pr-9 pl-3' : 'pl-9 pr-3'
              }`}
            >
              <option value="">
                {location.source === 'gps'
                  ? t('prayersGpsOption')
                  : t('prayersCityOption')}
              </option>
              {PRESET_CITIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.country}
                </option>
              ))}
            </select>
          </div>

          <select
            aria-label={t('prayersMethodAria')}
            value={methodId}
            onChange={(e) => onChangeMethod(Number(e.target.value))}
            className="w-full px-3 py-2.5 text-xs sm:text-sm rounded-xl ios-glass-input text-stone-800 dark:text-stone-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
          >
            {PRAYER_CALC_METHODS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        {/* Date & Prayer Widget Action Bar */}
        {(onOpenWidgetStudio || onLaunchFloatingWidget || onOpenStandaloneWidget) && (
          <div className="pt-4 border-t border-stone-200/70 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-2.5 text-start">
              <div className="w-9 h-9 rounded-xl bg-[#9A742E]/15 dark:bg-amber-500/20 text-[#9A742E] dark:text-amber-300 flex items-center justify-center shrink-0">
                <LayoutGrid className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100">
                  {t('widgetTitle')}
                </div>
                <p className="text-[11px] sm:text-xs text-stone-600 dark:text-stone-400">
                  {t('widgetSubtitle')}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {onLaunchFloatingWidget && (
                <button
                  type="button"
                  onClick={onLaunchFloatingWidget}
                  className="ios-spring inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl ios-glass-input text-xs font-semibold text-stone-800 dark:text-stone-200"
                >
                  <PictureInPicture2 className="w-3.5 h-3.5 text-[#14532D] dark:text-emerald-300" />
                  <span>{t('widgetLaunchPip')}</span>
                </button>
              )}
              {onOpenStandaloneWidget && (
                <button
                  type="button"
                  onClick={onOpenStandaloneWidget}
                  className="ios-spring inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl ios-glass-input text-xs font-semibold text-stone-800 dark:text-stone-200"
                >
                  <Maximize2 className="w-3.5 h-3.5 text-[#9A742E] dark:text-amber-300" />
                  <span>{t('widgetOpenStandalone')}</span>
                </button>
              )}
              {onOpenWidgetStudio && (
                <button
                  type="button"
                  onClick={onOpenWidgetStudio}
                  className="ios-spring inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#14532D] hover:bg-[#114224] dark:bg-emerald-700 text-white text-xs font-semibold"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>{t('widgetConfigureBtn')}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {gpsError && (
          <p className="text-xs text-amber-700 dark:text-amber-300">{gpsError}</p>
        )}
      </section>

      {/* Prayer Timings Grid */}
      {loading && !timings ? (
        <div className="rounded-3xl ios-glass-card p-10 text-center text-sm text-stone-500 dark:text-stone-400">
          {t('prayersLoadingTimings')}
        </div>
      ) : error && !timings ? (
        <div className="rounded-3xl ios-glass-card p-8 text-center space-y-3">
          <p className="text-sm text-rose-700 dark:text-rose-300">{error}</p>
          <button
            type="button"
            onClick={onRetryTimings}
            className="ios-spring inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#14532D] text-white text-xs font-medium"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{t('retry')}</span>
          </button>
        </div>
      ) : timings ? (
        <>
          <section
            aria-label={t('prayersGridAria')}
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5"
          >
            {PRAYER_CARDS.map(({ key, isAlertable, Icon }) => {
              const isNext = nextPrayer?.key === key;
              const timeVal = timings[key];
              const alertOn =
                isAlertable && reminders.prayerAlerts[key as PrayerKey];
              const prayerName = getPrayerLabel(key, language);
              return (
                <motion.div
                  key={key}
                  whileHover={{ y: -2 }}
                  className={`rounded-2xl p-4 flex flex-col justify-between gap-3 border transition-all ${
                    isNext
                      ? 'ios-glass-card border-[#14532D]/60 dark:border-emerald-400/60 ring-1 ring-[#14532D]/25'
                      : 'ios-glass-card'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                        isNext
                          ? 'bg-[#14532D] text-white dark:bg-emerald-600'
                          : 'bg-[#14532D]/10 dark:bg-emerald-500/20 text-[#14532D] dark:text-emerald-300'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>

                    {isAlertable && (
                      <button
                        type="button"
                        onClick={() => togglePrayerAlert(key as PrayerKey)}
                        aria-label={prayerName}
                        title={
                          alertOn
                            ? t('prayersAlertEnabledTitle')
                            : t('prayersAlertDisabledTitle')
                        }
                        className={`ios-spring w-8 h-8 rounded-xl flex items-center justify-center ${
                          alertOn
                            ? 'bg-emerald-900/12 text-[#14532D] dark:bg-emerald-500/20 dark:text-emerald-300'
                            : 'ios-glass-input text-stone-400'
                        }`}
                      >
                        {alertOn ? (
                          <Bell className="w-3.5 h-3.5" />
                        ) : (
                          <BellOff className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>

                  <div className="text-start">
                    <div className="text-xs text-stone-500 dark:text-stone-400">
                      {prayerName}
                    </div>
                    <div className="text-lg sm:text-xl font-bold text-stone-900 dark:text-stone-100 tabular-nums mt-0.5">
                      {formatWidgetTime(timeVal, language)}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </section>

          {/* Night & Suhoor Summary Strip */}
          <div className="rounded-2xl ios-glass-card px-5 py-3.5 flex flex-wrap items-center justify-between gap-4 text-xs sm:text-sm">
            <div className="flex flex-wrap items-center gap-5 tabular-nums text-stone-700 dark:text-stone-300">
              <span>
                <strong className="text-stone-900 dark:text-stone-100">
                  {t('prayersImsak')}
                </strong>{' '}
                {formatWidgetTime(timings.imsak, language)}
              </span>
              <span>
                <strong className="text-stone-900 dark:text-stone-100">
                  {t('prayersMidnight')}
                </strong>{' '}
                {formatWidgetTime(timings.midnight, language)}
              </span>
              <span>
                <strong className="text-[#14532D] dark:text-emerald-300">
                  {t('prayersLastThird')}
                </strong>{' '}
                {formatWidgetTime(timings.lastThird, language)}
              </span>
            </div>
            <button
              type="button"
              onClick={onOpenQibla}
              className="ios-spring text-xs font-semibold text-[#14532D] dark:text-emerald-300 hover:underline whitespace-nowrap"
            >
              {t('prayersOpenQiblaCity')} {isRTL ? '←' : '→'}
            </button>
          </div>
        </>
      ) : null}

      {/* Two-column Workspace: Adhan Voices & Daily Reminders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Adhan Voices Picker */}
        <section className="rounded-3xl ios-glass-card p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-start">
              <div className="w-9 h-9 rounded-xl bg-[#14532D]/12 dark:bg-emerald-500/20 text-[#14532D] dark:text-emerald-300 flex items-center justify-center shrink-0">
                <Volume2 className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-amiri text-xl font-bold text-stone-900 dark:text-stone-100">
                  {t('prayersAdhanVoicesTitle')}
                </h2>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  {t('prayersAdhanVoicesSubtitle')}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                onUpdateReminders({ autoPlayAdhan: !reminders.autoPlayAdhan })
              }
              className={`ios-spring px-3 py-1.5 rounded-xl text-xs font-medium border whitespace-nowrap ${
                reminders.autoPlayAdhan
                  ? 'border-[#14532D]/40 bg-[#14532D] text-white dark:bg-emerald-700'
                  : 'ios-glass-input text-stone-600 dark:text-stone-300'
              }`}
            >
              {reminders.autoPlayAdhan ? (
                <span className="inline-flex items-center gap-1">
                  <Volume2 className="w-3.5 h-3.5" /> {t('prayersAutoPlayOn')}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <VolumeX className="w-3.5 h-3.5" /> {t('prayersAutoPlayOff')}
                </span>
              )}
            </button>
          </div>

          <div className="space-y-2.5">
            {ADHAN_VOICES.map((voice) => {
              const isSelected = reminders.adhanId === voice.id;
              const isPreviewing = previewAdhanId === voice.id;
              return (
                <div
                  key={voice.id}
                  onClick={() => onUpdateReminders({ adhanId: voice.id })}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onUpdateReminders({ adhanId: voice.id });
                    }
                  }}
                  className={`cursor-pointer rounded-2xl p-3.5 border flex items-center justify-between gap-3 transition-all ${
                    isSelected
                      ? 'border-[#14532D] bg-[#14532D]/10 dark:border-emerald-500 dark:bg-emerald-500/18'
                      : 'ios-glass-input hover:border-[#14532D]/35'
                  }`}
                >
                  <div className="min-w-0 text-start">
                    <div className="text-sm font-semibold text-stone-900 dark:text-stone-100 truncate">
                      {voice.name}
                    </div>
                    <div className="text-xs text-stone-500 dark:text-stone-400">
                      {voice.muezzin} · {voice.origin}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTogglePreviewAdhan(voice.id);
                    }}
                    aria-label={voice.name}
                    className={`ios-spring px-3 py-1.5 rounded-xl text-xs font-medium inline-flex items-center gap-1.5 shrink-0 ${
                      isPreviewing
                        ? 'bg-rose-600 text-white'
                        : 'bg-[#14532D]/12 text-[#14532D] dark:bg-emerald-500/20 dark:text-emerald-300'
                    }`}
                  >
                    {isPreviewing ? (
                      <>
                        <Pause className="w-3.5 h-3.5" />
                        <span>{t('stop')}</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5" />
                        <span>{t('listen')}</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          <label className="flex items-center justify-between gap-3 pt-2 text-xs sm:text-sm text-stone-700 dark:text-stone-300 cursor-pointer text-start">
            <span>{t('prayersFajrDedicatedNote')}</span>
            <input
              type="checkbox"
              checked={reminders.fajrAdhanDedicated}
              onChange={(e) =>
                onUpdateReminders({ fajrAdhanDedicated: e.target.checked })
              }
              className="w-4 h-4 accent-[#14532D] rounded shrink-0"
            />
          </label>
        </section>

        {/* Daily Islamic Reminders */}
        <section className="rounded-3xl ios-glass-card p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-start">
              <div className="w-9 h-9 rounded-xl bg-amber-600/15 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                <BellRing className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-amiri text-xl font-bold text-stone-900 dark:text-stone-100">
                  {t('prayersDailyRemindersTitle')}
                </h2>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  {t('prayersDailyRemindersSubtitle')}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRequestNotifications}
              className={`ios-spring px-3 py-1.5 rounded-xl text-xs font-medium border whitespace-nowrap ${
                reminders.notificationsEnabled
                  ? 'border-[#14532D]/40 bg-[#14532D]/12 text-[#14532D] dark:border-emerald-500/40 dark:bg-emerald-500/20 dark:text-emerald-300'
                  : 'ios-glass-input text-stone-700 dark:text-stone-300'
              }`}
            >
              {notifPermission === 'granted' && reminders.notificationsEnabled
                ? t('prayersNotifGranted')
                : t('prayersNotifEnable')}
            </button>
          </div>

          {/* Lead time selector */}
          <div className="rounded-2xl ios-glass-input p-4 space-y-2.5 text-start">
            <div className="text-xs font-semibold text-stone-800 dark:text-stone-200">
              {t('prayersLeadTimeTitle')}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[0, 5, 10, 15].map((mins) => {
                const active = reminders.leadMinutes === mins;
                return (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => onUpdateReminders({ leadMinutes: mins })}
                    className={`ios-spring py-2 rounded-xl text-xs font-medium border ${
                      active
                        ? 'border-[#14532D] bg-[#14532D] text-white dark:bg-emerald-700'
                        : 'border-transparent bg-white/50 dark:bg-stone-800/50 text-stone-700 dark:text-stone-300'
                    }`}
                  >
                    {mins === 0
                      ? t('prayersLeadAtAdhan')
                      : t('prayersLeadMinutesBefore', {
                          mins: formatNumber(mins),
                        })}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Azkar & Khatmah & Kahf rows */}
          <div className="space-y-3">
            <div className="rounded-2xl ios-glass-input p-3.5 flex items-center justify-between gap-3 text-start">
              <div>
                <div className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                  {t('prayersMorningAzkar')}
                </div>
                <div className="text-xs text-stone-500 dark:text-stone-400">
                  {t('prayersMorningAzkarDesc')}
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <input
                  type="time"
                  aria-label={t('prayersMorningAzkar')}
                  value={reminders.azkarMorningTime}
                  onChange={(e) =>
                    onUpdateReminders({ azkarMorningTime: e.target.value })
                  }
                  className="text-xs rounded-lg px-2 py-1 bg-white/70 dark:bg-stone-900/70 border border-stone-300/60 dark:border-stone-700 text-stone-800 dark:text-stone-200"
                />
                <input
                  type="checkbox"
                  aria-label={t('prayersMorningAzkar')}
                  checked={reminders.azkarMorningEnabled}
                  onChange={(e) =>
                    onUpdateReminders({ azkarMorningEnabled: e.target.checked })
                  }
                  className="w-4 h-4 accent-[#14532D]"
                />
              </div>
            </div>

            <div className="rounded-2xl ios-glass-input p-3.5 flex items-center justify-between gap-3 text-start">
              <div>
                <div className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                  {t('prayersEveningAzkar')}
                </div>
                <div className="text-xs text-stone-500 dark:text-stone-400">
                  {t('prayersEveningAzkarDesc')}
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <input
                  type="time"
                  aria-label={t('prayersEveningAzkar')}
                  value={reminders.azkarEveningTime}
                  onChange={(e) =>
                    onUpdateReminders({ azkarEveningTime: e.target.value })
                  }
                  className="text-xs rounded-lg px-2 py-1 bg-white/70 dark:bg-stone-900/70 border border-stone-300/60 dark:border-stone-700 text-stone-800 dark:text-stone-200"
                />
                <input
                  type="checkbox"
                  aria-label={t('prayersEveningAzkar')}
                  checked={reminders.azkarEveningEnabled}
                  onChange={(e) =>
                    onUpdateReminders({ azkarEveningEnabled: e.target.checked })
                  }
                  className="w-4 h-4 accent-[#14532D]"
                />
              </div>
            </div>

            <div className="rounded-2xl ios-glass-input p-3.5 flex items-center justify-between gap-3 text-start">
              <div>
                <div className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                  {t('prayersKhatmahWird')}
                </div>
                <div className="text-xs text-stone-500 dark:text-stone-400">
                  {t('prayersKhatmahWirdDesc')}
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <input
                  type="time"
                  aria-label={t('prayersKhatmahWird')}
                  value={reminders.khatmahReminderTime}
                  onChange={(e) =>
                    onUpdateReminders({ khatmahReminderTime: e.target.value })
                  }
                  className="text-xs rounded-lg px-2 py-1 bg-white/70 dark:bg-stone-900/70 border border-stone-300/60 dark:border-stone-700 text-stone-800 dark:text-stone-200"
                />
                <input
                  type="checkbox"
                  aria-label={t('prayersKhatmahWird')}
                  checked={reminders.khatmahReminderEnabled}
                  onChange={(e) =>
                    onUpdateReminders({
                      khatmahReminderEnabled: e.target.checked,
                    })
                  }
                  className="w-4 h-4 accent-[#14532D]"
                />
              </div>
            </div>

            <label className="rounded-2xl ios-glass-input p-3.5 flex items-center justify-between gap-3 cursor-pointer text-start">
              <div>
                <div className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                  {t('prayersFridayKahf')}
                </div>
                <div className="text-xs text-stone-500 dark:text-stone-400">
                  {t('prayersFridayKahfDesc')}
                </div>
              </div>
              <input
                type="checkbox"
                checked={reminders.kahfFridayEnabled}
                onChange={(e) =>
                  onUpdateReminders({ kahfFridayEnabled: e.target.checked })
                }
                className="w-4 h-4 accent-[#14532D] shrink-0"
              />
            </label>
          </div>

          <button
            type="button"
            onClick={onTestReminder}
            className="ios-spring w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#14532D] hover:bg-[#114224] dark:bg-emerald-700 dark:hover:bg-emerald-600 text-[#FBF8F1] text-sm font-semibold shadow-xs"
          >
            <Sparkles className="w-4 h-4" />
            <span>{t('prayersTestAlertBtn')}</span>
          </button>
        </section>
      </div>
    </div>
  );
};
