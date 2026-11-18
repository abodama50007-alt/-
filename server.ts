import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import { createServer as createHttpServer } from 'http';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const ALLOWED_VOICES = new Set(['Charon', 'Fenrir', 'Kore', 'Puck', 'Zephyr']);
const MAX_NARRATION_CHARS = 2800;
const AUDIO_CACHE_LIMIT = 45;
const IMAGE_CACHE_LIMIT = 30;

// In-memory LRU cache for synthesized prophet story WAV clips
const narrationAudioCache = new Map<string, string>();
// In-memory LRU cache for AI-generated prophet story illustrations
const illustrationCache = new Map<string, string>();

function setBoundedCache(
  cache: Map<string, string>,
  key: string,
  value: string,
  limit: number
): void {
  if (cache.has(key)) {
    cache.delete(key);
  }
  cache.set(key, value);
  if (cache.size > limit) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) {
      cache.delete(oldestKey);
    }
  }
}

function getGenAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// In-memory cache for live PWA widget prayer data (30-minute TTL)
const widgetPrayerCache = new Map<
  string,
  { expiresAt: number; timings: Record<string, string> }
>();

const SERVER_HIJRI_MONTHS_AR = [
  'محرم',
  'صفر',
  'ربيع الأول',
  'ربيع الآخر',
  'جمادى الأولى',
  'جمادى الآخرة',
  'رجب',
  'شعبان',
  'رمضان',
  'شوال',
  'ذو القعدة',
  'ذو الحجة',
];

const SERVER_HIJRI_MONTHS_EN = [
  'Muharram',
  'Safar',
  'Rabi al-Awwal',
  'Rabi al-Thani',
  'Jumada al-Ula',
  'Jumada al-Akhirah',
  'Rajab',
  'Shaban',
  'Ramadan',
  'Shawwal',
  'Dhul-Qadah',
  'Dhul-Hijjah',
];

const SERVER_WEEKDAYS_AR = [
  'الأحد',
  'الإثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت',
];

const SERVER_WEEKDAYS_EN = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

function toServerArabicDigits(input: string | number): string {
  const map = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(input).replace(/\d/g, (d) => map[Number(d)] ?? d);
}

function cleanServerTime(raw: string | undefined, fallback: string): string {
  if (!raw) return fallback;
  const m = raw.match(/(\d{1,2}:\d{2})/);
  return m ? m[1].padStart(5, '0') : fallback;
}

function serverMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

