import { AppLanguage } from '../i18n/translations';
import { PrayerKey, PrayerTimingsData } from '../types/quran';
import { getLocalDateKey } from '../utils/date';

const prayerCache = new Map<string, PrayerTimingsData>();

function cleanTimeString(raw: string | undefined): string {
  if (!raw) return '00:00';
  // Aladhan may return "04:50 (EET)" -> extract HH:MM
  const match = raw.match(/(\d{1,2}:\d{2})/);
  return match ? match[1].padStart(5, '0') : '00:00';
}

export async function fetchPrayerTimings(
  lat: number,
  lng: number,
  methodId: number
): Promise<PrayerTimingsData> {
  const dateKey = getLocalDateKey();
  const cacheKey = `${dateKey}_${lat.toFixed(2)}_${lng.toFixed(2)}_${methodId}`;

  const memCached = prayerCache.get(cacheKey);
  if (memCached) return memCached;

  try {
    const rawStored = localStorage.getItem(`quran_prayer_timings_${cacheKey}`);
    if (rawStored) {
      const parsed = JSON.parse(rawStored) as PrayerTimingsData;
      prayerCache.set(cacheKey, parsed);
      return parsed;
    }
  } catch {
    // ignore storage errors
  }

  const latestStorageKey = `quran_prayer_latest_${lat.toFixed(2)}_${lng.toFixed(2)}_${methodId}`;

  try {
    const res = await fetch(
      `https://api.aladhan.com/v1/timings?latitude=${encodeURIComponent(
        lat
      )}&longitude=${encodeURIComponent(lng)}&method=${methodId}`
    );

    if (!res.ok) {
      throw new Error('تعذر جلب مواقيت الصلاة، يرجى التحقق من الاتصال');
    }

    const json = await res.json();
    const t = json.data?.timings ?? {};
    const hijri = json.data?.date?.hijri;
    const greg = json.data?.date?.gregorian;

    const hijriDateText = hijri
      ? `${hijri.weekday?.ar ?? ''} ${hijri.day ?? ''} ${hijri.month?.ar ?? ''} ${hijri.year ?? ''} هـ`
      : '';
    const gregorianDateText = greg
      ? `${greg.day ?? ''} ${greg.month?.en ?? ''} ${greg.year ?? ''}`
      : '';

    const parsed: PrayerTimingsData = {
      dateKey,
      fajr: cleanTimeString(t.Fajr),
      sunrise: cleanTimeString(t.Sunrise),
      dhuhr: cleanTimeString(t.Dhuhr),
      asr: cleanTimeString(t.Asr),
      maghrib: cleanTimeString(t.Maghrib),
      isha: cleanTimeString(t.Isha),
      imsak: cleanTimeString(t.Imsak),
      midnight: cleanTimeString(t.Midnight),
      lastThird: cleanTimeString(t.Lastthird),
      hijriDateText,
      gregorianDateText,
      methodId,
    };

    prayerCache.set(cacheKey, parsed);
    try {
      localStorage.setItem(
        `quran_prayer_timings_${cacheKey}`,
        JSON.stringify(parsed)
      );
      localStorage.setItem(latestStorageKey, JSON.stringify(parsed));
    } catch {
      // ignore
    }

    return parsed;
  } catch (err) {
    try {
      const latestRaw = localStorage.getItem(latestStorageKey);
      if (latestRaw) {
        const fallback = JSON.parse(latestRaw) as PrayerTimingsData;
        prayerCache.set(cacheKey, fallback);
        return fallback;
      }
    } catch {
      // ignore
    }
    throw err instanceof Error
      ? err
      : new Error('تعذر جلب مواقيت الصلاة دون اتصال');
  }
}

export function timeStringToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

export const PRAYER_LABELS: Record<PrayerKey | 'sunrise', string> = {
  fajr: 'الفجر',
  sunrise: 'الشروق',
  dhuhr: 'الظهر',
  asr: 'العصر',
  maghrib: 'المغرب',
  isha: 'العشاء',
};

export const PRAYER_LABELS_EN: Record<PrayerKey | 'sunrise', string> = {
  fajr: 'Fajr',
  sunrise: 'Sunrise',
  dhuhr: 'Dhuhr',
  asr: 'Asr',
  maghrib: 'Maghrib',
  isha: 'Isha',
};

export function getPrayerLabel(
  key: PrayerKey | 'sunrise',
  language: AppLanguage = 'ar'
): string {
  return language === 'en' ? PRAYER_LABELS_EN[key] : PRAYER_LABELS[key];
}

export function getNextPrayerInfo(
  timings: PrayerTimingsData,
  now = new Date(),
  language: AppLanguage = 'ar'
): {
  key: PrayerKey | 'sunrise';
  name: string;
  time: string;
  remainingSeconds: number;
} {
  const ordered: Array<{ key: PrayerKey | 'sunrise'; time: string }> = [
    { key: 'fajr', time: timings.fajr },
    { key: 'sunrise', time: timings.sunrise },
    { key: 'dhuhr', time: timings.dhuhr },
    { key: 'asr', time: timings.asr },
    { key: 'maghrib', time: timings.maghrib },
    { key: 'isha', time: timings.isha },
  ];

  const nowSeconds =
    now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

  for (const item of ordered) {
    const targetSeconds = timeStringToMinutes(item.time) * 60;
    if (targetSeconds > nowSeconds) {
      return {
        key: item.key,
        name: getPrayerLabel(item.key, language),
        time: item.time,
        remainingSeconds: targetSeconds - nowSeconds,
      };
    }
  }

  // Next is tomorrow's Fajr
  const tomorrowFajrSec = timeStringToMinutes(timings.fajr) * 60 + 86400;
  return {
    key: 'fajr',
    name: getPrayerLabel('fajr', language),
    time: timings.fajr,
    remainingSeconds: tomorrowFajrSec - nowSeconds,
  };
}
