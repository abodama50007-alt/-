import { AppLanguage } from '../i18n/translations';
import { getNextPrayerInfo, getPrayerLabel } from '../services/prayerApi';
import { PrayerKey, PrayerTimingsData, SavedGeoLocation } from '../types/quran';
import { toArabicDigits } from './arabic';
import { getCurrentHijriDate } from './hijri';

export type WidgetTheme =
  | 'emerald'
  | 'royal-gold'
  | 'calm-blue'
  | 'light'
  | 'dark'
  | 'custom';
export type WidgetSize = 'compact' | 'standard' | 'wide';

export interface WidgetCustomColors {
  primaryBg: string;
  secondaryBg: string;
  accentColor: string;
  textColor: string;
}

export interface ResolvedWidgetPalette {
  id: WidgetTheme;
  primaryBg: string;
  secondaryBg: string;
  accentColor: string;
  textColor: string;
  mutedTextColor: string;
  cardBg: string;
  borderColor: string;
  activeBg: string;
  isLight: boolean;
}

export interface PrayerWidgetPrefs {
  theme: WidgetTheme;
  size: WidgetSize;
  showSunrise: boolean;
  customColors: WidgetCustomColors;
}

export interface PrayerWidgetSnapshot {
  updatedAt: number;
  locationLabel: string;
  lat: number;
  lng: number;
  methodId: number;
  timings: PrayerTimingsData;
}

const WIDGET_SNAPSHOT_KEY = 'quran_widget_snapshot_v1';
const WIDGET_PREFS_KEY = 'quran_widget_prefs_v1';

export const DEFAULT_CUSTOM_WIDGET_COLORS: WidgetCustomColors = {
  primaryBg: '#2C221E',
  secondaryBg: '#16100E',
  accentColor: '#E5B85C',
  textColor: '#FFFDF7',
};

export const WIDGET_THEME_PRESETS: Record<
  Exclude<WidgetTheme, 'custom'>,
  Omit<ResolvedWidgetPalette, 'id'>
> = {
  emerald: {
    primaryBg: '#14532D',
    secondaryBg: '#0B2E19',
    accentColor: '#FCD34D',
    textColor: '#FBF8F1',
    mutedTextColor: 'rgba(236, 253, 245, 0.80)',
    cardBg: 'rgba(255, 255, 255, 0.11)',
    borderColor: 'rgba(217, 168, 78, 0.35)',
    activeBg: 'rgba(252, 211, 77, 0.20)',
    isLight: false,
  },
  'royal-gold': {
    primaryBg: '#3D2B10',
    secondaryBg: '#1C1306',
    accentColor: '#F6D279',
    textColor: '#FFFDF7',
    mutedTextColor: 'rgba(254, 243, 199, 0.80)',
    cardBg: 'rgba(246, 210, 121, 0.11)',
    borderColor: 'rgba(246, 210, 121, 0.42)',
    activeBg: 'rgba(246, 210, 121, 0.24)',
    isLight: false,
  },
  'calm-blue': {
    primaryBg: '#0F2E4D',
    secondaryBg: '#081B2E',
    accentColor: '#7DD3FC',
    textColor: '#F0F9FF',
    mutedTextColor: 'rgba(224, 242, 254, 0.80)',
    cardBg: 'rgba(125, 211, 252, 0.11)',
    borderColor: 'rgba(125, 211, 252, 0.36)',
    activeBg: 'rgba(125, 211, 252, 0.22)',
    isLight: false,
  },
  light: {
    primaryBg: '#FBF8F1',
    secondaryBg: '#EFE6D3',
    accentColor: '#14532D',
    textColor: '#1C1917',
    mutedTextColor: '#57534E',
    cardBg: 'rgba(255, 255, 255, 0.72)',
    borderColor: 'rgba(20, 83, 45, 0.18)',
    activeBg: 'rgba(20, 83, 45, 0.13)',
    isLight: true,
  },
  dark: {
    primaryBg: '#0F1714',
    secondaryBg: '#0A0F0D',
    accentColor: '#34D399',
    textColor: '#F2EFE8',
    mutedTextColor: '#A8A29E',
    cardBg: 'rgba(255, 255, 255, 0.06)',
    borderColor: 'rgba(255, 255, 255, 0.14)',
    activeBg: 'rgba(52, 211, 153, 0.18)',
    isLight: false,
  },
};

export function sanitizeHexColor(value: unknown, fallback: string): string {
  if (typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value.trim())) {
    return value.trim().toUpperCase();
  }
  return fallback;
}

