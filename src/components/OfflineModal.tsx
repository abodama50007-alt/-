import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  CheckCircle2,
  CloudDownload,
  HardDrive,
  Trash2,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { TAFSIR_OPTIONS } from '../data/quranMeta';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useLanguage } from '../i18n/LanguageContext';
import {
  clearOfflineQuranData,
  downloadFullQuranOffline,
  DownloadProgress,
  getOfflineStats,
  OfflinePackStats,
} from '../services/offlineDb';
import { fetchAllReciters, fetchAllSurahs } from '../services/quranApi';
import { TafsirEditionId } from '../types/quran';
import { PWAInstallButton } from './PWAInstallButton';

interface OfflineModalProps {
  open: boolean;
  activeTafsir: TafsirEditionId;
  onClose: () => void;
  onStatsUpdated: (stats: OfflinePackStats) => void;
}

export const OfflineModal: React.FC<OfflineModalProps> = ({
  open,
  activeTafsir,
  onClose,
  onStatsUpdated,
}) => {
  const isOnline = useOnlineStatus();
  const { isRTL, t, formatNumber } = useLanguage();
  const [selectedTafsir, setSelectedTafsir] =
    useState<TafsirEditionId>(activeTafsir);
  const [stats, setStats] = useState<OfflinePackStats>({
    surahsCount: 0,
    pagesCount: 0,
    cachedTafsirs: [],
    hasFullQuran: false,
  });
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setSelectedTafsir(activeTafsir);
    setErrorMsg(null);
  }, [activeTafsir]);

  useEffect(() => {
    if (!open) return;
    setErrorMsg(null);
    getOfflineStats().then((s) => {
      setStats(s);
      onStatsUpdated(s);
    });
  }, [open, onStatsUpdated]);

  const handleDownloadPack = async () => {
    if (!isOnline) {
      setErrorMsg(t('offlineNeedInternetErr'));
      return;
    }
    setDownloading(true);
    setErrorMsg(null);
    setProgress({
      stage: 'quran',
      percent: 8,
      label: t('offlineStartLabel'),
    });

    try {
      await Promise.all([fetchAllSurahs(), fetchAllReciters()]);
      const nextStats = await downloadFullQuranOffline(selectedTafsir, (p) =>
        setProgress(p)
      );
      setStats(nextStats);
      onStatsUpdated(nextStats);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : t('offlineDownloadFailedErr')
      );
    } finally {
      setDownloading(false);
    }
  };

  const handleClearCache = async () => {
    await clearOfflineQuranData();
    const empty: OfflinePackStats = {
      surahsCount: 0,
      pagesCount: 0,
      cachedTafsirs: [],
      hasFullQuran: false,
    };
    setStats(empty);
    setProgress(null);
    onStatsUpdated(empty);
  };

  const isSelectedTafsirReady =
    stats.hasFullQuran && stats.cachedTafsirs.includes(selectedTafsir);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="offline-modal-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/55 backdrop-blur-md"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl rounded-3xl ios-glass-card p-6 sm:p-7 shadow-2xl border border-white/50 dark:border-white/15 space-y-5"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 text-start">
                <div className="w-11 h-11 rounded-2xl bg-[#14532D]/12 dark:bg-emerald-500/20 text-[#14532D] dark:text-emerald-300 flex items-center justify-center shrink-0">
                  <HardDrive className="w-5 h-5" />
                </div>
                <div>
                  <h2
                    id="offline-modal-title"
                    className="font-amiri text-2xl font-bold text-stone-900 dark:text-stone-100"
                  >
                    {t('offlineModalTitle')}
                  </h2>
                  <div className="flex items-center gap-1.5 text-xs mt-0.5">
                    {isOnline ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300 font-medium">
                        <Wifi className="w-3.5 h-3.5" />{' '}
                        {t('offlineStatusOnline')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300 font-medium">
                        <WifiOff className="w-3.5 h-3.5" />{' '}
                        {t('offlineStatusOffline')}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label={t('close')}
                className="ios-spring w-9 h-9 rounded-xl ios-glass-input flex items-center justify-center text-stone-600 dark:text-stone-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Stats Strip */}
            <div className="grid grid-cols-2 gap-3 text-start">
              <div className="rounded-2xl ios-glass-input p-3.5">
                <div className="text-xs text-stone-500 dark:text-stone-400">
                  {t('offlineSavedSurahs')}
                </div>
                <div className="text-xl font-bold text-[#14532D] dark:text-emerald-300 tabular-nums mt-0.5">
                  {formatNumber(stats.surahsCount)} / {formatNumber(114)}{' '}
                  {t('surah')}
                </div>
              </div>
              <div className="rounded-2xl ios-glass-input p-3.5">
                <div className="text-xs text-stone-500 dark:text-stone-400">
                  {t('offlineSavedPages')}
                </div>
                <div className="text-xl font-bold text-[#14532D] dark:text-emerald-300 tabular-nums mt-0.5">
                  {formatNumber(stats.pagesCount)} / {formatNumber(604)}{' '}
                  {t('page')}
                </div>
              </div>
            </div>

            {/* Tafsir Pack Selection & Download CTA */}
            <div className="rounded-2xl ios-glass-input p-4 space-y-3.5 text-start">
              <div className="space-y-1">
                <label
                  htmlFor="offline-tafsir-select"
                  className="text-xs font-semibold text-stone-800 dark:text-stone-200 block"
                >
                  {t('offlineSelectTafsirLabel')}
                </label>
                <select
                  id="offline-tafsir-select"
                  value={selectedTafsir}
                  disabled={downloading}
                  onChange={(e) =>
                    setSelectedTafsir(e.target.value as TafsirEditionId)
                  }
                  className="w-full rounded-xl px-3 py-2 text-xs sm:text-sm bg-white/80 dark:bg-stone-900/70 border border-stone-300/60 dark:border-stone-700 text-stone-900 dark:text-stone-100"
                >
                  {TAFSIR_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.name} — {opt.author}
                      {stats.cachedTafsirs.includes(opt.id) &&
                      stats.hasFullQuran
                        ? ` ${t('offlineSavedTag')}`
                        : ''}
                    </option>
                  ))}
                </select>
              </div>

              {progress && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-stone-700 dark:text-stone-300">
                    <span>{progress.label}</span>
                    <span className="tabular-nums font-semibold">
                      {formatNumber(progress.percent)}
                      {isRTL ? '٪' : '%'}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-stone-200 dark:bg-stone-800 overflow-hidden">
                    <div
                      className="h-full bg-[#14532D] dark:bg-emerald-500 transition-[width] duration-300"
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                </div>
              )}

              {errorMsg && (
                <p className="text-xs text-rose-600 dark:text-rose-400">
                  {errorMsg}
                </p>
              )}

              {isSelectedTafsirReady ? (
                <div className="flex items-center justify-between gap-2 rounded-xl bg-emerald-900/10 dark:bg-emerald-500/20 px-3.5 py-2.5 text-xs font-semibold text-[#14532D] dark:text-emerald-300">
                  <span className="inline-flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    {t('offlineReadyBanner')}
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={downloading}
                  onClick={() => void handleDownloadPack()}
                  className="ios-spring w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#14532D] hover:bg-[#114224] dark:bg-emerald-700 dark:hover:bg-emerald-600 text-[#FBF8F1] text-sm font-semibold disabled:opacity-60"
                >
                  <CloudDownload className="w-4 h-4" />
                  <span>
                    {downloading
                      ? t('offlineDownloadingBtn')
                      : t('offlineDownloadFullBtn')}
                  </span>
                </button>
              )}
            </div>

            {/* Always-offline built-in features list */}
            <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed text-start">
              {t('offlineBuiltInNote')}
            </p>

            {/* Footer: Install App CTA + Clear Cache */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-stone-200/60 dark:border-white/10">
              <PWAInstallButton />

              {(stats.surahsCount > 0 || stats.pagesCount > 0) && (
                <button
                  type="button"
                  disabled={downloading}
                  onClick={() => void handleClearCache()}
                  className="ios-spring inline-flex items-center gap-1.5 px-3 py-2 rounded-xl ios-glass-input text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{t('offlineClearBtn')}</span>
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
