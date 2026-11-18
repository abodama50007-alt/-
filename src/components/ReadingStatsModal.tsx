import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  BarChart3,
  BookOpen,
  Clock,
  Flame,
  Headphones,
  Target,
  X,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DailyReadingStat, DailyStreakState, KhatmahState } from '../types/quran';
import { toArabicDigits } from '../utils/arabic';
import { getNormalizedStreakView } from '../utils/streak';

interface ReadingStatsModalProps {
  open: boolean;
  darkMode: boolean;
  statsByDate: Record<string, DailyReadingStat>;
  khatmah: KhatmahState;
  dailyStreak?: DailyStreakState;
  onClose: () => void;
  onOpenMushaf: () => void;
  onOpenKhatmah: () => void;
}

interface ChartDayPoint {
  date: string;
  shortLabel: string;
  fullLabel: string;
  pages: number;
  readingMinutes: number;
  listeningMinutes: number;
  totalMinutes: number;
  ayahsListened: number;
}

const TOTAL_MUSHAF_PAGES = 604;

export function getLocalDateKey(d = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatArabicDuration(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  if (mins < 1) {
    return `${toArabicDigits(Math.max(0, totalSeconds))} ث`;
  }
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hours === 0) {
    return `${toArabicDigits(mins)} د`;
  }
  if (remMins === 0) {
    return `${toArabicDigits(hours)} س`;
  }
  return `${toArabicDigits(hours)} س ${toArabicDigits(remMins)} د`;
}

interface CustomTooltipPayloadItem {
  name?: string;
  value?: number;
  color?: string;
  payload?: ChartDayPoint;
}

const ArabicChartTooltip: React.FC<{
  active?: boolean;
  payload?: CustomTooltipPayloadItem[];
  unit: 'pages' | 'minutes';
}> = ({ active, payload, unit }) => {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div
      dir="rtl"
      className="ios-glass-dock rounded-2xl px-3.5 py-2.5 text-xs space-y-1 shadow-lg border border-white/60 dark:border-white/15"
    >
      <div className="font-semibold text-stone-900 dark:text-stone-100">
        {point.fullLabel}
      </div>
      {unit === 'pages' ? (
        <div className="text-[#14532D] dark:text-emerald-300 tabular-nums font-medium">
          الصفحات المقروءة: {toArabicDigits(point.pages)} صفحة
        </div>
      ) : (
        <div className="space-y-0.5 tabular-nums">
          <div className="text-[#14532D] dark:text-emerald-300">
            القراءة: {toArabicDigits(point.readingMinutes)} دقيقة
          </div>
          <div className="text-[#9A742E] dark:text-amber-300">
            الاستماع للتلاوة: {toArabicDigits(point.listeningMinutes)} دقيقة
          </div>
        </div>
      )}
    </div>
  );
};