function hexLuminance(hex: string): number {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return 0;
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function resolveWidgetPalette(
  theme: WidgetTheme,
  customColors?: WidgetCustomColors
): ResolvedWidgetPalette {
  if (theme !== 'custom') {
    return {
      id: theme,
      ...WIDGET_THEME_PRESETS[theme],
    };
  }
  const primaryBg = sanitizeHexColor(
    customColors?.primaryBg,
    DEFAULT_CUSTOM_WIDGET_COLORS.primaryBg
  );
  const secondaryBg = sanitizeHexColor(
    customColors?.secondaryBg,
    DEFAULT_CUSTOM_WIDGET_COLORS.secondaryBg
  );
  const accentColor = sanitizeHexColor(
    customColors?.accentColor,
    DEFAULT_CUSTOM_WIDGET_COLORS.accentColor
  );
  const textColor = sanitizeHexColor(
    customColors?.textColor,
    DEFAULT_CUSTOM_WIDGET_COLORS.textColor
  );
  const isLight = hexLuminance(primaryBg) > 0.58;
  return {
    id: 'custom',
    primaryBg,
    secondaryBg,
    accentColor,
    textColor,
    mutedTextColor: isLight
      ? 'rgba(28, 25, 23, 0.72)'
      : 'rgba(255, 255, 255, 0.76)',
    cardBg: isLight ? 'rgba(255, 255, 255, 0.65)' : 'rgba(255, 255, 255, 0.11)',
    borderColor: `${accentColor}66`,
    activeBg: `${accentColor}33`,
    isLight,
  };
}

export const VALID_WIDGET_THEMES: readonly WidgetTheme[] = [
  'emerald',
  'royal-gold',
  'calm-blue',
  'light',
  'dark',
  'custom',
];

export const DEFAULT_WIDGET_PREFS: PrayerWidgetPrefs = {
  theme: 'emerald',
  size: 'standard',
  showSunrise: true,
  customColors: DEFAULT_CUSTOM_WIDGET_COLORS,
};

export function loadWidgetPrefs(): PrayerWidgetPrefs {
  try {
    const raw = localStorage.getItem(WIDGET_PREFS_KEY);
    if (!raw) return DEFAULT_WIDGET_PREFS;
    const parsed = JSON.parse(raw) as Partial<PrayerWidgetPrefs>;
    const rawCustom = parsed.customColors;
    return {
      theme: VALID_WIDGET_THEMES.includes(parsed.theme as WidgetTheme)
        ? (parsed.theme as WidgetTheme)
        : DEFAULT_WIDGET_PREFS.theme,
      size:
        parsed.size === 'compact' || parsed.size === 'standard' || parsed.size === 'wide'
          ? parsed.size
          : DEFAULT_WIDGET_PREFS.size,
      showSunrise:
        typeof parsed.showSunrise === 'boolean'
          ? parsed.showSunrise
          : DEFAULT_WIDGET_PREFS.showSunrise,
      customColors: {
        primaryBg: sanitizeHexColor(
          rawCustom?.primaryBg,
          DEFAULT_CUSTOM_WIDGET_COLORS.primaryBg
        ),
        secondaryBg: sanitizeHexColor(
          rawCustom?.secondaryBg,
          DEFAULT_CUSTOM_WIDGET_COLORS.secondaryBg
        ),
        accentColor: sanitizeHexColor(
          rawCustom?.accentColor,
          DEFAULT_CUSTOM_WIDGET_COLORS.accentColor
        ),
        textColor: sanitizeHexColor(
          rawCustom?.textColor,
          DEFAULT_CUSTOM_WIDGET_COLORS.textColor
        ),
      },
    };
  } catch {
    return DEFAULT_WIDGET_PREFS;
  }
}

export function saveWidgetPrefs(prefs: PrayerWidgetPrefs): void {
  try {
    localStorage.setItem(WIDGET_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

export function saveWidgetSnapshot(
  location: SavedGeoLocation,
  methodId: number,
  timings: PrayerTimingsData
): void {
  const snapshot: PrayerWidgetSnapshot = {
    updatedAt: Date.now(),
    locationLabel: location.label,
    lat: location.lat,
    lng: location.lng,
    methodId,
    timings,
  };
  try {
    localStorage.setItem(WIDGET_SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {
    // ignore
  }
}

export function loadWidgetSnapshot(): PrayerWidgetSnapshot | null {
  try {
    const raw = localStorage.getItem(WIDGET_SNAPSHOT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PrayerWidgetSnapshot;
  } catch {
    return null;
  }
}

export function formatWidgetTime(hhmm: string, language: AppLanguage): string {
  const [hStr, mStr] = hhmm.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const mm = String(m).padStart(2, '0');
  if (language === 'en') {
    const period = h >= 12 ? 'PM' : 'AM';
    return `${h12}:${mm} ${period}`;
  }
  const period = h >= 12 ? 'م' : 'ص';
  return `${toArabicDigits(h12)}:${toArabicDigits(mm)} ${period}`;
}

export function formatWidgetCountdown(
  totalSeconds: number,
  language: AppLanguage
): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  const pad = (n: number) => {
    const str = String(n).padStart(2, '0');
    return language === 'ar' ? toArabicDigits(str) : str;
  };
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
}

function appendThemeQueryParams(
  search: URLSearchParams,
  theme?: WidgetTheme,
  customColors?: WidgetCustomColors
) {
  if (!theme) return;
  search.set('theme', theme);
  if (theme === 'custom' && customColors) {
    search.set(
      'bg',
      sanitizeHexColor(customColors.primaryBg, DEFAULT_CUSTOM_WIDGET_COLORS.primaryBg)
    );
    search.set(
      'bg2',
      sanitizeHexColor(
        customColors.secondaryBg,
        DEFAULT_CUSTOM_WIDGET_COLORS.secondaryBg
      )
    );
    search.set(
      'accent',
      sanitizeHexColor(
        customColors.accentColor,
        DEFAULT_CUSTOM_WIDGET_COLORS.accentColor
      )
    );
    search.set(
      'text',
      sanitizeHexColor(customColors.textColor, DEFAULT_CUSTOM_WIDGET_COLORS.textColor)
    );
  }
}

export function buildWidgetStandaloneUrl(
  theme?: WidgetTheme,
  customColors?: WidgetCustomColors
): string {
  if (typeof window === 'undefined') {
    const search = new URLSearchParams({ mode: 'widget' });
    appendThemeQueryParams(search, theme, customColors);
    return `/?${search.toString()}`;
  }
  const url = new URL(window.location.origin);
  url.searchParams.set('mode', 'widget');
  appendThemeQueryParams(url.searchParams, theme, customColors);
  return url.toString();
}

export function buildWidgetDataJsonUrl(params: {
  lat?: number;
  lng?: number;
  methodId?: number;
  language?: AppLanguage;
  cityLabel?: string;
}): string {
  const path = '/widgets/prayer-data.json';
  const origin =
    typeof window !== 'undefined' ? window.location.origin : '';
  const search = new URLSearchParams();
  if (typeof params.lat === 'number' && Number.isFinite(params.lat)) {
    search.set('lat', params.lat.toFixed(4));
  }
  if (typeof params.lng === 'number' && Number.isFinite(params.lng)) {
    search.set('lng', params.lng.toFixed(4));
  }
  if (typeof params.methodId === 'number' && Number.isFinite(params.methodId)) {
    search.set('method', String(params.methodId));
  }
  if (params.language) {
    search.set('lang', params.language);
  }
  if (params.cityLabel) {
    search.set('city', params.cityLabel);
  }
  const qs = search.toString();
  return `${origin}${path}${qs ? `?${qs}` : ''}`;
}

export function buildWidgetTemplateJsonUrl(params?: {
  theme?: WidgetTheme;
  customColors?: WidgetCustomColors;
  language?: AppLanguage;
}): string {
  const origin =
    typeof window !== 'undefined' ? window.location.origin : '';
  const search = new URLSearchParams();
  if (params?.theme) {
    appendThemeQueryParams(search, params.theme, params.customColors);
  }
  if (params?.language) {
    search.set('lang', params.language);
  }
  const qs = search.toString();
  return `${origin}/widgets/prayer-widget-template.json${qs ? `?${qs}` : ''}`;
}

export function buildAdaptiveCardTemplate(params: {
  theme: WidgetTheme;
  customColors?: WidgetCustomColors;
  language?: AppLanguage;
}): Record<string, unknown> {
  const lang = params.language ?? 'ar';
  const isEn = lang === 'en';
  const palette = resolveWidgetPalette(params.theme, params.customColors);

  const svgBg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="420" viewBox="0 0 800 420"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${palette.primaryBg}"/><stop offset="100%" stop-color="${palette.secondaryBg}"/></linearGradient></defs><rect width="800" height="420" rx="28" fill="url(#g)"/><rect x="6" y="6" width="788" height="408" rx="24" fill="none" stroke="${palette.accentColor}" stroke-opacity="0.35" stroke-width="2"/></svg>`;
  const bgDataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgBg)}`;

  const search = new URLSearchParams({ mode: 'widget' });
  appendThemeQueryParams(search, params.theme, params.customColors);
  const openUrl = `/?${search.toString()}`;

  const primaryTextColor = palette.isLight ? 'Default' : 'Light';
  const accentTextColor =
    params.theme === 'royal-gold' || params.theme === 'emerald'
      ? 'Warning'
      : 'Accent';

  return {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.5',
    rtl: !isEn,
    widgetTheme: {
      id: palette.id,
      primaryBg: palette.primaryBg,
      secondaryBg: palette.secondaryBg,
      accentColor: palette.accentColor,
      textColor: palette.textColor,
      isLight: palette.isLight,
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
        url: openUrl,
      },
      {
        type: 'Action.Execute',
        title: isEn ? 'Refresh Timings' : 'تحديث المواقيت',
        verb: 'refresh',
      },
    ],
  };
}

export interface LiveWidgetDataPayload {
  appName: string;
  hijriDate: string;
  gregorianDate: string;
  location: string;
  nextPrayerLabel: string;
  nextPrayerName: string;
  nextPrayerTime: string;
  remainingLabel: string;
  lastUpdatedLabel: string;
  prayers: {
    fajrLabel: string;
    fajr: string;
    sunriseLabel: string;
    sunrise: string;
    dhuhrLabel: string;
    dhuhr: string;
    asrLabel: string;
    asr: string;
    maghribLabel: string;
    maghrib: string;
    ishaLabel: string;
    isha: string;
  };
}

export function buildLiveWidgetDataPayload(params: {
  timings: PrayerTimingsData;
  locationLabel: string;
  language: AppLanguage;
}): LiveWidgetDataPayload {
  const now = new Date();
  const isEn = params.language === 'en';
  const hijri = getCurrentHijriDate(now, params.language);
  const next = getNextPrayerInfo(params.timings, now, params.language);
  const remHours = Math.floor(next.remainingSeconds / 3600);
  const remMins = Math.floor((next.remainingSeconds % 3600) / 60);

  const remainingLabel = isEn
    ? `In ${remHours}h ${remMins}m`
    : `متبقي ${toArabicDigits(remHours)} س ${toArabicDigits(remMins)} د`;

  const updatedTime = `${String(now.getHours()).padStart(2, '0')}:${String(
    now.getMinutes()
  ).padStart(2, '0')}`;

  return {
    appName: isEn ? 'Al-Mushaf Al-Jami' : 'المصحف الجامع',
    hijriDate: hijri.formattedFull,
    gregorianDate: hijri.gregorianFormatted,
    location: params.locationLabel,
    nextPrayerLabel: isEn ? 'Next Prayer' : 'الصلاة القادمة',
    nextPrayerName: next.name,
    nextPrayerTime: formatWidgetTime(next.time, params.language),
    remainingLabel,
    lastUpdatedLabel: isEn
      ? `Updated ${updatedTime}`
      : `تحديث ${toArabicDigits(updatedTime)}`,
    prayers: {
      fajrLabel: getPrayerLabel('fajr', params.language),
      fajr: formatWidgetTime(params.timings.fajr, params.language),
      sunriseLabel: getPrayerLabel('sunrise', params.language),
      sunrise: formatWidgetTime(params.timings.sunrise, params.language),
      dhuhrLabel: getPrayerLabel('dhuhr', params.language),
      dhuhr: formatWidgetTime(params.timings.dhuhr, params.language),
      asrLabel: getPrayerLabel('asr', params.language),
      asr: formatWidgetTime(params.timings.asr, params.language),
      maghribLabel: getPrayerLabel('maghrib', params.language),
      maghrib: formatWidgetTime(params.timings.maghrib, params.language),
      ishaLabel: getPrayerLabel('isha', params.language),
      isha: formatWidgetTime(params.timings.isha, params.language),
    },
  };
}

const LIVE_WIDGET_CACHE_NAME = 'quran-widget-live-data-v1';

interface PwaWidgetsRegistryLike {
  widgets?: {
    updateByTag?: (
      tag: string,
      payload: { template: string; data: string }
    ) => Promise<void>;
  };
}

export async function syncLiveWidgetDataCache(params: {
  timings: PrayerTimingsData;
  locationLabel: string;
  language: AppLanguage;
  theme?: WidgetTheme;
  customColors?: WidgetCustomColors;
}): Promise<void> {
  if (typeof window === 'undefined') return;
  const payload = buildLiveWidgetDataPayload(params);
  const serializedData = JSON.stringify(payload);
  const templateObj = buildAdaptiveCardTemplate({
    theme: params.theme ?? 'emerald',
    customColors: params.customColors,
    language: params.language,
  });
  const serializedTemplate = JSON.stringify(templateObj, null, 2);

  try {
    if ('caches' in window) {
      const cache = await caches.open(LIVE_WIDGET_CACHE_NAME);
      await Promise.all([
        cache.put(
          '/widgets/prayer-data.json',
          new Response(serializedData, {
            status: 200,
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              'Cache-Control': 'no-cache',
            },
          })
        ),
        cache.put(
          '/widgets/prayer-widget-template.json',
          new Response(serializedTemplate, {
            status: 200,
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              'Cache-Control': 'no-cache',
            },
          })
        ),
      ]);
    }
  } catch {
    // ignore cache storage failures
  }

  // Update W3C PWA Widgets host registry when supported (Edge / Windows Widgets)
  try {
    if ('serviceWorker' in navigator) {
      const reg = (await navigator.serviceWorker.ready) as ServiceWorkerRegistration &
        PwaWidgetsRegistryLike;
      if (reg.widgets?.updateByTag) {
        await reg.widgets.updateByTag('prayer-date-widget', {
          template: serializedTemplate,
          data: serializedData,
        });
      }
    }
  } catch {
    // PWA Widgets API is optional across browsers
  }
}

export function buildWidgetIframeCode(
  theme: WidgetTheme,
  customColors?: WidgetCustomColors
): string {
  const url = buildWidgetStandaloneUrl(theme, customColors);
  return `<iframe src="${url}" title="Al-Mushaf Date & Prayer Widget" width="420" height="310" style="border:0;border-radius:24px;overflow:hidden;" loading="lazy"></iframe>`;
}

export function isDocumentPipSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'documentPictureInPicture' in window &&
    typeof (window as unknown as { documentPictureInPicture?: { requestWindow?: unknown } })
      .documentPictureInPicture?.requestWindow === 'function'
  );
}

interface DocumentPipApi {
  requestWindow: (opts?: { width?: number; height?: number }) => Promise<Window>;
}

export async function launchFloatingPrayerWidgetPiP(params: {
  timings: PrayerTimingsData | null;
  locationLabel: string;
  language: AppLanguage;
  theme: WidgetTheme;
  customColors?: WidgetCustomColors;
}): Promise<{ ok: boolean; reason?: 'unsupported' | 'failed' }> {
  if (!isDocumentPipSupported() || !params.timings) {
    return {
      ok: false,
      reason: isDocumentPipSupported() ? 'failed' : 'unsupported',
    };
  }

  try {
    const pipApi = (
      window as unknown as { documentPictureInPicture: DocumentPipApi }
    ).documentPictureInPicture;
    const pipWin = await pipApi.requestWindow({ width: 400, height: 345 });
    const doc = pipWin.document;
    const isEn = params.language === 'en';
    const dir = isEn ? 'ltr' : 'rtl';
    const resolved = resolveWidgetPalette(params.theme, params.customColors);

    const palette = {
      bg: `linear-gradient(145deg, ${resolved.primaryBg} 0%, ${resolved.secondaryBg} 100%)`,
      card: resolved.cardBg,
      border: resolved.borderColor,
      text: resolved.textColor,
      muted: resolved.mutedTextColor,
      accent: resolved.accentColor,
      activeBg: resolved.activeBg,
    };

    doc.documentElement.lang = params.language;
    doc.documentElement.dir = dir;
    doc.head.innerHTML = `
      <meta charset="utf-8" />
      <title>${isEn ? 'Date & Prayer Widget' : 'ودجيت التاريخ والصلاة'}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
          background: ${palette.bg};
          color: ${palette.text};
          min-height: 100vh;
          padding: 14px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 10px;
          direction: ${dir};
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 10px;
        }
        .hijri { font-size: 16px; font-weight: 700; line-height: 1.3; }
        .greg { font-size: 11px; color: ${palette.muted}; margin-top: 2px; }
        .loc {
          font-size: 11px;
          padding: 4px 8px;
          border-radius: 999px;
          background: ${palette.card};
          border: 1px solid ${palette.border};
          white-space: nowrap;
        }
        .next-box {
          background: ${palette.card};
          border: 1px solid ${palette.border};
          border-radius: 14px;
          padding: 11px 14px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
        }
        .next-label { font-size: 11px; color: ${palette.muted}; }
        .next-name { font-size: 19px; font-weight: 700; color: ${palette.accent}; }
        .countdown { font-size: 21px; font-weight: 800; font-variant-numeric: tabular-nums; }
        .grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 7px;
        }
        .cell {
          background: ${palette.card};
          border: 1px solid ${palette.border};
          border-radius: 11px;
          padding: 7px 6px;
          text-align: center;
        }
        .cell.active {
          background: ${palette.activeBg};
          border-color: ${palette.accent};
        }
        .cell-name { font-size: 11px; color: ${palette.muted}; }
        .cell-time { font-size: 12px; font-weight: 700; margin-top: 2px; font-variant-numeric: tabular-nums; }
      </style>
    `;

    doc.body.innerHTML = `
      <div class="header">
        <div>
          <div id="pip-hijri" class="hijri"></div>
          <div id="pip-greg" class="greg"></div>
        </div>
        <div id="pip-loc" class="loc"></div>
      </div>
      <div class="next-box">
        <div>
          <div id="pip-next-label" class="next-label"></div>
          <div id="pip-next-name" class="next-name"></div>
        </div>
        <div id="pip-countdown" class="countdown"></div>
      </div>
      <div id="pip-grid" class="grid"></div>
    `;

    const prayerKeys: Array<PrayerKey | 'sunrise'> = [
      'fajr',
      'sunrise',
      'dhuhr',
      'asr',
      'maghrib',
      'isha',
    ];

    const renderTick = () => {
      if (!params.timings) return;
      const now = new Date();
      const hijri = getCurrentHijriDate(now, params.language);
      const next = getNextPrayerInfo(params.timings, now, params.language);

      const hijriEl = doc.getElementById('pip-hijri');
      const gregEl = doc.getElementById('pip-greg');
      const locEl = doc.getElementById('pip-loc');
      const nextLblEl = doc.getElementById('pip-next-label');
      const nextNameEl = doc.getElementById('pip-next-name');
      const cdEl = doc.getElementById('pip-countdown');
      const gridEl = doc.getElementById('pip-grid');

      if (hijriEl) hijriEl.textContent = hijri.formattedFull;
      if (gregEl) gregEl.textContent = hijri.gregorianFormatted;
      if (locEl) locEl.textContent = params.locationLabel;
      if (nextLblEl) {
        nextLblEl.textContent = isEn
          ? `Next Prayer (${formatWidgetTime(next.time, 'en')})`
          : `الصلاة القادمة (${formatWidgetTime(next.time, 'ar')})`;
      }
      if (nextNameEl) nextNameEl.textContent = next.name;
      if (cdEl) cdEl.textContent = formatWidgetCountdown(next.remainingSeconds, params.language);

      if (gridEl) {
        gridEl.innerHTML = prayerKeys
          .map((pk) => {
            const active = pk === next.key;
            return `<div class="cell ${active ? 'active' : ''}">
              <div class="cell-name">${getPrayerLabel(pk, params.language)}</div>
              <div class="cell-time">${formatWidgetTime(params.timings![pk], params.language)}</div>
            </div>`;
          })
          .join('');
      }
    };

    renderTick();
    const intervalId = pipWin.setInterval(renderTick, 1000);
    pipWin.addEventListener('pagehide', () => {
      pipWin.clearInterval(intervalId);
    });
    return { ok: true };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}

export function generateAndroidAppWidgetKotlin(): string {
  return `package com.mushaf.jamee.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Android Home Screen Widget for Al-Mushaf Al-Jami (com.mushaf.jamee)
 * Reads live synced snapshot saved in WebView localStorage/SharedPreferences bridge
 * and displays Hijri date, Gregorian date, and the 5 daily prayer times.
 */
class PrayerDateWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (widgetId in appWidgetIds) {
            updatePrayerWidget(context, appWidgetManager, widgetId)
        }
    }

    companion object {
        private const val PREFS_NAME = "CapacitorStorage"
        private const val SNAPSHOT_KEY = "quran_widget_snapshot_v1"

        fun updatePrayerWidget(
            context: Context,
            manager: AppWidgetManager,
            widgetId: Int
        ) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val rawJson = prefs.getString(SNAPSHOT_KEY, null)

            var locationLabel = "مكة المكرمة"
            var hijriDate = "التقويم الهجري"
            var fajr = "04:45"
            var dhuhr = "12:18"
            var asr = "15:44"
            var maghrib = "18:36"
            var isha = "20:06"

            if (!rawJson.isNullOrBlank()) {
                runCatching {
                    val root = JSONObject(rawJson)
                    locationLabel = root.optString("locationLabel", locationLabel)
                    val timings = root.optJSONObject("timings")
                    if (timings != null) {
                        hijriDate = timings.optString("hijriDateText", hijriDate)
                        fajr = timings.optString("fajr", fajr)
                        dhuhr = timings.optString("dhuhr", dhuhr)
                        asr = timings.optString("asr", asr)
                        maghrib = timings.optString("maghrib", maghrib)
                        isha = timings.optString("isha", isha)
                    }
                }
            }

            val gregorian = SimpleDateFormat("dd MMM yyyy", Locale.getDefault()).format(Date())
            val pkg = context.packageName
            val layoutId = context.resources.getIdentifier("prayer_date_widget", "layout", pkg)
            val views = RemoteViews(pkg, layoutId)

            fun id(name: String) = context.resources.getIdentifier(name, "id", pkg)

            views.setTextViewText(id("widget_hijri_date"), hijriDate)
            views.setTextViewText(id("widget_greg_date"), "$gregorian • $locationLabel")
            views.setTextViewText(id("widget_next_prayer"), "الفجر • $fajr")
            views.setTextViewText(id("widget_fajr"), fajr)
            views.setTextViewText(id("widget_dhuhr"), dhuhr)
            views.setTextViewText(id("widget_asr"), asr)
            views.setTextViewText(id("widget_maghrib"), maghrib)
            views.setTextViewText(id("widget_isha"), isha)

            val launchIntent = Intent(Intent.ACTION_VIEW, Uri.parse("https://almushaf.app/?mode=widget"))
            val pendingIntent = PendingIntent.getActivity(
                context,
                0,
                launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(id("widget_root"), pendingIntent)
            manager.updateAppWidget(widgetId, views)
        }
    }
}
`;
}

export function generateAndroidWidgetLayoutXml(
  theme: WidgetTheme = 'emerald',
  customColors?: WidgetCustomColors
): string {
  const palette = resolveWidgetPalette(theme, customColors);
  return `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/widget_root"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical"
    android:padding="14dp"
    android:background="${palette.primaryBg}">

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:orientation="horizontal"
        android:gravity="center_vertical">

        <LinearLayout
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:orientation="vertical">

            <TextView
                android:id="@+id/widget_hijri_date"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="التقويم الهجري"
                android:textColor="${palette.textColor}"
                android:textSize="15sp"
                android:textStyle="bold" />

            <TextView
                android:id="@+id/widget_greg_date"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="مكة المكرمة"
                android:textColor="${palette.textColor}"
                android:alpha="0.82"
                android:textSize="11sp" />
        </LinearLayout>

        <TextView
            android:id="@+id/widget_next_prayer"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:background="#26FFFFFF"
            android:paddingHorizontal="10dp"
            android:paddingVertical="4dp"
            android:text="الفجر • 04:45"
            android:textColor="${palette.accentColor}"
            android:textSize="12sp"
            android:textStyle="bold" />
    </LinearLayout>

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:layout_marginTop="10dp"
        android:orientation="horizontal"
        android:weightSum="5">

        <LinearLayout
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:gravity="center"
            android:orientation="vertical">
            <TextView android:layout_width="wrap_content" android:layout_height="wrap_content" android:text="الفجر" android:textColor="#D1FAE5" android:textSize="10sp" />
            <TextView android:id="@+id/widget_fajr" android:layout_width="wrap_content" android:layout_height="wrap_content" android:text="04:45" android:textColor="#FFFFFF" android:textSize="12sp" android:textStyle="bold" />
        </LinearLayout>

        <LinearLayout
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:gravity="center"
            android:orientation="vertical">
            <TextView android:layout_width="wrap_content" android:layout_height="wrap_content" android:text="الظهر" android:textColor="#D1FAE5" android:textSize="10sp" />
            <TextView android:id="@+id/widget_dhuhr" android:layout_width="wrap_content" android:layout_height="wrap_content" android:text="12:18" android:textColor="#FFFFFF" android:textSize="12sp" android:textStyle="bold" />
        </LinearLayout>

        <LinearLayout
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:gravity="center"
            android:orientation="vertical">
            <TextView android:layout_width="wrap_content" android:layout_height="wrap_content" android:text="العصر" android:textColor="#D1FAE5" android:textSize="10sp" />
            <TextView android:id="@+id/widget_asr" android:layout_width="wrap_content" android:layout_height="wrap_content" android:text="15:44" android:textColor="#FFFFFF" android:textSize="12sp" android:textStyle="bold" />
        </LinearLayout>

        <LinearLayout
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:gravity="center"
            android:orientation="vertical">
            <TextView android:layout_width="wrap_content" android:layout_height="wrap_content" android:text="المغرب" android:textColor="#D1FAE5" android:textSize="10sp" />
            <TextView android:id="@+id/widget_maghrib" android:layout_width="wrap_content" android:layout_height="wrap_content" android:text="18:36" android:textColor="#FFFFFF" android:textSize="12sp" android:textStyle="bold" />
        </LinearLayout>

        <LinearLayout
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:gravity="center"
            android:orientation="vertical">
            <TextView android:layout_width="wrap_content" android:layout_height="wrap_content" android:text="العشاء" android:textColor="#D1FAE5" android:textSize="10sp" />
            <TextView android:id="@+id/widget_isha" android:layout_width="wrap_content" android:layout_height="wrap_content" android:text="20:06" android:textColor="#FFFFFF" android:textSize="12sp" android:textStyle="bold" />
        </LinearLayout>
    </LinearLayout>
</LinearLayout>
`;
}

export function generateAndroidManifestReceiverXml(): string {
  return `<receiver
    android:name=".widget.PrayerDateWidgetProvider"
    android:exported="false"
    android:label="ودجيت التاريخ ومواقيت الصلاة">
    <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
    </intent-filter>
    <meta-data
        android:name="android.appwidget.provider"
        android:resource="@xml/prayer_widget_info" />
</receiver>`;
}

export function generateAndroidWidgetInfoXml(): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="250dp"
    android:minHeight="110dp"
    android:targetCellWidth="4"
    android:targetCellHeight="2"
    android:updatePeriodMillis="1800000"
    android:initialLayout="@layout/prayer_date_widget"
    android:resizeMode="horizontal|vertical"
    android:widgetCategory="home_screen"
    android:description="@string/prayer_widget_description" />
`;
}

function hexToSwiftRgb(hex: string): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return 'red: 0.08, green: 0.33, blue: 0.18';
  const r = (parseInt(clean.slice(0, 2), 16) / 255).toFixed(2);
  const g = (parseInt(clean.slice(2, 4), 16) / 255).toFixed(2);
  const b = (parseInt(clean.slice(4, 6), 16) / 255).toFixed(2);
  return `red: ${r}, green: ${g}, blue: ${b}`;
}

