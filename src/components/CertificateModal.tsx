import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  Check,
  Copy,
  Download,
  ExternalLink,
  Share2,
  Sparkles,
  X,
} from 'lucide-react';
import { toArabicDigits } from '../utils/arabic';
import {
  APP_DEFAULT_SHARE_TEXT,
  APP_SHARE_URL,
  buildTelegramShareUrl,
  buildWhatsAppShareUrl,
  copyTextToClipboard,
  shareNativeOrCopy,
} from '../utils/share';

export interface CertificateData {
  recipientName: string;
  title: string;
  achievementLabel: string;
  points: number;
  winsCount?: number;
  roundsCount?: number;
  rank?: number | null;
  periodLabel?: string;
}

interface CertificateModalProps {
  isOpen: boolean;
  data: CertificateData | null;
  onClose: () => void;
  onShowToast: (msg: string) => void;
}

const CERT_NAME_STORAGE_KEY = 'quran_certificate_name_v1';

function formatDates() {
  const now = new Date();
  let hijri = '';
  let gregorian = '';
  try {
    hijri = new Intl.DateTimeFormat('ar-SA-u-ca-islamic', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(now);
  } catch {
    hijri = '';
  }
  try {
    gregorian = new Intl.DateTimeFormat('ar', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(now);
  } catch {
    gregorian = now.toISOString().slice(0, 10);
  }
  return { hijri, gregorian };
}

function drawEightPointStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  fill: string,
  stroke: string
) {
  ctx.save();
  ctx.beginPath();
  const points = 16;
  for (let i = 0; i < points; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (i * Math.PI) / 8 - Math.PI / 2;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = stroke;
  ctx.stroke();
  ctx.restore();
}

function drawCornerOrnament(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  sx: number,
  sy: number,
  color: string
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sx, sy);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 86);
  ctx.lineTo(0, 18);
  ctx.quadraticCurveTo(0, 0, 18, 0);
  ctx.lineTo(86, 0);
  ctx.stroke();

  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(14, 72);
  ctx.lineTo(14, 24);
  ctx.quadraticCurveTo(14, 14, 24, 14);
  ctx.lineTo(72, 14);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(28, 28, 5, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

async function renderCertificatePngBlob(params: {
  recipientName: string;
  title: string;
  achievementLabel: string;
  points: number;
  winsCount?: number;
  roundsCount?: number;
  rank?: number | null;
  periodLabel?: string;
  hijriDate: string;
  gregorianDate: string;
}): Promise<Blob | null> {
  const width = 1600;
  const height = 1120;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  if (document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // continue with available fonts
    }
  }

  // Warm manuscript background
  const bg = ctx.createRadialGradient(
    width / 2,
    height / 2,
    120,
    width / 2,
    height / 2,
    width * 0.72
  );
  bg.addColorStop(0, '#FFFDF8');
  bg.addColorStop(0.65, '#F9F3E5');
  bg.addColorStop(1, '#EFE4CC');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Subtle top & bottom emerald bands
  ctx.fillStyle = '#14532D';
  ctx.fillRect(48, 48, width - 96, 12);
  ctx.fillRect(48, height - 60, width - 96, 12);

  // Outer gold border
  ctx.strokeStyle = '#9A742E';
  ctx.lineWidth = 4;
  ctx.strokeRect(48, 48, width - 96, height - 96);

  // Inner fine border
  ctx.strokeStyle = 'rgba(20, 83, 45, 0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(72, 72, width - 144, height - 144);

  // Corner ornaments
  drawCornerOrnament(ctx, 84, 84, 1, 1, '#9A742E');
  drawCornerOrnament(ctx, width - 84, 84, -1, 1, '#9A742E');
  drawCornerOrnament(ctx, 84, height - 84, 1, -1, '#9A742E');
  drawCornerOrnament(ctx, width - 84, height - 84, -1, -1, '#9A742E');

  ctx.direction = 'rtl';
  ctx.textAlign = 'center';

  // Bismillah & App title
  ctx.fillStyle = '#9A742E';
  ctx.font = 'bold 30px "Amiri", "Noto Naskh Arabic", serif';
  ctx.fillText('بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ', width / 2, 165);

  ctx.fillStyle = '#14532D';
  ctx.font = 'bold 58px "Amiri", "Noto Naskh Arabic", serif';
  ctx.fillText(params.title, width / 2, 245);

  ctx.fillStyle = '#57534E';
  ctx.font = '600 26px "Noto Naskh Arabic", sans-serif';
  ctx.fillText(
    'يشهد تطبيق «المصحف الجامع» بمنح هذه الشهادة التقديرية إلى:',
    width / 2,
    318
  );

  // Gold divider
  ctx.strokeStyle = '#9A742E';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(width / 2 - 260, 355);
  ctx.lineTo(width / 2 + 260, 355);
  ctx.stroke();

  // Recipient Name
  ctx.fillStyle = '#1C1917';
  ctx.font = 'bold 72px "Amiri", "Noto Naskh Arabic", serif';
  ctx.fillText(params.recipientName || 'قارئ كتاب الله', width / 2, 455);

  // Underline for name
  ctx.strokeStyle = 'rgba(154, 116, 46, 0.45)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(width / 2 - 340, 488);
  ctx.lineTo(width / 2 + 340, 488);
  ctx.stroke();

  // Achievement Description
  ctx.fillStyle = '#292524';
  ctx.font = '600 32px "Noto Naskh Arabic", sans-serif';
  ctx.fillText(params.achievementLabel, width / 2, 565);

  if (params.periodLabel) {
    ctx.fillStyle = '#9A742E';
    ctx.font = 'bold 26px "Noto Naskh Arabic", sans-serif';
    ctx.fillText(params.periodLabel, width / 2, 618);
  }

  // Metrics Box
  const boxY = 665;
  const boxW = 1040;
  const boxH = 148;
  const boxX = (width - boxW) / 2;
  ctx.fillStyle = 'rgba(20, 83, 45, 0.06)';
  ctx.fillRect(boxX, boxY, boxW, boxH);
  ctx.strokeStyle = 'rgba(20, 83, 45, 0.25)';
  ctx.lineWidth = 2;
  ctx.strokeRect(boxX, boxY, boxW, boxH);

  const statItems: { label: string; value: string }[] = [
    { label: 'مجموع النقاط', value: `${toArabicDigits(params.points)} نقطة` },
  ];
  if (typeof params.winsCount === 'number') {
    statItems.push({
      label: 'مرات الفوز',
      value: `${toArabicDigits(params.winsCount)} فوز`,
    });
  }
  if (typeof params.roundsCount === 'number' && params.roundsCount > 0) {
    statItems.push({
      label: 'الجولات المكتملة',
      value: `${toArabicDigits(params.roundsCount)} جولة`,
    });
  }
  if (params.rank && params.rank > 0) {
    statItems.push({
      label: 'الترتيب',
      value: `المركز ${toArabicDigits(params.rank)}`,
    });
  }

  const colW = boxW / statItems.length;
  statItems.forEach((item, idx) => {
    const cx = boxX + boxW - colW * (idx + 0.5);
    ctx.fillStyle = '#57534E';
    ctx.font = '500 22px "Noto Naskh Arabic", sans-serif';
    ctx.fillText(item.label, cx, boxY + 52);

    ctx.fillStyle = '#14532D';
    ctx.font = 'bold 34px "Amiri", "Noto Naskh Arabic", serif';
    ctx.fillText(item.value, cx, boxY + 108);
  });

  // Seal on bottom center
  drawEightPointStar(
    ctx,
    width / 2,
    935,
    66,
    50,
    'rgba(154, 116, 46, 0.16)',
    '#9A742E'
  );
  ctx.fillStyle = '#14532D';
  ctx.font = 'bold 21px "Amiri", serif';
  ctx.fillText('المصحف', width / 2, 928);
  ctx.fillText('الجامع', width / 2, 956);

  // Dates & Signatures
  ctx.textAlign = 'right';
  ctx.fillStyle = '#44403C';
  ctx.font = '600 22px "Noto Naskh Arabic", sans-serif';
  if (params.hijriDate) {
    ctx.fillText(`التاريخ الهجري: ${params.hijriDate}`, width - 135, 920);
  }
  ctx.fillText(`التاريخ الميلادي: ${params.gregorianDate}`, width - 135, 960);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#14532D';
  ctx.font = 'bold 24px "Amiri", serif';
  ctx.fillText('تطبيق المصحف الجامع', 135, 920);
  ctx.fillStyle = '#57534E';
  ctx.font = '500 20px "Noto Naskh Arabic", sans-serif';
  ctx.fillText('مسابقات القرآن والسنة النبوية', 135, 960);

  return await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png', 1.0);
  });
}