export const ReadingStatsModal: React.FC<ReadingStatsModalProps> = ({
  open,
  darkMode,
  statsByDate,
  khatmah,
  dailyStreak,
  onClose,
  onOpenMushaf,
  onOpenKhatmah,
}) => {
  const [rangeDays, setRangeDays] = useState<7 | 14>(7);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  const dailyWirdTarget = Math.max(
    1,
    Math.ceil(TOTAL_MUSHAF_PAGES / Math.max(1, khatmah.targetDays))
  );

  const todayKey = getLocalDateKey();
  const todayStat = statsByDate[todayKey];
  const todayPagesCount = todayStat?.pagesVisited.length ?? 0;

  const chartData = useMemo<ChartDayPoint[]>(() => {
    const points: ChartDayPoint[] = [];
    const weekdayFormatter = new Intl.DateTimeFormat('ar-EG', {
      weekday: 'short',
    });
    const fullDateFormatter = new Intl.DateTimeFormat('ar-EG', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });

    for (let offset = rangeDays - 1; offset >= 0; offset--) {
      const d = new Date();
      d.setHours(12, 0, 0, 0);
      d.setDate(d.getDate() - offset);
      const key = getLocalDateKey(d);
      const stat = statsByDate[key];
      const readingMin = stat
        ? Number((stat.readingSeconds / 60).toFixed(1))
        : 0;
      const listeningMin = stat
        ? Number((stat.listeningSeconds / 60).toFixed(1))
        : 0;

      points.push({
        date: key,
        shortLabel:
          offset === 0
            ? 'اليوم'
            : rangeDays === 7
            ? weekdayFormatter.format(d)
            : `${toArabicDigits(d.getDate())}/${toArabicDigits(d.getMonth() + 1)}`,
        fullLabel: fullDateFormatter.format(d),
        pages: stat?.pagesVisited.length ?? 0,
        readingMinutes: readingMin,
        listeningMinutes: listeningMin,
        totalMinutes: Number((readingMin + listeningMin).toFixed(1)),
        ayahsListened: stat?.ayahsListened ?? 0,
      });
    }
    return points;
  }, [rangeDays, statsByDate]);

  const totals = useMemo(() => {
    const allStats = Object.values(statsByDate);
    let totalReadingSec = 0;
    let totalListeningSec = 0;
    let totalAyahsListened = 0;
    let totalPageReads = 0;

    for (const s of allStats) {
      totalReadingSec += s.readingSeconds;
      totalListeningSec += s.listeningSeconds;
      totalAyahsListened += s.ayahsListened;
      totalPageReads += s.pagesVisited.length;
    }

    // Calculate consecutive active days streak ending today (or yesterday)
    let streak = 0;
    for (let offset = 0; offset < 365; offset++) {
      const d = new Date();
      d.setDate(d.getDate() - offset);
      const key = getLocalDateKey(d);
      const st = statsByDate[key];
      const hasActivity =
        st &&
        (st.pagesVisited.length > 0 ||
          st.readingSeconds >= 20 ||
          st.listeningSeconds >= 20);
      if (hasActivity) {
        streak += 1;
      } else if (offset === 0) {
        // Allow today to not break yesterday's active streak yet
        continue;
      } else {
        break;
      }
    }

    return {
      totalSeconds: totalReadingSec + totalListeningSec,
      totalReadingSec,
      totalListeningSec,
      totalAyahsListened,
      totalPageReads,
      streak,
    };
  }, [statsByDate]);

  const khatmahReadPages = Math.min(
    TOTAL_MUSHAF_PAGES,
    Math.max(1, khatmah.currentPage)
  );
  const khatmahRemainingPages = Math.max(0, TOTAL_MUSHAF_PAGES - khatmahReadPages);
  const khatmahPct = Math.min(
    100,
    Math.round((khatmahReadPages / TOTAL_MUSHAF_PAGES) * 100)
  );

  const khatmahPieData = [
    { name: 'المقروء', value: khatmahReadPages },
    { name: 'المتبقي', value: khatmahRemainingPages },
  ];

  const primaryColor = darkMode ? '#34D399' : '#14532D';
  const secondaryColor = darkMode ? '#FBBF24' : '#9A742E';
  const mutedSliceColor = darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(28,25,23,0.1)';
  const axisTickColor = darkMode ? '#A8A29E' : '#57534E';
  const gridColor = darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(28,25,23,0.08)';

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reading-stats-title"
        >
          {/* Frosted Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-stone-950/45 backdrop-blur-md"
          />

          {/* Modal Sheet */}
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="relative z-10 w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-3xl ios-glass-dock p-5 sm:p-8 space-y-6"
          >
            {/* Modal Header */}
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-stone-300/60 dark:border-white/10 pb-5">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-2xl bg-[#14532D]/12 dark:bg-emerald-500/20 border border-[#14532D]/20 dark:border-emerald-400/25 flex items-center justify-center shrink-0">
                  <BarChart3 className="w-5 h-5 text-[#14532D] dark:text-emerald-300" />
                </div>
                <div>
                  <h2
                    id="reading-stats-title"
                    className="font-amiri text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100"
                  >
                    إحصائيات القراءة والتلاوة
                  </h2>
                  <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 mt-0.5">
                    متابعة مرئية للصفحات المقروءة يومياً، وقت التلاوة والاستماع،
                    وتقدم الختمة الحالية
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* 7 / 14 Days Range Switch */}
                <div className="flex items-center p-0.5 rounded-xl ios-glass-input">
                  {([7, 14] as const).map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setRangeDays(days)}
                      className={`ios-spring px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap ${
                        rangeDays === days
                          ? 'bg-white/85 dark:bg-white/[0.14] text-[#14532D] dark:text-emerald-300 shadow-xs'
                          : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                      }`}
                    >
                      آخر {toArabicDigits(days)} أيام
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  aria-label="إغلاق نافذة الإحصائيات"
                  className="ios-spring w-9 h-9 rounded-xl ios-glass-input inline-flex items-center justify-center text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 4 Key KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="p-4 rounded-2xl ios-glass-card space-y-1.5">
                <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
                  <span>صفحات اليوم</span>
                  <BookOpen className="w-4 h-4 text-[#14532D] dark:text-emerald-400" />
                </div>
                <div className="text-2xl font-bold text-stone-900 dark:text-stone-100 tabular-nums">
                  {toArabicDigits(todayPagesCount)}{' '}
                  <span className="text-xs font-normal text-stone-500 dark:text-stone-400">
                    / {toArabicDigits(dailyWirdTarget)} هدف
                  </span>
                </div>
                <div className="text-[11px] text-[#14532D] dark:text-emerald-300 tabular-nums">
                  الإجمالي المسجل: {toArabicDigits(totals.totalPageReads)} صفحة
                </div>
              </div>

              <div className="p-4 rounded-2xl ios-glass-card space-y-1.5">
                <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
                  <span>وقت التلاوة والقراءة</span>
                  <Clock className="w-4 h-4 text-[#9A742E] dark:text-amber-400" />
                </div>
                <div className="text-2xl font-bold text-stone-900 dark:text-stone-100 tabular-nums">
                  {formatArabicDuration(totals.totalSeconds)}
                </div>
                <div className="text-[11px] text-stone-500 dark:text-stone-400 tabular-nums">
                  اليوم: {formatArabicDuration((todayStat?.readingSeconds ?? 0) + (todayStat?.listeningSeconds ?? 0))}
                </div>
              </div>

              <div className="p-4 rounded-2xl ios-glass-card space-y-1.5">
                <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
                  <span>آيات التلاوة المسموعة</span>
                  <Headphones className="w-4 h-4 text-[#14532D] dark:text-emerald-400" />
                </div>
                <div className="text-2xl font-bold text-stone-900 dark:text-stone-100 tabular-nums">
                  {toArabicDigits(totals.totalAyahsListened)}
                </div>
                <div className="text-[11px] text-stone-500 dark:text-stone-400 tabular-nums">
                  وقت الاستماع: {formatArabicDuration(totals.totalListeningSec)}
                </div>
              </div>

              <div className="p-4 rounded-2xl ios-glass-card space-y-1.5">
                <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
                  <span>سلسلة المواظبة</span>
                  <Flame className="w-4 h-4 text-[#9A742E] dark:text-amber-400" />
                </div>
                <div className="text-2xl font-bold text-stone-900 dark:text-stone-100 tabular-nums">
                  {toArabicDigits(
                    dailyStreak
                      ? Math.max(
                          totals.streak,
                          getNormalizedStreakView(dailyStreak, todayKey).effectiveStreak
                        )
                      : totals.streak
                  )}{' '}
                  يوم
                </div>
                <div className="text-[11px] text-[#9A742E] dark:text-amber-300 tabular-nums">
                  الأجزاء المكتملة: {toArabicDigits(khatmah.completedJuz.length)} / ٣٠
                </div>
              </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Chart 1: Daily Pages BarChart (2 cols) */}
              <div className="lg:col-span-2 p-5 rounded-2xl ios-glass-card space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm sm:text-base font-semibold text-stone-900 dark:text-stone-100">
                      عدد الصفحات المقروءة يومياً
                    </h3>
                    <p className="text-xs text-stone-500 dark:text-stone-400 tabular-nums">
                      الخط المتقطع يمثل وردك اليومي المستهدف ({toArabicDigits(dailyWirdTarget)} صفحة)
                    </p>
                  </div>
                </div>

                <div className="h-60 w-full" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartData}
                      margin={{ top: 10, right: 12, left: -16, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={gridColor}
                        vertical={false}
                      />
                      <XAxis
                        dataKey="shortLabel"
                        tick={{ fill: axisTickColor, fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fill: axisTickColor, fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        cursor={{
                          fill: darkMode
                            ? 'rgba(255,255,255,0.05)'
                            : 'rgba(20,83,45,0.06)',
                        }}
                        content={<ArabicChartTooltip unit="pages" />}
                      />
                      <ReferenceLine
                        y={dailyWirdTarget}
                        stroke={secondaryColor}
                        strokeDasharray="5 4"
                        strokeWidth={1.5}
                      />
                      <Bar
                        dataKey="pages"
                        fill={primaryColor}
                        radius={[8, 8, 2, 2]}
                        maxBarSize={36}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 2: Current Khatmah Donut Progress */}
              <div className="p-5 rounded-2xl ios-glass-card flex flex-col justify-between space-y-4">
                <div>
                  <h3 className="text-sm sm:text-base font-semibold text-stone-900 dark:text-stone-100">
                    التقدم في الختمة الحالية
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400 tabular-nums">
                    صفحة {toArabicDigits(khatmahReadPages)} من ٦٠٤
                  </p>
                </div>

                <div className="relative h-48 w-full" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={khatmahPieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={56}
                        outerRadius={78}
                        startAngle={90}
                        endAngle={-270}
                        stroke="none"
                        paddingAngle={2}
                      >
                        <Cell fill={primaryColor} />
                        <Cell fill={mutedSliceColor} />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Center Percentage */}
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-2xl font-bold text-[#14532D] dark:text-emerald-300 tabular-nums">
                      {toArabicDigits(khatmahPct)}٪
                    </span>
                    <span className="text-[11px] text-stone-500 dark:text-stone-400">
                      مكتمل
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-stone-600 dark:text-stone-300 pt-2 border-t border-stone-200/70 dark:border-white/10 tabular-nums">
                  <span>المتبقي: {toArabicDigits(khatmahRemainingPages)} ص</span>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenKhatmah();
                    }}
                    className="inline-flex items-center gap-1 font-semibold text-[#14532D] dark:text-emerald-300 hover:underline"
                  >
                    <Target className="w-3.5 h-3.5" />
                    <span>إدارة الختمة</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Chart 3: Reading & Recitation Listening Time AreaChart */}
            <div className="p-5 rounded-2xl ios-glass-card space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm sm:text-base font-semibold text-stone-900 dark:text-stone-100">
                    الوقت المقضي في القراءة والاستماع (بالدقائق)
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    توزيع الدقائق اليومية بين القراءة في المصحف والاستماع للتلاوة
                  </p>
                </div>

                <div className="flex items-center gap-4 text-xs">
                  <span className="inline-flex items-center gap-1.5 text-stone-700 dark:text-stone-300">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: primaryColor }}
                    />
                    القراءة
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-stone-700 dark:text-stone-300">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: secondaryColor }}
                    />
                    الاستماع
                  </span>
                </div>
              </div>

              <div className="h-56 w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={chartData}
                    margin={{ top: 10, right: 12, left: -16, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="readingGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={primaryColor} stopOpacity={0.38} />
                        <stop offset="95%" stopColor={primaryColor} stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="listeningGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={secondaryColor} stopOpacity={0.38} />
                        <stop offset="95%" stopColor={secondaryColor} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={gridColor}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="shortLabel"
                      tick={{ fill: axisTickColor, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: axisTickColor, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<ArabicChartTooltip unit="minutes" />} />
                    <Area
                      type="monotone"
                      dataKey="readingMinutes"
                      stroke={primaryColor}
                      strokeWidth={2}
                      fill="url(#readingGrad)"
                    />
                    <Area
                      type="monotone"
                      dataKey="listeningMinutes"
                      stroke={secondaryColor}
                      strokeWidth={2}
                      fill="url(#listeningGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Footer Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <span className="text-xs text-stone-500 dark:text-stone-400">
                تُحدّث الإحصائيات تلقائياً أثناء قراءتك في المصحف أو استماعك للتلاوة
              </span>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenMushaf();
                }}
                className="ios-spring inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-medium rounded-xl bg-[#14532D] hover:bg-[#114224] dark:bg-emerald-700 dark:hover:bg-emerald-600 text-[#FBF8F1] shadow-sm"
              >
                <BookOpen className="w-4 h-4" />
                <span>العودة إلى المصحف</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
