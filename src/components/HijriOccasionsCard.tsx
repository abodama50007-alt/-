import React, { useMemo, useState } from 'react';
import { CalendarDays, ChevronDown, ChevronUp, MoonStar } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { PrayerTimingsData } from '../types/quran';
import {
  formatDaysRemainingAr,
  getCurrentHijriDate,
  getUpcomingPropheticOccasions,
} from '../utils/hijri';

interface HijriOccasionsCardProps {
  prayerTimings: PrayerTimingsData | null;
  onOpenPrayers?: () => void;
}

export const HijriOccasionsCard: React.FC<HijriOccasionsCardProps> = ({
  prayerTimings,
  onOpenPrayers,
}) => {
  const { language, t, formatNumber } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  const [selectedOccasionId, setSelectedOccasionId] = useState<string | null>(
    null
  );

  const todayKey = new Date().toDateString();

  const { hijri, occasions } = useMemo(() => {
    const now = new Date();
    return {
      hijri: getCurrentHijriDate(now, language),
      occasions: getUpcomingPropheticOccasions(now, 6, language),
    };
  }, [todayKey, language]);

  const visibleOccasions = expanded ? occasions : occasions.slice(0, 3);
  const activeOccasion =
    occasions.find((o) => o.id === selectedOccasionId) ?? occasions[0];

  return (
    <section
      aria-label={t('hijriCardAria')}
      className="rounded-3xl ios-glass-card p-6 sm:p-8 space-y-6"
    >
      {/* Top Row: Current Hijri Date & Gregorian alignment */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200/80 dark:border-stone-800/80 pb-5">
        <div className="flex items-start gap-3.5 text-start">
          <div className="w-11 h-11 rounded-2xl bg-[#14532D]/12 dark:bg-emerald-500/20 text-[#14532D] dark:text-emerald-300 flex items-center justify-center shrink-0">
            <MoonStar className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="text-xs font-medium text-[#9A742E] dark:text-amber-400">
              {t('hijriCalendarEyebrow')}
            </div>
            <h2 className="font-amiri text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100 tabular-nums">
              {hijri.formattedFull}
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400 tabular-nums">
              {t('hijriGregorianPrefix', { date: hijri.gregorianFormatted })}
              {prayerTimings?.hijriDateText && language === 'ar'
                ? ` · ${prayerTimings.hijriDateText}`
                : ''}
            </p>
          </div>
        </div>

        {onOpenPrayers && (
          <button
            type="button"
            onClick={onOpenPrayers}
            className="ios-spring self-start sm:self-center inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] text-xs font-medium rounded-xl ios-glass-input text-[#14532D] dark:text-emerald-300 hover:bg-white/75 dark:hover:bg-stone-800/75 whitespace-nowrap"
          >
            <CalendarDays className="w-4 h-4" />
            <span>{t('hijriTodayPrayersBtn')}</span>
          </button>
        )}
      </div>

      {/* Upcoming Prophetic & Islamic Occasions Header */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-start">
            <h3 className="text-base font-semibold text-stone-900 dark:text-stone-100">
              {t('hijriOccasionsTitle')}
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
              {t('hijriOccasionsSubtitle')}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="ios-spring inline-flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-xl ios-glass-input text-xs font-medium text-stone-700 dark:text-stone-300 whitespace-nowrap"
          >
            <span>
              {expanded
                ? t('hijriShowLess')
                : t('hijriShowMore', { count: formatNumber(occasions.length) })}
            </span>
            {expanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* Occasions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {visibleOccasions.map((occ) => {
            const isSelected = activeOccasion?.id === occ.id;
            return (
              <button
                key={occ.id}
                type="button"
                onClick={() => setSelectedOccasionId(occ.id)}
                className={`ios-spring text-start p-4 rounded-2xl transition-colors flex flex-col justify-between gap-2.5 border ${
                  isSelected
                    ? 'bg-[#14532D]/[0.07] dark:bg-emerald-500/[0.12] border-[#14532D]/45 dark:border-emerald-500/45'
                    : 'ios-glass-input border-transparent hover:border-[#14532D]/30'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-xs tabular-nums">
                    <span className="text-[#9A742E] dark:text-amber-400 font-medium">
                      {occ.categoryLabel} · {occ.hijriDateLabel}
                    </span>
                    <span
                      className={`font-semibold whitespace-nowrap ${
                        occ.isToday
                          ? 'text-[#14532D] dark:text-emerald-300'
                          : 'text-stone-600 dark:text-stone-300'
                      }`}
                    >
                      {formatDaysRemainingAr(occ.daysRemaining, language)}
                    </span>
                  </div>
                  <div className="font-amiri text-lg font-bold text-stone-900 dark:text-stone-100 leading-snug">
                    {occ.title}
                  </div>
                </div>

                <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed line-clamp-2">
                  {occ.sunnahNote}
                </p>
              </button>
            );
          })}
        </div>

        {/* Selected Occasion Prophetic Guidance Box */}
        {activeOccasion && (
          <div className="rounded-2xl ios-glass-input p-4 space-y-1.5 text-start">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-[#14532D] dark:text-emerald-300">
                {activeOccasion.title}
              </span>
              <span className="text-stone-500 dark:text-stone-400 tabular-nums">
                {activeOccasion.hijriDateLabel} ·{' '}
                {formatDaysRemainingAr(activeOccasion.daysRemaining, language)}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-stone-700 dark:text-stone-200 leading-relaxed">
              {activeOccasion.sunnahNote}
            </p>
          </div>
        )}
      </div>
    </section>
  );
};
