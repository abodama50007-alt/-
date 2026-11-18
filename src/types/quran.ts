export type AppSection = 'home' | 'mushaf' | 'index' | 'search' | 'khatmah' | 'prayers' | 'qibla' | 'azkar' | 'duas' | 'hisn' | 'prophets' | 'competitions' | 'promo_video';

export type ReadingMode = 'verses' | 'page';

export type TafsirEditionId = 'ar.muyassar' | 'ar.jalalayn' | 'en.sahih';

export type RepeatMode = 'none' | 'ayah-3' | 'ayah-loop' | 'surah';

export type HifzHideMode = 'full' | 'first-word' | 'visible';

export interface SurahMeta {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
  revelationType: 'Meccan' | 'Medinan' | string;
}

export interface AyahItem {
  number: number; // global 1..6236
  text: string;
  numberInSurah: number;
  juz: number;
  manzil: number;
  page: number;
  ruku: number;
  hizbQuarter: number;
  sajda: boolean | { id: number; recommended: boolean; obligatory: boolean };
  tafsir?: string;
  surah?: SurahMeta;
}

export interface LoadedSurah {
  meta: SurahMeta;
  ayahs: AyahItem[];
  tafsirEdition: TafsirEditionId;
}

export interface LoadedPage {
  pageNumber: number;
  ayahs: AyahItem[];
  tafsirEdition: TafsirEditionId;
}

export interface SearchMatch {
  number: number;
  text: string;
  numberInSurah: number;
  surah: SurahMeta;
}

export interface BookmarkItem {
  id: string;
  surahNumber: number;
  surahName: string;
  ayahNumberInSurah: number;
  globalAyahNumber: number;
  ayahPreview: string;
  page: number;
  createdAt: number;
}

export interface ReflectionNote {
  id: string;
  surahNumber: number;
  surahName: string;
  ayahNumberInSurah: number;
  note: string;
  updatedAt: number;
}

export interface Reciter {
  id: string;
  name: string;
  englishName?: string;
  style: string;
  type: 'versebyverse' | 'surahbysurah';
  featured?: boolean;
}

export interface AdhanVoice {
  id: string;
  name: string;
  muezzin: string;
  origin: string;
  url: string;
}

export interface PrayerTimingsData {
  dateKey: string;
  fajr: string;
  sunrise: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
  imsak: string;
  midnight: string;
  lastThird: string;
  hijriDateText: string;
  gregorianDateText: string;
  methodId: number;
}

export type PrayerKey = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';

export interface ReminderSettings {
  notificationsEnabled: boolean;
  autoPlayAdhan: boolean;
  adhanId: string;
  fajrAdhanDedicated: boolean;
  leadMinutes: number; // 0, 5, 10, 15
  prayerAlerts: Record<PrayerKey, boolean>;
  azkarMorningEnabled: boolean;
  azkarMorningTime: string; // HH:MM
  azkarEveningEnabled: boolean;
  azkarEveningTime: string; // HH:MM
  khatmahReminderEnabled: boolean;
  khatmahReminderTime: string; // HH:MM
  kahfFridayEnabled: boolean;
}

export interface SavedGeoLocation {
  lat: number;
  lng: number;
  label: string;
  source: 'gps' | 'city';
  cityId?: string;
}

export interface TafsirOption {
  id: TafsirEditionId;
  name: string;
  author: string;
}

export interface LastReadPosition {
  surahNumber: number;
  surahName: string;
  ayahNumberInSurah: number;
  page: number;
  juz: number;
  updatedAt: number;
}

export interface KhatmahState {
  targetDays: number;
  completedJuz: number[]; // 1..30
  currentPage: number; // 1..604
  startedAt: number;
}

export interface PersonalKhatmahRecord extends KhatmahState {
  id: string;
  name: string;
  updatedAt: number;
}

export type ReviewWirdType = 'pages' | 'juz' | 'surah' | 'custom';