export const CertificateModal: React.FC<CertificateModalProps> = ({
  isOpen,
  data,
  onClose,
  onShowToast,
}) => {
  const [customName, setCustomName] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [copiedAppLink, setCopiedAppLink] = useState(false);

  useEffect(() => {
    if (!data) return;
    let saved = '';
    try {
      saved = localStorage.getItem(CERT_NAME_STORAGE_KEY) || '';
    } catch {
      saved = '';
    }
    setCustomName(data.recipientName || saved || 'قارئ كتاب الله');
  }, [data]);

  const { hijri, gregorian } = useMemo(() => formatDates(), []);

  if (!isOpen || !data) return null;

  const finalName = customName.trim() || data.recipientName || 'قارئ كتاب الله';

  const handleNameChange = (val: string) => {
    setCustomName(val);
    try {
      localStorage.setItem(CERT_NAME_STORAGE_KEY, val);
    } catch {
      // ignore
    }
  };

  const handleDownloadPng = async () => {
    setDownloading(true);
    try {
      const blob = await renderCertificatePngBlob({
        recipientName: finalName,
        title: data.title,
        achievementLabel: data.achievementLabel,
        points: data.points,
        winsCount: data.winsCount,
        roundsCount: data.roundsCount,
        rank: data.rank,
        periodLabel: data.periodLabel,
        hijriDate: hijri,
        gregorianDate: gregorian,
      });
      if (!blob) {
        onShowToast('تعذر تجهيز ملف الشهادة للتحميل');
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `شهادة_${finalName.replace(/\s+/g, '_')}_المصحف_الجامع.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onShowToast('تم تحميل الشهادة التقديرية بصيغة PNG بنجاح');
    } catch {
      onShowToast('تعذر تحميل الشهادة، حاول مجدداً');
    } finally {
      setDownloading(false);
    }
  };

  const shareMessage = `حصلت على «${data.title}» برصيد ${toArabicDigits(
    data.points
  )} نقطة في مسابقات حفظ القرآن والسنة النبوية بتطبيق «المصحف الجامع»! انضم إلينا ونافس أصدقاءك الآن:\n${APP_SHARE_URL}`;

  const handleShareCertificate = async () => {
    const res = await shareNativeOrCopy({
      title: `${data.title} — المصحف الجامع`,
      text: shareMessage,
      url: APP_SHARE_URL,
    });
    if (res === 'copied') {
      onShowToast('تم نسخ نص الشهادة ورابط التطبيق للمشاركة');
    } else if (res === 'failed') {
      onShowToast('تعذر فتح المشاركة التلقائية');
    }
  };

  const handleCopyAppUrl = async () => {
    const ok = await copyTextToClipboard(`${APP_DEFAULT_SHARE_TEXT}\n${APP_SHARE_URL}`);
    if (ok) {
      setCopiedAppLink(true);
      onShowToast('تم نسخ رابط مشاركة التطبيق');
      window.setTimeout(() => setCopiedAppLink(false), 2000);
    } else {
      onShowToast(APP_SHARE_URL);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="الشهادة الافتراضية"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm overflow-y-auto"
    >
      <div className="w-full max-w-3xl rounded-3xl ios-glass-dock p-5 sm:p-7 space-y-5 my-auto shadow-2xl border border-[#9A742E]/35">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#9A742E]/15 text-[#9A742E] dark:text-amber-300 flex items-center justify-center shrink-0">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-amiri text-xl sm:text-2xl font-bold text-stone-900 dark:text-stone-100">
                الشهادة التقديرية الافتراضية
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                يمكنك تعديل الاسم وتحميل الشهادة كصورة عالية الدقة أو مشاركتها
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق الشهادة"
            className="ios-spring w-9 h-9 rounded-xl ios-glass-input flex items-center justify-center text-stone-600 dark:text-stone-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Name customizer */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
          <label
            htmlFor="cert-recipient-name"
            className="text-xs font-medium text-stone-700 dark:text-stone-300 whitespace-nowrap"
          >
            الاسم على الشهادة:
          </label>
          <input
            id="cert-recipient-name"
            type="text"
            maxLength={60}
            value={customName}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="اكتب اسمك كما تحب أن يظهر في الشهادة"
            className="flex-1 px-3.5 py-2 text-sm rounded-xl ios-glass-input text-stone-900 dark:text-stone-100"
          />
        </div>

        {/* Ornate Manuscript Preview Card */}
        <div className="relative rounded-2xl bg-gradient-to-br from-[#FFFDF7] via-[#F9F2E2] to-[#EFE2C6] text-[#1C1917] p-6 sm:p-9 border-2 border-[#9A742E] shadow-inner overflow-hidden text-center space-y-5">
          <div className="absolute inset-2.5 rounded-xl border border-[#14532D]/25 pointer-events-none" />

          <div className="relative z-10 space-y-3">
            <div className="font-amiri text-sm sm:text-base font-bold text-[#9A742E]">
              بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
            </div>
            <h3 className="font-amiri text-2xl sm:text-4xl font-bold text-[#14532D]">
              {data.title}
            </h3>
            <p className="text-xs sm:text-sm text-stone-600">
              يشهد تطبيق «المصحف الجامع» بمنح هذه الشهادة التقديرية إلى:
            </p>
            <div className="font-amiri text-3xl sm:text-4xl font-bold text-[#1C1917] pt-1 pb-2 border-b border-[#9A742E]/40 max-w-md mx-auto">
              {finalName}
            </div>
            <p className="text-sm sm:text-base font-medium text-stone-800 max-w-xl mx-auto leading-relaxed">
              {data.achievementLabel}
            </p>
            {data.periodLabel && (
              <div className="text-xs font-bold text-[#9A742E]">{data.periodLabel}</div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 max-w-xl mx-auto">
              <div className="rounded-xl bg-[#14532D]/8 border border-[#14532D]/20 px-3 py-2">
                <div className="text-[11px] text-stone-600">النقاط</div>
                <div className="text-base font-bold text-[#14532D] tabular-nums">
                  {toArabicDigits(data.points)} نقطة
                </div>
              </div>
              {typeof data.winsCount === 'number' && (
                <div className="rounded-xl bg-[#14532D]/8 border border-[#14532D]/20 px-3 py-2">
                  <div className="text-[11px] text-stone-600">مرات الفوز</div>
                  <div className="text-base font-bold text-[#14532D] tabular-nums">
                    {toArabicDigits(data.winsCount)} فوز
                  </div>
                </div>
              )}
              {typeof data.roundsCount === 'number' && data.roundsCount > 0 && (
                <div className="rounded-xl bg-[#14532D]/8 border border-[#14532D]/20 px-3 py-2">
                  <div className="text-[11px] text-stone-600">الجولات</div>
                  <div className="text-base font-bold text-[#14532D] tabular-nums">
                    {toArabicDigits(data.roundsCount)} جولة
                  </div>
                </div>
              )}
              {data.rank && data.rank > 0 ? (
                <div className="rounded-xl bg-[#9A742E]/12 border border-[#9A742E]/30 px-3 py-2">
                  <div className="text-[11px] text-stone-600">الترتيب</div>
                  <div className="text-base font-bold text-[#9A742E] tabular-nums">
                    المركز {toArabicDigits(data.rank)}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl bg-[#9A742E]/12 border border-[#9A742E]/30 px-3 py-2">
                  <div className="text-[11px] text-stone-600">التوثيق</div>
                  <div className="text-sm font-bold text-[#9A742E] inline-flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>معتمد</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 text-[11px] text-stone-600 border-t border-[#9A742E]/25">
              <span>
                {hijri ? `${hijri} · ` : ''}
                {gregorian}
              </span>
              <span className="font-amiri text-sm font-bold text-[#14532D]">
                خاتم تطبيق المصحف الجامع
              </span>
            </div>
          </div>
        </div>

        {/* Download & Share Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={downloading}
              onClick={() => void handleDownloadPng()}
              className="ios-spring inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#14532D] hover:bg-[#114224] dark:bg-emerald-700 dark:hover:bg-emerald-600 text-[#FBF8F1] text-sm font-semibold whitespace-nowrap shrink-0 disabled:opacity-60"
            >
              <Download className="w-4 h-4" />
              <span>{downloading ? 'جاري التجهيز...' : 'تحميل الشهادة (PNG)'}</span>
            </button>

            <button
              type="button"
              onClick={() => void handleShareCertificate()}
              className="ios-spring inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#9A742E] hover:bg-[#826023] text-white text-sm font-medium whitespace-nowrap shrink-0"
            >
              <Share2 className="w-4 h-4" />
              <span>مشاركة الشهادة والتطبيق</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleCopyAppUrl()}
              className="ios-spring inline-flex items-center gap-1.5 px-3 py-2 rounded-xl ios-glass-input text-xs font-medium text-stone-800 dark:text-stone-200 whitespace-nowrap shrink-0"
            >
              {copiedAppLink ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>نسخ رابط التطبيق</span>
            </button>

            <a
              href={buildWhatsAppShareUrl(shareMessage)}
              target="_blank"
              rel="noopener noreferrer"
              className="ios-spring inline-flex items-center gap-1.5 px-3 py-2 rounded-xl ios-glass-input text-xs font-medium text-[#14532D] dark:text-emerald-300 whitespace-nowrap shrink-0"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>واتساب</span>
            </a>

            <a
              href={buildTelegramShareUrl(APP_SHARE_URL, shareMessage)}
              target="_blank"
              rel="noopener noreferrer"
              className="ios-spring inline-flex items-center gap-1.5 px-3 py-2 rounded-xl ios-glass-input text-xs font-medium text-[#14532D] dark:text-emerald-300 whitespace-nowrap shrink-0"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>تيليجرام</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
export default CertificateModal;