function getServerHijriAndGreg(now: Date, lang: 'ar' | 'en') {
  let year = 1448;
  let month = 1;
  let day = 1;
  try {
    const parts = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
    }).formatToParts(now);
    day = Number(parts.find((p) => p.type === 'day')?.value || 1);
    month = Number(parts.find((p) => p.type === 'month')?.value || 1);
    const yrStr = parts.find((p) => p.type === 'year')?.value || '1448';
    year = Number(yrStr.replace(/\D/g, '')) || 1448;
  } catch {
    // keep default
  }

  const mIdx = Math.max(0, Math.min(11, month - 1));
  const wIdx = now.getDay();
  const hijriDate =
    lang === 'en'
      ? `${SERVER_WEEKDAYS_EN[wIdx]}, ${day} ${SERVER_HIJRI_MONTHS_EN[mIdx]} ${year} AH`
      : `${SERVER_WEEKDAYS_AR[wIdx]}، ${toServerArabicDigits(day)} ${SERVER_HIJRI_MONTHS_AR[mIdx]} ${toServerArabicDigits(year)} هـ`;

  let gregorianDate = '';
  try {
    gregorianDate = new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'ar-EG', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(now);
  } catch {
    gregorianDate = now.toISOString().slice(0, 10);
  }

  return { hijriDate, gregorianDate };
}

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '64kb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.get('/widgets/prayer-widget-template.json', (req: Request, res: Response) => {
    const lang: 'ar' | 'en' = req.query.lang === 'en' ? 'en' : 'ar';
    const isEn = lang === 'en';
    const rawTheme = typeof req.query.theme === 'string' ? req.query.theme : 'emerald';

    const sanitizeHex = (v: unknown, fb: string): string =>
      typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v.trim())
        ? v.trim().toUpperCase()
        : fb;

    const hexLum = (hex: string): number => {
      const c = hex.replace('#', '');
      const r = parseInt(c.slice(0, 2), 16) / 255;
      const g = parseInt(c.slice(2, 4), 16) / 255;
      const b = parseInt(c.slice(4, 6), 16) / 255;
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };

    const presets: Record<
      string,
      {
        primaryBg: string;
        secondaryBg: string;
        accentColor: string;
        textColor: string;
        isLight: boolean;
      }
    > = {
      emerald: {
        primaryBg: '#14532D',
        secondaryBg: '#0B2E19',
        accentColor: '#FCD34D',
        textColor: '#FBF8F1',
        isLight: false,
      },
      'royal-gold': {
        primaryBg: '#3D2B10',
        secondaryBg: '#1C1306',
        accentColor: '#F6D279',
        textColor: '#FFFDF7',
        isLight: false,
      },
      'calm-blue': {
        primaryBg: '#0F2E4D',
        secondaryBg: '#081B2E',
        accentColor: '#7DD3FC',
        textColor: '#F0F9FF',
        isLight: false,
      },
      light: {
        primaryBg: '#FBF8F1',
        secondaryBg: '#EFE6D3',
        accentColor: '#14532D',
        textColor: '#1C1917',
        isLight: true,
      },
      dark: {
        primaryBg: '#0F1714',
        secondaryBg: '#0A0F0D',
        accentColor: '#34D399',
        textColor: '#F2EFE8',
        isLight: false,
      },
    };

    let themeId = rawTheme in presets || rawTheme === 'custom' ? rawTheme : 'emerald';
    let palette = presets[themeId];
    if (themeId === 'custom') {
      const primaryBg = sanitizeHex(req.query.bg, '#2C221E');
      const secondaryBg = sanitizeHex(req.query.bg2, '#16100E');
      const accentColor = sanitizeHex(req.query.accent, '#E5B85C');
      const textColor = sanitizeHex(req.query.text, '#FFFDF7');
      palette = {
        primaryBg,
        secondaryBg,
        accentColor,
        textColor,
        isLight: hexLum(primaryBg) > 0.58,
      };
    } else if (!palette) {
      themeId = 'emerald';
      palette = presets.emerald;
    }

    const svgBg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="420" viewBox="0 0 800 420"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${palette.primaryBg}"/><stop offset="100%" stop-color="${palette.secondaryBg}"/></linearGradient></defs><rect width="800" height="420" rx="28" fill="url(#g)"/><rect x="6" y="6" width="788" height="408" rx="24" fill="none" stroke="${palette.accentColor}" stroke-opacity="0.35" stroke-width="2"/></svg>`;
    const bgDataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgBg)}`;

    const openUrlParams = new URLSearchParams({ mode: 'widget', theme: themeId });
    if (themeId === 'custom') {
      openUrlParams.set('bg', palette.primaryBg);
      openUrlParams.set('bg2', palette.secondaryBg);
      openUrlParams.set('accent', palette.accentColor);
      openUrlParams.set('text', palette.textColor);
    }

    const primaryTextColor = palette.isLight ? 'Default' : 'Light';
    const accentTextColor =
      themeId === 'royal-gold' || themeId === 'emerald' ? 'Warning' : 'Accent';

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=120');
    res.json({
      type: 'AdaptiveCard',
      $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
      version: '1.5',
      rtl: !isEn,
      widgetTheme: {
        id: themeId,
        ...palette,
      },
      body: [
        {
          type: 'Container',
          style: palette.isLight ? 'default' : 'emphasis',
          bleed: true,
          backgroundImage: {
            url: bgDataUri,
            fillMode: 'Cover',
          },
          items: [
            {
              type: 'ColumnSet',
              columns: [
                {
                  type: 'Column',
                  width: 'stretch',
                  items: [
                    {
                      type: 'TextBlock',
                      text: '${appName}',
                      size: 'Small',
                      weight: 'Bolder',
                      color: accentTextColor,
                    },
                    {
                      type: 'TextBlock',
                      text: '${hijriDate}',
                      size: 'Large',
                      weight: 'Bolder',
                      color: primaryTextColor,
                      wrap: true,
                      spacing: 'Small',
                    },
                    {
                      type: 'TextBlock',
                      text: '${gregorianDate} • ${location}',
                      size: 'Small',
                      color: primaryTextColor,
                      isSubtle: true,
                      wrap: true,
                      spacing: 'None',
                    },
                  ],
                },
                {
                  type: 'Column',
                  width: 'auto',
                  verticalContentAlignment: 'Center',
                  items: [
                    {
                      type: 'TextBlock',
                      text: '${nextPrayerLabel}',
                      size: 'Small',
                      color: primaryTextColor,
                      isSubtle: true,
                      horizontalAlignment: 'Right',
                    },
                    {
                      type: 'TextBlock',
                      text: '${nextPrayerName} • ${nextPrayerTime}',
                      size: 'Medium',
                      weight: 'Bolder',
                      color: accentTextColor,
                      horizontalAlignment: 'Right',
                      spacing: 'None',
                    },
                    {
                      type: 'TextBlock',
                      text: '${remainingLabel}',
                      size: 'Small',
                      weight: 'Bolder',
                      color: 'Good',
                      horizontalAlignment: 'Right',
                      spacing: 'None',
                    },
                  ],
                },
              ],
            },
            {
              type: 'ColumnSet',
              spacing: 'Medium',
              columns: ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].map((k) => ({
                type: 'Column',
                width: 'stretch',
                items: [
                  {
                    type: 'TextBlock',
                    text: `\${prayers.${k}Label}`,
                    size: 'Small',
                    color: primaryTextColor,
                    isSubtle: true,
                    horizontalAlignment: 'Center',
                  },
                  {
                    type: 'TextBlock',
                    text: `\${prayers.${k}}`,
                    size: 'Small',
                    weight: 'Bolder',
                    color: primaryTextColor,
                    horizontalAlignment: 'Center',
                    spacing: 'None',
                  },
                ],
              })),
            },
            {
              type: 'ColumnSet',
              spacing: 'Small',
              separator: true,
              columns: [
                {
                  type: 'Column',
                  width: 'stretch',
                  items: [
                    {
                      type: 'TextBlock',
                      text: '${prayers.sunriseLabel}: ${prayers.sunrise}',
                      size: 'Small',
                      color: primaryTextColor,
                      isSubtle: true,
                    },
                  ],
                },
                {
                  type: 'Column',
                  width: 'auto',
                  items: [
                    {
                      type: 'TextBlock',
                      text: '${lastUpdatedLabel}',
                      size: 'Small',
                      color: primaryTextColor,
                      isSubtle: true,
                      horizontalAlignment: 'Right',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
      actions: [
        {
          type: 'Action.OpenUrl',
          title: isEn ? 'Open Prayer & Date Widget' : 'فتح ودجيت الصلاة والتاريخ',
          url: `/?${openUrlParams.toString()}`,
        },
        {
          type: 'Action.Execute',
          title: isEn ? 'Refresh Timings' : 'تحديث المواقيت',
          verb: 'refresh',
        },
      ],
    });
  });

  app.get('/widgets/prayer-data.json', async (req: Request, res: Response) => {
    const lat = Number(req.query.lat) || 21.3891;
    const lng = Number(req.query.lng) || 39.8579;
    const methodId = Number(req.query.method) || 4;
    const lang: 'ar' | 'en' = req.query.lang === 'en' ? 'en' : 'ar';
    const city =
      typeof req.query.city === 'string' && req.query.city.trim()
        ? req.query.city.trim().slice(0, 80)
        : lang === 'en'
        ? 'Makkah, Saudi Arabia'
        : 'مكة المكرمة، السعودية';

    const now = new Date();
    const dateKey = now.toISOString().slice(0, 10);
    const cacheKey = `${dateKey}_${lat.toFixed(2)}_${lng.toFixed(2)}_${methodId}`;

    let timings: Record<string, string> = {
      fajr: '05:14',
      sunrise: '06:34',
      dhuhr: '12:07',
      asr: '15:18',
      maghrib: '17:40',
      isha: '19:10',
    };

    const cached = widgetPrayerCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      timings = cached.timings;
    } else {
      try {
        const upstream = await fetch(
          `https://api.aladhan.com/v1/timings?latitude=${encodeURIComponent(
            lat
          )}&longitude=${encodeURIComponent(lng)}&method=${methodId}`
        );
        if (upstream.ok) {
          const json = (await upstream.json()) as {
            data?: { timings?: Record<string, string> };
          };
          const t = json.data?.timings ?? {};
          timings = {
            fajr: cleanServerTime(t.Fajr, timings.fajr),
            sunrise: cleanServerTime(t.Sunrise, timings.sunrise),
            dhuhr: cleanServerTime(t.Dhuhr, timings.dhuhr),
            asr: cleanServerTime(t.Asr, timings.asr),
            maghrib: cleanServerTime(t.Maghrib, timings.maghrib),
            isha: cleanServerTime(t.Isha, timings.isha),
          };
          widgetPrayerCache.set(cacheKey, {
            expiresAt: Date.now() + 30 * 60 * 1000,
            timings,
          });
        }
      } catch {
        // Keep resilient default fallback timings offline
      }
    }

    const { hijriDate, gregorianDate } = getServerHijriAndGreg(now, lang);
    const ordered: Array<{
      key: 'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';
      ar: string;
      en: string;
    }> = [
      { key: 'fajr', ar: 'الفجر', en: 'Fajr' },
      { key: 'sunrise', ar: 'الشروق', en: 'Sunrise' },
      { key: 'dhuhr', ar: 'الظهر', en: 'Dhuhr' },
      { key: 'asr', ar: 'العصر', en: 'Asr' },
      { key: 'maghrib', ar: 'المغرب', en: 'Maghrib' },
      { key: 'isha', ar: 'العشاء', en: 'Isha' },
    ];

    const nowMins = now.getHours() * 60 + now.getMinutes();
    let next = ordered[0];
    let diffMins = serverMinutes(timings.fajr) + 1440 - nowMins;
    for (const item of ordered) {
      const targetMins = serverMinutes(timings[item.key]);
      if (targetMins > nowMins) {
        next = item;
        diffMins = targetMins - nowMins;
        break;
      }
    }

    const remHrs = Math.floor(diffMins / 60);
    const remMins = diffMins % 60;
    const remainingLabel =
      lang === 'en'
        ? `In ${remHrs}h ${remMins}m`
        : `متبقي ${toServerArabicDigits(remHrs)} س ${toServerArabicDigits(remMins)} د`;

    const lastUpdatedLabel =
      lang === 'en'
        ? `Updated ${String(now.getHours()).padStart(2, '0')}:${String(
            now.getMinutes()
          ).padStart(2, '0')}`
        : `آخر تحديث ${toServerArabicDigits(
            String(now.getHours()).padStart(2, '0')
          )}:${toServerArabicDigits(String(now.getMinutes()).padStart(2, '0'))}`;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json({
      appName: lang === 'en' ? 'Al-Mushaf Al-Jami' : 'المصحف الجامع',
      hijriDate,
      gregorianDate,
      location: city,
      nextPrayerLabel: lang === 'en' ? 'Next Prayer' : 'الصلاة القادمة',
      nextPrayerName: lang === 'en' ? next.en : next.ar,
      nextPrayerTime: timings[next.key],
      remainingLabel,
      lastUpdatedLabel,
      prayers: {
        fajrLabel: lang === 'en' ? 'Fajr' : 'الفجر',
        fajr: timings.fajr,
        sunriseLabel: lang === 'en' ? 'Sunrise' : 'الشروق',
        sunrise: timings.sunrise,
        dhuhrLabel: lang === 'en' ? 'Dhuhr' : 'الظهر',
        dhuhr: timings.dhuhr,
        asrLabel: lang === 'en' ? 'Asr' : 'العصر',
        asr: timings.asr,
        maghribLabel: lang === 'en' ? 'Maghrib' : 'المغرب',
        maghrib: timings.maghrib,
        ishaLabel: lang === 'en' ? 'Isha' : 'العشاء',
        isha: timings.isha,
      },
    });
  });

  app.post('/api/prophets/narrate', async (req: Request, res: Response) => {
    try {
      const body = req.body as {
        text?: unknown;
        voiceName?: unknown;
      };

      const rawText = typeof body?.text === 'string' ? body.text.trim() : '';
      if (!rawText) {
        res.status(400).json({ error: 'النص المطلوب قراءته فارغ' });
        return;
      }

      const clippedText =
        rawText.length > MAX_NARRATION_CHARS
          ? rawText.slice(0, MAX_NARRATION_CHARS)
          : rawText;

      const requestedVoice =
        typeof body?.voiceName === 'string' && ALLOWED_VOICES.has(body.voiceName)
          ? body.voiceName
          : 'Charon';

      const cacheKey = `${requestedVoice}::${clippedText}`;
      const cachedWav = narrationAudioCache.get(cacheKey);
      if (cachedWav) {
        res.json({
          audioBase64: cachedWav,
          mimeType: 'audio/wav',
          cached: true,
        });
        return;
      }

      const ai = getGenAIClient();
      if (!ai) {
        res.status(503).json({
          error: 'GEMINI_API_KEY_NOT_CONFIGURED',
          message:
            'خدمة التلاوة السحابية غير مفعلة حالياً، سيتم استخدام القارئ المدمج.',
        });
        return;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: clippedText,
                speechMetadata: {
                  style:
                    'Warm, dignified, eloquent classical Arabic storyteller reading prophet history clearly, serenely, and reverently with natural pacing',
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: requestedVoice },
            },
          },
        },
      });

      const parts = response.candidates?.[0]?.content?.parts ?? [];
      let base64Audio: string | undefined;
      for (const part of parts) {
        if (part.inlineData?.data) {
          base64Audio = part.inlineData.data;
          break;
        }
      }

      if (!base64Audio) {
        res.status(502).json({
          error: 'NO_AUDIO_RETURNED',
          message: 'لم يتم إرجاع ملف صوتي من خدمة التوليد.',
        });
        return;
      }

      setBoundedCache(narrationAudioCache, cacheKey, base64Audio, AUDIO_CACHE_LIMIT);
      res.json({
        audioBase64: base64Audio,
        mimeType: 'audio/wav',
        cached: false,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'تعذر توليد التلاوة الصوتية للقصة';
      const status =
        message.includes('429') || message.includes('RESOURCE_EXHAUSTED')
          ? 429
          : 500;
      res.status(status).json({
        error: 'NARRATION_FAILED',
        message,
      });
    }
  });

  app.post('/api/prophets/illustrate', async (req: Request, res: Response) => {
    try {
      const body = req.body as {
        prophetId?: unknown;
        prophetName?: unknown;
        scenePrompt?: unknown;
        forceRefresh?: unknown;
      };

      const prophetId =
        typeof body?.prophetId === 'string' ? body.prophetId.trim() : '';
      const scenePrompt =
        typeof body?.scenePrompt === 'string' ? body.scenePrompt.trim() : '';
      const forceRefresh = Boolean(body?.forceRefresh);

      if (!prophetId || !scenePrompt) {
        res.status(400).json({ error: 'بيانات القصة غير مكتملة لتوليد الرسم' });
        return;
      }

      if (!forceRefresh && illustrationCache.has(prophetId)) {
        res.json({
          imageDataUrl: illustrationCache.get(prophetId),
          cached: true,
        });
        return;
      }

      const ai = getGenAIClient();
      if (!ai) {
        res.status(503).json({
          error: 'GEMINI_API_KEY_NOT_CONFIGURED',
          message:
            'يرجى ضبط مفتاح Gemini API في Settings > Secrets لتفعيل توليد الرسومات بالذكاء الاصطناعي.',
        });
        return;
      }

      const fullPrompt = [
        'Museum-grade reverent Islamic manuscript and atmospheric landscape illustration.',
        `Scene theme: ${scenePrompt}.`,
        'Warm alabaster gold, deep forest emerald, lapis blue, and soft ambient light.',
        'Strict artistic constraint: NO human figures, NO faces, NO prophets depicted, pure scenic architecture, nature, celestial light, and symbolic artifacts only. Editorial painterly style.',
      ].join(' ');

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-image',
        contents: {
          parts: [{ text: fullPrompt }],
        },
        config: {
          imageConfig: {
            aspectRatio: '16:9',
          },
        },
      });

      const parts = response.candidates?.[0]?.content?.parts ?? [];
      let imageDataUrl: string | null = null;
      for (const part of parts) {
        if (part.inlineData?.data) {
          const mime = part.inlineData.mimeType || 'image/png';
          imageDataUrl = `data:${mime};base64,${part.inlineData.data}`;
          break;
        }
      }

      if (!imageDataUrl) {
        res.status(502).json({
          error: 'NO_IMAGE_RETURNED',
          message: 'لم تُرجع خدمة الذكاء الاصطناعي صورة صالحة، يرجى المحاولة مجدداً.',
        });
        return;
      }

      setBoundedCache(illustrationCache, prophetId, imageDataUrl, IMAGE_CACHE_LIMIT);
      res.json({
        imageDataUrl,
        cached: false,
      });
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      if (raw.includes('PERMISSION_DENIED') || raw.includes('API_KEY_INVALID')) {
        res.status(403).json({
          error: 'API_KEY_PERMISSION',
          message:
            'توليد الصور بالذكاء الاصطناعي يتطلب مفتاحاً مفعّلاً من Settings > Secrets.',
        });
        return;
      }
      if (raw.includes('RESOURCE_EXHAUSTED') || raw.includes('429')) {
        res.status(429).json({
          error: 'QUOTA_EXCEEDED',
          message:
            'تم بلوغ حد الحصة المتاح لتوليد الصور؛ يمكنك ترقية المفتاح في Settings > Secrets.',
        });
        return;
      }
      res.status(500).json({
        error: 'ILLUSTRATION_FAILED',
        message: 'تعذر توليد الرسم حالياً، تم الإبقاء على اللوحة التعبيرية الافتراضية.',
      });
    }
  });

  const httpServer = createHttpServer(app);

  if (process.env.NODE_ENV !== 'production') {
    process.env.DISABLE_HMR = 'true';
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (req: Request, res: Response, next) => {
      if (req.path.startsWith('/api/')) {
        next();
        return;
      }
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
