import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Headphones,
  Pause,
  Play,
  Repeat,
  SkipBack,
  SkipForward,
  Volume2,
  X,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { Reciter, RepeatMode } from '../types/quran';
import { formatTimeSeconds } from '../utils/arabic';

interface AudioPlayerBarProps {
  visible: boolean;
  isPlaying: boolean;
  isLoadingAudio: boolean;
  surahName: string;
  ayahNumberInSurah: number;
  totalAyahs: number;
  reciters: Reciter[];
  reciterId: string;
  isFullSurahMode: boolean;
  playbackSpeed: number;
  repeatMode: RepeatMode;
  currentTime: number;
  duration: number;
  onTogglePlay: () => void;
  onNextAyah: () => void;
  onPrevAyah: () => void;
  onSeek: (seconds: number) => void;
  onOpenReciterPicker: () => void;
  onCycleSpeed: () => void;
  onCycleRepeat: () => void;
  onClose: () => void;
}

export const AudioPlayerBar: React.FC<AudioPlayerBarProps> = ({
  visible,
  isPlaying,
  isLoadingAudio,
  surahName,
  ayahNumberInSurah,
  totalAyahs,
  reciters,
  reciterId,
  isFullSurahMode,
  playbackSpeed,
  repeatMode,
  currentTime,
  duration,
  onTogglePlay,
  onNextAyah,
  onPrevAyah,
  onSeek,
  onOpenReciterPicker,
  onCycleSpeed,
  onCycleRepeat,
  onClose,
}) => {
  const { isRTL, t, formatNumber, getReciterName } = useLanguage();
  const progressPct =
    duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const activeReciter = reciters.find((r) => r.id === reciterId);

  const repeatLabels: Record<RepeatMode, string> = {
    none: t('audioRepeatNone'),
    'ayah-3': t('audioRepeatAyah3'),
    'ayah-loop': t('audioRepeatAyahLoop'),
    surah: t('audioRepeatSurah'),
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          role="region"
          aria-label={t('audioRegionAria')}
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          className="fixed bottom-[76px] inset-x-3 sm:inset-x-6 lg:inset-x-auto lg:left-1/2 lg:-translate-x-1/2 lg:w-full lg:max-w-4xl z-40 ios-glass-dock rounded-[22px] overflow-hidden"
        >
          {/* Interactive seekable audio progress bar */}
          <div
            dir="ltr"
            onClick={(e) => {
              if (!duration) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = Math.max(
                0,
                Math.min(1, (e.clientX - rect.left) / rect.width)
              );
              onSeek(ratio * duration);
            }}
            title={t('audioSeekTitle')}
            className="h-1.5 w-full bg-stone-200/70 dark:bg-stone-800/70 cursor-pointer"
          >
            <div
              className="h-full bg-[#14532D] dark:bg-emerald-400 transition-[width] duration-150"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <div className="px-3.5 sm:px-5 py-2 flex items-center justify-between gap-3">
            {/* Track Info */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="hidden sm:flex w-9 h-9 rounded-xl bg-[#14532D]/12 dark:bg-emerald-500/18 text-[#14532D] dark:text-emerald-300 items-center justify-center shrink-0">
                <Volume2 className="w-4 h-4" />
              </div>
              <div className="min-w-0 text-start">
                <div className="text-sm font-semibold text-stone-900 dark:text-stone-100 truncate">
                  {isFullSurahMode
                    ? t('audioFullSurahTag', { surah: surahName })
                    : t('audioAyahTag', {
                        surah: surahName,
                        ayah: formatNumber(ayahNumberInSurah),
                      })}
                </div>
                <div className="text-xs text-stone-500 dark:text-stone-400 flex items-center gap-2 tabular-nums">
                  {!isFullSurahMode && (
                    <>
                      <span>
                        {formatNumber(ayahNumberInSurah)} /{' '}
                        {formatNumber(totalAyahs)}
                      </span>
                      <span aria-hidden="true">·</span>
                    </>
                  )}
                  <span>
                    {formatTimeSeconds(currentTime)} /{' '}
                    {formatTimeSeconds(duration)}
                  </span>
                </div>
              </div>
            </div>

            {/* Transport Controls */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                type="button"
                onClick={() =>
                  isFullSurahMode
                    ? onSeek(Math.max(0, currentTime - 10))
                    : onPrevAyah()
                }
                title={isFullSurahMode ? t('audioSeekBack') : t('audioPrevAyah')}
                aria-label={
                  isFullSurahMode ? t('audioSeekBack') : t('audioPrevAyah')
                }
                className="ios-spring w-9 h-9 inline-flex items-center justify-center rounded-xl text-stone-700 dark:text-stone-300 hover:bg-stone-900/5 dark:hover:bg-white/10"
              >
                {isRTL ? (
                  <SkipForward className="w-4 h-4" />
                ) : (
                  <SkipBack className="w-4 h-4" />
                )}
              </button>

              <button
                type="button"
                onClick={onTogglePlay}
                aria-label={isPlaying ? t('pause') : t('play')}
                className="ios-spring w-10 h-10 inline-flex items-center justify-center rounded-xl bg-[#14532D] hover:bg-[#114224] dark:bg-emerald-700 dark:hover:bg-emerald-600 text-[#FBF8F1] shadow-xs"
              >
                {isLoadingAudio ? (
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
              </button>

              <button
                type="button"
                onClick={() =>
                  isFullSurahMode
                    ? onSeek(Math.min(duration || currentTime + 10, currentTime + 10))
                    : onNextAyah()
                }
                title={
                  isFullSurahMode ? t('audioSeekForward') : t('audioNextAyah')
                }
                aria-label={
                  isFullSurahMode ? t('audioSeekForward') : t('audioNextAyah')
                }
                className="ios-spring w-9 h-9 inline-flex items-center justify-center rounded-xl text-stone-700 dark:text-stone-300 hover:bg-stone-900/5 dark:hover:bg-white/10"
              >
                {isRTL ? (
                  <SkipBack className="w-4 h-4" />
                ) : (
                  <SkipForward className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* Reciter & Modes */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onOpenReciterPicker}
                title={t('audioChooseReciterTitle')}
                className="ios-spring inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-xl ios-glass-input text-stone-800 dark:text-stone-200 max-w-[140px] sm:max-w-[175px]"
              >
                <Headphones className="w-3.5 h-3.5 text-[#14532D] dark:text-emerald-300 shrink-0" />
                <span className="truncate">
                  {getReciterName(activeReciter, t('audioChooseReciter'))}
                </span>
              </button>

              <button
                type="button"
                onClick={onCycleRepeat}
                title={t('audioRepeatTitle')}
                className={`ios-spring hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-xl border whitespace-nowrap ${
                  repeatMode !== 'none'
                    ? 'border-[#14532D]/40 bg-[#14532D]/12 text-[#14532D] dark:border-emerald-500/40 dark:bg-emerald-500/20 dark:text-emerald-300'
                    : 'ios-glass-input text-stone-600 dark:text-stone-300'
                }`}
              >
                <Repeat className="w-3.5 h-3.5" />
                <span>{repeatLabels[repeatMode]}</span>
              </button>

              <button
                type="button"
                onClick={onCycleSpeed}
                title={t('audioSpeedTitle')}
                className="ios-spring hidden sm:inline-flex items-center justify-center px-2.5 py-1.5 text-xs font-medium rounded-xl ios-glass-input text-stone-700 dark:text-stone-300 tabular-nums whitespace-nowrap"
              >
                {formatNumber(playbackSpeed)}×
              </button>

              <button
                type="button"
                onClick={onClose}
                aria-label={t('audioHidePlayer')}
                className="ios-spring w-8 h-8 inline-flex items-center justify-center rounded-xl text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-100 hover:bg-stone-900/5 dark:hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
