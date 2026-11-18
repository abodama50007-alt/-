import { RECITERS } from '../data/quranMeta';
import {
  AyahItem,
  LoadedPage,
  LoadedSurah,
  Reciter,
  SearchMatch,
  SurahMeta,
  TafsirEditionId,
} from '../types/quran';
import {
  getOfflineJuz,
  getOfflinePage,
  getOfflineSurah,
  saveOfflineJuz,
  saveOfflinePage,
  saveOfflineSurah,
  searchOfflineQuran,
} from './offlineDb';

const API_BASE = 'https://api.alquran.cloud/v1';

const surahListCache: { data: SurahMeta[] | null } = { data: null };
const surahDetailCache = new Map<string, LoadedSurah>();
const pageDetailCache = new Map<string, LoadedPage>();
const audioCache = new Map<string, Map<number, string>>();
const recitersCache: { data: Reciter[] | null } = { data: null };

export async function fetchAllSurahs(): Promise<SurahMeta[]> {
  if (surahListCache.data) return surahListCache.data;

  try {
    const cachedRaw = localStorage.getItem('quran_all_surahs_v1');
    if (cachedRaw) {
      const parsed = JSON.parse(cachedRaw) as SurahMeta[];
      if (Array.isArray(parsed) && parsed.length === 114) {
        surahListCache.data = parsed;
        return parsed;
      }
    }
  } catch {
    // ignore storage errors
  }

  const res = await fetch(`${API_BASE}/surah`);
  if (!res.ok) {
    throw new Error('تعذر تحميل فهرس السور من الخادم');
  }
  const json = await res.json();
  const list = json.data as SurahMeta[];
  surahListCache.data = list;

  try {
    localStorage.setItem('quran_all_surahs_v1', JSON.stringify(list));
  } catch {
    // ignore quota exceeded
  }

  return list;
}

export async function fetchSurahWithTafsir(
  surahNumber: number,
  tafsirEdition: TafsirEditionId
): Promise<LoadedSurah> {
  const cacheKey = `${surahNumber}_${tafsirEdition}`;
  const cached = surahDetailCache.get(cacheKey);
  if (cached) return cached;

  const offlineHit = await getOfflineSurah(surahNumber, tafsirEdition);
  if (offlineHit) {
    surahDetailCache.set(cacheKey, offlineHit);
    return offlineHit;
  }

  const res = await fetch(
    `${API_BASE}/surah/${surahNumber}/editions/quran-uthmani,${tafsirEdition}`
  );
  if (!res.ok) {
    throw new Error('تعذر تحميل آيات السورة والتفسير، تأكد من الاتصال أو حمل المصحف للعمل بدون إنترنت');
  }

  const json = await res.json();
  const editions = json.data;
  if (!Array.isArray(editions) || editions.length < 2) {
    throw new Error('بيانات السورة غير مكتملة');
  }

  const quranData = editions[0];
  const tafsirData = editions[1];

  const meta: SurahMeta = {
    number: quranData.number,
    name: quranData.name,
    englishName: quranData.englishName,
    englishNameTranslation: quranData.englishNameTranslation,
    numberOfAyahs: quranData.numberOfAyahs,
    revelationType: quranData.revelationType,
  };

  const ayahs: AyahItem[] = quranData.ayahs.map((ayah: AyahItem, idx: number) => ({
    ...ayah,
    tafsir: tafsirData.ayahs[idx]?.text ?? '',
  }));

  const loaded: LoadedSurah = { meta, ayahs, tafsirEdition };
  surahDetailCache.set(cacheKey, loaded);
  void saveOfflineSurah(loaded);
  return loaded;
}

export async function fetchJuzAyahs(juzNumber: number): Promise<AyahItem[]> {
  const offlineJuz = await getOfflineJuz(juzNumber);
  if (offlineJuz && offlineJuz.length > 0) return offlineJuz;

  const res = await fetch(`${API_BASE}/juz/${juzNumber}/quran-uthmani`);
  if (!res.ok) {
    throw new Error('تعذر تحميل الجزء المطلوب');
  }
  const json = await res.json();
  const ayahs = (json.data?.ayahs ?? []) as AyahItem[];
  if (ayahs.length > 0) {
    void saveOfflineJuz(juzNumber, ayahs);
  }
  return ayahs;
}

