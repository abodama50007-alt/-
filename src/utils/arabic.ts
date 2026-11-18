const EASTERN_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

export function toArabicDigits(value: number | string): string {
  return String(value).replace(/\d/g, (d) => EASTERN_DIGITS[Number(d)] ?? d);
}

/**
 * Strips the prepended Bismillah from Ayah 1 of Surahs (except Al-Fatihah #1 and At-Tawbah #9),
 * since Al-Quran Cloud includes it inside ayah 1 text of quran-uthmani.
 */
export function stripLeadingBismillah(text: string, surahNumber: number, ayahNumberInSurah: number): string {
  if (surahNumber === 1 || surahNumber === 9 || ayahNumberInSurah !== 1) {
    return text;
  }

  // Match Uthmani Bismillah variations at start of verse 1
  const bismillahPrefix = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';
  if (text.startsWith(bismillahPrefix)) {
    return text.slice(bismillahPrefix.length).trimStart();
  }

  // Fallback normalized check (handling slight unicode variations)
  const cleaned = text.replace(/^بِسْمِ\s+[\u0600-\u06FF]+\s+[\u0600-\u06FF]+\s+[\u0600-\u06FF]+\s*/, '');
  if (text.includes('ٱلرَّحِيمِ') && text.indexOf('ٱلرَّحِيمِ') < 45) {
    const idx = text.indexOf('ٱلرَّحِيمِ');
    return text.slice(idx + 'ٱلرَّحِيمِ'.length).trimStart();
  }
  return cleaned;
}

export function normalizeArabicForSearch(text: string): string {
  return text
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .trim();
}

export function formatTimeSeconds(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const mins = Math.floor(sec / 60);
  const secs = Math.floor(sec % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatRevelationType(type: string): string {
  return type === 'Meccan' ? 'مكية' : 'مدنية';
}
