import {
  AyahItem,
  LoadedPage,
  LoadedSurah,
  SearchMatch,
  SurahMeta,
  TafsirEditionId,
} from '../types/quran';

const DB_NAME = 'quran_offline_db_v1';
const DB_VERSION = 1;
const STORE_SURAHS = 'surahs';
const STORE_PAGES = 'pages';
const STORE_JUZ = 'juz';
const STORE_META = 'meta';

let dbPromise: Promise<IDBDatabase> | null = null;

function openOfflineDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB غير مدعوم في هذا المتصفح'));
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_SURAHS)) {
        db.createObjectStore(STORE_SURAHS);
      }
      if (!db.objectStoreNames.contains(STORE_PAGES)) {
        db.createObjectStore(STORE_PAGES);
      }
      if (!db.objectStoreNames.contains(STORE_JUZ)) {
        db.createObjectStore(STORE_JUZ);
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META);
      }
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => {
        database.close();
        dbPromise = null;
      };
      resolve(database);
    };
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
    request.onblocked = () => {
      dbPromise = null;
      reject(new Error('IndexedDB open blocked'));
    };
  });

  return dbPromise;
}

async function idbGet<T>(storeName: string, key: string): Promise<T | null> {
  try {
    const db = await openOfflineDb();
    return await new Promise<T | null>((resolve) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function idbPut<T>(
  storeName: string,
  key: string,
  value: T
): Promise<void> {
  try {
    const db = await openOfflineDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore storage errors
  }
}

export async function getOfflineSurah(
  surahNumber: number,
  tafsirEdition: TafsirEditionId
): Promise<LoadedSurah | null> {
  return idbGet<LoadedSurah>(STORE_SURAHS, `${surahNumber}_${tafsirEdition}`);
}

export async function saveOfflineSurah(data: LoadedSurah): Promise<void> {
  await idbPut(
    STORE_SURAHS,
    `${data.meta.number}_${data.tafsirEdition}`,
    data
  );
}

export async function getOfflinePage(
  pageNumber: number,
  tafsirEdition: TafsirEditionId
): Promise<LoadedPage | null> {
  return idbGet<LoadedPage>(STORE_PAGES, `${pageNumber}_${tafsirEdition}`);
}

export async function saveOfflinePage(data: LoadedPage): Promise<void> {
  await idbPut(
    STORE_PAGES,
    `${data.pageNumber}_${data.tafsirEdition}`,
    data
  );
}

export async function getOfflineJuz(juzNumber: number): Promise<AyahItem[] | null> {
  return idbGet<AyahItem[]>(STORE_JUZ, `juz_${juzNumber}`);
}

export async function saveOfflineJuz(
  juzNumber: number,
  ayahs: AyahItem[]
): Promise<void> {
  await idbPut(STORE_JUZ, `juz_${juzNumber}`, ayahs);
}

export interface OfflinePackStats {
  surahsCount: number;
  pagesCount: number;
  cachedTafsirs: TafsirEditionId[];
  hasFullQuran: boolean;
}

export async function getOfflineStats(): Promise<OfflinePackStats> {
  try {
    const db = await openOfflineDb();
    const [surahKeys, pageKeys] = await Promise.all([
      new Promise<IDBValidKey[]>((resolve) => {
        const tx = db.transaction(STORE_SURAHS, 'readonly');
        const req = tx.objectStore(STORE_SURAHS).getAllKeys();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      }),
      new Promise<IDBValidKey[]>((resolve) => {
        const tx = db.transaction(STORE_PAGES, 'readonly');
        const req = tx.objectStore(STORE_PAGES).getAllKeys();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      }),
    ]);

    const uniqueSurahs = new Set<number>();
    const tafsirs = new Set<TafsirEditionId>();
    for (const k of surahKeys) {
      const str = String(k);
      const idx = str.indexOf('_');
      if (idx > 0) {
        uniqueSurahs.add(Number(str.slice(0, idx)));
        tafsirs.add(str.slice(idx + 1) as TafsirEditionId);
      }
    }

    const uniquePages = new Set<number>();
    for (const k of pageKeys) {
      const str = String(k);
      const idx = str.indexOf('_');
      if (idx > 0) {
        uniquePages.add(Number(str.slice(0, idx)));
      }
    }

    return {
      surahsCount: uniqueSurahs.size,
      pagesCount: uniquePages.size,
      cachedTafsirs: Array.from(tafsirs),
      hasFullQuran: uniqueSurahs.size >= 114 && uniquePages.size >= 604,
    };
  } catch {
    return {
      surahsCount: 0,
      pagesCount: 0,
      cachedTafsirs: [],
      hasFullQuran: false,
    };
  }
}

export function normalizeArabicForSearch(text: string): string {
  return text
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .trim();
}

export async function searchOfflineQuran(
  query: string
): Promise<{ count: number; matches: SearchMatch[] }> {
  const normQuery = normalizeArabicForSearch(query);
  if (!normQuery) return { count: 0, matches: [] };

  try {
    const db = await openOfflineDb();
    const allSurahs = await new Promise<LoadedSurah[]>((resolve) => {
      const tx = db.transaction(STORE_SURAHS, 'readonly');
      const req = tx.objectStore(STORE_SURAHS).getAll();
      req.onsuccess = () => resolve((req.result as LoadedSurah[]) || []);
      req.onerror = () => resolve([]);
    });

    // Deduplicate by surahNumber so we only scan each cached surah once
    const bySurah = new Map<number, LoadedSurah>();
    for (const s of allSurahs) {
      if (s?.meta?.number && !bySurah.has(s.meta.number)) {
        bySurah.set(s.meta.number, s);
      }
    }

    const matches: SearchMatch[] = [];
    const sorted = Array.from(bySurah.values()).sort(
      (a, b) => a.meta.number - b.meta.number
    );

    for (const surah of sorted) {
      for (const ayah of surah.ayahs) {
        if (normalizeArabicForSearch(ayah.text).includes(normQuery)) {
          matches.push({
            number: ayah.number,
            text: ayah.text,
            numberInSurah: ayah.numberInSurah,
            surah: surah.meta,
          });
        }
      }
    }

    return { count: matches.length, matches };
  } catch {
    return { count: 0, matches: [] };
  }
}

export interface DownloadProgress {
  stage: 'quran' | 'tafsir' | 'saving' | 'done';
  percent: number;
  label: string;
}

export async function downloadFullQuranOffline(
  tafsirEdition: TafsirEditionId,
  onProgress?: (p: DownloadProgress) => void
): Promise<OfflinePackStats> {
  onProgress?.({
    stage: 'quran',
    percent: 15,
    label: 'جاري تحميل المصحف الشريف كاملاً (١١٤ سورة / ٦٠٤ صفحة)...',
  });

  const quranRes = await fetch('https://api.alquran.cloud/v1/quran/quran-uthmani');
  if (!quranRes.ok) {
    throw new Error('تعذر تحميل المصحف الشريف، تحقق من اتصال الإنترنت');
  }
  const quranJson = await quranRes.json();
  const quranSurahs = (quranJson.data?.surahs ?? []) as Array<
    SurahMeta & { ayahs: AyahItem[] }
  >;
  if (quranSurahs.length !== 114) {
    throw new Error('بيانات المصحف غير مكتملة');
  }

  onProgress?.({
    stage: 'tafsir',
    percent: 48,
    label: 'جاري تحميل التفسير المعتمد لجميع الآيات...',
  });

  const tafsirRes = await fetch(
    `https://api.alquran.cloud/v1/quran/${tafsirEdition}`
  );
  if (!tafsirRes.ok) {
    throw new Error('تعذر تحميل التفسير، تحقق من اتصال الإنترنت');
  }
  const tafsirJson = await tafsirRes.json();
  const tafsirSurahs = (tafsirJson.data?.surahs ?? []) as Array<{
    number: number;
    ayahs: Array<{ numberInSurah: number; text: string }>;
  }>;

  onProgress?.({
    stage: 'saving',
    percent: 78,
    label: 'جاري حفظ السور والصفحات والأجزاء في ذاكرة الجهاز...',
  });

  const tafsirBySurah = new Map<number, Array<{ text: string }>>();
  for (const ts of tafsirSurahs) {
    tafsirBySurah.set(ts.number, ts.ayahs || []);
  }

  const surahMetaList: SurahMeta[] = [];
  const pagesMap = new Map<number, AyahItem[]>();
  const juzMap = new Map<number, AyahItem[]>();

  const db = await openOfflineDb();

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(
      [STORE_SURAHS, STORE_PAGES, STORE_JUZ, STORE_META],
      'readwrite'
    );
    const surahStore = tx.objectStore(STORE_SURAHS);
    const pageStore = tx.objectStore(STORE_PAGES);
    const juzStore = tx.objectStore(STORE_JUZ);
    const metaStore = tx.objectStore(STORE_META);

    for (const s of quranSurahs) {
      const meta: SurahMeta = {
        number: s.number,
        name: s.name,
        englishName: s.englishName,
        englishNameTranslation: s.englishNameTranslation,
        numberOfAyahs: s.numberOfAyahs,
        revelationType: s.revelationType,
      };
      surahMetaList.push(meta);

      const tAyahs = tafsirBySurah.get(s.number) ?? [];
      const ayahs: AyahItem[] = (s.ayahs || []).map((a, idx) => {
        const enriched: AyahItem = {
          ...a,
          tafsir: tAyahs[idx]?.text ?? '',
        };
        const pageNum = enriched.page;
        if (pageNum >= 1 && pageNum <= 604) {
          const list = pagesMap.get(pageNum) ?? [];
          list.push({ ...enriched, surah: meta });
          pagesMap.set(pageNum, list);
        }
        const juzNum = enriched.juz;
        if (juzNum >= 1 && juzNum <= 30) {
          const jList = juzMap.get(juzNum) ?? [];
          jList.push({ ...enriched, surah: meta });
          juzMap.set(juzNum, jList);
        }
        return enriched;
      });

      const loadedSurah: LoadedSurah = { meta, ayahs, tafsirEdition };
      surahStore.put(loadedSurah, `${meta.number}_${tafsirEdition}`);
    }

    for (const [pageNumber, ayahs] of pagesMap.entries()) {
      const loadedPage: LoadedPage = {
        pageNumber,
        ayahs,
        tafsirEdition,
      };
      pageStore.put(loadedPage, `${pageNumber}_${tafsirEdition}`);
    }

    for (const [juzNumber, ayahs] of juzMap.entries()) {
      juzStore.put(ayahs, `juz_${juzNumber}`);
    }

    metaStore.put(Date.now(), `downloaded_${tafsirEdition}`);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  try {
    localStorage.setItem('quran_all_surahs_v1', JSON.stringify(surahMetaList));
  } catch {
    // ignore quota error
  }

  onProgress?.({
    stage: 'done',
    percent: 100,
    label: 'اكتمل حفظ المصحف كاملاً للعمل بدون إنترنت!',
  });

  return getOfflineStats();
}

export async function clearOfflineQuranData(): Promise<void> {
  try {
    const db = await openOfflineDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(
        [STORE_SURAHS, STORE_PAGES, STORE_JUZ, STORE_META],
        'readwrite'
      );
      tx.objectStore(STORE_SURAHS).clear();
      tx.objectStore(STORE_PAGES).clear();
      tx.objectStore(STORE_JUZ).clear();
      tx.objectStore(STORE_META).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}