export async function fetchPageAyahs(pageNumber: number): Promise<AyahItem[]> {
  const offlinePage = await getOfflinePage(pageNumber, 'ar.muyassar');
  if (offlinePage && offlinePage.ayahs.length > 0) return offlinePage.ayahs;

  const res = await fetch(`${API_BASE}/page/${pageNumber}/quran-uthmani`);
  if (!res.ok) {
    throw new Error('تعذر تحميل صفحة المصحف');
  }
  const json = await res.json();
  return (json.data?.ayahs ?? []) as AyahItem[];
}

export function getCachedPageWithTafsir(
  pageNumber: number,
  tafsirEdition: TafsirEditionId
): LoadedPage | null {
  const safePage = Math.max(1, Math.min(604, pageNumber));
  return pageDetailCache.get(`${safePage}_${tafsirEdition}`) ?? null;
}

export async function fetchPageWithTafsir(
  pageNumber: number,
  tafsirEdition: TafsirEditionId
): Promise<LoadedPage> {
  const safePage = Math.max(1, Math.min(604, pageNumber));
  const cacheKey = `${safePage}_${tafsirEdition}`;
  const cached = pageDetailCache.get(cacheKey);
  if (cached) return cached;

  const offlineHit = await getOfflinePage(safePage, tafsirEdition);
  if (offlineHit) {
    pageDetailCache.set(cacheKey, offlineHit);
    return offlineHit;
  }

  const [quranRes, tafsirRes] = await Promise.all([
    fetch(`${API_BASE}/page/${safePage}/quran-uthmani`),
    fetch(`${API_BASE}/page/${safePage}/${tafsirEdition}`),
  ]);

  if (!quranRes.ok) {
    throw new Error('تعذر تحميل صفحة المصحف، يرجى المحاولة مرة أخرى');
  }

  const quranJson = await quranRes.json();
  const quranAyahs = (quranJson.data?.ayahs ?? []) as AyahItem[];

  let tafsirAyahs: Array<{ text?: string }> = [];
  if (tafsirRes.ok) {
    const tafsirJson = await tafsirRes.json();
    tafsirAyahs = tafsirJson.data?.ayahs ?? [];
  }

  const ayahs: AyahItem[] = quranAyahs.map((ayah, idx) => ({
    ...ayah,
    tafsir: tafsirAyahs[idx]?.text ?? '',
  }));

  const loaded: LoadedPage = {
    pageNumber: safePage,
    ayahs,
    tafsirEdition,
  };
  pageDetailCache.set(cacheKey, loaded);
  void saveOfflinePage(loaded);
  return loaded;
}

export function prefetchPageWithTafsir(
  pageNumber: number,
  tafsirEdition: TafsirEditionId
): void {
  if (pageNumber < 1 || pageNumber > 604) return;
  const cacheKey = `${pageNumber}_${tafsirEdition}`;
  if (pageDetailCache.has(cacheKey)) return;
  fetchPageWithTafsir(pageNumber, tafsirEdition).catch(() => {
    // ignore background prefetch errors
  });
}

export async function fetchSurahAudioUrls(
  surahNumber: number,
  reciterId: string
): Promise<Map<number, string>> {
  const cacheKey = `${surahNumber}_${reciterId}`;
  const cached = audioCache.get(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(`${API_BASE}/surah/${surahNumber}/${reciterId}`);
    if (res.ok) {
      const json = await res.json();
      const map = new Map<number, string>();
      const ayahs = json.data?.ayahs ?? [];
      for (const a of ayahs) {
        if (a.audio) {
          map.set(a.number, a.audio);
        } else if (Array.isArray(a.audioSecondary) && a.audioSecondary[0]) {
          map.set(a.number, a.audioSecondary[0]);
        }
      }
      if (map.size > 0) {
        audioCache.set(cacheKey, map);
        return map;
      }
    }
  } catch {
    // fallback to CDN pattern below
  }

  return new Map<number, string>();
}

