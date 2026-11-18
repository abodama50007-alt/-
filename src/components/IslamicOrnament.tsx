import React from 'react';
import { toArabicDigits } from '../utils/arabic';

interface SurahHeaderBannerProps {
  surahName: string;
  surahNumber: number;
  revelationType: string;
  ayahCount: number;
  juzNumber?: number;
}

export const SurahHeaderBanner: React.FC<SurahHeaderBannerProps> = ({
  surahName,
  surahNumber,
  revelationType,
  ayahCount,
  juzNumber,
}) => {
  const revLabel = revelationType === 'Meccan' ? 'مكية' : 'مدنية';

  return (
    <div className="relative py-6 px-4 sm:px-8 ios-glass-card rounded-2xl text-center overflow-hidden">
      {/* Subtle geometric corner accents */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute top-2 right-2 w-8 h-8 text-[#9A742E]/40 dark:text-amber-500/30"
        viewBox="0 0 32 32"
        fill="none"
      >
        <path d="M30 2H14C7.373 2 2 7.373 2 14V30" stroke="currentColor" strokeWidth="1.25" />
        <path d="M26 6H15C10.029 6 6 10.029 6 15V26" stroke="currentColor" strokeWidth="0.9" />
      </svg>
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute top-2 left-2 w-8 h-8 text-[#9A742E]/40 dark:text-amber-500/30 -scale-x-100"
        viewBox="0 0 32 32"
        fill="none"
      >
        <path d="M30 2H14C7.373 2 2 7.373 2 14V30" stroke="currentColor" strokeWidth="1.25" />
        <path d="M26 6H15C10.029 6 6 10.029 6 15V26" stroke="currentColor" strokeWidth="0.9" />
      </svg>
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute bottom-2 right-2 w-8 h-8 text-[#9A742E]/40 dark:text-amber-500/30 -scale-y-100"
        viewBox="0 0 32 32"
        fill="none"
      >
        <path d="M30 2H14C7.373 2 2 7.373 2 14V30" stroke="currentColor" strokeWidth="1.25" />
        <path d="M26 6H15C10.029 6 6 10.029 6 15V26" stroke="currentColor" strokeWidth="0.9" />
      </svg>
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute bottom-2 left-2 w-8 h-8 text-[#9A742E]/40 dark:text-amber-500/30 scale-x-[-1] scale-y-[-1]"
        viewBox="0 0 32 32"
        fill="none"
      >
        <path d="M30 2H14C7.373 2 2 7.373 2 14V30" stroke="currentColor" strokeWidth="1.25" />
        <path d="M26 6H15C10.029 6 6 10.029 6 15V26" stroke="currentColor" strokeWidth="0.9" />
      </svg>

      <div className="flex items-center justify-center gap-3 text-xs text-stone-600 dark:text-stone-400 mb-1.5 tabular-nums">
        <span>السورة {toArabicDigits(surahNumber)}</span>
        <span aria-hidden="true">·</span>
        <span>{revLabel}</span>
        <span aria-hidden="true">·</span>
        <span>{toArabicDigits(ayahCount)} آية</span>
        {juzNumber ? (
          <>
            <span aria-hidden="true">·</span>
            <span>الجزء {toArabicDigits(juzNumber)}</span>
          </>
        ) : null}
      </div>

      <h1 className="font-amiri text-3xl sm:text-4xl font-bold text-[#1C1917] dark:text-[#F2EFE8]">
        {surahName}
      </h1>
    </div>
  );
};

export const AyahEndRosette: React.FC<{ numberInSurah: number; active?: boolean }> = ({
  numberInSurah,
  active = false,
}) => {
  return (
    <span
      className={`inline-flex items-center justify-center mx-1.5 align-middle select-none font-quran text-[0.72em] transition-colors ${
        active
          ? 'text-[#14532D] dark:text-emerald-300 font-bold'
          : 'text-[#9A742E] dark:text-amber-400/90'
      }`}
      aria-label={`الآية ${toArabicDigits(numberInSurah)}`}
    >
      ﴿{toArabicDigits(numberInSurah)}﴾
    </span>
  );
};

export const MushafPageSurahStrip: React.FC<{
  surahName: string;
  revelationType?: string;
  ayahCount?: number;
}> = ({ surahName, revelationType, ayahCount }) => {
  const revLabel =
    revelationType === 'Meccan'
      ? 'مكية'
      : revelationType === 'Medinan'
      ? 'مدنية'
      : '';

  return (
    <div className="my-4 first:mt-1 relative py-2.5 px-6 rounded-xl border border-[#C6B288] dark:border-[#3A4D43] bg-gradient-to-b from-[#F3E9D2]/90 via-[#EFE2C6]/75 to-[#F3E9D2]/90 dark:from-[#1B2520] dark:via-[#161F1A] dark:to-[#1B2520] text-center shadow-xs overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-1 rounded-lg border border-[#9A742E]/30 dark:border-amber-400/20"
      />
      <div className="relative z-10 flex items-center justify-between gap-3">
        <span className="text-[11px] font-medium text-[#7A5C23] dark:text-amber-300/80 min-w-[48px] text-right">
          {revLabel}
        </span>
        <h2 className="font-amiri text-xl sm:text-2xl font-bold text-[#1C1917] dark:text-[#F2EFE8]">
          {surahName}
        </h2>
        <span className="text-[11px] font-medium text-[#7A5C23] dark:text-amber-300/80 tabular-nums min-w-[48px] text-left">
          {ayahCount ? `${toArabicDigits(ayahCount)} آية` : ''}
        </span>
      </div>
    </div>
  );
};
