import { AppLanguage } from '../i18n/translations';
import { toArabicDigits } from './arabic';

export const HIJRI_MONTHS_AR = [
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
] as const;

export const HIJRI_MONTHS_EN = [
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
] as const;

export interface HijriDateInfo {
  year: number;
  month: number; // 1..12
  day: number; // 1..30
  monthNameAr: string;
  weekdayAr: string;
  formattedDateAr: string;
  formattedFullAr: string;
  gregorianFormattedAr: string;
  monthName: string;
  weekday: string;
  formattedDate: string;
  formattedFull: string;
  gregorianFormatted: string;
}

export type OccasionCategory = 'seerah' | 'sunnah' | 'season';

export interface PropheticOccasionItem {
  id: string;
  title: string;
  hijriMonth: number;
  hijriDay: number;
  hijriDateLabel: string;
  category: OccasionCategory;
  categoryLabel: string;
  sunnahNote: string;
  daysRemaining: number;
  isToday: boolean;
}

const WEEKDAYS_AR = [
  'الأحد',
  'الإثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت',
];

const WEEKDAYS_EN = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

function extractHijriNumericParts(date: Date): {
  year: number;
  month: number;
  day: number;
} {
  try {
    const formatter = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
    });
    const parts = formatter.formatToParts(date);
    const dayVal = Number(parts.find((p) => p.type === 'day')?.value || 1);
    const monthVal = Number(parts.find((p) => p.type === 'month')?.value || 1);
    const yearRaw = parts.find((p) => p.type === 'year')?.value || '1447';
    const yearVal = Number(yearRaw.replace(/\D/g, '')) || 1447;
    return {
      year: yearVal,
      month: Math.max(1, Math.min(12, monthVal)),
      day: Math.max(1, Math.min(30, dayVal)),
    };
  } catch {
    return { year: 1447, month: 1, day: 1 };
  }
}

