import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { toArabicDigits } from '../utils/arabic';
import { AppLanguage, TRANSLATIONS, TranslationKey } from './translations';

const LANGUAGE_STORAGE_KEY = 'quran_app_language_v1';

interface LanguageContextValue {
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => void;
  toggleLanguage: () => void;
  isRTL: boolean;
  dir: 'rtl' | 'ltr';
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
  formatNumber: (value: number | string) => string;
  getSurahName: (
    surah: { name?: string; englishName?: string } | null | undefined,
    fallback?: string
  ) => string;
  getRevelationLabel: (type: string) => string;
  getReciterName: (
    reciter: { name?: string; englishName?: string } | null | undefined,
    fallback?: string
  ) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function loadInitialLanguage(): AppLanguage {
  if (typeof window === 'undefined') return 'ar';
  try {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved === 'en' || saved === 'ar') return saved;
  } catch {
    // ignore storage access issues
  }
  return 'ar';
}

function applyDocumentLanguage(language: AppLanguage) {
  if (typeof document === 'undefined') return;
  const html = document.documentElement;
  html.lang = language;
  html.dir = language === 'ar' ? 'rtl' : 'ltr';
  document.title = TRANSLATIONS[language].appDocumentTitle;
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [language, setLanguageState] = useState<AppLanguage>(() => {
    const initial = loadInitialLanguage();
    applyDocumentLanguage(initial);
    return initial;
  });

  useEffect(() => {
    applyDocumentLanguage(language);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // ignore
    }
  }, [language]);

  const setLanguage = useCallback((lang: AppLanguage) => {
    setLanguageState(lang);
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguageState((prev) => (prev === 'ar' ? 'en' : 'ar'));
  }, []);

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>): string => {
      let text = TRANSLATIONS[language][key] ?? TRANSLATIONS.ar[key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
        }
      }
      return text;
    },
    [language]
  );

  const formatNumber = useCallback(
    (value: number | string): string => {
      return language === 'en' ? String(value) : toArabicDigits(value);
    },
    [language]
  );

  const getSurahName = useCallback(
    (
      surah: { name?: string; englishName?: string } | null | undefined,
      fallback = ''
    ): string => {
      if (!surah) return fallback;
      if (language === 'en') {
        return surah.englishName
          ? `Surah ${surah.englishName}`
          : surah.name || fallback;
      }
      return surah.name || surah.englishName || fallback;
    },
    [language]
  );

  const getRevelationLabel = useCallback(
    (type: string): string => {
      if (language === 'en') {
        return type === 'Meccan' ? 'Meccan' : 'Medinan';
      }
      return type === 'Meccan' ? 'مكية' : 'مدنية';
    },
    [language]
  );

  const getReciterName = useCallback(
    (
      reciter: { name?: string; englishName?: string } | null | undefined,
      fallback = ''
    ): string => {
      if (!reciter) return fallback;
      if (language === 'en') {
        return reciter.englishName || reciter.name || fallback;
      }
      return reciter.name || reciter.englishName || fallback;
    },
    [language]
  );

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage,
      toggleLanguage,
      isRTL: language === 'ar',
      dir: language === 'ar' ? 'rtl' : 'ltr',
      t,
      formatNumber,
      getSurahName,
      getRevelationLabel,
      getReciterName,
    }),
    [
      language,
      setLanguage,
      toggleLanguage,
      t,
      formatNumber,
      getSurahName,
      getRevelationLabel,
      getReciterName,
    ]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return ctx;
}
