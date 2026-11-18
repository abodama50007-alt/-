const DB_NAME = 'quran_prophet_ai_illustrations_v1';
const STORE_NAME = 'illustrations';
const DB_VERSION = 1;

const memoryImageCache = new Map<string, string>();

export const PROPHET_AI_SCENE_PROMPTS: Record<string, string> = {
  adam: 'Lush garden of Eden at dawn with an ancient olive tree, clear streams, and warm morning mist under golden sunlight',
  idris: 'Ancient stone observatory courtyard under a starry sky with a brass astrolabe, parchment scrolls, and calm candlelight',
  nuh: 'Monumental wooden ark resting peacefully amidst receding ocean waves near the peak of Mount Judi beneath breaking golden clouds',
  hud: 'Tall sandstone pillars of ancient Iram amidst swirling golden desert sands at sunset with a bright star above',
  salih: 'Carved Nabataean-inspired sandstone rock dwellings in Al-Hijr canyon beside a tranquil emerald oasis spring',
  ibrahim: 'Miraculous serene emerald garden blooming with cool breeze inside an ancient courtyard alongside the dignified silhouette of the Kaaba',
  lut: 'Quiet dawn breaking cleanly over silent desert cliffs and winding valleys with rays of guiding light',
  ismail: 'Crystalline Zamzam water spring bubbling amidst sunlit desert valley hills near the sacred stone sanctuary of Makkah',
  ishaq: 'Peaceful ancient olive grove in Canaan bathed in warm golden afternoon light and gentle breeze',
  yaqub: 'Quiet desert tent encampment beneath a deep indigo night sky glowing with twelve bright stars',
  yusuf: 'Grand Egyptian limestone palace colonnade overlooking golden wheat fields beneath the sun, crescent moon, and eleven stars',
  ayyub: 'Cool clear healing spring bursting from pale desert stone surrounded by fresh green herbs after rain',
  shuayb: 'Shaded green valley orchards of Madyan featuring an ornate balanced golden scale resting on a stone pedestal',
  musa: 'Sacred valley of Tuwa at Mount Tur illuminated by warm divine golden glow on a desert bush, with towering parted sea walls in the distance',
  harun: 'Serene ancient sanctuary interior lit by an ornate seven-branched brass lampstand and stone arches',
  dhulkifl: 'Tranquil arched prayer niche with a hanging brass lantern glowing over parchment scrolls at dusk',
  dawud: 'Majestic misty mountains at dawn echoing with golden light beside an ornate wooden harp on a stone balcony',
  sulayman: 'Luminous crystal-floored courtyard palace surrounded by geometric Islamic domes and sunlit gardens',
  ilyas: 'Dark rain clouds releasing silver rainfall onto green terraced mountain hills after long drought',
  alyasa: 'Tranquil winding Jordan river valley framed by tall cypress trees in crisp morning light',
  yunus: 'Deep midnight lapis ocean waves illuminated by moonlight near a peaceful shoreline covered with broad green gourd leaves',
  zakariya: 'Sunlit stone sanctuary mihrab bathed in diagonal beams of golden light beside blossoming almond branches',
  yahya: 'Clear desert river waters flowing past reeds under the radiant morning star at dawn',
  isa: 'Peaceful Mount of Olives courtyard at sunrise with an ornate olive tree, glowing lantern, and white dove wings',
  muhammad: 'Scenic view of Mount Hira overlooking peaceful Makkah hills and the illuminated green dome and minarets of Madinah under a crescent moon',
};

function openIllustrationDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function loadCachedProphetAiImages(): Promise<
  Record<string, string>
> {
  const result: Record<string, string> = {};
  memoryImageCache.forEach((val, key) => {
    result[key] = val;
  });

  const db = await openIllustrationDb();
  if (!db) return result;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          const key = String(cursor.key);
          const val = String(cursor.value);
          if (val.startsWith('data:image/')) {
            memoryImageCache.set(key, val);
            result[key] = val;
          }
          cursor.continue();
        } else {
          resolve(result);
        }
      };
      req.onerror = () => resolve(result);
    } catch {
      resolve(result);
    }
  });
}

async function saveCachedProphetAiImage(
  prophetId: string,
  imageDataUrl: string
): Promise<void> {
  memoryImageCache.set(prophetId, imageDataUrl);
  const db = await openIllustrationDb();
  if (!db) return;
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(imageDataUrl, prophetId);
  } catch {
    // ignore IndexedDB quota errors
  }
}

export async function generateProphetAiIllustration(params: {
  prophetId: string;
  prophetName: string;
  forceRefresh?: boolean;
}): Promise<string> {
  if (!params.forceRefresh && memoryImageCache.has(params.prophetId)) {
    return memoryImageCache.get(params.prophetId)!;
  }

  const scenePrompt =
    PROPHET_AI_SCENE_PROMPTS[params.prophetId] ??
    `Historic Middle Eastern scenic landscape representing ${params.prophetName}`;

  const res = await fetch('/api/prophets/illustrate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prophetId: params.prophetId,
      prophetName: params.prophetName,
      scenePrompt,
      forceRefresh: Boolean(params.forceRefresh),
    }),
  });

  if (!res.ok) {
    const errBody = (await res.json().catch(() => ({}))) as {
      message?: string;
      error?: string;
    };
    throw new Error(
      errBody.message ||
        errBody.error ||
        'تعذر توليد اللوحة بالذكاء الاصطناعي حالياً'
    );
  }

  const data = (await res.json()) as { imageDataUrl?: string };
  if (!data.imageDataUrl) {
    throw new Error('لم يتم إرجاع صورة صالحة');
  }

  await saveCachedProphetAiImage(params.prophetId, data.imageDataUrl);
  return data.imageDataUrl;
}
