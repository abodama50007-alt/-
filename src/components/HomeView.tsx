import React, { useState } from 'react';
import {
  ArrowLeft,
  BarChart3,
  BookHeart,
  BookOpen,
  CheckCircle2,
  Clock,
  CloudDownload,
  Compass,
  Film,
  Headphones,
  Heart,
  Play,
  ScrollText,
  Search,
  Settings,
  Share2,
  Shield,
  Trophy,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { isAdminUser } from '../firebase';
import { useLanguage } from '../i18n/LanguageContext';
import { getNextPrayerInfo } from '../services/prayerApi';
import { APP_DEFAULT_SHARE_TEXT, APP_SHARE_URL, shareNativeOrCopy } from '../utils/share';
import {
  AppSection,
  BookmarkItem,
  DailyStreakState,
  KhatmahState,
  LastReadPosition,
  PrayerTimingsData,
  ReflectionNote,
  SurahMeta,
} from '../types/quran';
import { DailyStreakSection } from './DailyStreakSection';
import { HijriOccasionsCard } from './HijriOccasionsCard';
import { PrayerDateWidget } from './PrayerDateWidget';
import { WidgetCustomColors, WidgetSize, WidgetTheme } from '../utils/widget';

interface HomeViewProps {
  surahList: SurahMeta[];
  lastRead: LastReadPosition;
  khatmah: KhatmahState;
  activeKhatmahName?: string;
  bookmarks: BookmarkItem[];
  notes: ReflectionNote[];
  totalTasbeehCount: number;
  dailyStreak: DailyStreakState;
  user: User | null;
  prayerTimings: PrayerTimingsData | null;
  locationLabel: string;
  recitersCount: number;
  hasFullQuranOffline: boolean;
  onNavigate: (section: AppSection) => void;
  onOpenSurah: (surahNumber: number, ayahNumber?: number) => void;
  onSearchSubmit: (query: string) => void;
  onOpenStats: () => void;
  onOpenReciterPicker: () => void;
  onOpenWelcome: () => void;
  onOpenOffline: () => void;
  onOpenSettings: () => void;
  onQuickTasbeeh: () => void;
  onClaimDailyReward: () => void;
  onOpenSevenDayCelebration: (milestoneDays: number) => void;
  onOpenHifzQuiz?: () => void;
  onShowToast?: (msg: string) => void;
  widgetTheme?: WidgetTheme;
  widgetCustomColors?: WidgetCustomColors;
  widgetSize?: WidgetSize;
  onOpenWidgetStudio?: () => void;
  onLaunchFloatingWidget?: () => void;
  onOpenStandaloneWidget?: () => void;
}

interface DailyAyahItem {
  surahNumber: number;
  surahName: string;
  surahNameEn: string;
  ayahNumber: number;
  text: string;
  tafsir: string;
  tafsirEn: string;
}

const DAILY_AYAHS: DailyAyahItem[] = [
  {
    surahNumber: 2,
    surahName: 'سورة البقرة',
    surahNameEn: 'Surah Al-Baqarah',
    ayahNumber: 286,
    text: 'لَا يُكَلِّفُ ٱللَّهُ نَفْسًا إِلَّا وُسْعَهَا ۚ لَهَا مَا كَسَبَتْ وَعَلَيْهَا مَا ٱكْتَسَبَتْ',
    tafsir:
      'من رحمة الله بعباده أنه لا يكلف أحداً من الأعمال ما لا يطيقه، فلكل نفس ثواب ما عملت من خير، وعليها عقاب ما اكتسبت من شر.',
    tafsirEn:
      'Allah does not burden a soul beyond its capacity; it will have the reward of what good it has earned and bear the consequence of what ill it has done.',
  },
  {
    surahNumber: 13,
    surahName: 'سورة الرعد',
    surahNameEn: 'Surah Ar-Rad',
    ayahNumber: 28,
    text: 'ٱلَّذِينَ ءَامَنُوا۟ وَتَطْمَئِنُّ قُلُوبُهُم بِذِكْرِ ٱللَّهِ ۗ أَلَا بِذِكْرِ ٱللَّهِ تَطْمَئِنُّ ٱلْقُلُوبُ',
    tafsir:
      'الذين آمنوا تسكن قلوبهم وتستأنس بذكر الله وتوحيده، فذكر الله هو منبع السكينة والطمأنينة الحقيقية للنفس.',
    tafsirEn:
      'Those who have believed and whose hearts find rest in the remembrance of Allah. Unquestionably, in the remembrance of Allah do hearts find peace.',
  },
  {
    surahNumber: 94,
    surahName: 'سورة الشرح',
    surahNameEn: 'Surah Ash-Sharh',
    ayahNumber: 5,
    text: 'فَإِنَّ مَعَ ٱلْعُسْرِ يُسْرًا ۝ إِنَّ مَعَ ٱلْعُسْرِ يُسْرًا',
    tafsir:
      'بشارة ربانية بأن مع كل ضيق وشدة فرجاً وتيسيراً قريباً، ولا يغلب عسرٌ يسرين.',
    tafsirEn:
      'Indeed, with hardship comes ease. Indeed, with hardship comes ease — a divine promise of relief accompanying every trial.',
  },
  {
    surahNumber: 39,
    surahName: 'سورة الزمر',
    surahNameEn: 'Surah Az-Zumar',
    ayahNumber: 53,
    text: 'قُلْ يَٰعِبَادِىَ ٱلَّذِينَ أَسْرَفُوا۟ عَلَىٰٓ أَنفُسِهِمْ لَا تَقْنَطُوا۟ مِن رَّحْمَةِ ٱللَّهِ ۚ إِنَّ ٱللَّهَ يَغْفِرُ ٱلذُّنُوبَ جَمِيعًا',
    tafsir:
      'نداء رحمة واسع يدعو المذنبين إلى التوبة وعدم اليأس، فإن الله يغفر الذنوب جميعها لمن تاب وأناب إليه.',
    tafsirEn:
      'A boundless call of mercy urging believers never to despair of Allah’s forgiveness, for He forgives all sins for those who sincerely repent.',
  },
  {
    surahNumber: 65,
    surahName: 'سورة الطلاق',
    surahNameEn: 'Surah At-Talaq',
    ayahNumber: 3,
    text: 'وَمَن يَتَوَكَّلْ عَلَى ٱللَّهِ فَهُوَ حَسْبُهُۥٓ ۚ إِنَّ ٱللَّهَ بَٰلِغُ أَمْرِهِۦ',
    tafsir:
      'من اعتمد على الله وفوّض أمره إليه كفاه الله ما أهمّه، وحقق له ما فيه خيره في الدنيا والآخرة.',
    tafsirEn:
      'Whoever relies upon Allah — then He is sufficient for him. Allah will surely accomplish His purpose.',
  },
  {
    surahNumber: 16,
    surahName: 'سورة النحل',
    surahNameEn: 'Surah An-Nahl',
    ayahNumber: 97,
    text: 'مَنْ عَمِلَ صَٰلِحًا مِّن ذَكَرٍ أَوْ أُنثَىٰ وَهُوَ مُؤْمِنٌ فَلَنُحْيِيَنَّهُۥ حَيَوٰةً طَيِّبَةً',
    tafsir:
      'وعد إلهي بالسعادة والرضا والحياة الطيبة في الدنيا والأجر العظيم في الآخرة لكل مؤمن عامل بالصالحات.',
    tafsirEn:
      'Whoever does righteousness, whether male or female, while being a believer — We will surely cause them to live a good, serene life.',
  },
  {
    surahNumber: 2,
    surahName: 'سورة البقرة',
    surahNameEn: 'Surah Al-Baqarah',
    ayahNumber: 152,
    text: 'فَٱذْكُرُونِىٓ أَذْكُرْكُمْ وَٱشْكُرُوا۟ لِى وَلَا تَكْفُرُونِ',
    tafsir:
      'اذكروني بالطاعة والدعاء أذكركم بالمغفرة والثناء في الملأ الأعلى، واشكروا نعمي عليكم ولا تجحدوها.',
    tafsirEn:
      'So remember Me; I will remember you. And be grateful to Me and do not deny Me.',
  },
];

const FEATURED_SURAH_NUMBERS = [1, 2, 18, 36, 55, 67];

export const HomeView: React.FC<HomeViewProps> = ({
  surahList,
  lastRead,
  khatmah,
  activeKhatmahName,
  bookmarks,
  notes,
  totalTasbeehCount,
  dailyStreak,
  user,
  prayerTimings,
  locationLabel,
  recitersCount,
  hasFullQuranOffline,
  onNavigate,
  onOpenSurah,
  onSearchSubmit,
  onOpenStats,
  onOpenReciterPicker,
  onOpenWelcome,
  onOpenOffline,
  onOpenSettings,
  onQuickTasbeeh,
  onClaimDailyReward,
  onOpenSevenDayCelebration,
  onOpenHifzQuiz,
  onShowToast,
  widgetTheme = 'emerald',
  widgetCustomColors,
  widgetSize = 'standard',
  onOpenWidgetStudio,
  onLaunchFloatingWidget,
  onOpenStandaloneWidget,
}) => {
  const { language, isRTL, t, formatNumber, getSurahName, getRevelationLabel } =
    useLanguage();
  const [heroQuery, setHeroQuery] = useState('');

  // Deterministic verse of the day based on local calendar day
  const now = new Date();
  const dayIndex =
    Math.floor(
      Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000
    ) % DAILY_AYAHS.length;
  const dailyAyah = DAILY_AYAHS[Math.abs(dayIndex)];
  const nextPrayer = prayerTimings
    ? getNextPrayerInfo(prayerTimings, now, language)
    : null;

  const khatmahPct = Math.min(
    100,
    Math.round((khatmah.currentPage / 604) * 100)
  );
  const dailyWirdPages = Math.ceil(604 / khatmah.targetDays);

  const featuredSurahs = FEATURED_SURAH_NUMBERS.map((num) =>
    surahList.find((s) => s.number === num)
  ).filter((s): s is SurahMeta => Boolean(s));

  const lastReadSurahMeta = surahList.find(
    (s) => s.number === lastRead.surahNumber
  );
  const lastReadDisplayName = getSurahName(
    lastReadSurahMeta,
    lastRead.surahName
  );

  const handleHeroSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (heroQuery.trim()) {
      onSearchSubmit(heroQuery.trim());
    } else {
      onNavigate('search');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 pb-10 space-y-12">
      {/* Hero Section */}
      <section className="relative rounded-3xl ios-glass-card px-6 py-10 sm:px-12 sm:py-14 overflow-hidden">
        {/* Subtle geometric corner ornaments */}
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute top-3 right-3 w-12 h-12 text-[#9A742E]/35 dark:text-amber-500/25"
          viewBox="0 0 48 48"
          fill="none"
        >
          <path d="M46 2H20C10.059 2 2 10.059 2 20V46" stroke="currentColor" strokeWidth="1.25" />
          <path d="M40 8H21C13.82 8 8 13.82 8 21V40" stroke="currentColor" strokeWidth="0.9" />
        </svg>
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute bottom-3 left-3 w-12 h-12 text-[#9A742E]/35 dark:text-amber-500/25 scale-[-1]"
          viewBox="0 0 48 48"
          fill="none"
        >
          <path d="M46 2H20C10.059 2 2 10.059 2 20V46" stroke="currentColor" strokeWidth="1.25" />
          <path d="M40 8H21C13.82 8 8 13.82 8 21V40" stroke="currentColor" strokeWidth="0.9" />
        </svg>

        <div className="max-w-3xl mx-auto text-center space-y-6 relative z-10">
          <div className="flex flex-wrap items-center justify-center gap-2 text-xs sm:text-sm text-stone-600 dark:text-stone-400">
            <span>
              {user
                ? t('homeGreetingSynced', {
                    name: user.displayName?.split(' ')[0] || t('myAccount'),
                  })
                : t('homeGuestTagline')}
            </span>
            <button
              type="button"
              onClick={onOpenWelcome}
              className="text-xs font-medium text-[#14532D] dark:text-emerald-300 hover:underline"
            >
              {t('homeWelcomeGuideBtn')}
            </button>
          </div>

          <h1 className="font-amiri text-3xl sm:text-5xl font-bold text-[#1C1917] dark:text-[#F2EFE8] leading-snug text-balance">
            {t('homeHeroTitle')}
          </h1>

          <p className="text-sm sm:text-base text-stone-600 dark:text-stone-300 max-w-2xl mx-auto leading-relaxed">
            {t('homeHeroSubtitle', { count: formatNumber(recitersCount) })}
          </p>

          {/* Hero Instant Search */}
          <form
            onSubmit={handleHeroSearch}
            className="max-w-xl mx-auto flex items-center gap-2 pt-1"
          >
            <div className="relative flex-1">
              <Search
                className={`w-4 h-4 text-stone-400 absolute top-1/2 -translate-y-1/2 pointer-events-none ${
                  isRTL ? 'right-3.5' : 'left-3.5'
                }`}
              />
              <input
                type="search"
                value={heroQuery}
                onChange={(e) => setHeroQuery(e.target.value)}
                placeholder={t('homeSearchPlaceholder')}
                aria-label={t('homeSearchAria')}
                className={`w-full py-3 text-sm rounded-xl ios-glass-input text-stone-900 dark:text-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 ${
                  isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'
                }`}
              />
            </div>
            <button
              type="submit"
              className="ios-spring px-5 py-3 text-sm font-medium rounded-xl bg-[#14532D] hover:bg-[#114224] dark:bg-emerald-700 dark:hover:bg-emerald-600 text-[#FBF8F1] whitespace-nowrap shrink-0"
            >
              {t('searchBtn')}
            </button>
          </form>

          {/* Primary & Secondary Hero Actions */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() =>
                onOpenSurah(lastRead.surahNumber, lastRead.ayahNumberInSurah)
              }
              className="ios-spring inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-xl bg-[#14532D] hover:bg-[#114224] dark:bg-emerald-700 dark:hover:bg-emerald-600 text-[#FBF8F1] whitespace-nowrap"
            >
              <BookOpen className="w-4 h-4" />
              <span>
                {t('resumeReading')}: {lastReadDisplayName} ({t('ayah')}{' '}
                {formatNumber(lastRead.ayahNumberInSurah)})
              </span>
            </button>

            <button
              type="button"
              onClick={onOpenReciterPicker}
              className="ios-spring inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-xl ios-glass-input text-stone-800 dark:text-stone-200 hover:bg-white/70 dark:hover:bg-stone-800/70 whitespace-nowrap"
            >
              <Headphones className="w-4 h-4 text-[#14532D] dark:text-emerald-300" />
              <span>
                {t('homeRecitersBtn', { count: formatNumber(recitersCount) })}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('prayers')}
              className="ios-spring inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-xl ios-glass-input text-stone-800 dark:text-stone-200 hover:bg-white/70 dark:hover:bg-stone-800/70 whitespace-nowrap"
            >
              <Clock className="w-4 h-4 text-[#14532D] dark:text-emerald-300" />
              <span>
                {nextPrayer
                  ? t('homeNextPrayerBtn', {
                      name: nextPrayer.name,
                      time: formatNumber(nextPrayer.time),
                    })
                  : t('homePrayersBtn')}
              </span>
            </button>

            <button
              type="button"
              onClick={onOpenStats}
              className="ios-spring inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-xl ios-glass-input text-[#14532D] dark:text-emerald-300 hover:bg-white/70 dark:hover:bg-stone-800/70 whitespace-nowrap"
            >
              <BarChart3 className="w-4 h-4" />
              <span>{t('homeStatsBtn')}</span>
            </button>

            <button
              type="button"
              onClick={onOpenOffline}
              className="ios-spring inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-xl ios-glass-input text-stone-800 dark:text-stone-200 hover:bg-white/70 dark:hover:bg-stone-800/70 whitespace-nowrap"
            >
              <CloudDownload className="w-4 h-4 text-[#14532D] dark:text-emerald-300" />
              <span>
                {hasFullQuranOffline
                  ? t('homeOfflineReadyBtn')
                  : t('homeOfflineDownloadBtn')}
              </span>
            </button>

            <button
              type="button"
              onClick={onOpenSettings}
              className="ios-spring inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-xl ios-glass-input text-stone-800 dark:text-stone-200 hover:bg-white/70 dark:hover:bg-stone-800/70 whitespace-nowrap"
            >
              <Settings className="w-4 h-4 text-[#14532D] dark:text-emerald-300" />
              <span>{t('settingsLabel')}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                void shareNativeOrCopy({
                  title: t('appName'),
                  text: APP_DEFAULT_SHARE_TEXT,
                  url: APP_SHARE_URL,
                }).then((res) => {
                  if (res === 'copied') {
                    onShowToast?.(t('shareSuccess'));
                  } else if (res === 'failed') {
                    onShowToast?.(t('shareFailed'));
                  }
                });
              }}
              className="ios-spring inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-xl ios-glass-input text-[#9A742E] dark:text-amber-300 hover:bg-white/70 dark:hover:bg-stone-800/70 whitespace-nowrap"
            >
              <Share2 className="w-4 h-4" />
              <span>{t('shareApp')}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Personal Progress Strip (3 clean columns) */}
      <section aria-label={t('homeProgressAria')} className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <button
          type="button"
          onClick={() =>
            onOpenSurah(lastRead.surahNumber, lastRead.ayahNumberInSurah)
          }
          className="ios-spring text-start p-5 rounded-2xl ios-glass-card hover:border-[#14532D]/45 dark:hover:border-emerald-500/40 space-y-2"
        >
          <div className="text-xs text-stone-500 dark:text-stone-400">
            {t('homeLastReadTitle')}
          </div>
          <div className="font-amiri text-2xl font-bold text-stone-900 dark:text-stone-100">
            {lastReadDisplayName}
          </div>
          <div className="text-xs text-[#14532D] dark:text-emerald-300 tabular-nums">
            {t('homeLastReadMeta', {
              ayah: formatNumber(lastRead.ayahNumberInSurah),
              page: formatNumber(lastRead.page),
              juz: formatNumber(lastRead.juz),
            })}
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('khatmah')}
          className="ios-spring text-start p-5 rounded-2xl ios-glass-card hover:border-[#14532D]/45 dark:hover:border-emerald-500/40 space-y-2.5"
        >
          <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400 gap-2">
            <span className="truncate">
              {activeKhatmahName
                ? t('homeKhatmahProgressNamed', { name: activeKhatmahName })
                : t('homeKhatmahProgressDefault')}
            </span>
            <span className="font-semibold text-[#14532D] dark:text-emerald-300 tabular-nums shrink-0">
              {formatNumber(khatmahPct)}
              {isRTL ? '٪' : '%'}
            </span>
          </div>
          <div className="text-xl font-bold text-stone-900 dark:text-stone-100 tabular-nums">
            {t('homeKhatmahPageOf', {
              current: formatNumber(khatmah.currentPage),
              total: formatNumber(604),
            })}
          </div>
          <div className="h-1.5 w-full rounded-full bg-stone-200/80 dark:bg-stone-800/80 overflow-hidden">
            <div
              className="h-full bg-[#14532D] dark:bg-emerald-500 transition-[width] duration-300"
              style={{ width: `${khatmahPct}%` }}
            />
          </div>
          <div className="text-xs text-stone-500 dark:text-stone-400 tabular-nums">
            {t('homeKhatmahDailyWird', {
              pages: formatNumber(dailyWirdPages),
            })}
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('azkar')}
          className="ios-spring text-start p-5 rounded-2xl ios-glass-card hover:border-[#14532D]/45 dark:hover:border-emerald-500/40 space-y-2"
        >
          <div className="text-xs text-stone-500 dark:text-stone-400">
            {t('homeSavedAndZikr')}
          </div>
          <div className="text-xl font-bold text-stone-900 dark:text-stone-100 tabular-nums">
            {t('homeBookmarksAndNotes', {
              bookmarks: formatNumber(bookmarks.length),
              notes: formatNumber(notes.length),
            })}
          </div>
          <div className="text-xs text-[#9A742E] dark:text-amber-400 tabular-nums">
            {t('homeTotalTasbeeh', {
              count: formatNumber(totalTasbeehCount),
            })}
          </div>
        </button>
      </section>

      {/* Daily Streaks & 7-Day Reward Journey */}
      <DailyStreakSection
        streak={dailyStreak}
        onOpenMushaf={() =>
          onOpenSurah(lastRead.surahNumber, lastRead.ayahNumberInSurah)
        }
        onOpenAzkar={() => onNavigate('azkar')}
        onQuickTasbeeh={onQuickTasbeeh}
        onClaimReward={onClaimDailyReward}
        onOpenSevenDayCelebration={onOpenSevenDayCelebration}
      />

      {/* Hijri Date & Upcoming Prophetic Occasions */}
      <HijriOccasionsCard
        prayerTimings={prayerTimings}
        onOpenPrayers={() => onNavigate('prayers')}
      />

      {/* Live Date & Prayer Times Widget */}
      <PrayerDateWidget
        timings={prayerTimings}
        locationLabel={locationLabel}
        theme={widgetTheme}
        customColors={widgetCustomColors}
        size={widgetSize}
        variant="embedded"
        onOpenWidgetStudio={onOpenWidgetStudio}
        onLaunchFloatingWidget={onLaunchFloatingWidget}
        onOpenStandaloneWidget={onOpenStandaloneWidget}
        onOpenPrayersPage={() => onNavigate('prayers')}
      />

      {/* Verse of the Day Section */}
      <section className="rounded-2xl ios-glass-card p-6 sm:p-8 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200/80 dark:border-stone-800 pb-4">
          <div className="space-y-0.5 text-start">
            <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
              {t('homeDailyAyahTitle')}
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400 tabular-nums">
              {t('homeDailyAyahMeta', {
                surah:
                  language === 'en' ? dailyAyah.surahNameEn : dailyAyah.surahName,
                ayah: formatNumber(dailyAyah.ayahNumber),
              })}
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              onOpenSurah(dailyAyah.surahNumber, dailyAyah.ayahNumber)
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-stone-300 dark:border-stone-700 text-stone-800 dark:text-stone-200 hover:bg-stone-200/50 dark:hover:bg-stone-800 transition-colors whitespace-nowrap"
          >
            <Play className="w-3.5 h-3.5 text-[#14532D] dark:text-emerald-400" />
            <span>{t('homeReadAyahInSurah')}</span>
          </button>
        </div>

        <p
          dir="rtl"
          className="font-quran text-2xl sm:text-3xl leading-[2.2] text-[#1C1917] dark:text-[#F2EFE8] text-right"
        >
          ﴿{dailyAyah.text}﴾
        </p>

        <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-300 max-w-3xl text-start">
          {language === 'en' ? dailyAyah.tafsirEn : dailyAyah.tafsir}
        </p>
      </section>

      {/* Featured Surahs Grid */}
      <section className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div className="text-start">
            <h2 className="font-amiri text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100">
              {t('homeFeaturedSurahsTitle')}
            </h2>
            <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-0.5">
              {t('homeFeaturedSurahsSubtitle')}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('index')}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-[#14532D] dark:text-emerald-300 hover:underline whitespace-nowrap"
          >
            <span>{t('homeAllSurahsBtn', { count: formatNumber(114) })}</span>
            <ArrowLeft className={`w-4 h-4 ${!isRTL ? 'rotate-180' : ''}`} />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {featuredSurahs.map((surah) => (
            <button
              key={surah.number}
              type="button"
              onClick={() => onOpenSurah(surah.number)}
              className="ios-spring group text-start p-4 rounded-2xl ios-glass-card hover:border-[#14532D]/50 dark:hover:border-emerald-500/40 flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-10 h-10 rounded-xl ios-glass-input flex items-center justify-center text-sm font-semibold text-[#14532D] dark:text-emerald-300 tabular-nums shrink-0">
                  {formatNumber(surah.number)}
                </div>
                <div className="min-w-0">
                  <div className="font-amiri text-xl font-bold text-stone-900 dark:text-stone-100 group-hover:text-[#14532D] dark:group-hover:text-emerald-300 transition-colors truncate">
                    {language === 'en' ? surah.englishName : surah.name}
                  </div>
                  <div className="text-xs text-stone-500 dark:text-stone-400 tabular-nums">
                    {t('homeSurahAyahCount', {
                      type: getRevelationLabel(surah.revelationType),
                      count: formatNumber(surah.numberOfAyahs),
                    })}
                  </div>
                </div>
              </div>
              <ArrowLeft
                className={`w-4 h-4 text-stone-400 group-hover:text-[#14532D] dark:group-hover:text-emerald-300 transition-colors shrink-0 ${
                  !isRTL ? 'rotate-180' : ''
                }`}
              />
            </button>
          ))}
        </div>
      </section>

      {/* Quick Worship Tools Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2 border-t border-stone-200/70 dark:border-stone-800/70">
        <button
          type="button"
          onClick={() => onNavigate('prayers')}
          className="ios-spring text-start p-5 rounded-2xl ios-glass-card hover:border-[#14532D]/50 flex items-start gap-3.5"
        >
          <Clock className="w-5 h-5 text-[#14532D] dark:text-emerald-400 mt-0.5 shrink-0" />
          <div>
            <div className="text-sm font-semibold text-stone-900 dark:text-stone-100">
              {t('homeToolPrayersTitle')}
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 leading-relaxed">
              {nextPrayer
                ? t('homeToolPrayersNext', {
                    name: nextPrayer.name,
                    time: formatNumber(nextPrayer.time),
                    location: locationLabel,
                  })
                : t('homeToolPrayersDesc')}
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('prophets')}
          className="ios-spring text-start p-5 rounded-2xl ios-glass-card hover:border-[#14532D]/50 flex items-start gap-3.5"
        >
          <ScrollText className="w-5 h-5 text-[#14532D] dark:text-emerald-400 mt-0.5 shrink-0" />
          <div>
            <div className="text-sm font-semibold text-stone-900 dark:text-stone-100">
              {t('homeToolProphetsTitle')}
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 leading-relaxed">
              {t('homeToolProphetsDesc')}
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('hisn')}
          className="ios-spring text-start p-5 rounded-2xl ios-glass-card hover:border-[#14532D]/50 flex items-start gap-3.5"
        >
          <Shield className="w-5 h-5 text-[#14532D] dark:text-emerald-400 mt-0.5 shrink-0" />
          <div>
            <div className="text-sm font-semibold text-stone-900 dark:text-stone-100">
              {t('homeToolHisnTitle')}
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 leading-relaxed">
              {t('homeToolHisnDesc')}
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('azkar')}
          className="ios-spring text-start p-5 rounded-2xl ios-glass-card hover:border-[#14532D]/50 flex items-start gap-3.5"
        >
          <Heart className="w-5 h-5 text-[#14532D] dark:text-emerald-400 mt-0.5 shrink-0" />
          <div>
            <div className="text-sm font-semibold text-stone-900 dark:text-stone-100">
              {t('homeToolAzkarTitle')}
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 leading-relaxed">
              {t('homeToolAzkarDesc')}
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('duas')}
          className="ios-spring text-start p-5 rounded-2xl ios-glass-card hover:border-[#14532D]/50 flex items-start gap-3.5"
        >
          <BookHeart className="w-5 h-5 text-[#14532D] dark:text-emerald-400 mt-0.5 shrink-0" />
          <div>
            <div className="text-sm font-semibold text-stone-900 dark:text-stone-100">
              {t('homeToolDuasTitle')}
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 leading-relaxed">
              {t('homeToolDuasDesc')}
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('qibla')}
          className="ios-spring text-start p-5 rounded-2xl ios-glass-card hover:border-[#14532D]/50 flex items-start gap-3.5"
        >
          <Compass className="w-5 h-5 text-[#14532D] dark:text-emerald-400 mt-0.5 shrink-0" />
          <div>
            <div className="text-sm font-semibold text-stone-900 dark:text-stone-100">
              {t('homeToolQiblaTitle')}
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 leading-relaxed">
              {t('homeToolQiblaDesc')}
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('khatmah')}
          className="ios-spring text-start p-5 rounded-2xl ios-glass-card hover:border-[#14532D]/50 flex items-start gap-3.5"
        >
          <CheckCircle2 className="w-5 h-5 text-[#9A742E] dark:text-amber-400 mt-0.5 shrink-0" />
          <div>
            <div className="text-sm font-semibold text-stone-900 dark:text-stone-100">
              {t('homeToolKhatmahTitle')}
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 leading-relaxed">
              {t('homeToolKhatmahDesc')}
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('competitions')}
          className="ios-spring text-start p-5 rounded-2xl ios-glass-card hover:border-[#14532D]/50 flex items-start gap-3.5"
        >
          <Trophy className="w-5 h-5 text-[#9A742E] dark:text-amber-400 mt-0.5 shrink-0" />
          <div>
            <div className="text-sm font-semibold text-stone-900 dark:text-stone-100">
              {t('homeToolCompetitionsTitle')}
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 leading-relaxed">
              {t('homeToolCompetitionsDesc')}
            </p>
          </div>
        </button>

        {onOpenHifzQuiz && (
          <button
            type="button"
            onClick={onOpenHifzQuiz}
            className="ios-spring text-start p-5 rounded-2xl ios-glass-card hover:border-[#14532D]/50 flex items-start gap-3.5"
          >
            <BookOpen className="w-5 h-5 text-[#14532D] dark:text-emerald-400 mt-0.5 shrink-0" />
            <div>
              <div className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                {t('homeToolHifzTitle')}
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 leading-relaxed">
                {t('homeToolHifzDesc')}
              </p>
            </div>
          </button>
        )}

        {isAdminUser(user) && (
          <button
            type="button"
            onClick={() => onNavigate('promo_video')}
            className="ios-spring text-start p-5 rounded-2xl ios-glass-card hover:border-[#14532D]/50 flex items-start gap-3.5"
          >
            <Film className="w-5 h-5 text-[#14532D] dark:text-emerald-400 mt-0.5 shrink-0" />
            <div>
              <div className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                {t('homeToolPromoTitle')}
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 leading-relaxed">
                {t('homeToolPromoDesc')}
              </p>
            </div>
          </button>
        )}

        <button
          type="button"
          onClick={() => onNavigate('search')}
          className="ios-spring text-start p-5 rounded-2xl ios-glass-card hover:border-[#14532D]/50 flex items-start gap-3.5"
        >
          <Search className="w-5 h-5 text-[#14532D] dark:text-emerald-400 mt-0.5 shrink-0" />
          <div>
            <div className="text-sm font-semibold text-stone-900 dark:text-stone-100">
              {t('homeToolSearchTitle')}
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 leading-relaxed">
              {t('homeToolSearchDesc')}
            </p>
          </div>
        </button>
      </section>
    </div>
  );
};
