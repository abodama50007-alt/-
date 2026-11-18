import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { BellRing, VolumeX, WifiOff, X } from 'lucide-react';
import { AdminUsersModal } from './components/AdminUsersModal';
import { AudioPlayerBar } from './components/AudioPlayerBar';
import { AzkarView } from './components/AzkarView';
import { BottomNavBar } from './components/BottomNavBar';
import { CompetitionsView, HubTab } from './components/CompetitionsView';
import { DuasView } from './components/DuasView';
import { Header } from './components/Header';
import { HisnView } from './components/HisnView';
import { HomeView } from './components/HomeView';
import { formatReviewWirdSummary, KhatmahView } from './components/KhatmahView';
import { MushafReaderView } from './components/MushafReaderView';
import { OfflineModal } from './components/OfflineModal';
import { PrayerDateWidget } from './components/PrayerDateWidget';
import { PrayersView } from './components/PrayersView';
import { PrayerWidgetModal } from './components/PrayerWidgetModal';
import { PromoVideoView } from './components/PromoVideoView';
import { ProphetsView } from './components/ProphetsView';
import { QiblaView } from './components/QiblaView';
import { getLocalDateKey, ReadingStatsModal } from './components/ReadingStatsModal';
import { ReciterPickerModal } from './components/ReciterPickerModal';
import { SearchView } from './components/SearchView';
import { SettingsModal } from './components/SettingsModal';
import { StorePublishModal } from './components/StorePublishModal';
import { StreakCelebrationModal } from './components/StreakCelebrationModal';
import { SurahIndexView } from './components/SurahIndexView';
import { WelcomeOverlay } from './components/WelcomeOverlay';
import { ADHAN_VOICES, JUZ_LIST, RECITERS } from './data/quranMeta';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { useLanguage } from './i18n/LanguageContext';
import { getOfflineStats } from './services/offlineDb';
import {
  auth,
  awardDailyStreakLeaderboardBonus,
  deleteCloudBookmark,
  deleteCloudNote,
  deleteCloudPersonalKhatmah,
  ensureUserProfile,
  isAdminUser,
  loadUserCloudData,
  loadUserHifzStats,
  loadUserPersonalKhatmahs,
  loadUserStreakState,
  normalizeGroupCode,
  normalizeRoomCode,
  saveSyncState,
  saveUserHifzStats,
  saveUserStreakState,
  signInWithGoogle,
  signOutUser,
  upsertCloudBookmark,
  upsertCloudNote,
  upsertCloudPersonalKhatmah,
} from './firebase';
import {
  fetchPrayerTimings,
  PRAYER_LABELS,
  timeStringToMinutes,
} from './services/prayerApi';
import {
  fetchAllReciters,
  fetchAllSurahs,
  fetchJuzAyahs,
  fetchPageAyahs,
  fetchPageWithTafsir,
  fetchSurahAudioUrls,
  fetchSurahWithTafsir,
  getCachedPageWithTafsir,
  getFallbackAudioUrl,
  getSurahAudioUrl,
  prefetchPageWithTafsir,
} from './services/quranApi';
import {
  AppSection,
  AppSettings,
  AyahItem,
  BookmarkItem,
  DailyReadingStat,
  DailyStreakState,
  HifzHideMode,
  HifzQuizAchievementRecord,
  KhatmahState,
  LastReadPosition,
  LoadedPage,
  LoadedSurah,
  PersonalKhatmahRecord,
  PrayerKey,
  PrayerTimingsData,
  Reciter,
  ReflectionNote,
  ReminderSettings,
  RepeatMode,
  ReviewSchedule,
  SavedGeoLocation,
  StreakActivityKind,
  SurahMeta,
} from './types/quran';
import { stripLeadingBismillah, toArabicDigits } from './utils/arabic';
import { PRESET_CITIES } from './utils/qibla';
import {
  claimTodayStreakReward,
  DEFAULT_DAILY_STREAK,
  getStreakDateKey,
  recordDailyStreakActivity,
} from './utils/streak';
import {
  launchFloatingPrayerWidgetPiP,
  loadWidgetPrefs,
  PrayerWidgetPrefs,
  sanitizeHexColor,
  saveWidgetPrefs,
  saveWidgetSnapshot,
  syncLiveWidgetDataCache,
  VALID_WIDGET_THEMES,
  WidgetTheme,
} from './utils/widget';

function resolveAutoDarkMode(): boolean {
  const prefersDark =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  const hour = new Date().getHours();
  const isNightTime = hour >= 18 || hour < 6;
  return prefersDark || isNightTime;
}

const DEFAULT_SETTINGS: AppSettings = {
  themeMode: 'auto',
  darkMode: resolveAutoDarkMode(),
  readingMode: 'verses',
  fontSize: 28,
  showTafsirInline: false,
  tafsirEdition: 'ar.muyassar',
  reciterId: 'ar.alafasy',
  playbackSpeed: 1,
  repeatMode: 'none',
};

const DEFAULT_LAST_READ: LastReadPosition = {
  surahNumber: 1,
  surahName: 'سُورَةُ ٱلْفَاتِحَةِ',
  ayahNumberInSurah: 1,
  page: 1,
  juz: 1,
  updatedAt: Date.now(),
};

const DEFAULT_KHATMAH: KhatmahState = {
  targetDays: 30,
  completedJuz: [],
  currentPage: 1,
  startedAt: Date.now(),
};

const DEFAULT_MAIN_KHATMAH: PersonalKhatmahRecord = {
  id: 'khatmah_main',
  name: 'الختمة الرئيسية',
  targetDays: 30,
  completedJuz: [],
  currentPage: 1,
  startedAt: Date.now(),
  updatedAt: Date.now(),
};

const DEFAULT_HIFZ_STATS: HifzQuizAchievementRecord = {
  totalPoints: 0,
  quizzesCompleted: 0,
  totalQuestionsAnswered: 0,
  totalCorrect: 0,
  bestScorePct: 0,
  bestStreak: 0,
  testedSurahs: [],
  testedJuzs: [],
  lastTestedLabel: '',
  updatedAt: 0,
};

function readInitialKhatmahs(): PersonalKhatmahRecord[] {
  try {
    const raw = localStorage.getItem('quran_khatmah_list_v1');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
          .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
          .map((item, idx) => ({
            id: typeof item.id === 'string' && item.id ? item.id : `khatmah_${idx + 1}`,
            name: typeof item.name === 'string' && item.name.trim() ? item.name : 'الختمة الرئيسية',
            targetDays: Math.max(1, Math.min(365, Number(item.targetDays || 30))),
            currentPage: Math.max(1, Math.min(604, Number(item.currentPage || 1))),
            completedJuz: Array.isArray(item.completedJuz)
              ? item.completedJuz.filter((n): n is number => Number.isInteger(n) && n >= 1 && n <= 30)
              : [],
            startedAt: Number(item.startedAt || Date.now()),
            updatedAt: Number(item.updatedAt || Date.now()),
          }));
      }
    }
  } catch {
    // fall back to legacy single khatmah migration
  }
  const legacy = readStorage('quran_khatmah_v1', DEFAULT_KHATMAH);
  return [
    {
      ...DEFAULT_MAIN_KHATMAH,
      ...legacy,
      id: 'khatmah_main',
      name: 'الختمة الرئيسية',
      updatedAt: legacy.startedAt || Date.now(),
    },
  ];
}

const DEFAULT_LOCATION: SavedGeoLocation = {
  lat: PRESET_CITIES[0].lat,
  lng: PRESET_CITIES[0].lng,
  label: `${PRESET_CITIES[0].name}، ${PRESET_CITIES[0].country}`,
  source: 'city',
  cityId: PRESET_CITIES[0].id,
};

const DEFAULT_REMINDERS: ReminderSettings = {
  notificationsEnabled: true,
  autoPlayAdhan: true,
  adhanId: 'makkah',
  fajrAdhanDedicated: true,
  leadMinutes: 0,
  prayerAlerts: {
    fajr: true,
    dhuhr: true,
    asr: true,
    maghrib: true,
    isha: true,
  },
  azkarMorningEnabled: true,
  azkarMorningTime: '06:30',
  azkarEveningEnabled: true,
  azkarEveningTime: '17:30',
  khatmahReminderEnabled: true,
  khatmahReminderTime: '20:30',
  kahfFridayEnabled: true,
};

const DEFAULT_REVIEW_SCHEDULE: ReviewSchedule = {
  enabled: false,
  days: [1, 4], // الإثنين والخميس
  time: '21:00',
  wirdType: 'juz',
  pagesCount: 10,
  fromPage: 1,
  juzNumber: 30,
  surahNumber: 18,
  customNote: '',
  completedDates: [],
};

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return fallback;
  }
}

function readStorageArray<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

interface ActiveAlertBanner {
  id: string;
  title: string;
  body: string;
  isAdhanPlaying: boolean;
}