export function generateIOSWidgetKitSwift(
  theme: WidgetTheme = 'emerald',
  customColors?: WidgetCustomColors
): string {
  const palette = resolveWidgetPalette(theme, customColors);
  const primaryRgb = hexToSwiftRgb(palette.primaryBg);
  const secondaryRgb = hexToSwiftRgb(palette.secondaryBg);
  const accentRgb = hexToSwiftRgb(palette.accentColor);
  const textRgb = hexToSwiftRgb(palette.textColor);
  return `import WidgetKit
import SwiftUI

// Add to your Xcode Widget Extension target for com.mushaf.jamee
struct PrayerEntry: TimelineEntry {
    let date: Date
    let hijriDate: String
    let gregorianDate: String
    let location: String
    let nextPrayer: String
    let timings: [(String, String)]
}

struct PrayerProvider: TimelineProvider {
    func placeholder(in context: Context) -> PrayerEntry {
        sampleEntry(for: Date())
    }

    func getSnapshot(in context: Context, completion: @escaping (PrayerEntry) -> Void) {
        completion(sampleEntry(for: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<PrayerEntry>) -> Void) {
        let now = Date()
        let entry = sampleEntry(for: now)
        let nextRefresh = Calendar.current.date(byAdding: .minute, value: 15, to: now) ?? now.addingTimeInterval(900)
        completion(Timeline(entries: [entry], policy: .after(nextRefresh)))
    }

    private func sampleEntry(for date: Date) -> PrayerEntry {
        let hijriFormatter = DateFormatter()
        hijriFormatter.calendar = Calendar(identifier: .islamicUmmAlQura)
        hijriFormatter.locale = Locale(identifier: "ar")
        hijriFormatter.dateFormat = "EEEE d MMMM yyyy هـ"

        let gregFormatter = DateFormatter()
        gregFormatter.dateFormat = "d MMM yyyy"

        // Read synced snapshot via shared App Group UserDefaults (group.com.mushaf.jamee)
        let defaults = UserDefaults(suiteName: "group.com.mushaf.jamee")
        let city = defaults?.string(forKey: "widget_location") ?? "مكة المكرمة"

        return PrayerEntry(
            date: date,
            hijriDate: hijriFormatter.string(from: date),
            gregorianDate: gregFormatter.string(from: date),
            location: city,
            nextPrayer: defaults?.string(forKey: "widget_next_prayer") ?? "الفجر 04:45",
            timings: [
                ("الفجر", defaults?.string(forKey: "widget_fajr") ?? "04:45"),
                ("الظهر", defaults?.string(forKey: "widget_dhuhr") ?? "12:18"),
                ("العصر", defaults?.string(forKey: "widget_asr") ?? "15:44"),
                ("المغرب", defaults?.string(forKey: "widget_maghrib") ?? "18:36"),
                ("العشاء", defaults?.string(forKey: "widget_isha") ?? "20:06")
            ]
        )
    }
}

struct PrayerDateWidgetEntryView: View {
    var entry: PrayerEntry
    private let textColor = Color(${textRgb})
    private let accentColor = Color(${accentRgb})

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(entry.hijriDate)
                        .font(.headline)
                        .foregroundStyle(textColor)
                    Text("\\(entry.gregorianDate) • \\(entry.location)")
                        .font(.caption2)
                        .foregroundStyle(textColor.opacity(0.8))
                }
                Spacer()
                Text(entry.nextPrayer)
                    .font(.caption.bold())
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(accentColor.opacity(0.22))
                    .clipShape(Capsule())
                    .foregroundStyle(accentColor)
            }

            HStack(spacing: 6) {
                ForEach(entry.timings, id: \\.0) { item in
                    VStack(spacing: 2) {
                        Text(item.0).font(.caption2).foregroundStyle(textColor.opacity(0.75))
                        Text(item.1).font(.caption.bold()).foregroundStyle(textColor)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 6)
                    .background(textColor.opacity(0.10))
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                }
            }
        }
        .padding()
        .containerBackground(
            LinearGradient(
                colors: [Color(${primaryRgb}), Color(${secondaryRgb})],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            ),
            for: .widget
        )
    }
}

@main
struct PrayerDateWidget: Widget {
    let kind = "PrayerDateWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: PrayerProvider()) { entry in
            PrayerDateWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("التاريخ ومواقيت الصلاة")
        .description("يعرض التاريخ الهجري والميلادي ومواقيت الصلاة القادمة.")
        .supportedFamilies([.systemMedium, .systemLarge])
    }
}
`;
}
