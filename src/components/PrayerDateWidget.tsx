import React, { useEffect, useState } from 'react';
import {
  Calendar,
  Clock,
  ExternalLink,
  Languages,
  MapPin,
  Maximize2,
  Moon,
  PictureInPicture2,
  RefreshCw,
  SlidersHorizontal,
  Sun,
  Sunrise,
  Sunset,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { getNextPrayerInfo, getPrayerLabel } from '../services/prayerApi';
import { PrayerKey, PrayerTimingsData } from '../types/quran';
import { getCurrentHijriDate } from '../utils/hijri';
import {
  formatWidgetCountdown,
  formatWidgetTime,
  resolveWidgetPalette,
  WidgetCustomColors,
  WidgetSize,
  WidgetTheme,
} from '../utils/widget';

interface PrayerDateWidgetProps {
  timings: PrayerTimingsData | null;
  locationLabel: string;
  theme?: WidgetTheme;
  customColors?: WidgetCustomColors;
  size?: WidgetSize;
  variant?: 'embedded' | 'standalone' | 'preview';
  loading?: boolean;
  onRefreshTimings?: () => void;
  onOpenWidgetStudio?: () => void;
  onLaunchFloatingWidget?: () => void;
  onOpenStandaloneWidget?: () => void;
  onExitStandalone?: () => void;
  onOpenPrayersPage?: () => void;
  onCycleTheme?: () => void;
}

const PRAYER_ITEMS: Array<{
  key: PrayerKey | 'sunrise';
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  { key: 'fajr', Icon: Sunrise },
  { key: 'sunrise', Icon: Sun },
  { key: 'dhuhr', Icon: Sun },
  { key: 'asr', Icon: Sunset },
  { key: 'maghrib', Icon: Sunset },
  { key: 'isha', Icon: Moon },
];

export const PrayerDateWidget: React.FC<PrayerDateWidgetProps> = ({
  timings,
  locationLabel,
  theme = 'emerald',
  customColors,
  size = 'standard',
  variant = 'embedded',
  loading = false,
  onRefreshTimings,
  onOpenWidgetStudio,
  onLaunchFloatingWidget,
  onOpenStandaloneWidget,
  onExitStandalone,
  onOpenPrayersPage,
  onCycleTheme,
}) => {
  const { language, toggleLanguage, t, formatNumber } = useLanguage();
  const [nowTick, setNowTick] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const hijri = getCurrentHijriDate(nowTick, language);
  const nextPrayer = timings
    ? getNextPrayerInfo(timings, nowTick, language)
    : null;

  const liveClock = (() => {
    try {
      return new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'ar-EG', {
        hour: '2-digit',
        minute: '2-digit',
        second: size === 'wide' || variant === 'standalone' ? '2-digit' : undefined,
      }).format(nowTick);
    } catch {
      return nowTick.toLocaleTimeString();
    }
  })();

  const palette = resolveWidgetPalette(theme, customColors);
  const isLightTheme = palette.isLight;

  const themeClasses =
    theme === 'light'
      ? 'ios-glass-card text-stone-900 dark:text-stone-100'
      : 'shadow-lg shadow-black/25';

  const widgetContainerStyle: React.CSSProperties | undefined =
    theme === 'light'
      ? undefined
      : {
          background: `linear-gradient(135deg, ${palette.primaryBg} 0%, ${palette.secondaryBg} 100%)`,
          color: palette.textColor,
          borderColor: palette.borderColor,
        };

  const mutedText = isLightTheme
    ? 'text-stone-500 dark:text-stone-400'
    : 'opacity-80';
  const subtleSurface = isLightTheme
    ? 'bg-white/65 dark:bg-stone-900/60 border-stone-200/80 dark:border-white/10'
    : 'bg-white/10 border-white/15';
  const activePrayerSurface = isLightTheme
    ? 'bg-[#14532D] text-[#FBF8F1] border-[#14532D] shadow-sm'
    : 'shadow-sm';
  const actionBtnClass = isLightTheme
    ? 'ios-glass-input text-stone-800 dark:text-stone-200 hover:bg-white/80 dark:hover:bg-stone-800/80'
    : 'bg-white/12 hover:bg-white/20 text-white border border-white/15';

  const visiblePrayers =
    size === 'compact'
      ? PRAYER_ITEMS.filter((p) => p.key !== 'sunrise')
      : PRAYER_ITEMS;

  return (
    <section
      aria-label={t('widgetTitle')}
      style={widgetContainerStyle}
      className={`rounded-3xl border p-5 sm:p-6 transition-all ${themeClasses} ${
        variant === 'standalone'
          ? 'w-full max-w-2xl mx-auto shadow-2xl'
          : ''
      }`}
    >
      {/* Top Bar: Widget Badge + Quick Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-4 border-b border-current/10">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${subtleSurface}`}
          >
            <Calendar className="w-3.5 h-3.5 text-[#D9A84E]" />
            <span>{t('widgetBadge')}</span>
          </span>
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border ${subtleSurface}`}
          >
            <MapPin className="w-3 h-3 shrink-0" />
            <span className="truncate max-w-[180px] sm:max-w-[260px]">
              {locationLabel}
            </span>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {variant === 'standalone' && (
            <>
              <button
                type="button"
                onClick={toggleLanguage}
                className={`ios-spring inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium ${actionBtnClass}`}
                title={t('settingsLanguageLabel')}
              >
                <Languages className="w-3.5 h-3.5" />
                <span>{language === 'ar' ? 'EN' : 'ع'}</span>
              </button>
              {onCycleTheme && (
                <button
                  type="button"
                  onClick={onCycleTheme}
                  className={`ios-spring inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium ${actionBtnClass}`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>
                    {theme === 'emerald'
                      ? t('widgetStyleEmerald')
                      : theme === 'royal-gold'
                      ? t('widgetStyleRoyalGold')
                      : theme === 'calm-blue'
                      ? t('widgetStyleCalmBlue')
                      : theme === 'dark'
                      ? t('widgetStyleDark')
                      : theme === 'custom'
                      ? t('widgetStyleCustom')
                      : t('widgetStyleLight')}
                  </span>
                </button>
              )}
            </>
          )}

          {onRefreshTimings && (
            <button
              type="button"
              onClick={onRefreshTimings}
              aria-label={t('widgetRefresh')}
              title={t('widgetRefresh')}
              className={`ios-spring w-8 h-8 rounded-xl inline-flex items-center justify-center ${actionBtnClass}`}
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
              />
            </button>
          )}

          {onLaunchFloatingWidget && variant !== 'preview' && (
            <button
              type="button"
              onClick={onLaunchFloatingWidget}
              className={`ios-spring inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium ${actionBtnClass}`}
            >
              <PictureInPicture2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('widgetLaunchPip')}</span>
            </button>
          )}

          {onOpenStandaloneWidget && variant === 'embedded' && (
            <button
              type="button"
              onClick={onOpenStandaloneWidget}
              aria-label={t('widgetOpenStandalone')}
              title={t('widgetOpenStandalone')}
              className={`ios-spring w-8 h-8 rounded-xl inline-flex items-center justify-center ${actionBtnClass}`}
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}

          {onOpenWidgetStudio && variant !== 'preview' && (
            <button
              type="button"
              onClick={onOpenWidgetStudio}
              className={`ios-spring inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold ${
                isLightTheme
                  ? 'bg-[#14532D] text-white hover:bg-[#114224]'
                  : 'bg-[#EAB308]/90 text-stone-950 hover:bg-[#FACC15]'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>{t('widgetOpenStudio')}</span>
            </button>
          )}

          {onExitStandalone && variant === 'standalone' && (
            <button
              type="button"
              onClick={onExitStandalone}
              className={`ios-spring inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold ${
                isLightTheme
                  ? 'bg-[#14532D] text-white hover:bg-[#114224]'
                  : 'bg-[#EAB308] text-stone-950 hover:bg-[#FACC15]'
              }`}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>{t('widgetExitStandalone')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Date + Next Prayer Row */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center py-4">
        <div className="md:col-span-7 space-y-1.5 text-start">
          <div className={`text-xs font-medium ${mutedText}`}>
            {t('widgetHijriDate')} · {liveClock}
          </div>
          <div className="font-amiri text-2xl sm:text-3xl font-bold leading-snug">
            {hijri.formattedFull}
          </div>
          <div className={`text-xs sm:text-sm ${mutedText}`}>
            {t('widgetGregorianDate')}: {hijri.gregorianFormatted}
          </div>
        </div>

        <div className="md:col-span-5">
          {nextPrayer ? (
            <div
              className={`rounded-2xl border px-4 py-3.5 flex items-center justify-between gap-4 ${subtleSurface}`}
            >
              <div className="space-y-0.5 text-start">
                <div className={`text-[11px] font-medium ${mutedText}`}>
                  {t('widgetNextPrayer')}
                </div>
                <div className="font-amiri text-xl sm:text-2xl font-bold">
                  {nextPrayer.name}
                </div>
                <div className={`text-xs tabular-nums ${mutedText}`}>
                  {formatWidgetTime(nextPrayer.time, language)}
                </div>
              </div>

              <div className="text-end">
                <div className={`text-[11px] font-medium ${mutedText}`}>
                  {t('widgetRemaining')}
                </div>
                <div className="text-xl sm:text-2xl font-extrabold tabular-nums tracking-wide">
                  {formatWidgetCountdown(nextPrayer.remainingSeconds, language)}
                </div>
              </div>
            </div>
          ) : (
            <div
              className={`rounded-2xl border px-4 py-4 text-xs text-center ${subtleSurface} ${mutedText}`}
            >
              {t('widgetNoTimings')}
            </div>
          )}
        </div>
      </div>

      {/* Prayer Times Grid */}
      {timings && (
        <div
          className={`grid gap-2 sm:gap-2.5 ${
            size === 'compact'
              ? 'grid-cols-5'
              : 'grid-cols-3 sm:grid-cols-6'
          }`}
        >
          {visiblePrayers.map(({ key, Icon }) => {
            const isNext = nextPrayer?.key === key;
            return (
              <div
                key={key}
                style={
                  isNext && !isLightTheme
                    ? {
                        backgroundColor: palette.activeBg,
                        borderColor: palette.accentColor,
                        color: palette.accentColor,
                      }
                    : undefined
                }
                className={`rounded-2xl border px-2.5 py-2.5 text-center transition-all ${
                  isNext ? activePrayerSurface : subtleSurface
                }`}
              >
                <div className="flex items-center justify-center gap-1 text-[11px] font-medium opacity-85">
                  <Icon className="w-3 h-3 shrink-0" />
                  <span>{getPrayerLabel(key, language)}</span>
                </div>
                <div className="mt-1 text-xs sm:text-sm font-bold tabular-nums">
                  {formatWidgetTime(timings[key], language)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Optional Footer Extras in Wide / Standalone */}
      {timings && (size === 'wide' || variant === 'standalone') && (
        <div
          className={`mt-4 pt-3 border-t border-current/10 flex flex-wrap items-center justify-between gap-3 text-xs ${mutedText}`}
        >
          <div className="flex flex-wrap items-center gap-4 tabular-nums">
            <span>
              {t('prayersImsak')} {formatWidgetTime(timings.imsak, language)}
            </span>
            <span>
              {t('prayersMidnight')}{' '}
              {formatWidgetTime(timings.midnight, language)}
            </span>
            <span>
              {t('prayersLastThird')}{' '}
              {formatWidgetTime(timings.lastThird, language)}
            </span>
          </div>
          {onOpenPrayersPage && (
            <button
              type="button"
              onClick={onOpenPrayersPage}
              className="inline-flex items-center gap-1 font-semibold underline underline-offset-4 hover:opacity-85"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{t('homePrayersBtn')}</span>
            </button>
          )}
        </div>
      )}

      {/* Minimal footer link in embedded mode */}
      {variant === 'embedded' && size !== 'wide' && onOpenPrayersPage && (
        <div className="mt-3 flex items-center justify-between text-[11px] opacity-85">
          <span className="tabular-nums">
            {t('homeNextPrayerBtn', {
              name: nextPrayer ? nextPrayer.name : '—',
              time: nextPrayer ? formatNumber(nextPrayer.time) : '—',
            })}
          </span>
          <button
            type="button"
            onClick={onOpenPrayersPage}
            className="font-semibold hover:underline"
          >
            {t('homePrayersBtn')}
          </button>
        </div>
      )}
    </section>
  );
};