export default function App() {
  const { language, t } = useLanguage();
  const [isWidgetMode, setIsWidgetMode] = useState<boolean>(() => {
    try {
      return new URLSearchParams(window.location.search).get('mode') === 'widget';
    } catch {
      return false;
    }
  });
  const [widgetStudioOpen, setWidgetStudioOpen] = useState(false);
  const [widgetPrefs, setWidgetPrefs] = useState<PrayerWidgetPrefs>(() => {
    const stored = loadWidgetPrefs();
    try {
      const sp = new URLSearchParams(window.location.search);
      const themeParam = sp.get('theme') as WidgetTheme | null;
      if (themeParam && VALID_WIDGET_THEMES.includes(themeParam)) {
        if (themeParam === 'custom') {
          return {
            ...stored,
            theme: 'custom',
            customColors: {
              primaryBg: sanitizeHexColor(sp.get('bg'), stored.customColors.primaryBg),
              secondaryBg: sanitizeHexColor(
                sp.get('bg2'),
                stored.customColors.secondaryBg
              ),
              accentColor: sanitizeHexColor(
                sp.get('accent'),
                stored.customColors.accentColor
              ),
              textColor: sanitizeHexColor(
                sp.get('text'),
                stored.customColors.textColor
              ),
            },
          };
        }
        return { ...stored, theme: themeParam };
      }
    } catch {
      // ignore
    }
    return stored;
  });
  const [initialRoomCode] = useState<string | null>(() => {
    try {
      const param = new URLSearchParams(window.location.search).get('room');
      const cleaned = param ? normalizeRoomCode(param) : '';
      return cleaned.length >= 6 ? cleaned : null;
    } catch {
      return null;
    }
  });
  const [initialGroupCode] = useState<string | null>(() => {
    try {
      const param = new URLSearchParams(window.location.search).get('khatmah');
      const cleaned = param ? normalizeGroupCode(param) : '';
      return cleaned.length >= 6 ? cleaned : null;
    } catch {
      return null;
    }
  });
  const [activeSection, setActiveSection] = useState<AppSection>(() => {
    if (initialRoomCode) return 'competitions';
    if (initialGroupCode) return 'khatmah';
    try {
      const sec = new URLSearchParams(window.location.search).get('section');
      const allowed: AppSection[] = [
        'home',
        'mushaf',
        'index',
        'search',
        'khatmah',
        'prayers',
        'qibla',
        'azkar',
        'duas',
        'hisn',
        'prophets',
        'competitions',
      ];
      if (sec && allowed.includes(sec as AppSection)) {
        return sec as AppSection;
      }
    } catch {
      // ignore
    }
    return 'home';
  });
  const [competitionsInitialTab, setCompetitionsInitialTab] =
    useState<HubTab>('solo');
  const [initialSearchQuery, setInitialSearchQuery] = useState<string>('');
  const [surahList, setSurahList] = useState<SurahMeta[]>([]);
  const [listLoading, setListLoading] = useState(true);

  // Welcome / Onboarding Screen
  const [welcomeOpen, setWelcomeOpen] = useState<boolean>(() => {
    if (initialRoomCode || initialGroupCode) return false;
    try {
      if (new URLSearchParams(window.location.search).get('mode') === 'widget') {
        return false;
      }
      return localStorage.getItem('quran_welcome_seen_v1') !== '1';
    } catch {
      return true;
    }
  });

  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [adminUsersOpen, setAdminUsersOpen] = useState(false);
  const [storePublishOpen, setStorePublishOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const cloudLoadedUidRef = useRef<string | null>(null);
  const authSyncSeqRef = useRef(0);

  useEffect(() => {
    if (activeSection === 'promo_video' && !isAdminUser(user)) {
      setActiveSection('home');
    }
  }, [activeSection, user]);

  // Reciters Library (170+ Quranify / Al-Quran Cloud reciters)
  const [reciters, setReciters] = useState<Reciter[]>(RECITERS);
  const [reciterPickerOpen, setReciterPickerOpen] = useState(false);

  const [settings, setSettings] = useState<AppSettings>(() => {
    const stored = readStorage('quran_app_settings_v1', DEFAULT_SETTINGS);
    if (stored.themeMode === 'auto') {
      return { ...stored, darkMode: resolveAutoDarkMode() };
    }
    return {
      ...stored,
      darkMode: stored.themeMode === 'dark',
    };
  });
  const [lastRead, setLastRead] = useState<LastReadPosition>(() =>
    readStorage('quran_last_read_v1', DEFAULT_LAST_READ)
  );
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>(() =>
    readStorageArray('quran_bookmarks_v1')
  );
  const [notes, setNotes] = useState<ReflectionNote[]>(() =>
    readStorageArray('quran_notes_v1')
  );
  const [khatmahs, setKhatmahs] = useState<PersonalKhatmahRecord[]>(() =>
    readInitialKhatmahs()
  );
  const khatmahsRef = useRef<PersonalKhatmahRecord[]>(khatmahs);
  useEffect(() => {
    khatmahsRef.current = khatmahs;
  }, [khatmahs]);
  const [activeKhatmahId, setActiveKhatmahId] = useState<string>(() => {
    try {
      const savedId = localStorage.getItem('quran_active_khatmah_id_v1');
      if (savedId) return savedId;
    } catch {
      // ignore
    }
    return 'khatmah_main';
  });

  const activeKhatmahRecord = useMemo(
    () => khatmahs.find((k) => k.id === activeKhatmahId) ?? khatmahs[0] ?? DEFAULT_MAIN_KHATMAH,
    [khatmahs, activeKhatmahId]
  );

  const khatmah: KhatmahState = useMemo(
    () => ({
      targetDays: activeKhatmahRecord.targetDays,
      completedJuz: activeKhatmahRecord.completedJuz,
      currentPage: activeKhatmahRecord.currentPage,
      startedAt: activeKhatmahRecord.startedAt,
    }),
    [activeKhatmahRecord]
  );
  const [totalTasbeehCount, setTotalTasbeehCount] = useState<number>(() => {
    try {
      const val = localStorage.getItem('quran_total_tasbeeh_v1');
      return val ? Number(val) || 0 : 0;
    } catch {
      return 0;
    }
  });
  const [favoriteDuaIds, setFavoriteDuaIds] = useState<string[]>(() =>
    readStorageArray<string>('quran_dua_favorites_v1')
  );
  const [reviewSchedule, setReviewSchedule] = useState<ReviewSchedule>(() =>
    readStorage('quran_review_schedule_v1', DEFAULT_REVIEW_SCHEDULE)
  );

  // Location, Prayer Times & Reminders State
  const [location, setLocation] = useState<SavedGeoLocation>(() =>
    readStorage('quran_qibla_location_v1', DEFAULT_LOCATION)
  );
  const [prayerMethodId, setPrayerMethodId] = useState<number>(() => {
    try {
      const val = localStorage.getItem('quran_prayer_method_v1');
      return val ? Number(val) || 5 : 5;
    } catch {
      return 5;
    }
  });
  const [prayerTimings, setPrayerTimings] = useState<PrayerTimingsData | null>(null);
  const [prayerLoading, setPrayerLoading] = useState(false);
  const [prayerError, setPrayerError] = useState<string | null>(null);
  const [prayerReloadTrigger, setPrayerReloadTrigger] = useState(0);

  const [reminders, setReminders] = useState<ReminderSettings>(() =>
    readStorage('quran_reminders_v1', DEFAULT_REMINDERS)
  );
  const adhanAudioRef = useRef<HTMLAudioElement | null>(null);
  const [previewAdhanId, setPreviewAdhanId] = useState<string | null>(null);
  const [activeAlert, setActiveAlert] = useState<ActiveAlertBanner | null>(null);
  const firedAlertsRef = useRef<Set<string>>(new Set());

  // Active Surah & Page Reader State
  const [activeSurahNumber, setActiveSurahNumber] = useState<number>(
    lastRead.surahNumber || 1
  );
  const [highlightAyahNumber, setHighlightAyahNumber] = useState<number | null>(
    null
  );
  const [highlightAyahGlobalNumber, setHighlightAyahGlobalNumber] = useState<
    number | null
  >(null);
  const [loadedSurah, setLoadedSurah] = useState<LoadedSurah | null>(null);
  const [surahLoading, setSurahLoading] = useState(true);
  const [surahError, setSurahError] = useState<string | null>(null);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  // Page View (1..604) State
  const [activePageNumber, setActivePageNumber] = useState<number>(() =>
    Math.max(1, Math.min(604, lastRead.page || 1))
  );
  const [loadedPage, setLoadedPage] = useState<LoadedPage | null>(null);
  const [pageLoading, setPageLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [pageReloadTrigger, setPageReloadTrigger] = useState(0);

  // Reading Statistics & Daily Streaks State (persisted per local calendar day)
  const [statsOpen, setStatsOpen] = useState(false);
  const [readingStats, setReadingStats] = useState<Record<string, DailyReadingStat>>(
    () => readStorage('quran_reading_stats_v1', {})
  );
  const [dailyStreak, setDailyStreak] = useState<DailyStreakState>(() =>
    readStorage('quran_daily_streak_v1', DEFAULT_DAILY_STREAK)
  );
  const [hifzStats, setHifzStats] = useState<HifzQuizAchievementRecord>(() =>
    readStorage('quran_hifz_quiz_stats_v1', DEFAULT_HIFZ_STATS)
  );
  const [celebrationMilestone, setCelebrationMilestone] = useState<number | null>(
    null
  );

  // Offline & PWA State
  const isOnline = useOnlineStatus();
  const [offlineOpen, setOfflineOpen] = useState(false);
  const [hasFullQuranOffline, setHasFullQuranOffline] = useState(false);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  // Audio State (Quran Recitation)
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playerVisible, setPlayerVisible] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [playingSurah, setPlayingSurah] = useState<LoadedSurah | null>(null);
  const [playingAyahIndex, setPlayingAyahIndex] = useState<number>(0);
  const audioUrlsCacheRef = useRef<Map<string, Map<number, string>>>(
    new Map()
  );
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const ayahRepeatCounterRef = useRef(0);

  // Hifz / Memorization Mode State
  const [hifzModeEnabled, setHifzModeEnabled] = useState(false);
  const [hifzHideMode, setHifzHideMode] = useState<HifzHideMode>('full');
  const [revealedHifzAyahs, setRevealedHifzAyahs] = useState<Set<number>>(
    () => new Set()
  );
  const [hifzTargetGlobalAyah, setHifzTargetGlobalAyah] = useState<number | null>(
    null
  );
  const [hifzRepeatTarget, setHifzRepeatTarget] = useState<number>(5);
  const [hifzRepeatDone, setHifzRepeatDone] = useState<number>(0);
  const hifzRepeatDoneRef = useRef<number>(0);
  const [hifzAudioRepeatActive, setHifzAudioRepeatActive] = useState(false);

  const activeReciter = useMemo(
    () => reciters.find((r) => r.id === settings.reciterId),
    [reciters, settings.reciterId]
  );
  const isFullSurahMode = activeReciter?.type === 'surahbysurah';

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      toastTimerRef.current = null;
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 2800);
  }, []);

  // Load full 170+ reciters roster & check offline pack status
  useEffect(() => {
    let active = true;
    fetchAllReciters().then((list) => {
      if (active && list.length > 0) setReciters(list);
    });
    getOfflineStats().then((s) => {
      if (active) setHasFullQuranOffline(s.hasFullQuran);
    });
    return () => {
      active = false;
    };
  }, []);

  // Firebase Auth listener + initial Cloud Data load
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      const seq = ++authSyncSeqRef.current;
      setUser(firebaseUser);
      if (!firebaseUser) {
        cloudLoadedUidRef.current = null;
        return;
      }

      try {
        await ensureUserProfile(firebaseUser);
        if (authSyncSeqRef.current !== seq) return;
        const cloud = await loadUserCloudData(firebaseUser.uid);
        if (authSyncSeqRef.current !== seq) return;

        if (cloud.syncState) {
          const s = cloud.syncState;
          if (typeof s.totalTasbeehCount === 'number') {
            setTotalTasbeehCount((prev) => Math.max(prev, s.totalTasbeehCount!));
          }
          if (typeof s.khatmahCurrentPage === 'number') {
            setKhatmahs((prev) =>
              prev.map((item, idx) =>
                idx === 0 || item.id === 'khatmah_main'
                  ? {
                      ...item,
                      currentPage: Math.max(item.currentPage, s.khatmahCurrentPage!),
                      targetDays: s.khatmahTargetDays ?? item.targetDays,
                      completedJuz:
                        s.khatmahCompletedJuz && s.khatmahCompletedJuz.length > 0
                          ? Array.from(
                              new Set([...item.completedJuz, ...s.khatmahCompletedJuz])
                            ).sort((a, b) => a - b)
                          : item.completedJuz,
                      updatedAt: Date.now(),
                    }
                  : item
              )
            );
          }
          if (typeof s.lastReadSurah === 'number') {
            setLastRead({
              surahNumber: s.lastReadSurah,
              surahName: s.lastReadSurahName || DEFAULT_LAST_READ.surahName,
              ayahNumberInSurah: s.lastReadAyah || 1,
              page: s.lastReadPage || 1,
              juz: s.lastReadJuz || 1,
              updatedAt: Date.now(),
            });
          }
          setSettings((prev) => {
            const nextTheme = s.themeMode ?? prev.themeMode;
            return {
              ...prev,
              reciterId: s.reciterId || prev.reciterId,
              tafsirEdition: s.tafsirEdition || prev.tafsirEdition,
              readingMode: s.readingMode || prev.readingMode,
              fontSize: s.fontSize || prev.fontSize,
              themeMode: nextTheme,
              darkMode:
                nextTheme === 'auto'
                  ? resolveAutoDarkMode()
                  : nextTheme === 'dark',
            };
          });
          if (s.adhanId) {
            setReminders((prev) => ({ ...prev, adhanId: s.adhanId! }));
          }
        }

        if (cloud.bookmarks.length > 0) {
          setBookmarks((prev) => {
            const byId = new Map<string, BookmarkItem>();
            for (const item of [...cloud.bookmarks, ...prev]) {
              byId.set(item.id, item);
            }
            return Array.from(byId.values()).sort(
              (a, b) => b.createdAt - a.createdAt
            );
          });
        }

        if (cloud.notes.length > 0) {
          setNotes((prev) => {
            const byId = new Map<string, ReflectionNote>();
            for (const item of [...cloud.notes, ...prev]) {
              byId.set(item.id, item);
            }
            return Array.from(byId.values()).sort(
              (a, b) => b.updatedAt - a.updatedAt
            );
          });
        }

        const cloudStreak = await loadUserStreakState(firebaseUser.uid);
        if (authSyncSeqRef.current !== seq) return;
        if (cloudStreak) {
          setDailyStreak((prev) => {
            const mergedLogs: DailyStreakState['dailyLogs'] = {
              ...cloudStreak.dailyLogs,
            };
            for (const [dateKey, localLog] of Object.entries(prev.dailyLogs)) {
              const cloudLog = mergedLogs[dateKey];
              if (!cloudLog) {
                mergedLogs[dateKey] = localLog;
              } else {
                mergedLogs[dateKey] = {
                  date: dateKey,
                  quranDone: cloudLog.quranDone || localLog.quranDone,
                  tasbeehDone: cloudLog.tasbeehDone || localLog.tasbeehDone,
                  rewardClaimed: cloudLog.rewardClaimed || localLog.rewardClaimed,
                  pointsEarned: Math.max(
                    cloudLog.pointsEarned,
                    localLog.pointsEarned
                  ),
                };
              }
            }
            const mergedMilestones = Array.from(
              new Set([
                ...cloudStreak.celebratedMilestones,
                ...prev.celebratedMilestones,
              ])
            )
              .sort((a, b) => a - b)
              .slice(-30);
            const usePrevDate = prev.lastActiveDate >= cloudStreak.lastActiveDate;
            return {
              currentStreak: usePrevDate
                ? Math.max(prev.currentStreak, cloudStreak.currentStreak)
                : Math.max(cloudStreak.currentStreak, prev.currentStreak),
              longestStreak: Math.max(
                prev.longestStreak,
                cloudStreak.longestStreak
              ),
              lastActiveDate: usePrevDate
                ? prev.lastActiveDate
                : cloudStreak.lastActiveDate,
              totalActiveDays: Math.max(
                prev.totalActiveDays,
                cloudStreak.totalActiveDays
              ),
              totalStreakPoints: Math.max(
                prev.totalStreakPoints,
                cloudStreak.totalStreakPoints
              ),
              celebratedMilestones: mergedMilestones,
              dailyLogs: mergedLogs,
            };
          });
        }

        const cloudKhatmahs = await loadUserPersonalKhatmahs(firebaseUser.uid);
        if (authSyncSeqRef.current !== seq) return;
        if (cloudKhatmahs.length > 0) {
          setKhatmahs((prev) => {
            const byId = new Map<string, PersonalKhatmahRecord>();
            for (const item of prev) {
              byId.set(item.id, item);
            }
            for (const remote of cloudKhatmahs) {
              const local = byId.get(remote.id);
              if (!local || remote.updatedAt >= local.updatedAt) {
                byId.set(remote.id, remote);
              }
            }
            return Array.from(byId.values()).sort(
              (a, b) => a.startedAt - b.startedAt
            );
          });
        } else {
          // Seed initial local khatmah plans into Firestore on first multi-khatmah sync
          for (const localItem of khatmahsRef.current) {
            void upsertCloudPersonalKhatmah(firebaseUser.uid, localItem).catch(
              () => {}
            );
          }
        }

        const cloudHifzStats = await loadUserHifzStats(firebaseUser.uid);
        if (authSyncSeqRef.current !== seq) return;
        if (cloudHifzStats) {
          setHifzStats((prev) => ({
            totalPoints: Math.max(prev.totalPoints, cloudHifzStats.totalPoints),
            quizzesCompleted: Math.max(
              prev.quizzesCompleted,
              cloudHifzStats.quizzesCompleted
            ),
            totalQuestionsAnswered: Math.max(
              prev.totalQuestionsAnswered,
              cloudHifzStats.totalQuestionsAnswered
            ),
            totalCorrect: Math.max(
              prev.totalCorrect,
              cloudHifzStats.totalCorrect
            ),
            bestScorePct: Math.max(
              prev.bestScorePct,
              cloudHifzStats.bestScorePct
            ),
            bestStreak: Math.max(prev.bestStreak, cloudHifzStats.bestStreak),
            testedSurahs: Array.from(
              new Set([...prev.testedSurahs, ...cloudHifzStats.testedSurahs])
            ).sort((a, b) => a - b),
            testedJuzs: Array.from(
              new Set([...prev.testedJuzs, ...cloudHifzStats.testedJuzs])
            ).sort((a, b) => a - b),
            lastTestedLabel:
              prev.updatedAt >= cloudHifzStats.updatedAt && prev.lastTestedLabel
                ? prev.lastTestedLabel
                : cloudHifzStats.lastTestedLabel || prev.lastTestedLabel,
            updatedAt: Math.max(prev.updatedAt, cloudHifzStats.updatedAt),
          }));
        }

        cloudLoadedUidRef.current = firebaseUser.uid;
      } catch {
        // Error already logged cleanly by handleFirestoreError
      }
    });

    return () => unsub();
  }, []);

  // Debounced cloud sync when signed-in user updates state
  useEffect(() => {
    if (!user || cloudLoadedUidRef.current !== user.uid) return;
    const timer = window.setTimeout(() => {
      saveSyncState(user.uid, {
        totalTasbeehCount,
        khatmah,
        lastRead,
        settings,
        adhanId: reminders.adhanId,
      }).catch(() => {});
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [
    user,
    totalTasbeehCount,
    khatmah,
    lastRead,
    settings,
    reminders.adhanId,
  ]);

  // Debounced cloud sync for Daily Streak state
  useEffect(() => {
    if (!user || cloudLoadedUidRef.current !== user.uid) return;
    const todayDate = getStreakDateKey();
    const timer = window.setTimeout(() => {
      saveUserStreakState(user.uid, dailyStreak, todayDate).catch(() => {});
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [user, dailyStreak]);

  // Debounced cloud sync for Hifz Quiz Achievement Record
  useEffect(() => {
    try {
      localStorage.setItem('quran_hifz_quiz_stats_v1', JSON.stringify(hifzStats));
    } catch {
      // ignore
    }
    if (!user || cloudLoadedUidRef.current !== user.uid) return;
    const timer = window.setTimeout(() => {
      saveUserHifzStats(user.uid, hifzStats).catch(() => {});
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [user, hifzStats]);

  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    try {
      const signedUser = await signInWithGoogle();
      try {
        localStorage.setItem('quran_welcome_seen_v1', '1');
      } catch {
        // ignore
      }
      setWelcomeOpen(false);
      showToast(`أهلاً بك، ${signedUser.displayName || 'تم تسجيل الدخول'}`);
    } catch {
      showToast('لم يكتمل تسجيل الدخول، يمكنك المحاولة مرة أخرى');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
      showToast('تم تسجيل الخروج');
    } catch {
      showToast('تعذر تسجيل الخروج');
    }
  };

  // Fetch Prayer Timings for active location + calculation method
  useEffect(() => {
    let active = true;
    setPrayerLoading(true);
    setPrayerError(null);

    fetchPrayerTimings(location.lat, location.lng, prayerMethodId)
      .then((data) => {
        if (active) setPrayerTimings(data);
      })
      .catch((err) => {
        if (active) {
          setPrayerError(
            err instanceof Error ? err.message : 'تعذر جلب مواقيت الصلاة'
          );
        }
      })
      .finally(() => {
        if (active) setPrayerLoading(false);
      });

    return () => {
      active = false;
    };
  }, [location.lat, location.lng, prayerMethodId, prayerReloadTrigger]);

  // Persist widget snapshot & user preferences
  useEffect(() => {
    saveWidgetPrefs(widgetPrefs);
  }, [widgetPrefs]);

  useEffect(() => {
    if (prayerTimings) {
      saveWidgetSnapshot(location, prayerMethodId, prayerTimings);
      void syncLiveWidgetDataCache({
        timings: prayerTimings,
        locationLabel: location.label,
        language,
        theme: widgetPrefs.theme,
        customColors: widgetPrefs.customColors,
      });
    }
  }, [
    location,
    prayerMethodId,
    prayerTimings,
    language,
    widgetPrefs.theme,
    widgetPrefs.customColors,
  ]);

  const handleUpdateWidgetPrefs = useCallback(
    (partial: Partial<PrayerWidgetPrefs>) => {
      setWidgetPrefs((prev) => ({ ...prev, ...partial }));
    },
    []
  );

  const handleLaunchFloatingWidget = useCallback(async () => {
    const res = await launchFloatingPrayerWidgetPiP({
      timings: prayerTimings,
      locationLabel: location.label,
      language,
      theme: widgetPrefs.theme,
      customColors: widgetPrefs.customColors,
    });
    if (res.ok) {
      showToast(t('widgetPipActive'));
    } else if (res.reason === 'unsupported') {
      showToast(t('widgetPipUnsupported'));
      setWidgetStudioOpen(true);
    }
  }, [
    language,
    location.label,
    prayerTimings,
    showToast,
    t,
    widgetPrefs.theme,
    widgetPrefs.customColors,
  ]);

  const handleEnterStandaloneWidget = useCallback(() => {
    setIsWidgetMode(true);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('mode', 'widget');
      window.history.replaceState({}, '', url.toString());
    } catch {
      // ignore
    }
  }, []);

  const handleExitStandaloneWidget = useCallback(() => {
    setIsWidgetMode(false);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('mode');
      url.searchParams.delete('theme');
      window.history.replaceState({}, '', url.toString());
    } catch {
      // ignore
    }
  }, []);

  // Persist location, method & reminders
  useEffect(() => {
    try {
      localStorage.setItem('quran_qibla_location_v1', JSON.stringify(location));
    } catch {
      // ignore
    }
  }, [location]);

  useEffect(() => {
    try {
      localStorage.setItem('quran_prayer_method_v1', String(prayerMethodId));
    } catch {
      // ignore
    }
  }, [prayerMethodId]);

  useEffect(() => {
    try {
      localStorage.setItem('quran_reminders_v1', JSON.stringify(reminders));
    } catch {
      // ignore
    }
  }, [reminders]);

  const stopAdhanAudio = useCallback(() => {
    if (adhanAudioRef.current) {
      adhanAudioRef.current.pause();
      adhanAudioRef.current.currentTime = 0;
    }
    setPreviewAdhanId(null);
    setActiveAlert((prev) =>
      prev ? { ...prev, isAdhanPlaying: false } : null
    );
  }, []);

  const playAdhanById = useCallback(
    async (adhanId: string, asPreview = false) => {
      const voice =
        ADHAN_VOICES.find((v) => v.id === adhanId) ?? ADHAN_VOICES[0];
      if (!adhanAudioRef.current) {
        adhanAudioRef.current = new Audio();
      }
      const adhanEl = adhanAudioRef.current;

      if (asPreview && previewAdhanId === voice.id && !adhanEl.paused) {
        stopAdhanAudio();
        return;
      }

      // Pause Quran recitation if running so voices don't overlap
      if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
      }

      adhanEl.src = voice.url;
      adhanEl.onended = () => {
        setPreviewAdhanId(null);
        setActiveAlert((prev) =>
          prev ? { ...prev, isAdhanPlaying: false } : null
        );
      };

      try {
        await adhanEl.play();
        if (asPreview) {
          setPreviewAdhanId(voice.id);
        }
      } catch {
        showToast('تعذر تشغيل صوت الأذان تلقائياً (تأكد من إعدادات الصوت)');
      }
    },
    [previewAdhanId, showToast, stopAdhanAudio]
  );

  const triggerAlertNotification = useCallback(
    (title: string, body: string, playAdhanForPrayerKey?: PrayerKey) => {
      let willPlayAdhan = false;
      if (playAdhanForPrayerKey && reminders.autoPlayAdhan) {
        const chosenAdhan =
          playAdhanForPrayerKey === 'fajr' && reminders.fajrAdhanDedicated
            ? 'fajr_special'
            : reminders.adhanId;
        willPlayAdhan = true;
        void playAdhanById(chosenAdhan, false);
      }

      setActiveAlert({
        id: `${Date.now()}`,
        title,
        body,
        isAdhanPlaying: willPlayAdhan,
      });

      if (
        reminders.notificationsEnabled &&
        typeof window !== 'undefined' &&
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {
        try {
          new Notification(title, { body, dir: 'rtl', lang: 'ar' });
        } catch {
          // ignore notification error in restricted browsers
        }
      }
    },
    [
      playAdhanById,
      reminders.adhanId,
      reminders.autoPlayAdhan,
      reminders.fajrAdhanDedicated,
      reminders.notificationsEnabled,
    ]
  );

  // Live background scheduler for Prayers, Azkar, Khatmah & Friday Al-Kahf
  useEffect(() => {
    const checkReminders = () => {
      const now = new Date();
      const dateKey = getLocalDateKey(now);
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(
        now.getMinutes()
      ).padStart(2, '0')}`;

      const fireOnce = (
        key: string,
        title: string,
        body: string,
        prayerKey?: PrayerKey
      ) => {
        const fullKey = `${dateKey}_${key}`;
        if (firedAlertsRef.current.has(fullKey)) return;
        firedAlertsRef.current.add(fullKey);
        triggerAlertNotification(title, body, prayerKey);
      };

      if (prayerTimings) {
        const prayers: PrayerKey[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
        for (const pk of prayers) {
          if (!reminders.prayerAlerts[pk]) continue;
          const targetMin = timeStringToMinutes(prayerTimings[pk]);
          const triggerMin = (targetMin - reminders.leadMinutes + 1440) % 1440;
          if (currentMinutes === triggerMin) {
            const label = PRAYER_LABELS[pk];
            if (reminders.leadMinutes === 0) {
              fireOnce(
                `prayer_${pk}`,
                `حان الآن موعد صلاة ${label}`,
                `بتوقيت ${location.label} — حيّ على الصلاة`,
                pk
              );
            } else {
              fireOnce(
                `prayer_${pk}`,
                `اقترب موعد صلاة ${label}`,
                `متبقي ${toArabicDigits(reminders.leadMinutes)} دقائق على أذان ${label}`
              );
            }
          }
        }
      }

      if (
        reminders.azkarMorningEnabled &&
        hhmm === reminders.azkarMorningTime
      ) {
        fireOnce(
          'azkar_morning',
          'موعد أذكار الصباح',
          'ابدأ يومك بذكر الله والتحصين النبوي المبارك.'
        );
      }

      if (
        reminders.azkarEveningEnabled &&
        hhmm === reminders.azkarEveningTime
      ) {
        fireOnce(
          'azkar_evening',
          'موعد أذكار المساء',
          'حافظ على أذكار المساء لطمأنينة القلب والسكينة.'
        );
      }

      if (
        reminders.khatmahReminderEnabled &&
        hhmm === reminders.khatmahReminderTime
      ) {
        fireOnce(
          'khatmah_wird',
          'تذكير الورد اليومي للقرآن',
          `وصلت في ختمتك إلى الصفحة ${toArabicDigits(khatmah.currentPage)} من ٦٠٤.`
        );
      }

      if (reminders.kahfFridayEnabled && now.getDay() === 5 && hhmm === '09:00') {
        fireOnce(
          'friday_kahf',
          'جمعة مباركة — سورة الكهف',
          'لا تنسَ قراءة سورة الكهف والإكثار من الصلاة على النبي ﷺ.'
        );
      }

      if (
        reviewSchedule.enabled &&
        reviewSchedule.days.includes(now.getDay()) &&
        hhmm === reviewSchedule.time
      ) {
        fireOnce(
          'khatmah_review_schedule',
          'موعد مراجعة ورد القرآن الكريم',
          formatReviewWirdSummary(reviewSchedule, surahList)
        );
      }
    };

    const intervalId = window.setInterval(checkReminders, 15_000);
    return () => window.clearInterval(intervalId);
  }, [
    khatmah.currentPage,
    location.label,
    prayerTimings,
    reminders,
    reviewSchedule,
    surahList,
    triggerAlertNotification,
  ]);

  // Automatically update settings.darkMode based on system preference and sunset/sunrise time when themeMode is 'auto'
  useEffect(() => {
    if (settings.themeMode !== 'auto') return;

    const syncAutoTheme = () => {
      const nextDark = resolveAutoDarkMode();
      setSettings((prev) =>
        prev.themeMode === 'auto' && prev.darkMode !== nextDark
          ? { ...prev, darkMode: nextDark }
          : prev
      );
    };

    syncAutoTheme();

    const mediaQuery =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-color-scheme: dark)')
        : null;

    mediaQuery?.addEventListener('change', syncAutoTheme);
    const intervalId = window.setInterval(syncAutoTheme, 60_000);

    return () => {
      mediaQuery?.removeEventListener('change', syncAutoTheme);
      window.clearInterval(intervalId);
    };
  }, [settings.themeMode]);

  // Sync Dark Mode to <html>
  useEffect(() => {
    const root = document.documentElement;
    if (settings.darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem('quran_app_settings_v1', JSON.stringify(settings));
    } catch {
      // ignore
    }
  }, [settings]);

  // Persist user collections
  useEffect(() => {
    try {
      localStorage.setItem('quran_last_read_v1', JSON.stringify(lastRead));
    } catch {
      // ignore
    }
  }, [lastRead]);

  useEffect(() => {
    try {
      localStorage.setItem('quran_bookmarks_v1', JSON.stringify(bookmarks));
    } catch {
      // ignore
    }
  }, [bookmarks]);

  useEffect(() => {
    try {
      localStorage.setItem('quran_notes_v1', JSON.stringify(notes));
    } catch {
      // ignore
    }
  }, [notes]);

  useEffect(() => {
    try {
      localStorage.setItem(
        'quran_dua_favorites_v1',
        JSON.stringify(favoriteDuaIds)
      );
    } catch {
      // ignore
    }
  }, [favoriteDuaIds]);

  useEffect(() => {
    try {
      localStorage.setItem('quran_khatmah_v1', JSON.stringify(khatmah));
      localStorage.setItem('quran_khatmah_list_v1', JSON.stringify(khatmahs));
      localStorage.setItem('quran_active_khatmah_id_v1', activeKhatmahRecord.id);
    } catch {
      // ignore
    }
  }, [khatmah, khatmahs, activeKhatmahRecord.id]);

  useEffect(() => {
    try {
      localStorage.setItem(
        'quran_review_schedule_v1',
        JSON.stringify(reviewSchedule)
      );
    } catch {
      // ignore
    }
  }, [reviewSchedule]);

  useEffect(() => {
    try {
      localStorage.setItem(
        'quran_total_tasbeeh_v1',
        String(totalTasbeehCount)
      );
    } catch {
      // ignore
    }
  }, [totalTasbeehCount]);

  useEffect(() => {
    try {
      localStorage.setItem(
        'quran_reading_stats_v1',
        JSON.stringify(readingStats)
      );
    } catch {
      // ignore
    }
  }, [readingStats]);

  useEffect(() => {
    try {
      localStorage.setItem(
        'quran_daily_streak_v1',
        JSON.stringify(dailyStreak)
      );
    } catch {
      // ignore
    }
  }, [dailyStreak]);

  const trackDailyStreak = useCallback(
    (kind: StreakActivityKind) => {
      const todayKey = getStreakDateKey();
      setDailyStreak((prev) => {
        const result = recordDailyStreakActivity(prev, kind, todayKey);
        if (result.nextState === prev) return prev;
        if (result.newlyReachedMilestone !== null) {
          window.setTimeout(() => {
            setCelebrationMilestone(result.newlyReachedMilestone);
          }, 250);
        } else if (result.becameActiveToday) {
          window.setTimeout(() => {
            showToast(
              `تم تسجيل يومك في سلسلة المواظبة (${toArabicDigits(
                result.nextState.currentStreak
              )} يوم متتالي)!`
            );
          }, 150);
        }
        return result.nextState;
      });
    },
    [showToast]
  );

  const handleClaimDailyReward = useCallback(() => {
    const todayKey = getStreakDateKey();
    const res = claimTodayStreakReward(dailyStreak, todayKey);
    if (!res.claimed) {
      showToast('أتمّ قراءة القرآن أو التسبيح اليوم أولاً لاستلام المكافأة');
      return;
    }
    setDailyStreak(res.nextState);
    if (res.milestoneReached !== null) {
      setCelebrationMilestone(res.milestoneReached);
    }
    showToast(
      `مبارك! حصلت على +${toArabicDigits(res.pointsAwarded)} نقطة لمواظبتك اليومية`
    );
    if (user) {
      awardDailyStreakLeaderboardBonus({
        user,
        pointsEarned: res.pointsAwarded,
        bestStreak: res.nextState.longestStreak,
        dateKey: todayKey,
      }).catch((err) => {
        console.error('Failed to sync daily streak bonus to leaderboard:', err);
      });
    }
  }, [dailyStreak, showToast, user]);

  // Mark daily Quran streak when user actively reads in the Mushaf reader
  useEffect(() => {
    if (activeSection !== 'mushaf') return;
    if (
      (settings.readingMode === 'verses' && loadedSurah && !surahLoading) ||
      (settings.readingMode === 'page' && loadedPage && !pageLoading)
    ) {
      trackDailyStreak('quran');
    }
  }, [
    activeSection,
    activeSurahNumber,
    activePageNumber,
    settings.readingMode,
    loadedSurah,
    loadedPage,
    surahLoading,
    pageLoading,
    trackDailyStreak,
  ]);

  const recordPageVisited = useCallback((pageNumber: number) => {
    if (!pageNumber || pageNumber < 1 || pageNumber > 604) return;
    const todayKey = getLocalDateKey();
    setReadingStats((prev) => {
      const current = prev[todayKey] ?? {
        date: todayKey,
        pagesVisited: [],
        readingSeconds: 0,
        listeningSeconds: 0,
        ayahsListened: 0,
      };
      if (current.pagesVisited.includes(pageNumber)) return prev;
      return {
        ...prev,
        [todayKey]: {
          ...current,
          pagesVisited: [...current.pagesVisited, pageNumber],
        },
      };
    });
  }, []);

  // Fetch all 114 surahs index once
  useEffect(() => {
    let active = true;
    setListLoading(true);
    fetchAllSurahs()
      .then((list) => {
        if (active) setSurahList(list);
      })
      .catch(() => {
        // Surah reader still works even if list call failed momentarily
      })
      .finally(() => {
        if (active) setListLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Fetch active surah + tafsir
  useEffect(() => {
    let active = true;
    setSurahLoading(true);
    setSurahError(null);

    fetchSurahWithTafsir(activeSurahNumber, settings.tafsirEdition)
      .then((data) => {
        if (!active) return;
        setLoadedSurah(data);
        if (settings.readingMode === 'verses') {
          const targetAyahObj =
            (highlightAyahNumber
              ? data.ayahs.find((a) => a.numberInSurah === highlightAyahNumber)
              : undefined) ?? data.ayahs[0];
          if (targetAyahObj) {
            recordPageVisited(targetAyahObj.page);
            setLastRead({
              surahNumber: data.meta.number,
              surahName: data.meta.name,
              ayahNumberInSurah: targetAyahObj.numberInSurah,
              page: targetAyahObj.page,
              juz: targetAyahObj.juz,
              updatedAt: Date.now(),
            });
          }
        }
      })
      .catch((err) => {
        if (!active) return;
        setSurahError(
          err instanceof Error ? err.message : 'تعذر تحميل السورة'
        );
      })
      .finally(() => {
        if (active) setSurahLoading(false);
      });

    return () => {
      active = false;
    };
  }, [activeSurahNumber, settings.tafsirEdition, reloadTrigger]);

  // Fetch active Mushaf page (1..604) + prefetch adjacent pages when in Page View
  useEffect(() => {
    if (settings.readingMode !== 'page') return;
    let active = true;
    setPageError(null);

    const syncCached = getCachedPageWithTafsir(
      activePageNumber,
      settings.tafsirEdition
    );
    if (syncCached) {
      setLoadedPage(syncCached);
      setPageLoading(false);
    } else {
      setPageLoading(true);
    }

    fetchPageWithTafsir(activePageNumber, settings.tafsirEdition)
      .then((data) => {
        if (!active) return;
        setLoadedPage(data);
        recordPageVisited(data.pageNumber);
        const firstAyah = data.ayahs[0];
        if (firstAyah) {
          if (firstAyah.surah) {
            setActiveSurahNumber(firstAyah.surah.number);
          }
          setLastRead({
            surahNumber: firstAyah.surah?.number ?? activeSurahNumber,
            surahName: firstAyah.surah?.name ?? '',
            ayahNumberInSurah: firstAyah.numberInSurah,
            page: data.pageNumber,
            juz: firstAyah.juz,
            updatedAt: Date.now(),
          });
        }
        prefetchPageWithTafsir(activePageNumber + 1, settings.tafsirEdition);
        prefetchPageWithTafsir(activePageNumber - 1, settings.tafsirEdition);
      })
      .catch((err) => {
        if (!active) return;
        setPageError(
          err instanceof Error ? err.message : 'تعذر تحميل صفحة المصحف'
        );
      })
      .finally(() => {
        if (active) setPageLoading(false);
      });

    return () => {
      active = false;
    };
  }, [
    activePageNumber,
    settings.readingMode,
    settings.tafsirEdition,
    pageReloadTrigger,
  ]);

  // Update playback speed on audio element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = settings.playbackSpeed;
    }
  }, [settings.playbackSpeed]);

  // Play specific ayah index (or full surah for surahbysurah reciters)
  const startPlayingAyahAtIndex = useCallback(
    async (
      surahData: LoadedSurah,
      index: number,
      reciterId: string,
      forceVerseByVerse = false
    ) => {
      const ayah = surahData.ayahs[index];
      if (!ayah) return;

      // Pause Adhan preview if running
      if (adhanAudioRef.current && !adhanAudioRef.current.paused) {
        stopAdhanAudio();
      }

      setPlayerVisible(true);
      setPlayingSurah(surahData);
      setPlayingAyahIndex(index);
      setIsLoadingAudio(true);

      const todayKey = getLocalDateKey();
      setReadingStats((prev) => {
        const current = prev[todayKey] ?? {
          date: todayKey,
          pagesVisited: [],
          readingSeconds: 0,
          listeningSeconds: 0,
          ayahsListened: 0,
        };
        return {
          ...prev,
          [todayKey]: {
            ...current,
            ayahsListened: current.ayahsListened + 1,
          },
        };
      });

      const chosenReciter = reciters.find((r) => r.id === reciterId);
      const effectiveReciterId =
        forceVerseByVerse && chosenReciter?.type === 'surahbysurah'
          ? 'ar.alafasy'
          : reciterId;
      const effectiveReciter = reciters.find(
        (r) => r.id === effectiveReciterId
      );
      let url = '';

      if (effectiveReciter?.type === 'surahbysurah' && !forceVerseByVerse) {
        url = getSurahAudioUrl(effectiveReciterId, surahData.meta.number);
      } else {
        const cacheKey = `${surahData.meta.number}_${effectiveReciterId}`;
        let map = audioUrlsCacheRef.current.get(cacheKey);
        if (!map || map.size === 0) {
          map = await fetchSurahAudioUrls(
            surahData.meta.number,
            effectiveReciterId
          );
          if (map.size > 0) {
            audioUrlsCacheRef.current.set(cacheKey, map);
          }
        }
        url =
          map.get(ayah.number) ??
          getFallbackAudioUrl(effectiveReciterId, ayah.number);
      }

      if (!audioRef.current) {
        audioRef.current = new Audio();
      }

      const audio = audioRef.current;
      audio.src = url;
      audio.playbackRate = settings.playbackSpeed;

      try {
        await audio.play();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
        showToast('تعذر تشغيل التلاوة، جرب قارئاً آخر');
      } finally {
        setIsLoadingAudio(false);
      }
    },
    [reciters, settings.playbackSpeed, showToast, stopAdhanAudio]
  );

  // Audio event listeners (onended -> auto advance / repeat / Hifz loop)
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    const audio = audioRef.current;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime || 0);
    const handleLoadedMetadata = () => setDuration(audio.duration || 0);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    const handleEnded = () => {
      if (!playingSurah) return;

      const currentAyah = playingSurah.ayahs[playingAyahIndex];
      if (
        hifzModeEnabled &&
        hifzAudioRepeatActive &&
        hifzTargetGlobalAyah !== null &&
        currentAyah?.number === hifzTargetGlobalAyah
      ) {
        const nextDone = hifzRepeatDoneRef.current + 1;
        hifzRepeatDoneRef.current = nextDone;
        setHifzRepeatDone(nextDone);

        if (nextDone < hifzRepeatTarget) {
          audio.currentTime = 0;
          audio.play().catch(() => {});
        } else {
          setHifzAudioRepeatActive(false);
          setIsPlaying(false);
          showToast(
            `أحسنت! أتممت تكرار الآية ${toArabicDigits(hifzRepeatTarget)} مرات`
          );
        }
        return;
      }

      if (isFullSurahMode) {
        if (settings.repeatMode === 'surah' || settings.repeatMode === 'ayah-loop') {
          audio.currentTime = 0;
          audio.play().catch(() => {});
        } else {
          setIsPlaying(false);
        }
        return;
      }

      if (settings.repeatMode === 'ayah-loop') {
        audio.currentTime = 0;
        audio.play().catch(() => {});
        return;
      }

      if (settings.repeatMode === 'ayah-3') {
        if (ayahRepeatCounterRef.current < 2) {
          ayahRepeatCounterRef.current += 1;
          audio.currentTime = 0;
          audio.play().catch(() => {});
          return;
        }
        ayahRepeatCounterRef.current = 0;
      }

      const nextIndex = playingAyahIndex + 1;
      if (nextIndex < playingSurah.ayahs.length) {
        startPlayingAyahAtIndex(playingSurah, nextIndex, settings.reciterId);
      } else if (settings.repeatMode === 'surah') {
        startPlayingAyahAtIndex(playingSurah, 0, settings.reciterId);
      } else {
        setIsPlaying(false);
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [
    isFullSurahMode,
    playingSurah,
    playingAyahIndex,
    settings.repeatMode,
    settings.reciterId,
    startPlayingAyahAtIndex,
    hifzModeEnabled,
    hifzAudioRepeatActive,
    hifzTargetGlobalAyah,
    hifzRepeatTarget,
    showToast,
  ]);

  const handlePlayAyah = async (ayah: AyahItem) => {
    setHifzAudioRepeatActive(false);
    const currentPlayingAyah = playingSurah?.ayahs[playingAyahIndex];

    if (
      !isFullSurahMode &&
      currentPlayingAyah?.number === ayah.number &&
      audioRef.current
    ) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(() => {});
      }
      return;
    }

    const targetSurahNum = ayah.surah?.number ?? loadedSurah?.meta.number;
    if (!targetSurahNum) return;

    if (
      isFullSurahMode &&
      playingSurah?.meta.number === targetSurahNum &&
      playerVisible &&
      audioRef.current
    ) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(() => {});
      }
      return;
    }

    let surahForPlay =
      loadedSurah && loadedSurah.meta.number === targetSurahNum
        ? loadedSurah
        : playingSurah && playingSurah.meta.number === targetSurahNum
        ? playingSurah
        : null;

    if (!surahForPlay) {
      try {
        surahForPlay = await fetchSurahWithTafsir(
          targetSurahNum,
          settings.tafsirEdition
        );
      } catch {
        showToast('تعذر تشغيل التلاوة لهذه الآية');
        return;
      }
    }

    const idx = surahForPlay.ayahs.findIndex((a) => a.number === ayah.number);
    if (idx !== -1) {
      ayahRepeatCounterRef.current = 0;
      startPlayingAyahAtIndex(surahForPlay, idx, settings.reciterId);
    }
  };

  // Hifz / Memorization Mode Handlers
  const handleToggleHifzMode = () => {
    setHifzModeEnabled((prev) => {
      const next = !prev;
      if (next) {
        const visibleList =
          settings.readingMode === 'page'
            ? loadedPage?.ayahs ?? []
            : loadedSurah?.ayahs ?? [];
        if (visibleList.length > 0) {
          setHifzTargetGlobalAyah((curr) =>
            curr && visibleList.some((a) => a.number === curr)
              ? curr
              : visibleList[0].number
          );
        }
        showToast('تم تفعيل وضع الحفظ والتكرار');
      } else {
        setHifzAudioRepeatActive(false);
      }
      return next;
    });
  };

  const handleToggleRevealAyah = (globalAyahNumber: number) => {
    setRevealedHifzAyahs((prev) => {
      const next = new Set(prev);
      if (next.has(globalAyahNumber)) {
        next.delete(globalAyahNumber);
      } else {
        next.add(globalAyahNumber);
      }
      return next;
    });
  };

  const handleSelectHifzTargetAyah = (ayah: AyahItem) => {
    setHifzTargetGlobalAyah(ayah.number);
    hifzRepeatDoneRef.current = 0;
    setHifzRepeatDone(0);
    setHifzAudioRepeatActive(false);
    showToast(`تم تحديد الآية ${toArabicDigits(ayah.numberInSurah)} للتكرار`);
  };

  const handleIncrementHifzRepeatManual = () => {
    const nextDone = hifzRepeatDoneRef.current + 1;
    hifzRepeatDoneRef.current = nextDone;
    setHifzRepeatDone(nextDone);
    if (nextDone === hifzRepeatTarget) {
      showToast(
        `أحسنت! أتممت تكرار الآية ${toArabicDigits(hifzRepeatTarget)} مرات`
      );
    }
  };

  const handleResetHifzCounter = () => {
    hifzRepeatDoneRef.current = 0;
    setHifzRepeatDone(0);
  };

  const handleToggleHifzAudioRepeat = async () => {
    if (hifzAudioRepeatActive && isPlaying) {
      if (audioRef.current) audioRef.current.pause();
      setHifzAudioRepeatActive(false);
      return;
    }

    const visibleList =
      settings.readingMode === 'page'
        ? loadedPage?.ayahs ?? []
        : loadedSurah?.ayahs ?? [];
    const targetAyah =
      visibleList.find((a) => a.number === hifzTargetGlobalAyah) ??
      visibleList[0];
    if (!targetAyah) return;

    setHifzTargetGlobalAyah(targetAyah.number);

    if (hifzRepeatDoneRef.current >= hifzRepeatTarget) {
      hifzRepeatDoneRef.current = 0;
      setHifzRepeatDone(0);
    }

    if (
      hifzAudioRepeatActive &&
      playingSurah?.ayahs[playingAyahIndex]?.number === targetAyah.number &&
      audioRef.current
    ) {
      try {
        await audioRef.current.play();
        setIsPlaying(true);
      } catch {
        setHifzAudioRepeatActive(false);
      }
      return;
    }

    const targetSurahNum =
      targetAyah.surah?.number ?? loadedSurah?.meta.number ?? activeSurahNumber;
    let surahForPlay =
      loadedSurah && loadedSurah.meta.number === targetSurahNum
        ? loadedSurah
        : playingSurah && playingSurah.meta.number === targetSurahNum
        ? playingSurah
        : null;

    if (!surahForPlay) {
      try {
        surahForPlay = await fetchSurahWithTafsir(
          targetSurahNum,
          settings.tafsirEdition
        );
      } catch {
        showToast('تعذر تحميل تلاوة الآية للتكرار');
        return;
      }
    }

    const idx = surahForPlay.ayahs.findIndex(
      (a) => a.number === targetAyah.number
    );
    if (idx !== -1) {
      if (isFullSurahMode) {
        showToast('التكرار بالآية يستخدم تلاوة مقسمة بالآيات (العفاسي)');
      }
      setHifzAudioRepeatActive(true);
      await startPlayingAyahAtIndex(surahForPlay, idx, settings.reciterId, true);
    }
  };

  const handleChangeReciter = async (newReciterId: string) => {
    setSettings((prev) => ({ ...prev, reciterId: newReciterId }));
    const chosen = reciters.find((r) => r.id === newReciterId);
    if (chosen) {
      showToast(`تم اختيار القارئ: ${chosen.name}`);
    }

    if (playerVisible && playingSurah) {
      const wasPlaying = isPlaying;
      if (chosen?.type === 'surahbysurah') {
        if (audioRef.current) {
          audioRef.current.src = getSurahAudioUrl(
            newReciterId,
            playingSurah.meta.number
          );
          audioRef.current.playbackRate = settings.playbackSpeed;
          if (wasPlaying) {
            audioRef.current.play().catch(() => {});
          }
        }
      } else {
        const cacheKey = `${playingSurah.meta.number}_${newReciterId}`;
        let freshMap = audioUrlsCacheRef.current.get(cacheKey);
        if (!freshMap || freshMap.size === 0) {
          freshMap = await fetchSurahAudioUrls(
            playingSurah.meta.number,
            newReciterId
          );
          if (freshMap.size > 0) {
            audioUrlsCacheRef.current.set(cacheKey, freshMap);
          }
        }
        const ayah = playingSurah.ayahs[playingAyahIndex];
        if (ayah && audioRef.current) {
          audioRef.current.src =
            freshMap.get(ayah.number) ??
            getFallbackAudioUrl(newReciterId, ayah.number);
          audioRef.current.playbackRate = settings.playbackSpeed;
          if (wasPlaying) {
            audioRef.current.play().catch(() => {});
          }
        }
      }
    }
  };

  const handleSelectSurah = async (surahNumber: number, targetAyah?: number) => {
    setActiveSurahNumber(surahNumber);
    setHighlightAyahNumber(targetAyah ?? null);
    setHighlightAyahGlobalNumber(null);
    setActiveSection('mushaf');

    try {
      const data = await fetchSurahWithTafsir(surahNumber, settings.tafsirEdition);
      const targetObj =
        (targetAyah
          ? data.ayahs.find((a) => a.numberInSurah === targetAyah)
          : undefined) ?? data.ayahs[0];
      if (targetObj) {
        setActivePageNumber(targetObj.page);
        if (targetAyah) {
          setHighlightAyahGlobalNumber(targetObj.number);
        }
      }
    } catch {
      // handled by surah loader
    }

    if (!targetAyah) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleJumpToJuz = async (juzNumber: number) => {
    const juzMeta = JUZ_LIST.find((j) => j.number === juzNumber);
    if (settings.readingMode === 'page' && juzMeta) {
      setActivePageNumber(juzMeta.startPage);
      setHighlightAyahGlobalNumber(null);
      setActiveSection('mushaf');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    try {
      const ayahs = await fetchJuzAyahs(juzNumber);
      const first = ayahs[0];
      if (first?.surah) {
        handleSelectSurah(first.surah.number, first.numberInSurah);
      }
    } catch {
      showToast('تعذر الانتقال إلى الجزء المطلوب');
    }
  };

  const handleJumpToPage = async (pageNumber: number) => {
    const clamped = Math.max(1, Math.min(604, pageNumber));
    setActivePageNumber(clamped);
    setHighlightAyahGlobalNumber(null);
    setActiveSection('mushaf');

    if (settings.readingMode === 'page') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    try {
      const ayahs = await fetchPageAyahs(clamped);
      const first = ayahs[0];
      if (first?.surah) {
        setActiveSurahNumber(first.surah.number);
        setHighlightAyahNumber(first.numberInSurah);
      }
    } catch {
      showToast('تعذر الانتقال إلى الصفحة المطلوبة');
    }
  };

  const handleToggleBookmark = (ayah: AyahItem, surahMeta: SurahMeta) => {
    const exists = bookmarks.find((b) => b.globalAyahNumber === ayah.number);
    if (exists) {
      setBookmarks((prev) => prev.filter((b) => b.globalAyahNumber !== ayah.number));
      showToast('تمت إزالة العلامة المرجعية');
      if (user) {
        deleteCloudBookmark(user.uid, exists.id).catch(() => {});
      }
      return;
    }

    const cleanPreview = stripLeadingBismillah(
      ayah.text,
      surahMeta.number,
      ayah.numberInSurah
    );
    const item: BookmarkItem = {
      id: `${surahMeta.number}_${ayah.numberInSurah}`,
      surahNumber: surahMeta.number,
      surahName: surahMeta.name,
      ayahNumberInSurah: ayah.numberInSurah,
      globalAyahNumber: ayah.number,
      ayahPreview: cleanPreview,
      page: ayah.page,
      createdAt: Date.now(),
    };
    setBookmarks((prev) => [item, ...prev]);
    showToast('تم حفظ الآية في العلامات المرجعية');
    if (user) {
      upsertCloudBookmark(user.uid, item).catch(() => {});
    }
  };

  const handleRemoveBookmarkById = (id: string) => {
    setBookmarks((prev) => prev.filter((b) => b.id !== id));
    if (user) {
      deleteCloudBookmark(user.uid, id).catch(() => {});
    }
  };

  const handleSaveNote = (
    surahMeta: SurahMeta,
    ayahNumberInSurah: number,
    noteText: string
  ) => {
    const id = `${surahMeta.number}_${ayahNumberInSurah}`;
    const newNote: ReflectionNote = {
      id,
      surahNumber: surahMeta.number,
      surahName: surahMeta.name,
      ayahNumberInSurah,
      note: noteText,
      updatedAt: Date.now(),
    };
    setNotes((prev) => [newNote, ...prev.filter((n) => n.id !== id)]);
    showToast('تم حفظ خاطرة التدبر');
    if (user) {
      upsertCloudNote(user.uid, newNote).catch(() => {});
    }
  };

  const handleDeleteNote = (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    showToast('تم حذف الخاطرة');
    if (user) {
      deleteCloudNote(user.uid, id).catch(() => {});
    }
  };

  const handleUpdateActiveKhatmah = (next: KhatmahState) => {
    const updatedRecord: PersonalKhatmahRecord = {
      ...activeKhatmahRecord,
      ...next,
      updatedAt: Date.now(),
    };
    setKhatmahs((prev) =>
      prev.map((item) =>
        item.id === updatedRecord.id ? updatedRecord : item
      )
    );
    if (user) {
      upsertCloudPersonalKhatmah(user.uid, updatedRecord).catch(() => {});
    }
  };

  const handleCreateKhatmah = (name: string, targetDays: number) => {
    const cleanName = name.trim().slice(0, 80) || 'ختمة جديدة';
    const newId = `khatmah_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const nowMs = Date.now();
    const record: PersonalKhatmahRecord = {
      id: newId,
      name: cleanName,
      targetDays: Math.max(1, Math.min(365, Math.round(targetDays || 30))),
      currentPage: 1,
      completedJuz: [],
      startedAt: nowMs,
      updatedAt: nowMs,
    };
    setKhatmahs((prev) => [...prev, record]);
    setActiveKhatmahId(newId);
    showToast(`تم إنشاء «${cleanName}» بنجاح`);
    if (user) {
      upsertCloudPersonalKhatmah(user.uid, record).catch(() => {});
    }
  };

  const handleRenameKhatmah = (id: string, newName: string) => {
    const cleanName = newName.trim().slice(0, 80);
    if (!cleanName) return;
    const target = khatmahs.find((item) => item.id === id);
    if (!target) return;
    const updatedRecord: PersonalKhatmahRecord = {
      ...target,
      name: cleanName,
      updatedAt: Date.now(),
    };
    setKhatmahs((prev) =>
      prev.map((item) => (item.id === id ? updatedRecord : item))
    );
    showToast(`تم تعديل اسم الختمة إلى «${cleanName}»`);
    if (user) {
      upsertCloudPersonalKhatmah(user.uid, updatedRecord).catch(() => {});
    }
  };

  const handleDeleteKhatmah = (id: string) => {
    if (khatmahs.length <= 1) {
      showToast('يجب الإبقاء على ختمة واحدة على الأقل');
      return;
    }
    const remaining = khatmahs.filter((item) => item.id !== id);
    setKhatmahs(remaining);
    if (activeKhatmahRecord.id === id && remaining[0]) {
      setActiveKhatmahId(remaining[0].id);
    }
    showToast('تم حذف الختمة');
    if (user) {
      deleteCloudPersonalKhatmah(user.uid, id).catch(() => {});
    }
  };

  const handleMarkSurahReadInKhatmah = (pageNumber: number) => {
    recordPageVisited(pageNumber);
    trackDailyStreak('quran');
    handleUpdateActiveKhatmah({
      ...khatmah,
      currentPage: Math.max(khatmah.currentPage, pageNumber),
    });
    showToast(
      `تم تحديث «${activeKhatmahRecord.name}» إلى الصفحة ${toArabicDigits(
        pageNumber
      )}`
    );
  };

  // Track active reading & recitation listening seconds (every 5s while tab is visible)
  useEffect(() => {
    const isReadingActive = activeSection === 'mushaf';
    if (!isReadingActive && !isPlaying) return;

    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      const todayKey = getLocalDateKey();
      setReadingStats((prev) => {
        const current = prev[todayKey] ?? {
          date: todayKey,
          pagesVisited: [],
          readingSeconds: 0,
          listeningSeconds: 0,
          ayahsListened: 0,
        };
        return {
          ...prev,
          [todayKey]: {
            ...current,
            readingSeconds:
              current.readingSeconds + (isReadingActive ? 5 : 0),
            listeningSeconds:
              current.listeningSeconds + (isPlaying ? 5 : 0),
          },
        };
      });
    }, 5000);

    return () => window.clearInterval(timer);
  }, [activeSection, isPlaying]);

  const currentPlayingAyah = playingSurah?.ayahs[playingAyahIndex] ?? null;
  const isAudioVisible =
    playerVisible && Boolean(playingSurah && currentPlayingAyah);

  // Follow audio recitation across Mushaf pages automatically when in Page View (for verse-by-verse)
  useEffect(() => {
    if (
      !isFullSurahMode &&
      settings.readingMode === 'page' &&
      isPlaying &&
      currentPlayingAyah?.page &&
      currentPlayingAyah.page !== activePageNumber
    ) {
      setActivePageNumber(currentPlayingAyah.page);
    }
  }, [
    currentPlayingAyah?.page,
    isFullSurahMode,
    isPlaying,
    settings.readingMode,
  ]);

  const dismissWelcome = () => {
    try {
      localStorage.setItem('quran_welcome_seen_v1', '1');
    } catch {
      // ignore
    }
    setWelcomeOpen(false);
  };

  if (isWidgetMode) {
    const cycleTheme = () => {
      const order: WidgetTheme[] = [
        'emerald',
        'royal-gold',
        'calm-blue',
        'light',
        'dark',
      ];
      const idx = order.indexOf(widgetPrefs.theme);
      const next = order[(idx + 1) % order.length];
      handleUpdateWidgetPrefs({ theme: next });
    };

    return (
      <MotionConfig reducedMotion="user">
        <div className="relative min-h-screen flex flex-col items-center justify-center p-4 sm:p-8 bg-[#F5EFE2] text-[#1C1917] dark:bg-[#090E0C] dark:text-[#EAE6DC] transition-colors duration-300">
          <div
            aria-hidden="true"
            className="fixed inset-0 -z-10 pointer-events-none overflow-hidden"
          >
            <div className="absolute -top-28 right-[-8%] w-[520px] h-[520px] rounded-full bg-emerald-600/[0.15] dark:bg-emerald-500/[0.18] blur-[100px]" />
            <div className="absolute bottom-[-10%] left-[-8%] w-[460px] h-[460px] rounded-full bg-amber-500/[0.14] dark:bg-amber-400/[0.11] blur-[100px]" />
          </div>

          <PrayerDateWidget
            timings={prayerTimings}
            locationLabel={location.label}
            theme={widgetPrefs.theme}
            customColors={widgetPrefs.customColors}
            size="wide"
            variant="standalone"
            loading={prayerLoading}
            onRefreshTimings={() => setPrayerReloadTrigger((c) => c + 1)}
            onOpenWidgetStudio={() => setWidgetStudioOpen(true)}
            onLaunchFloatingWidget={() => void handleLaunchFloatingWidget()}
            onExitStandalone={handleExitStandaloneWidget}
            onOpenPrayersPage={() => {
              handleExitStandaloneWidget();
              setActiveSection('prayers');
            }}
            onCycleTheme={cycleTheme}
          />

          <AnimatePresence>
            {toastMessage && (
              <motion.div
                role="status"
                aria-live="polite"
                initial={{ opacity: 0, y: 12, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.94 }}
                className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl ios-glass-dock text-stone-900 dark:text-stone-100 text-xs font-medium"
              >
                {toastMessage}
              </motion.div>
            )}
          </AnimatePresence>

          <PrayerWidgetModal
            open={widgetStudioOpen}
            onClose={() => setWidgetStudioOpen(false)}
            user={user}
            timings={prayerTimings}
            locationLabel={location.label}
            location={location}
            prayerMethodId={prayerMethodId}
            prefs={widgetPrefs}
            onUpdatePrefs={handleUpdateWidgetPrefs}
            onLaunchFloatingWidget={() => void handleLaunchFloatingWidget()}
            onOpenStandaloneWidget={handleEnterStandaloneWidget}
            onShowToast={showToast}
          />
        </div>
      </MotionConfig>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={`relative min-h-screen flex flex-col bg-[#F5EFE2] text-[#1C1917] dark:bg-[#090E0C] dark:text-[#EAE6DC] transition-colors duration-300 ${
          isAudioVisible ? 'pb-40' : 'pb-24'
        }`}
      >
        {/* Layered Ambient Light Washes for iOS Liquid Glass Refraction */}
        <div
          aria-hidden="true"
          className="fixed inset-0 -z-10 pointer-events-none overflow-hidden"
        >
          <div className="absolute -top-28 right-[-8%] w-[580px] h-[580px] rounded-full bg-emerald-600/[0.14] dark:bg-emerald-500/[0.18] blur-[100px]" />
          <div className="absolute top-[28%] left-[-10%] w-[520px] h-[520px] rounded-full bg-amber-500/[0.14] dark:bg-amber-400/[0.11] blur-[100px]" />
          <div className="absolute bottom-[-10%] right-[18%] w-[480px] h-[480px] rounded-full bg-teal-700/[0.1] dark:bg-teal-400/[0.11] blur-[100px]" />
        </div>

        {/* Live Prayer / Reminder / Adhan Liquid Glass Banner */}
        <AnimatePresence>
          {activeAlert && (
            <motion.div
              role="alert"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed top-20 inset-x-4 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-lg z-50 ios-glass-dock rounded-2xl p-4 border border-[#14532D]/40 dark:border-emerald-400/40 shadow-xl"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#14532D] text-white flex items-center justify-center shrink-0">
                    <BellRing className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-stone-900 dark:text-stone-100">
                      {activeAlert.title}
                    </div>
                    <p className="text-xs text-stone-600 dark:text-stone-300 mt-0.5">
                      {activeAlert.body}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {activeAlert.isAdhanPlaying && (
                    <button
                      type="button"
                      onClick={stopAdhanAudio}
                      className="ios-spring inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-medium"
                    >
                      <VolumeX className="w-3.5 h-3.5" />
                      <span>{t('stopAdhan')}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      stopAdhanAudio();
                      setActiveAlert(null);
                    }}
                    aria-label={t('closeAlert')}
                    className="ios-spring w-8 h-8 rounded-xl ios-glass-input flex items-center justify-center text-stone-600 dark:text-stone-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <Header
          activeSection={activeSection}
          onNavigate={(section) => {
            if (section === 'competitions') setCompetitionsInitialTab('solo');
            setActiveSection(section);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          lastRead={lastRead}
          onResumeLastRead={() =>
            handleSelectSurah(lastRead.surahNumber, lastRead.ayahNumberInSurah)
          }
          onOpenStats={() => setStatsOpen(true)}
          onOpenOffline={() => setOfflineOpen(true)}
          hasFullQuranOffline={hasFullQuranOffline}
          isOnline={isOnline}
          user={user}
          authLoading={authLoading}
          onSignIn={handleGoogleSignIn}
          onSignOut={handleSignOut}
          onOpenAdminUsers={() => setAdminUsersOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        {/* Offline Connectivity Pill */}
        <AnimatePresence>
          {!isOnline && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mx-auto mt-3 px-4 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/35 text-amber-800 dark:text-amber-300 text-xs font-medium inline-flex items-center gap-2"
            >
              <WifiOff className="w-3.5 h-3.5" />
              <span>{t('offlineBanner')}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <main className="flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 10, scale: 0.995 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              {activeSection === 'home' && (
                <HomeView
                  surahList={surahList}
                  lastRead={lastRead}
                  khatmah={khatmah}
                  activeKhatmahName={activeKhatmahRecord.name}
                  bookmarks={bookmarks}
                  notes={notes}
                  totalTasbeehCount={totalTasbeehCount}
                  dailyStreak={dailyStreak}
                  user={user}
                  prayerTimings={prayerTimings}
                  locationLabel={location.label}
                  recitersCount={reciters.length}
                  hasFullQuranOffline={hasFullQuranOffline}
                  onNavigate={(section) => {
                    if (section === 'search') setInitialSearchQuery('');
                    if (section === 'competitions') setCompetitionsInitialTab('solo');
                    setActiveSection(section);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  onOpenSurah={handleSelectSurah}
                  onSearchSubmit={(query) => {
                    setInitialSearchQuery(query);
                    setActiveSection('search');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  onOpenStats={() => setStatsOpen(true)}
                  onOpenReciterPicker={() => setReciterPickerOpen(true)}
                  onOpenWelcome={() => setWelcomeOpen(true)}
                  onOpenOffline={() => setOfflineOpen(true)}
                  onOpenSettings={() => setSettingsOpen(true)}
                  onQuickTasbeeh={() => {
                    setTotalTasbeehCount((c) => c + 1);
                    trackDailyStreak('tasbeeh');
                    showToast('تقبل الله تسبيحك — سُبْحَانَ اللَّهِ وَبِحَمْدِهِ');
                  }}
                  onClaimDailyReward={handleClaimDailyReward}
                  onOpenSevenDayCelebration={(milestoneDays) =>
                    setCelebrationMilestone(milestoneDays)
                  }
                  onOpenHifzQuiz={() => {
                    setCompetitionsInitialTab('hifz_quiz');
                    setActiveSection('competitions');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  onShowToast={showToast}
                  widgetTheme={widgetPrefs.theme}
                  widgetCustomColors={widgetPrefs.customColors}
                  widgetSize={widgetPrefs.size}
                  onOpenWidgetStudio={() => setWidgetStudioOpen(true)}
                  onLaunchFloatingWidget={() => void handleLaunchFloatingWidget()}
                  onOpenStandaloneWidget={handleEnterStandaloneWidget}
                />
              )}

              {activeSection === 'mushaf' && (
                <MushafReaderView
                  surahList={surahList}
                  loadedSurah={loadedSurah}
                  loading={surahLoading}
                  error={surahError}
                  activeSurahNumber={activeSurahNumber}
                  activePageNumber={activePageNumber}
                  loadedPage={loadedPage}
                  pageLoading={pageLoading}
                  pageError={pageError}
                  highlightAyahNumber={highlightAyahNumber}
                  highlightAyahGlobalNumber={highlightAyahGlobalNumber}
                  playingAyahGlobalNumber={
                    playerVisible && currentPlayingAyah
                      ? currentPlayingAyah.number
                      : null
                  }
                  isPlaying={isPlaying}
                  settings={settings}
                  reciters={reciters}
                  bookmarks={bookmarks}
                  notes={notes}
                  onSelectSurah={handleSelectSurah}
                  onChangePage={(page) => {
                    setHighlightAyahGlobalNumber(null);
                    setActivePageNumber(Math.max(1, Math.min(604, page)));
                  }}
                  onJumpToJuz={handleJumpToJuz}
                  onJumpToPage={handleJumpToPage}
                  onOpenReciterPicker={() => setReciterPickerOpen(true)}
                  onUpdateSettings={(partial) => {
                    if (partial.reciterId) {
                      void handleChangeReciter(partial.reciterId);
                      return;
                    }
                    if (
                      partial.readingMode === 'page' &&
                      settings.readingMode !== 'page'
                    ) {
                      const targetPage =
                        lastRead.surahNumber === activeSurahNumber &&
                        lastRead.page
                          ? lastRead.page
                          : loadedSurah?.ayahs[0]?.page ?? activePageNumber;
                      setActivePageNumber(Math.max(1, Math.min(604, targetPage)));
                    } else if (
                      partial.readingMode === 'verses' &&
                      settings.readingMode !== 'verses' &&
                      loadedPage?.ayahs[0]?.surah
                    ) {
                      setActiveSurahNumber(loadedPage.ayahs[0].surah.number);
                      setHighlightAyahNumber(loadedPage.ayahs[0].numberInSurah);
                    }
                    setSettings((prev) => {
                      const next = { ...prev, ...partial };
                      if (partial.themeMode !== undefined) {
                        next.darkMode =
                          partial.themeMode === 'auto'
                            ? resolveAutoDarkMode()
                            : partial.themeMode === 'dark';
                      } else if (partial.darkMode !== undefined) {
                        next.themeMode = partial.darkMode ? 'dark' : 'light';
                      }
                      return next;
                    });
                  }}
                  onPlayAyah={handlePlayAyah}
                  onToggleBookmark={handleToggleBookmark}
                  onSaveNote={handleSaveNote}
                  onDeleteNote={handleDeleteNote}
                  onMarkSurahReadInKhatmah={handleMarkSurahReadInKhatmah}
                  onRetry={() => setReloadTrigger((t) => t + 1)}
                  onRetryPage={() => setPageReloadTrigger((t) => t + 1)}
                  hifzModeEnabled={hifzModeEnabled}
                  hifzHideMode={hifzHideMode}
                  revealedAyahNumbers={revealedHifzAyahs}
                  hifzTargetGlobalAyah={hifzTargetGlobalAyah}
                  hifzRepeatTarget={hifzRepeatTarget}
                  hifzRepeatDone={hifzRepeatDone}
                  hifzAudioRepeatActive={hifzAudioRepeatActive}
                  onToggleHifzMode={handleToggleHifzMode}
                  onChangeHifzHideMode={(mode) => setHifzHideMode(mode)}
                  onToggleRevealAyah={handleToggleRevealAyah}
                  onRevealAllAyahs={(nums) =>
                    setRevealedHifzAyahs((prev) => {
                      const next = new Set(prev);
                      nums.forEach((n) => next.add(n));
                      return next;
                    })
                  }
                  onHideAllAyahs={() => setRevealedHifzAyahs(new Set())}
                  onSelectHifzTargetAyah={handleSelectHifzTargetAyah}
                  onChangeHifzRepeatTarget={(count) => setHifzRepeatTarget(count)}
                  onIncrementHifzRepeatManual={handleIncrementHifzRepeatManual}
                  onResetHifzCounter={handleResetHifzCounter}
                  onToggleHifzAudioRepeat={() => void handleToggleHifzAudioRepeat()}
                />
              )}

              {activeSection === 'index' && (
                <SurahIndexView
                  surahList={surahList}
                  loading={listLoading}
                  bookmarks={bookmarks}
                  notes={notes}
                  onOpenSurah={handleSelectSurah}
                  onOpenJuz={handleJumpToJuz}
                  onRemoveBookmark={handleRemoveBookmarkById}
                  onDeleteNote={handleDeleteNote}
                />
              )}

              {activeSection === 'search' && (
                <SearchView
                  initialQuery={initialSearchQuery}
                  surahList={surahList}
                  onOpenMatch={handleSelectSurah}
                />
              )}

              {activeSection === 'khatmah' && (
                <KhatmahView
                  khatmah={khatmah}
                  khatmahs={khatmahs}
                  activeKhatmahId={activeKhatmahRecord.id}
                  surahList={surahList}
                  reviewSchedule={reviewSchedule}
                  todayDateKey={getLocalDateKey()}
                  user={user}
                  authLoading={authLoading}
                  initialGroupCode={initialGroupCode}
                  onSignIn={handleGoogleSignIn}
                  onSelectKhatmah={(id) => setActiveKhatmahId(id)}
                  onCreateKhatmah={handleCreateKhatmah}
                  onRenameKhatmah={handleRenameKhatmah}
                  onDeleteKhatmah={handleDeleteKhatmah}
                  onUpdateKhatmah={(next) => {
                    if (next.currentPage > khatmah.currentPage) {
                      trackDailyStreak('quran');
                      for (
                        let p = khatmah.currentPage + 1;
                        p <= next.currentPage;
                        p++
                      ) {
                        recordPageVisited(p);
                      }
                    }
                    handleUpdateActiveKhatmah(next);
                  }}
                  onUpdateReviewSchedule={(partial) =>
                    setReviewSchedule((prev) => ({ ...prev, ...partial }))
                  }
                  onOpenPage={handleJumpToPage}
                  onOpenJuz={handleJumpToJuz}
                  onOpenSurah={(surahNumber) => handleSelectSurah(surahNumber)}
                  onTestReviewReminder={() =>
                    triggerAlertNotification(
                      'تذكير جدول المراجعة',
                      formatReviewWirdSummary(reviewSchedule, surahList)
                    )
                  }
                  onOpenStats={() => setStatsOpen(true)}
                  onShowToast={showToast}
                />
              )}

              {activeSection === 'prayers' && (
                <PrayersView
                  location={location}
                  methodId={prayerMethodId}
                  timings={prayerTimings}
                  loading={prayerLoading}
                  error={prayerError}
                  reminders={reminders}
                  previewAdhanId={previewAdhanId}
                  onChangeLocation={setLocation}
                  onChangeMethod={setPrayerMethodId}
                  onRetryTimings={() => setPrayerReloadTrigger((t) => t + 1)}
                  onUpdateReminders={(partial) =>
                    setReminders((prev) => ({ ...prev, ...partial }))
                  }
                  onTogglePreviewAdhan={(id) => void playAdhanById(id, true)}
                  onTestReminder={() =>
                    triggerAlertNotification(
                      'تجربة تنبيه الصلاة والأذان',
                      `تم تفعيل التنبيه بنجاح بتوقيت ${location.label}`,
                      'dhuhr'
                    )
                  }
                  onOpenQibla={() => setActiveSection('qibla')}
                  onOpenWidgetStudio={() => setWidgetStudioOpen(true)}
                  onLaunchFloatingWidget={() => void handleLaunchFloatingWidget()}
                  onOpenStandaloneWidget={handleEnterStandaloneWidget}
                />
              )}

              {activeSection === 'qibla' && (
                <QiblaView
                  externalLocation={location}
                  onLocationChange={setLocation}
                />
              )}

              {activeSection === 'azkar' && (
                <AzkarView
                  totalTasbeehCount={totalTasbeehCount}
                  dailyStreak={dailyStreak}
                  onIncrementTotalTasbeeh={() => {
                    setTotalTasbeehCount((c) => c + 1);
                    trackDailyStreak('tasbeeh');
                  }}
                  onZikrActivity={() => trackDailyStreak('tasbeeh')}
                />
              )}

              {activeSection === 'duas' && (
                <DuasView
                  favoriteIds={favoriteDuaIds}
                  onToggleFavorite={(id) => {
                    setFavoriteDuaIds((prev) => {
                      const exists = prev.includes(id);
                      showToast(
                        exists
                          ? 'تمت إزالة الدعاء من المفضلة'
                          : 'تمت إضافة الدعاء إلى المفضلة'
                      );
                      return exists
                        ? prev.filter((item) => item !== id)
                        : [id, ...prev];
                    });
                  }}
                  onShowToast={showToast}
                />
              )}

              {activeSection === 'hisn' && (
                <HisnView
                  todayDateKey={getLocalDateKey()}
                  onIncrementTotalTasbeeh={() => {
                    setTotalTasbeehCount((c) => c + 1);
                    trackDailyStreak('tasbeeh');
                  }}
                  onShowToast={showToast}
                />
              )}

              {activeSection === 'prophets' && (
                <ProphetsView
                  onOpenSurah={handleSelectSurah}
                  onShowToast={showToast}
                />
              )}

              {activeSection === 'competitions' && (
                <CompetitionsView
                  user={user}
                  authLoading={authLoading}
                  lastRead={lastRead}
                  surahList={surahList}
                  initialRoomCode={initialRoomCode}
                  initialTab={competitionsInitialTab}
                  hifzStats={hifzStats}
                  onUpdateHifzStats={setHifzStats}
                  onHifzQuizCompleted={() => trackDailyStreak('quran')}
                  onSignIn={handleGoogleSignIn}
                  onOpenSurah={handleSelectSurah}
                  onShowToast={showToast}
                />
              )}

              {activeSection === 'promo_video' && isAdminUser(user) && (
                <PromoVideoView user={user} onShowToast={showToast} />
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Developer Attribution & Store Privacy Policy Footer */}
        <footer className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-4">
          <div className="ios-glass-card rounded-2xl px-5 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs sm:text-sm text-stone-600 dark:text-stone-400">
            <span>{t('appFooterSummary')}</span>
            <div className="flex flex-wrap items-center gap-3">
              <a
                href="/privacy.html"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#14532D] dark:text-emerald-300 hover:underline font-medium"
              >
                {t('privacyPolicy')}
              </a>
              {isAdminUser(user) && (
                <>
                  <span aria-hidden="true">·</span>
                  <button
                    type="button"
                    onClick={() => setStorePublishOpen(true)}
                    className="text-[#9A742E] dark:text-amber-400 hover:underline font-medium"
                  >
                    {t('publishToStores')}
                  </button>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span className="font-medium text-stone-800 dark:text-stone-200">
                {t('developerCredit')}
              </span>
            </div>
          </div>
        </footer>

        {/* Toast Feedback */}
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              role="status"
              aria-live="polite"
              initial={{ opacity: 0, y: 12, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 420, damping: 28 }}
              className={`fixed left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl ios-glass-dock text-stone-900 dark:text-stone-100 text-xs font-medium ${
                isAudioVisible ? 'bottom-36' : 'bottom-24'
              }`}
            >
              {toastMessage}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Persistent Audio Player (floats cleanly above BottomNavBar) */}
        <AudioPlayerBar
          visible={isAudioVisible}
          isPlaying={isPlaying}
          isLoadingAudio={isLoadingAudio}
          surahName={playingSurah?.meta.name ?? ''}
          ayahNumberInSurah={currentPlayingAyah?.numberInSurah ?? 1}
          totalAyahs={playingSurah?.meta.numberOfAyahs ?? 1}
          reciters={reciters}
          reciterId={settings.reciterId}
          isFullSurahMode={isFullSurahMode && !hifzAudioRepeatActive}
          playbackSpeed={settings.playbackSpeed}
          repeatMode={settings.repeatMode}
          currentTime={currentTime}
          duration={duration}
          onTogglePlay={() => {
            if (!audioRef.current) return;
            if (isPlaying) {
              audioRef.current.pause();
            } else {
              audioRef.current.play().catch(() => {});
            }
          }}
          onNextAyah={() => {
            if (!playingSurah) return;
            setHifzAudioRepeatActive(false);
            const next = playingAyahIndex + 1;
            if (next < playingSurah.ayahs.length) {
              ayahRepeatCounterRef.current = 0;
              startPlayingAyahAtIndex(playingSurah, next, settings.reciterId);
            }
          }}
          onPrevAyah={() => {
            if (!playingSurah) return;
            setHifzAudioRepeatActive(false);
            const prev = playingAyahIndex - 1;
            if (prev >= 0) {
              ayahRepeatCounterRef.current = 0;
              startPlayingAyahAtIndex(playingSurah, prev, settings.reciterId);
            }
          }}
          onSeek={(sec) => {
            if (audioRef.current && Number.isFinite(sec)) {
              audioRef.current.currentTime = Math.max(0, sec);
            }
          }}
          onOpenReciterPicker={() => setReciterPickerOpen(true)}
          onCycleSpeed={() => {
            const speeds = [0.75, 1, 1.25, 1.5];
            const idx = speeds.indexOf(settings.playbackSpeed);
            const next = speeds[(idx + 1) % speeds.length];
            setSettings((prev) => ({ ...prev, playbackSpeed: next }));
          }}
          onCycleRepeat={() => {
            const modes: RepeatMode[] = ['none', 'ayah-3', 'ayah-loop', 'surah'];
            const idx = modes.indexOf(settings.repeatMode);
            const next = modes[(idx + 1) % modes.length];
            setSettings((prev) => ({ ...prev, repeatMode: next }));
          }}
          onClose={() => {
            if (audioRef.current) audioRef.current.pause();
            setHifzAudioRepeatActive(false);
            setIsPlaying(false);
            setPlayerVisible(false);
          }}
        />

        {/* iOS Floating Frosted Glass Navigation Bar */}
        <BottomNavBar
          activeSection={activeSection}
          user={user}
          onNavigate={(section) => {
            if (section === 'promo_video' && !isAdminUser(user)) return;
            if (section === 'search') setInitialSearchQuery('');
            if (section === 'competitions') setCompetitionsInitialTab('solo');
            setActiveSection(section);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />

        {/* Reading & Recitation Statistics Modal (Recharts) */}
        <ReadingStatsModal
          open={statsOpen}
          darkMode={settings.darkMode}
          statsByDate={readingStats}
          khatmah={khatmah}
          dailyStreak={dailyStreak}
          onClose={() => setStatsOpen(false)}
          onOpenMushaf={() => setActiveSection('mushaf')}
          onOpenKhatmah={() => setActiveSection('khatmah')}
        />

        {/* 7-Day Streak Motivational Celebration Modal */}
        <StreakCelebrationModal
          open={celebrationMilestone !== null}
          milestoneDays={celebrationMilestone ?? 7}
          streak={dailyStreak}
          onClose={() => setCelebrationMilestone(null)}
          onOpenMushaf={() =>
            handleSelectSurah(lastRead.surahNumber, lastRead.ayahNumberInSurah)
          }
          onShowToast={showToast}
        />

        {/* Searchable 170+ Quranify Reciter Picker Modal */}
        <ReciterPickerModal
          open={reciterPickerOpen}
          reciters={reciters}
          selectedReciterId={settings.reciterId}
          onSelect={(id) => void handleChangeReciter(id)}
          onClose={() => setReciterPickerOpen(false)}
        />

        {/* Offline Download & PWA Modal */}
        <OfflineModal
          open={offlineOpen}
          activeTafsir={settings.tafsirEdition}
          onClose={() => setOfflineOpen(false)}
          onStatsUpdated={(s) => setHasFullQuranOffline(s.hasFullQuran)}
        />

        {/* Admin Registered Users Modal */}
        <AdminUsersModal
          open={adminUsersOpen}
          onClose={() => setAdminUsersOpen(false)}
          currentUser={user}
        />

        {/* Comprehensive App Settings Modal */}
        <SettingsModal
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          settings={settings}
          onUpdateSettings={(partial) => {
            if (partial.reciterId) {
              void handleChangeReciter(partial.reciterId);
              return;
            }
            if (
              partial.readingMode === 'page' &&
              settings.readingMode !== 'page'
            ) {
              const targetPage =
                lastRead.surahNumber === activeSurahNumber && lastRead.page
                  ? lastRead.page
                  : loadedSurah?.ayahs[0]?.page ?? activePageNumber;
              setActivePageNumber(Math.max(1, Math.min(604, targetPage)));
            } else if (
              partial.readingMode === 'verses' &&
              settings.readingMode !== 'verses' &&
              loadedPage?.ayahs[0]?.surah
            ) {
              setActiveSurahNumber(loadedPage.ayahs[0].surah.number);
              setHighlightAyahNumber(loadedPage.ayahs[0].numberInSurah);
            }
            setSettings((prev) => {
              const next = { ...prev, ...partial };
              if (partial.themeMode !== undefined) {
                next.darkMode =
                  partial.themeMode === 'auto'
                    ? resolveAutoDarkMode()
                    : partial.themeMode === 'dark';
              } else if (partial.darkMode !== undefined) {
                next.themeMode = partial.darkMode ? 'dark' : 'light';
              }
              return next;
            });
          }}
          reminders={reminders}
          onUpdateReminders={(partial) =>
            setReminders((prev) => ({ ...prev, ...partial }))
          }
          location={location}
          prayerMethodId={prayerMethodId}
          onChangePrayerMethod={setPrayerMethodId}
          reciters={reciters}
          previewAdhanId={previewAdhanId}
          onTogglePreviewAdhan={(id) => void playAdhanById(id, true)}
          hasFullQuranOffline={hasFullQuranOffline}
          user={user}
          authLoading={authLoading}
          onSignIn={handleGoogleSignIn}
          onSignOut={handleSignOut}
          onOpenReciterPicker={() => setReciterPickerOpen(true)}
          onOpenOffline={() => setOfflineOpen(true)}
          onOpenPrayers={() => setActiveSection('prayers')}
          onOpenWelcome={() => setWelcomeOpen(true)}
          onOpenAdminUsers={() => setAdminUsersOpen(true)}
          onOpenStorePublish={() => setStorePublishOpen(true)}
          onOpenWidgetStudio={() => setWidgetStudioOpen(true)}
          onLaunchFloatingWidget={() => void handleLaunchFloatingWidget()}
          onOpenStandaloneWidget={handleEnterStandaloneWidget}
          onResetDefaults={() => {
            setSettings({
              ...DEFAULT_SETTINGS,
              darkMode: resolveAutoDarkMode(),
            });
            setReminders(DEFAULT_REMINDERS);
            showToast(t('settingsResetToast'));
          }}
        />

        {/* Date & Prayer Times Widget Studio Modal */}
        <PrayerWidgetModal
          open={widgetStudioOpen}
          onClose={() => setWidgetStudioOpen(false)}
          user={user}
          timings={prayerTimings}
          locationLabel={location.label}
          location={location}
          prayerMethodId={prayerMethodId}
          prefs={widgetPrefs}
          onUpdatePrefs={handleUpdateWidgetPrefs}
          onLaunchFloatingWidget={() => void handleLaunchFloatingWidget()}
          onOpenStandaloneWidget={handleEnterStandaloneWidget}
          onShowToast={showToast}
        />

        {/* Store Packaging & Publishing Guide Modal (Admin Only) */}
        {isAdminUser(user) && (
          <StorePublishModal
            open={storePublishOpen}
            user={user}
            onClose={() => setStorePublishOpen(false)}
            onShowToast={showToast}
          />
        )}

        {/* Welcome / Onboarding Screen */}
        <WelcomeOverlay
          open={welcomeOpen}
          user={user}
          authLoading={authLoading}
          onGoogleSignIn={handleGoogleSignIn}
          onContinueAsGuest={dismissWelcome}
        />
      </div>
    </MotionConfig>
  );
}
