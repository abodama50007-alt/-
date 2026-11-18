import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Check,
  Code2,
  Copy,
  Download,
  Globe,
  LayoutGrid,
  Maximize2,
  PictureInPicture2,
  Smartphone,
  TabletSmartphone,
  X,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { isAdminUser } from '../firebase';
import { useLanguage } from '../i18n/LanguageContext';
import { PrayerTimingsData, SavedGeoLocation } from '../types/quran';
import {
  buildAdaptiveCardTemplate,
  buildWidgetDataJsonUrl,
  buildWidgetIframeCode,
  buildWidgetStandaloneUrl,
  buildWidgetTemplateJsonUrl,
  DEFAULT_CUSTOM_WIDGET_COLORS,
  generateAndroidAppWidgetKotlin,
  generateAndroidManifestReceiverXml,
  generateAndroidWidgetInfoXml,
  generateAndroidWidgetLayoutXml,
  generateIOSWidgetKitSwift,
  isDocumentPipSupported,
  PrayerWidgetPrefs,
  resolveWidgetPalette,
  WidgetCustomColors,
  WidgetSize,
  WidgetTheme,
} from '../utils/widget';
import { PrayerDateWidget } from './PrayerDateWidget';

interface PrayerWidgetModalProps {
  open: boolean;
  onClose: () => void;
  user?: User | null;
  timings: PrayerTimingsData | null;
  locationLabel: string;
  location?: SavedGeoLocation;
  prayerMethodId?: number;
  prefs: PrayerWidgetPrefs;
  onUpdatePrefs: (partial: Partial<PrayerWidgetPrefs>) => void;
  onLaunchFloatingWidget: () => void;
  onOpenStandaloneWidget: () => void;
  onShowToast?: (msg: string) => void;
}

type StudioTab = 'web' | 'android' | 'ios';