export interface ReviewSchedule {
  enabled: boolean;
  days: number[]; // 0 (Sunday) .. 6 (Saturday)
  time: string; // HH:MM
  wirdType: ReviewWirdType;
  pagesCount: number;
  fromPage: number;
  juzNumber: number;
  surahNumber: number;
  customNote: string;
  completedDates: string[]; // YYYY-MM-DD
}

export interface ZikrItem {
  id: string;
  category: 'morning' | 'evening' | 'prayer' | 'quranic';
  text: string;
  reference: string;
  benefit?: string;
  count: number;
}

export type DuaCategory = 'quran' | 'sunnah' | 'prophets' | 'daily';

export interface DuaItem {
  id: string;
  title: string;
  category: DuaCategory;
  text: string;
  reference: string;
  benefit?: string;
}

export type HisnCategoryId =
  | 'sleep_wake'
  | 'morning_evening'
  | 'mosque_prayer'
  | 'home_food'
  | 'travel_market'
  | 'distress_nature'
  | 'repentance';

export interface HisnZikrItem {
  id: string;
  category: HisnCategoryId;
  occasion: string;
  text: string;
  reference: string;
  virtue?: string;
  count: number;
}

export interface TasbeehPreset {
  id: string;
  phrase: string;
  target: number;
}

export type ThemeMode = 'auto' | 'light' | 'dark';

export interface AppSettings {
  themeMode: ThemeMode;
  darkMode: boolean;
  readingMode: ReadingMode;
  fontSize: number; // px for Quran text
  showTafsirInline: boolean;
  tafsirEdition: TafsirEditionId;
  reciterId: string;
  playbackSpeed: number;
  repeatMode: RepeatMode;
}

export interface DailyReadingStat {
  date: string; // YYYY-MM-DD local calendar day
  pagesVisited: number[];
  readingSeconds: number;
  listeningSeconds: number;
  ayahsListened: number;
}

export type ProphetEra = 'early' | 'arab_nations' | 'bani_israil' | 'final_seal';

export interface ProphetQuranRef {
  surahNumber: number;
  surahName: string;
  ayahNumber: number;
  ayahText: string;
}

export interface ProphetChapter {
  heading: string;
  content: string;
}

export interface ProphetStory {
  id: string;
  order: number;
  name: string;
  title: string;
  era: ProphetEra;
  isUlulAzm?: boolean;
  peopleOrPlace: string;
  summary: string;
  estimatedReadMinutes: number;
  chapters: ProphetChapter[];
  miracles: string[];
  lessons: string[];
  quranRefs: ProphetQuranRef[];
}

export type StreakActivityKind = 'quran' | 'tasbeeh';

export interface DailyStreakLog {
  date: string; // YYYY-MM-DD local calendar day
  quranDone: boolean;
  tasbeehDone: boolean;
  rewardClaimed: boolean;
  pointsEarned: number;
}

export interface DailyStreakState {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string; // YYYY-MM-DD or ''
  totalActiveDays: number;
  totalStreakPoints: number;
  celebratedMilestones: number[];
  dailyLogs: Record<string, DailyStreakLog>;
}

export type GroupKhatmahStatus = 'active' | 'completed';

export interface GroupKhatmahRecord {
  groupCode: string;
  title: string;
  description: string;
  creatorUid: string;
  creatorName: string;
  targetDays: number;
  memberUids: string[];
  status: GroupKhatmahStatus;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface GroupKhatmahMemberRecord {
  uid: string;
  groupCode: string;
  displayName: string;
  photoURL: string;
  completedJuz: number[]; // 1..30
  currentPage: number; // 1..604
  joinedAtMs: number;
  updatedAtMs: number;
}

export interface HifzQuizAchievementRecord {
  totalPoints: number;
  quizzesCompleted: number;
  totalQuestionsAnswered: number;
  totalCorrect: number;
  bestScorePct: number;
  bestStreak: number;
  testedSurahs: number[]; // 1..114
  testedJuzs: number[]; // 1..30
  lastTestedLabel: string;
  updatedAt: number;
}