export function getCurrentHijriDate(
  date = new Date(),
  language: AppLanguage = 'ar'
): HijriDateInfo {
  const { year, month, day } = extractHijriNumericParts(date);
  const monthNameAr = HIJRI_MONTHS_AR[month - 1] ?? HIJRI_MONTHS_AR[0];
  const monthNameEn = HIJRI_MONTHS_EN[month - 1] ?? HIJRI_MONTHS_EN[0];
  const weekdayAr = WEEKDAYS_AR[date.getDay()] ?? '';
  const weekdayEn = WEEKDAYS_EN[date.getDay()] ?? '';

  const formattedDateAr = `${toArabicDigits(day)} ${monthNameAr} ${toArabicDigits(
    year
  )} هـ`;
  const formattedFullAr = `${weekdayAr}، ${formattedDateAr}`;

  const formattedDateEn = `${day} ${monthNameEn} ${year} AH`;
  const formattedFullEn = `${weekdayEn}, ${formattedDateEn}`;

  let gregorianFormattedAr = '';
  let gregorianFormattedEn = '';
  try {
    gregorianFormattedAr = new Intl.DateTimeFormat('ar-EG', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
    gregorianFormattedEn = new Intl.DateTimeFormat('en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  } catch {
    gregorianFormattedAr = date.toLocaleDateString('ar');
    gregorianFormattedEn = date.toLocaleDateString('en');
  }

  return {
    year,
    month,
    day,
    monthNameAr,
    weekdayAr,
    formattedDateAr,
    formattedFullAr,
    gregorianFormattedAr,
    monthName: language === 'en' ? monthNameEn : monthNameAr,
    weekday: language === 'en' ? weekdayEn : weekdayAr,
    formattedDate: language === 'en' ? formattedDateEn : formattedDateAr,
    formattedFull: language === 'en' ? formattedFullEn : formattedFullAr,
    gregorianFormatted:
      language === 'en' ? gregorianFormattedEn : gregorianFormattedAr,
  };
}

interface StaticOccasionDef {
  id: string;
  title: string;
  titleEn: string;
  hijriMonth: number;
  hijriDay: number;
  category: OccasionCategory;
  categoryLabel: string;
  categoryLabelEn: string;
  sunnahNote: string;
  sunnahNoteEn: string;
}

const ANNUAL_PROPHETIC_OCCASIONS: StaticOccasionDef[] = [
  {
    id: 'hijri_new_year',
    title: 'رأس السنة الهجرية والهجرة النبوية',
    titleEn: 'Islamic New Year & Prophetic Hijrah',
    hijriMonth: 1,
    hijriDay: 1,
    category: 'seerah',
    categoryLabel: 'حدث نبوي',
    categoryLabelEn: 'Prophetic Event',
    sunnahNote:
      'ذكرى هجرة النبي ﷺ وأبي بكر الصديق من مكة إلى المدينة وتأسيس دولة الإسلام، وفي المحرم يُستحب الإكثار من الصيام.',
    sunnahNoteEn:
      'Commemorates the migration of Prophet Muhammad ﷺ and Abu Bakr from Makkah to Madinah. Voluntary fasting is recommended in Muharram.',
  },
  {
    id: 'ashura',
    title: 'يوم عاشوراء',
    titleEn: 'Day of Ashura',
    hijriMonth: 1,
    hijriDay: 10,
    category: 'sunnah',
    categoryLabel: 'سُنة نبوية',
    categoryLabelEn: 'Prophetic Sunnah',
    sunnahNote:
      'صام النبي ﷺ يوم عاشوراء وقال: «صيام يوم عاشوراء أحتسب على الله أن يكفّر السنة التي قبله»، ويُستحب صيام التاسع معه.',
    sunnahNoteEn:
      'The Prophet ﷺ fasted Ashura and hoped Allah would expiate the sins of the preceding year; fasting the 9th with it is recommended.',
  },
  {
    id: 'mawlid',
    title: 'ذكرى مولد النبي محمد ﷺ',
    titleEn: 'Birth of Prophet Muhammad ﷺ',
    hijriMonth: 3,
    hijriDay: 12,
    category: 'seerah',
    categoryLabel: 'سيرة نبوية',
    categoryLabelEn: 'Seerah',
    sunnahNote:
      'ميلاد خاتم الأنبياء والمرسلين ﷺ في مكة المكرمة؛ مناسبة لتجديد المحبة واتباع سنته والإكثار من الصلاة عليه ﷺ.',
    sunnahNoteEn:
      'Birth of the Final Messenger ﷺ in Makkah—a reminder to follow his noble Sunnah and send abundant blessings upon him.',
  },
  {
    id: 'isra_miraj',
    title: 'ذكرى الإسراء والمعراج',
    titleEn: 'Al-Isra wal-Miraj',
    hijriMonth: 7,
    hijriDay: 27,
    category: 'seerah',
    categoryLabel: 'حدث نبوي',
    categoryLabelEn: 'Prophetic Event',
    sunnahNote:
      'أسرى الله بنبيه ﷺ من المسجد الحرام إلى المسجد الأقصى ثم عُرج به إلى السماوات العلا حيث فُرضت الصلوات الخمس.',
    sunnahNoteEn:
      'The miraculous Night Journey from Makkah to Al-Aqsa and Ascension through the heavens, where the five daily prayers were prescribed.',
  },
  {
    id: 'nisf_shaban',
    title: 'ليلة النصف من شعبان وتحويل القبلة',
    titleEn: 'Mid-Shaban & Change of Qiblah',
    hijriMonth: 8,
    hijriDay: 15,
    category: 'sunnah',
    categoryLabel: 'سُنة وسيرة',
    categoryLabelEn: 'Sunnah & Seerah',
    sunnahNote:
      'في شعبان تُرفع الأعمال إلى الله وكان النبي ﷺ يكثر الصيام فيه، وحُوّلت القبلة إلى الكعبة المشرفة.',
    sunnahNoteEn:
      'In Shaban deeds are presented to Allah, the Prophet ﷺ fasted frequently, and the Qiblah was directed toward the Sacred Kaaba.',
  },
  {
    id: 'ramadan_start',
    title: 'غرة شهر رمضان المبارك',
    titleEn: 'First Day of Ramadan',
    hijriMonth: 9,
    hijriDay: 1,
    category: 'season',
    categoryLabel: 'موسم طاعة',
    categoryLabelEn: 'Sacred Season',
    sunnahNote:
      'شهر القرآن والصيام والقيام؛ كان النبي ﷺ أجود الناس فيه وكان جبريل يدارسه القرآن كل ليلة.',
    sunnahNoteEn:
      'The blessed month of the Quran, fasting, and night prayer; the Prophet ﷺ was most generous and reviewed the Quran nightly with Jibril.',
  },
  {
    id: 'badr',
    title: 'ذكرى غزوة بدر الكبرى',
    titleEn: 'Battle of Badr',
    hijriMonth: 9,
    hijriDay: 17,
    category: 'seerah',
    categoryLabel: 'حدث نبوي',
    categoryLabelEn: 'Prophetic Event',
    sunnahNote:
      'يوم الفرقان في السنة الثانية للهجرة، حين نصر الله النبي ﷺ وصحبه وأعزّ دينه بالتوكل والدعاء.',
    sunnahNoteEn:
      'The Day of Criterion in 2 AH, when Allah granted decisive victory to the Prophet ﷺ and his Companions through sincere supplication and reliance.',
  },
  {
    id: 'fath_makkah',
    title: 'ذكرى فتح مكة المكرمة',
    titleEn: 'Conquest of Makkah',
    hijriMonth: 9,
    hijriDay: 20,
    category: 'seerah',
    categoryLabel: 'حدث نبوي',
    categoryLabelEn: 'Prophetic Event',
    sunnahNote:
      'دخل النبي ﷺ مكة فاتحاً متواضعاً مطأطئاً رأسه، وطهّر البيت الحرام وعفا عن أهلها بقوله: «اذهبوا فأنتم الطلقاء».',
    sunnahNoteEn:
      'The Prophet ﷺ entered Makkah in humility, purified the Kaaba, and showed unmatched mercy with the words: "Go, for you are free."',
  },
  {
    id: 'last_ten_ramadan',
    title: 'بدء العشر الأواخر وتحرّي ليلة القدر',
    titleEn: 'Last Ten Nights & Laylatul-Qadr',
    hijriMonth: 9,
    hijriDay: 21,
    category: 'sunnah',
    categoryLabel: 'سُنة نبوية',
    categoryLabelEn: 'Prophetic Sunnah',
    sunnahNote:
      'كان النبي ﷺ إذا دخل العشر شدّ مئزره وأحيا ليله وأيقظ أهله، وعلّمنا دعاء: «اللهم إنك عفو تحب العفو فاعف عني».',
    sunnahNoteEn:
      'The Prophet ﷺ strove earnestly in worship during these nights and taught: "O Allah, You are Pardoning and love to pardon, so pardon me."',
  },
  {
    id: 'eid_fitr',
    title: 'عيد الفطر المبارك',
    titleEn: 'Eid al-Fitr',
    hijriMonth: 10,
    hijriDay: 1,
    category: 'season',
    categoryLabel: 'شعيرة إسلامية',
    categoryLabelEn: 'Islamic Celebration',
    sunnahNote:
      'يوم الجائزة والفرح بإتمام الصيام؛ من السنة إخراج زكاة الفطر قبل الصلاة، والتكبير، والأكل وتراً قبل الخروج للمصلى.',
    sunnahNoteEn:
      'Day of gratitude upon completing Ramadan. Give Zakat al-Fitr before Eid prayer, recite Takbir, and eat odd-numbered dates beforehand.',
  },
  {
    id: 'dhul_hijjah_ten',
    title: 'أوائل ذي الحجة المباركة',
    titleEn: 'First Ten Days of Dhul-Hijjah',
    hijriMonth: 12,
    hijriDay: 1,
    category: 'sunnah',
    categoryLabel: 'موسم طاعة',
    categoryLabelEn: 'Sacred Season',
    sunnahNote:
      'قال ﷺ: «ما من أيام العمل الصالح فيها أحب إلى الله من هذه الأيام» ويُسن فيها التكبير والتهليل والتحميد والصدقة.',
    sunnahNoteEn:
      'There are no days in which righteous deeds are more beloved to Allah than these ten days—increase Takbir, Dhikr, charity, and fasting.',
  },
  {
    id: 'arafah',
    title: 'يوم عرفة وخطبة حجة الوداع',
    titleEn: 'Day of Arafah',
    hijriMonth: 12,
    hijriDay: 9,
    category: 'sunnah',
    categoryLabel: 'سُنة نبوية',
    categoryLabelEn: 'Prophetic Sunnah',
    sunnahNote:
      'قال ﷺ عن صيام عرفة: «أحتسب على الله أن يكفّر السنة التي قبله والسنة التي بعده»، وفيه خطب النبي ﷺ خطبة الوداع.',
    sunnahNoteEn:
      'Fasting Arafah expiates the sins of the previous and coming year, and it marks the historic Farewell Sermon of the Prophet ﷺ.',
  },
  {
    id: 'eid_adha',
    title: 'عيد الأضحى المبارك',
    titleEn: 'Eid al-Adha',
    hijriMonth: 12,
    hijriDay: 10,
    category: 'season',
    categoryLabel: 'شعيرة إسلامية',
    categoryLabelEn: 'Islamic Celebration',
    sunnahNote:
      'أعظم الأيام عند الله يوم النحر، يُشرع فيه صلاة العيد والأضحية والتكبير المقيد حتى غروب شمس أيام التشريق.',
    sunnahNoteEn:
      'The greatest day of the year—marked by Eid prayer, Qurbani sacrifice, charity, and Takbir throughout the Days of Tashriq.',
  },
];

function computeDaysUntilHijri(
  targetMonth: number,
  targetDay: number,
  baseDate: Date
): number {
  const startMidnight = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate()
  );
  for (let offset = 0; offset <= 366; offset++) {
    const probe = new Date(startMidnight.getTime() + offset * 86_400_000);
    const parts = extractHijriNumericParts(probe);
    if (parts.month === targetMonth && parts.day === targetDay) {
      return offset;
    }
  }
  return 365;
}

export function getUpcomingPropheticOccasions(
  baseDate = new Date(),
  limit = 6,
  language: AppLanguage = 'ar'
): PropheticOccasionItem[] {
  const current = extractHijriNumericParts(baseDate);

  const items: PropheticOccasionItem[] = ANNUAL_PROPHETIC_OCCASIONS.map((occ) => {
    const daysRemaining = computeDaysUntilHijri(
      occ.hijriMonth,
      occ.hijriDay,
      baseDate
    );
    const monthName =
      language === 'en'
        ? HIJRI_MONTHS_EN[occ.hijriMonth - 1] ?? ''
        : HIJRI_MONTHS_AR[occ.hijriMonth - 1] ?? '';

    return {
      id: occ.id,
      title: language === 'en' ? occ.titleEn : occ.title,
      hijriMonth: occ.hijriMonth,
      hijriDay: occ.hijriDay,
      hijriDateLabel:
        language === 'en'
          ? `${occ.hijriDay} ${monthName}`
          : `${toArabicDigits(occ.hijriDay)} ${monthName}`,
      category: occ.category,
      categoryLabel:
        language === 'en' ? occ.categoryLabelEn : occ.categoryLabel,
      sunnahNote: language === 'en' ? occ.sunnahNoteEn : occ.sunnahNote,
      daysRemaining,
      isToday: daysRemaining === 0,
    };
  });

  // Add upcoming Ayyam Al-Beed (13th of current or next Hijri month)
  const targetBeedMonth =
    current.day <= 15 ? current.month : (current.month % 12) + 1;
  const targetBeedDay = current.day >= 13 && current.day <= 15 ? current.day : 13;
  const beedDaysRemaining = computeDaysUntilHijri(
    targetBeedMonth,
    targetBeedDay,
    baseDate
  );
  const beedMonthName =
    language === 'en'
      ? HIJRI_MONTHS_EN[targetBeedMonth - 1] ?? ''
      : HIJRI_MONTHS_AR[targetBeedMonth - 1] ?? '';

  items.push({
    id: `ayyam_al_beed_${targetBeedMonth}`,
    title:
      language === 'en'
        ? 'Fasting the White Days (13, 14, 15)'
        : 'صيام الأيام البيض (١٣، ١٤، ١٥)',
    hijriMonth: targetBeedMonth,
    hijriDay: targetBeedDay,
    hijriDateLabel:
      language === 'en'
        ? `13–15 ${beedMonthName}`
        : `١٣ - ١٥ ${beedMonthName}`,
    category: 'sunnah',
    categoryLabel: language === 'en' ? 'Monthly Sunnah' : 'سُنة شهرية',
    sunnahNote:
      language === 'en'
        ? 'The Prophet ﷺ advised fasting the 13th, 14th, and 15th of each Hijri month, equaling the reward of fasting the entire year.'
        : 'أوصى النبي ﷺ بصيام ثلاثة أيام من كل شهر وهي الثالث عشر والرابع عشر والخامس عشر، وأجرها كصيام الدهر.',
    daysRemaining: beedDaysRemaining,
    isToday: beedDaysRemaining === 0,
  });

  return items.sort((a, b) => a.daysRemaining - b.daysRemaining).slice(0, limit);
}

export function formatDaysRemainingAr(
  days: number,
  language: AppLanguage = 'ar'
): string {
  if (language === 'en') {
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    return `In ${days} days`;
  }
  if (days === 0) return 'اليوم';
  if (days === 1) return 'غداً';
  if (days === 2) return 'بعد يومين';
  if (days >= 3 && days <= 10) return `بعد ${toArabicDigits(days)} أيام`;
  return `بعد ${toArabicDigits(days)} يوماً`;
}