export const PrayerWidgetModal: React.FC<PrayerWidgetModalProps> = ({
  open,
  onClose,
  user,
  timings,
  locationLabel,
  location,
  prayerMethodId,
  prefs,
  onUpdatePrefs,
  onLaunchFloatingWidget,
  onOpenStandaloneWidget,
  onShowToast,
}) => {
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState<StudioTab>('web');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const canViewDeveloperCodes = isAdminUser(user);

  const customColors = prefs.customColors ?? DEFAULT_CUSTOM_WIDGET_COLORS;
  const pipSupported = isDocumentPipSupported();
  const directUrl = buildWidgetStandaloneUrl(prefs.theme, customColors);
  const dataJsonUrl = buildWidgetDataJsonUrl({
    lat: location?.lat,
    lng: location?.lng,
    methodId: prayerMethodId,
    language,
    cityLabel: locationLabel,
  });
  const templateJsonUrl = buildWidgetTemplateJsonUrl({
    theme: prefs.theme,
    customColors,
    language,
  });
  const customTemplateJson = JSON.stringify(
    buildAdaptiveCardTemplate({
      theme: prefs.theme,
      customColors,
      language,
    }),
    null,
    2
  );
  const iframeCode = buildWidgetIframeCode(prefs.theme, customColors);
  const androidKotlin = generateAndroidAppWidgetKotlin();
  const androidLayoutXml = generateAndroidWidgetLayoutXml(
    prefs.theme,
    customColors
  );
  const androidXml = generateAndroidWidgetInfoXml();
  const androidManifestXml = generateAndroidManifestReceiverXml();
  const iosSwift = generateIOSWidgetKitSwift(prefs.theme, customColors);

  const handleCopyText = async (
    key: string,
    text: string,
    toastText?: string
  ) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      if (toastText) onShowToast?.(toastText);
      window.setTimeout(() => {
        setCopiedKey((curr) => (curr === key ? null : curr));
      }, 2200);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleDownloadFile = (filename: string, content: string) => {
    try {
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  };

  const handleUpdateCustomColor = (
    key: keyof WidgetCustomColors,
    value: string
  ) => {
    onUpdatePrefs({
      theme: 'custom',
      customColors: {
        ...customColors,
        [key]: value.toUpperCase(),
      },
    });
  };

  const themes: Array<{
    id: WidgetTheme;
    label: string;
    primary: string;
    accent: string;
  }> = [
    {
      id: 'emerald',
      label: t('widgetStyleEmerald'),
      primary: '#14532D',
      accent: '#FCD34D',
    },
    {
      id: 'royal-gold',
      label: t('widgetStyleRoyalGold'),
      primary: '#3D2B10',
      accent: '#F6D279',
    },
    {
      id: 'calm-blue',
      label: t('widgetStyleCalmBlue'),
      primary: '#0F2E4D',
      accent: '#7DD3FC',
    },
    {
      id: 'light',
      label: t('widgetStyleLight'),
      primary: '#FBF8F1',
      accent: '#14532D',
    },
    {
      id: 'dark',
      label: t('widgetStyleDark'),
      primary: '#0F1714',
      accent: '#34D399',
    },
    {
      id: 'custom',
      label: t('widgetStyleCustom'),
      primary: resolveWidgetPalette('custom', customColors).primaryBg,
      accent: resolveWidgetPalette('custom', customColors).accentColor,
    },
  ];

  const sizes: Array<{ id: WidgetSize; label: string }> = [
    { id: 'compact', label: t('widgetSizeCompact') },
    { id: 'standard', label: t('widgetSizeStandard') },
    { id: 'wide', label: t('widgetSizeWide') },
  ];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 bg-stone-950/50 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 360, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="prayer-widget-modal-title"
            className="w-full sm:max-w-3xl max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-3xl ios-glass-card overflow-hidden"
          >
            {/* Header */}
            <div className="px-5 sm:px-6 py-4 border-b border-white/40 dark:border-white/10 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-[#14532D]/12 dark:bg-emerald-500/20 text-[#14532D] dark:text-emerald-300 flex items-center justify-center shrink-0">
                  <LayoutGrid className="w-5 h-5" />
                </div>
                <div className="min-w-0 text-start">
                  <h2
                    id="prayer-widget-modal-title"
                    className="font-amiri text-xl font-bold text-stone-900 dark:text-stone-100 truncate"
                  >
                    {t('widgetTitle')}
                  </h2>
                  <p className="text-xs text-stone-600 dark:text-stone-400 truncate">
                    {t('widgetSubtitle')}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label={t('close')}
                className="ios-spring w-9 h-9 rounded-xl ios-glass-input flex items-center justify-center text-stone-600 dark:text-stone-300 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-5">
              {/* Theme & Size Controls */}
              <div className="space-y-3">
                <div className="rounded-2xl ios-glass-input p-3.5 space-y-2.5 text-start">
                  <div className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                    {t('widgetStyleLabel')}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {themes.map((item) => {
                      const active = prefs.theme === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => onUpdatePrefs({ theme: item.id })}
                          className={`ios-spring flex items-center gap-2 py-2 px-2.5 rounded-xl text-xs font-medium border ${
                            active
                              ? 'bg-[#14532D] text-white dark:bg-emerald-700 border-[#14532D] shadow-xs'
                              : 'bg-white/65 dark:bg-stone-900/65 text-stone-700 dark:text-stone-300 border-stone-200/70 dark:border-white/10'
                          }`}
                        >
                          <span
                            className="w-4 h-4 rounded-full shrink-0 border border-black/15 flex items-center justify-center"
                            style={{ backgroundColor: item.primary }}
                          >
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: item.accent }}
                            />
                          </span>
                          <span className="truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {prefs.theme === 'custom' && (
                    <div className="pt-2.5 mt-2 border-t border-stone-200/60 dark:border-white/10 space-y-2">
                      <div className="text-[11px] font-semibold text-[#14532D] dark:text-emerald-300">
                        {t('widgetCustomColorsTitle')}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {(
                          [
                            {
                              key: 'primaryBg',
                              label: t('widgetCustomPrimaryBg'),
                              val: customColors.primaryBg,
                            },
                            {
                              key: 'secondaryBg',
                              label: t('widgetCustomSecondaryBg'),
                              val: customColors.secondaryBg,
                            },
                            {
                              key: 'accentColor',
                              label: t('widgetCustomAccent'),
                              val: customColors.accentColor,
                            },
                            {
                              key: 'textColor',
                              label: t('widgetCustomText'),
                              val: customColors.textColor,
                            },
                          ] as const
                        ).map((cp) => (
                          <label
                            key={cp.key}
                            className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-white/75 dark:bg-stone-900/75 border border-stone-200/70 dark:border-white/10 cursor-pointer"
                          >
                            <span className="text-[11px] font-medium text-stone-700 dark:text-stone-300 truncate">
                              {cp.label}
                            </span>
                            <input
                              type="color"
                              value={cp.val}
                              onChange={(e) =>
                                handleUpdateCustomColor(cp.key, e.target.value)
                              }
                              aria-label={cp.label}
                              className="w-6 h-6 rounded-md border-0 bg-transparent cursor-pointer shrink-0 p-0"
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl ios-glass-input p-3.5 space-y-2 text-start">
                  <div className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                    {t('widgetSizeLabel')}
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {sizes.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onUpdatePrefs({ size: item.id })}
                        className={`ios-spring py-2 px-2 rounded-xl text-xs font-medium ${
                          prefs.size === item.id
                            ? 'bg-[#14532D] text-white dark:bg-emerald-700 shadow-xs'
                            : 'bg-white/60 dark:bg-stone-900/60 text-stone-700 dark:text-stone-300'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Live Preview */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-stone-700 dark:text-stone-300">
                  <span>{t('widgetLivePreview')}</span>
                  {canViewDeveloperCodes && (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-[#14532D] dark:text-emerald-300 text-[11px]">
                      {t('widgetManifestStatusBadge')}
                    </span>
                  )}
                </div>
                <PrayerDateWidget
                  timings={timings}
                  locationLabel={locationLabel}
                  theme={prefs.theme}
                  customColors={customColors}
                  size={prefs.size}
                  variant="preview"
                />
              </div>

              {/* Quick Launch Actions for All Users */}
              {!canViewDeveloperCodes && (
                <div className="rounded-2xl ios-glass-input p-4 space-y-3 text-start">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={onLaunchFloatingWidget}
                      className="ios-spring flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#14532D] hover:bg-[#114224] dark:bg-emerald-700 text-white text-xs font-semibold"
                    >
                      <PictureInPicture2 className="w-4 h-4" />
                      <span>{t('widgetLaunchPip')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenStandaloneWidget();
                      }}
                      className="ios-spring flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-amber-600/15 dark:bg-amber-500/20 border border-amber-600/30 text-[#9A742E] dark:text-amber-300 text-xs font-semibold"
                    >
                      <Maximize2 className="w-4 h-4" />
                      <span>{t('widgetOpenStandalone')}</span>
                    </button>
                  </div>

                  {!pipSupported && (
                    <p className="text-[11px] text-amber-700 dark:text-amber-300">
                      {t('widgetPipUnsupported')}
                    </p>
                  )}
                </div>
              )}

              {/* Developer & Admin-Only Platform Codes / JSON Templates */}
              {canViewDeveloperCodes && (
                <>
                  {/* Platform Tabs */}
                  <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-stone-200/60 dark:bg-stone-900/60">
                    <button
                      type="button"
                      onClick={() => setActiveTab('web')}
                      className={`ios-spring flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-semibold ${
                        activeTab === 'web'
                          ? 'bg-white dark:bg-stone-800 text-[#14532D] dark:text-emerald-300 shadow-xs'
                          : 'text-stone-600 dark:text-stone-400'
                      }`}
                    >
                      <Globe className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{t('widgetTabWeb')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('android')}
                      className={`ios-spring flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-semibold ${
                        activeTab === 'android'
                          ? 'bg-white dark:bg-stone-800 text-[#14532D] dark:text-emerald-300 shadow-xs'
                          : 'text-stone-600 dark:text-stone-400'
                      }`}
                    >
                      <Smartphone className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{t('widgetTabAndroid')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('ios')}
                      className={`ios-spring flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-semibold ${
                        activeTab === 'ios'
                          ? 'bg-white dark:bg-stone-800 text-[#14532D] dark:text-emerald-300 shadow-xs'
                          : 'text-stone-600 dark:text-stone-400'
                      }`}
                    >
                      <TabletSmartphone className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{t('widgetTabIOS')}</span>
                    </button>
                  </div>

                  {/* Tab Content */}
                  {activeTab === 'web' && (
                <div className="rounded-2xl ios-glass-input p-4 sm:p-5 space-y-4 text-start">
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                      {t('widgetWebHowTitle')}
                    </h3>
                    <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                      {t('widgetWebHowDesc')}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={onLaunchFloatingWidget}
                      className="ios-spring flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#14532D] hover:bg-[#114224] dark:bg-emerald-700 text-white text-xs font-semibold"
                    >
                      <PictureInPicture2 className="w-4 h-4" />
                      <span>{t('widgetLaunchPip')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenStandaloneWidget();
                      }}
                      className="ios-spring flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-amber-600/15 dark:bg-amber-500/20 border border-amber-600/30 text-[#9A742E] dark:text-amber-300 text-xs font-semibold"
                    >
                      <Maximize2 className="w-4 h-4" />
                      <span>{t('widgetOpenStandalone')}</span>
                    </button>
                  </div>

                  {!pipSupported && (
                    <p className="text-[11px] text-amber-700 dark:text-amber-300">
                      {t('widgetPipUnsupported')}
                    </p>
                  )}

                  {/* Direct URL + Embed Snippet */}
                  <div className="space-y-2.5 pt-2 border-t border-stone-200/70 dark:border-white/10">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                        {t('widgetCopyDirectUrl')}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          void handleCopyText(
                            'url',
                            directUrl,
                            t('widgetDirectUrlCopied')
                          )
                        }
                        className="ios-spring inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/80 dark:bg-stone-900/80 border border-stone-200/80 dark:border-white/10 text-xs font-medium text-[#14532D] dark:text-emerald-300"
                      >
                        {copiedKey === 'url' ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>
                          {copiedKey === 'url'
                            ? t('widgetCopiedCode')
                            : t('widgetCopyDirectUrl')}
                        </span>
                      </button>
                    </div>
                    <code
                      dir="ltr"
                      className="block w-full p-2.5 rounded-xl bg-stone-900/90 text-emerald-300 text-[11px] overflow-x-auto select-all"
                    >
                      {directUrl}
                    </code>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span className="text-xs font-semibold text-stone-700 dark:text-stone-300 inline-flex items-center gap-1.5">
                        <Code2 className="w-3.5 h-3.5" />
                        <span>{t('widgetCopyEmbed')}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          void handleCopyText(
                            'iframe',
                            iframeCode,
                            t('widgetEmbedCopied')
                          )
                        }
                        className="ios-spring inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/80 dark:bg-stone-900/80 border border-stone-200/80 dark:border-white/10 text-xs font-medium text-[#14532D] dark:text-emerald-300"
                      >
                        {copiedKey === 'iframe' ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>
                          {copiedKey === 'iframe'
                            ? t('widgetCopiedCode')
                            : t('widgetCopyEmbed')}
                        </span>
                      </button>
                    </div>
                    <code
                      dir="ltr"
                      className="block w-full p-2.5 rounded-xl bg-stone-900/90 text-amber-200 text-[11px] overflow-x-auto select-all"
                    >
                      {iframeCode}
                    </code>

                    {/* Live JSON Data Feed URL */}
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                        {t('widgetDataJsonUrlLabel')}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          void handleCopyText(
                            'data-json',
                            dataJsonUrl,
                            t('widgetDataJsonUrlCopied')
                          )
                        }
                        className="ios-spring inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/80 dark:bg-stone-900/80 border border-stone-200/80 dark:border-white/10 text-xs font-medium text-[#14532D] dark:text-emerald-300 shrink-0"
                      >
                        {copiedKey === 'data-json' ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>
                          {copiedKey === 'data-json'
                            ? t('widgetCopiedCode')
                            : t('widgetCopyCode')}
                        </span>
                      </button>
                    </div>
                    <code
                      dir="ltr"
                      className="block w-full p-2.5 rounded-xl bg-stone-900/90 text-sky-200 text-[11px] overflow-x-auto select-all"
                    >
                      {dataJsonUrl}
                    </code>

                    {/* Adaptive Card Template URL */}
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                        {t('widgetTemplateUrlLabel')}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          void handleCopyText(
                            'template-json',
                            templateJsonUrl,
                            t('widgetTemplateUrlCopied')
                          )
                        }
                        className="ios-spring inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/80 dark:bg-stone-900/80 border border-stone-200/80 dark:border-white/10 text-xs font-medium text-[#14532D] dark:text-emerald-300 shrink-0"
                      >
                        {copiedKey === 'template-json' ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>
                          {copiedKey === 'template-json'
                            ? t('widgetCopiedCode')
                            : t('widgetCopyCode')}
                        </span>
                      </button>
                    </div>
                    <code
                      dir="ltr"
                      className="block w-full p-2.5 rounded-xl bg-stone-900/90 text-emerald-200 text-[11px] overflow-x-auto select-all"
                    >
                      {templateJsonUrl}
                    </code>

                    {/* Live Customized Adaptive Card JSON */}
                    <div className="pt-2 border-t border-stone-200/70 dark:border-white/10 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                            {t('widgetTemplatePreviewTitle')}
                          </div>
                          <div className="text-[11px] text-[#14532D] dark:text-emerald-300">
                            {t('widgetTemplateSyncedNote')}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              void handleCopyText(
                                'template-body',
                                customTemplateJson,
                                t('widgetCopiedCode')
                              )
                            }
                            className="ios-spring inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/80 dark:bg-stone-900/80 border border-stone-200/80 dark:border-white/10 text-xs font-medium text-[#14532D] dark:text-emerald-300"
                          >
                            {copiedKey === 'template-body' ? (
                              <Check className="w-3.5 h-3.5" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                            <span>
                              {copiedKey === 'template-body'
                                ? t('widgetCopiedCode')
                                : t('widgetCopyCode')}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleDownloadFile(
                                'prayer-widget-template.json',
                                customTemplateJson
                              )
                            }
                            className="ios-spring inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#14532D] text-white text-xs font-medium"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>{t('widgetDownloadTemplateBtn')}</span>
                          </button>
                        </div>
                      </div>
                      <pre
                        dir="ltr"
                        className="max-h-44 overflow-auto p-3 rounded-xl bg-stone-950 text-emerald-200 text-[11px] font-mono leading-relaxed"
                      >
                        {customTemplateJson}
                      </pre>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'android' && (
                <div className="rounded-2xl ios-glass-input p-4 sm:p-5 space-y-4 text-start">
                  <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                    {t('widgetAndroidDesc')}
                  </p>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        dir="ltr"
                        className="text-xs font-mono font-semibold text-stone-800 dark:text-stone-200"
                      >
                        PrayerDateWidgetProvider.kt
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            void handleCopyText('kt', androidKotlin)
                          }
                          className="ios-spring inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/80 dark:bg-stone-900/80 text-xs font-medium text-[#14532D] dark:text-emerald-300"
                        >
                          {copiedKey === 'kt' ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          <span>
                            {copiedKey === 'kt'
                              ? t('widgetCopiedCode')
                              : t('widgetCopyCode')}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleDownloadFile(
                              'PrayerDateWidgetProvider.kt',
                              androidKotlin
                            )
                          }
                          className="ios-spring inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#14532D] text-white text-xs font-medium"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>{t('widgetDownloadFile')}</span>
                        </button>
                      </div>
                    </div>
                    <pre
                      dir="ltr"
                      className="max-h-48 overflow-auto p-3 rounded-xl bg-stone-950 text-emerald-200 text-[11px] font-mono leading-relaxed"
                    >
                      {androidKotlin}
                    </pre>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        dir="ltr"
                        className="text-xs font-mono font-semibold text-stone-800 dark:text-stone-200"
                      >
                        res/xml/prayer_widget_info.xml
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => void handleCopyText('xml', androidXml)}
                          className="ios-spring inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/80 dark:bg-stone-900/80 text-xs font-medium text-[#14532D] dark:text-emerald-300"
                        >
                          {copiedKey === 'xml' ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          <span>
                            {copiedKey === 'xml'
                              ? t('widgetCopiedCode')
                              : t('widgetCopyCode')}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleDownloadFile(
                              'prayer_widget_info.xml',
                              androidXml
                            )
                          }
                          className="ios-spring inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#14532D] text-white text-xs font-medium"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>{t('widgetDownloadFile')}</span>
                        </button>
                      </div>
                    </div>
                    <pre
                      dir="ltr"
                      className="max-h-36 overflow-auto p-3 rounded-xl bg-stone-950 text-amber-200 text-[11px] font-mono leading-relaxed"
                    >
                      {androidXml}
                    </pre>
                  </div>

                  {/* Widget Layout XML */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-stone-800 dark:text-stone-200">
                        {t('widgetAndroidLayoutTitle')}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            void handleCopyText('layout-xml', androidLayoutXml)
                          }
                          className="ios-spring inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/80 dark:bg-stone-900/80 text-xs font-medium text-[#14532D] dark:text-emerald-300"
                        >
                          {copiedKey === 'layout-xml' ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          <span>
                            {copiedKey === 'layout-xml'
                              ? t('widgetCopiedCode')
                              : t('widgetCopyCode')}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleDownloadFile(
                              'prayer_date_widget.xml',
                              androidLayoutXml
                            )
                          }
                          className="ios-spring inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#14532D] text-white text-xs font-medium"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>{t('widgetDownloadFile')}</span>
                        </button>
                      </div>
                    </div>
                    <pre
                      dir="ltr"
                      className="max-h-40 overflow-auto p-3 rounded-xl bg-stone-950 text-sky-200 text-[11px] font-mono leading-relaxed"
                    >
                      {androidLayoutXml}
                    </pre>
                  </div>

                  {/* AndroidManifest Receiver */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-stone-800 dark:text-stone-200">
                        {t('widgetAndroidManifestTitle')}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          void handleCopyText('manifest-xml', androidManifestXml)
                        }
                        className="ios-spring inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/80 dark:bg-stone-900/80 text-xs font-medium text-[#14532D] dark:text-emerald-300 shrink-0"
                      >
                        {copiedKey === 'manifest-xml' ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>
                          {copiedKey === 'manifest-xml'
                            ? t('widgetCopiedCode')
                            : t('widgetCopyCode')}
                        </span>
                      </button>
                    </div>
                    <pre
                      dir="ltr"
                      className="max-h-32 overflow-auto p-3 rounded-xl bg-stone-950 text-emerald-200 text-[11px] font-mono leading-relaxed"
                    >
                      {androidManifestXml}
                    </pre>
                  </div>
                </div>
              )}

              {activeTab === 'ios' && (
                <div className="rounded-2xl ios-glass-input p-4 sm:p-5 space-y-4 text-start">
                  <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                    {t('widgetIOSDesc')}
                  </p>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        dir="ltr"
                        className="text-xs font-mono font-semibold text-stone-800 dark:text-stone-200"
                      >
                        PrayerDateWidget.swift
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => void handleCopyText('swift', iosSwift)}
                          className="ios-spring inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/80 dark:bg-stone-900/80 text-xs font-medium text-[#14532D] dark:text-emerald-300"
                        >
                          {copiedKey === 'swift' ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          <span>
                            {copiedKey === 'swift'
                              ? t('widgetCopiedCode')
                              : t('widgetCopyCode')}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleDownloadFile(
                              'PrayerDateWidget.swift',
                              iosSwift
                            )
                          }
                          className="ios-spring inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#14532D] text-white text-xs font-medium"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>{t('widgetDownloadFile')}</span>
                        </button>
                      </div>
                    </div>
                    <pre
                      dir="ltr"
                      className="max-h-64 overflow-auto p-3 rounded-xl bg-stone-950 text-sky-200 text-[11px] font-mono leading-relaxed"
                    >
                      {iosSwift}
                    </pre>
                  </div>
                </div>
              )}
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