export function getFallbackAudioUrl(reciterId: string, globalAyahNumber: number): string {
  return `https://cdn.islamic.network/quran/audio/128/${reciterId}/${globalAyahNumber}.mp3`;
}

export function getSurahAudioUrl(reciterId: string, surahNumber: number): string {
  return `https://cdn.islamic.network/quran/audio-surah/128/${reciterId}/${surahNumber}.mp3`;
}

export async function fetchAllReciters(): Promise<Reciter[]> {
  if (recitersCache.data) return recitersCache.data;

  try {
    const cachedRaw = localStorage.getItem('quran_all_reciters_v2');
    if (cachedRaw) {
      const parsed = JSON.parse(cachedRaw) as Reciter[];
      if (Array.isArray(parsed) && parsed.length > 30) {
        recitersCache.data = parsed;
        return parsed;
      }
    }
  } catch {
    // ignore storage errors
  }

  try {
    const res = await fetch(`${API_BASE}/edition?format=audio&language=ar`);
    if (!res.ok) return RECITERS;
    const json = await res.json();
    const rawList = (json.data ?? []) as Array<{
      identifier: string;
      name: string;
      englishName: string;
      type: string;
    }>;

    const mergedMap = new Map<string, Reciter>();
    for (const curated of RECITERS) {
      mergedMap.set(curated.id, curated);
    }

    for (const item of rawList) {
      if (!item.identifier || item.identifier.endsWith('-2')) continue;
      if (item.identifier === 'ar.oimaoqataris') continue;
      if (item.identifier === 'ar.lesaintcorantraduitenfrancais') continue;
      const existing = mergedMap.get(item.identifier);
      const recType: Reciter['type'] =
        item.type === 'versebyverse' ? 'versebyverse' : 'surahbysurah';
      if (existing) {
        mergedMap.set(item.identifier, {
          ...existing,
          englishName: existing.englishName ?? item.englishName,
        });
      } else {
        mergedMap.set(item.identifier, {
          id: item.identifier,
          name: item.name,
          englishName: item.englishName,
          style:
            recType === 'versebyverse'
              ? 'مرتل · آية بآية'
              : 'تلاوة السورة كاملة',
          type: recType,
        });
      }
    }

    const result = Array.from(mergedMap.values());
    recitersCache.data = result;
    try {
      localStorage.setItem('quran_all_reciters_v2', JSON.stringify(result));
    } catch {
      // ignore quota exceeded
    }
    return result;
  } catch {
    return RECITERS;
  }
}

export async function searchQuran(query: string): Promise<{ count: number; matches: SearchMatch[] }> {
  const trimmed = query.trim();
  if (!trimmed) return { count: 0, matches: [] };

  // Prefer instant offline IndexedDB search if offline
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return searchOfflineQuran(trimmed);
  }

  try {
    const res = await fetch(
      `${API_BASE}/search/${encodeURIComponent(trimmed)}/all/quran-simple-clean`
    );
    if (res.status === 404) {
      return { count: 0, matches: [] };
    }
    if (!res.ok) {
      const offlineResult = await searchOfflineQuran(trimmed);
      if (offlineResult.count > 0) return offlineResult;
      throw new Error('تعذر إتمام البحث في القرآن الكريم');
    }
    const json = await res.json();
    return {
      count: json.data?.count ?? 0,
      matches: (json.data?.matches ?? []) as SearchMatch[],
    };
  } catch (err) {
    const offlineResult = await searchOfflineQuran(trimmed);
    if (offlineResult.count > 0) return offlineResult;
    throw err instanceof Error
      ? err
      : new Error('تعذر إتمام البحث بدون إنترنت — يمكنك تحميل المصحف للبحث محلياً');
  }
}
