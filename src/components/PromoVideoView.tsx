import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Download,
  Film,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { isAdminUser } from '../firebase';
import { toArabicDigits } from '../utils/arabic';

interface PromoVideoViewProps {
  user?: User | null;
  onShowToast: (msg: string) => void;
}

type AspectPreset = '9:16' | '16:9';
type VisualThemeId = 'emerald_gold' | 'night_emerald' | 'parchment_classic';

interface ThemePalette {
  id: VisualThemeId;
  label: string;
  bgStart: string;
  bgEnd: string;
  accent: string;
  gold: string;
  textPrimary: string;
  textMuted: string;
  cardBg: string;
  cardBorder: string;
}

const THEMES: Record<VisualThemeId, ThemePalette> = {
  emerald_gold: {
    id: 'emerald_gold',
    label: 'زمردي وذهبي (ملكي)',
    bgStart: '#0B3520',
    bgEnd: '#04170E',
    accent: '#10B981',
    gold: '#E3B95F',
    textPrimary: '#FBF8F1',
    textMuted: '#D6DFD8',
    cardBg: 'rgba(255, 255, 255, 0.08)',
    cardBorder: 'rgba(227, 185, 95, 0.35)',
  },
  night_emerald: {
    id: 'night_emerald',
    label: 'ليلي عميق (حديث)',
    bgStart: '#0A0F14',
    bgEnd: '#111E19',
    accent: '#34D399',
    gold: '#F59E0B',
    textPrimary: '#F5F5F4',
    textMuted: '#A8B3AF',
    cardBg: 'rgba(16, 185, 129, 0.09)',
    cardBorder: 'rgba(52, 211, 153, 0.32)',
  },
  parchment_classic: {
    id: 'parchment_classic',
    label: 'رقعة مخطوطة دافئة',
    bgStart: '#FBF6EA',
    bgEnd: '#EDE2CB',
    accent: '#14532D',
    gold: '#9A742E',
    textPrimary: '#1C1917',
    textMuted: '#57534E',
    cardBg: 'rgba(20, 83, 45, 0.07)',
    cardBorder: 'rgba(154, 116, 46, 0.35)',
  },
};

const FEATURE_POOL = [
  'المصحف الشريف بالرسم العثماني والتفسير الميسر',
  'قصص الـ ٢٥ نبياً كاملة برسومات وسرد صوتي',
  'مواقيت الصلاة والأذان واتجاه القبلة الشريفة',
  'مسابقات حفظ القرآن والسنة والاتصال مع صديق',
  'أكثر من ١٧٠ قارئاً والعمل الكامل بدون إنترنت',
  'حصن المسلم وأذكار اليوم والليلة والسبحة',
];

const DURATION_SECONDS = 14;

function easeOutCubic(x: number): number {
  return 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapArabicText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (ctx.measureText(candidate).width <= maxWidth) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawIslamicRosette(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  rotation: number,
  color: string,
  alpha: number
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;

  // Nested rotated squares forming 8-point Islamic star
  const layers = 3;
  for (let l = 0; l < layers; l++) {
    const size = radius * (1 - l * 0.22);
    for (let s = 0; s < 2; s++) {
      ctx.save();
      ctx.rotate((s * Math.PI) / 4 + (l * Math.PI) / 16);
      ctx.strokeRect(-size / Math.SQRT2, -size / Math.SQRT2, size * Math.SQRT2, size * Math.SQRT2);
      ctx.restore();
    }
  }
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.38, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export const PromoVideoView: React.FC<PromoVideoViewProps> = ({
  user,
  onShowToast,
}) => {
  if (!isAdminUser(user)) {
    return null;
  }
  return <PromoVideoStudio onShowToast={onShowToast} />;
};

const PromoVideoStudio: React.FC<{ onShowToast: (msg: string) => void }> = ({
  onShowToast,
}) => {
  const [aspect, setAspect] = useState<AspectPreset>('9:16');
  const [themeId, setThemeId] = useState<VisualThemeId>('emerald_gold');
  const [headline, setHeadline] = useState('المصحف الجامع');
  const [subtitle, setSubtitle] = useState(
    'رفيقك المتكامل للقرآن الكريم، قصص الأنبياء، ومجالس الحفظ والمنافسة'
  );
  const [ctaText, setCtaText] = useState('متاح مجاناً الآن — ابدأ وردك اليومي');
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>(FEATURE_POOL.slice(0, 4));
  const [includeAmbientAudio, setIncludeAmbientAudio] = useState(true);

  const [isPlaying, setIsPlaying] = useState(true);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportedVideoUrl, setExportedVideoUrl] = useState<string | null>(null);
  const [exportedMimeExt, setExportedMimeExt] = useState<'webm' | 'mp4'>('webm');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const elapsedRef = useRef<number>(0);

  const dimensions = useMemo(
    () => (aspect === '9:16' ? { width: 720, height: 1280 } : { width: 1280, height: 720 }),
    [aspect]
  );

  // Clean up object URL on unmount or re-export
  useEffect(() => {
    return () => {
      if (exportedVideoUrl) {
        URL.revokeObjectURL(exportedVideoUrl);
      }
    };
  }, [exportedVideoUrl]);

  const drawFrameAt = useCallback(
    (ctx: CanvasRenderingContext2D, t: number) => {
      const { width, height } = dimensions;
      const palette = THEMES[themeId];
      const isVertical = aspect === '9:16';

      // 1. Background gradient
      const bgGrad = ctx.createLinearGradient(0, 0, width, height);
      bgGrad.addColorStop(0, palette.bgStart);
      bgGrad.addColorStop(1, palette.bgEnd);
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Soft ambient glow orbs
      ctx.save();
      const glowGrad = ctx.createRadialGradient(
        width * 0.5,
        height * 0.32,
        20,
        width * 0.5,
        height * 0.32,
        Math.max(width, height) * 0.55
      );
      glowGrad.addColorStop(0, `${palette.accent}33`);
      glowGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = glowGrad;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();

      // Rotating geometric ornaments in corners
      drawIslamicRosette(
        ctx,
        width * 0.14,
        height * 0.12,
        isVertical ? 110 : 120,
        t * 0.12,
        palette.gold,
        0.22
      );
      drawIslamicRosette(
        ctx,
        width * 0.86,
        height * 0.88,
        isVertical ? 120 : 135,
        -t * 0.1,
        palette.gold,
        0.2
      );

      // Decorative double frame border
      ctx.save();
      ctx.strokeStyle = palette.gold;
      ctx.globalAlpha = 0.28;
      ctx.lineWidth = 2;
      drawRoundedRect(ctx, 22, 22, width - 44, height - 44, 28);
      ctx.stroke();
      ctx.globalAlpha = 0.14;
      drawRoundedRect(ctx, 34, 34, width - 68, height - 68, 22);
      ctx.stroke();
      ctx.restore();

      ctx.direction = 'rtl';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // ==================== SCENE 1 (0s -> 3.6s): BRAND INTRO ====================
      if (t < 3.6) {
        const p = easeOutCubic(clamp01(t / 1.1));
        const fadeOut = t > 3.0 ? clamp01(1 - (t - 3.0) / 0.6) : 1;
        ctx.save();
        ctx.globalAlpha = p * fadeOut;

        drawIslamicRosette(
          ctx,
          width / 2,
          height * (isVertical ? 0.34 : 0.34),
          (isVertical ? 130 : 115) * (0.8 + 0.2 * p),
          t * 0.22,
          palette.gold,
          0.5 * fadeOut
        );

        ctx.fillStyle = palette.gold;
        ctx.font = `600 ${isVertical ? 28 : 24}px "Noto Naskh Arabic", Tahoma, sans-serif`;
        ctx.fillText(
          'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
          width / 2,
          height * (isVertical ? 0.2 : 0.18)
        );

        ctx.fillStyle = palette.textPrimary;
        ctx.font = `bold ${isVertical ? 82 : 76}px "Amiri", "Noto Naskh Arabic", serif`;
        ctx.fillText(
          headline || 'المصحف الجامع',
          width / 2,
          height * (isVertical ? 0.48 : 0.49) + (1 - p) * 24
        );

        ctx.fillStyle = palette.textMuted;
        ctx.font = `500 ${isVertical ? 32 : 28}px "Noto Naskh Arabic", Tahoma, sans-serif`;
        const subLines = wrapArabicText(ctx, subtitle, width * 0.78);
        subLines.forEach((line, idx) => {
          ctx.fillText(
            line,
            width / 2,
            height * (isVertical ? 0.59 : 0.64) + idx * (isVertical ? 46 : 40)
          );
        });
        ctx.restore();
      }
      // ==================== SCENE 2 (3.6s -> 7.6s): MUSHAF VERSE SHOWCASE ====================
      else if (t < 7.6) {
        const localT = t - 3.6;
        const p = easeOutCubic(clamp01(localT / 0.9));
        const fadeOut = localT > 3.4 ? clamp01(1 - (localT - 3.4) / 0.6) : 1;
        ctx.save();
        ctx.globalAlpha = p * fadeOut;

        ctx.fillStyle = palette.gold;
        ctx.font = `600 ${isVertical ? 30 : 26}px "Noto Naskh Arabic", sans-serif`;
        ctx.fillText('تلاوة وتدبر بخشوع وطمأنينة', width / 2, height * 0.16);

        // Glass Verse Card
        const cardW = width * (isVertical ? 0.84 : 0.74);
        const cardH = height * (isVertical ? 0.44 : 0.46);
        const cardX = (width - cardW) / 2;
        const cardY = height * (isVertical ? 0.25 : 0.26) + (1 - p) * 25;

        ctx.fillStyle = palette.cardBg;
        drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 32);
        ctx.fill();
        ctx.strokeStyle = palette.cardBorder;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = palette.textPrimary;
        ctx.font = `bold ${isVertical ? 54 : 50}px "Amiri", "Noto Naskh Arabic", serif`;
        ctx.fillText('﴿ وَرَتِّلِ الْقُرْآنَ تَرْتِيلًا ﴾', width / 2, cardY + cardH * 0.38);

        ctx.fillStyle = palette.textMuted;
        ctx.font = `500 ${isVertical ? 28 : 25}px "Noto Naskh Arabic", sans-serif`;
        ctx.fillText(
          'الرسم العثماني الكامل · ٦٠٤ صفحة · تفسير وتلاوة ١٧٠+ قارئ',
          width / 2,
          cardY + cardH * 0.68
        );

        // Footer pill bar inside scene
        ctx.fillStyle = palette.gold;
        ctx.font = `600 ${isVertical ? 28 : 24}px "Noto Naskh Arabic", sans-serif`;
        ctx.fillText(
          'يعمل بكفاءة كاملة حتى بدون اتصال بالإنترنت',
          width / 2,
          height * (isVertical ? 0.8 : 0.84)
        );
        ctx.restore();
      }
      // ==================== SCENE 3 (7.6s -> 11.4s): FEATURE HIGHLIGHTS ====================
      else if (t < 11.4) {
        const localT = t - 7.6;
        const fadeOut = localT > 3.2 ? clamp01(1 - (localT - 3.2) / 0.6) : 1;
        ctx.save();
        ctx.globalAlpha = fadeOut;

        ctx.fillStyle = palette.gold;
        ctx.font = `bold ${isVertical ? 40 : 34}px "Amiri", serif`;
        ctx.fillText('أبرز أقسام التطبيق الشاملة', width / 2, height * 0.14);

        const feats =
          selectedFeatures.length > 0 ? selectedFeatures.slice(0, 4) : FEATURE_POOL.slice(0, 4);

        feats.forEach((feat, i) => {
          const itemReveal = easeOutCubic(clamp01((localT - i * 0.35) / 0.55));
          ctx.save();
          ctx.globalAlpha = itemReveal * fadeOut;

          if (isVertical) {
            const boxW = width * 0.84;
            const boxH = 128;
            const bx = (width - boxW) / 2;
            const by = height * 0.24 + i * 165 + (1 - itemReveal) * 28;
            ctx.fillStyle = palette.cardBg;
            drawRoundedRect(ctx, bx, by, boxW, boxH, 24);
            ctx.fill();
            ctx.strokeStyle = palette.cardBorder;
            ctx.lineWidth = 1.6;
            ctx.stroke();

            ctx.fillStyle = palette.textPrimary;
            ctx.font = '600 28px "Noto Naskh Arabic", sans-serif';
            const lines = wrapArabicText(ctx, feat, boxW - 60);
            lines.slice(0, 2).forEach((ln, li) => {
              ctx.fillText(
                ln,
                width / 2,
                by + boxH / 2 + (lines.length > 1 ? (li === 0 ? -18 : 20) : 0)
              );
            });
          } else {
            // 2x2 grid in 16:9
            const col = i % 2;
            const row = Math.floor(i / 2);
            const boxW = width * 0.4;
            const boxH = 148;
            const gapX = 36;
            const gapY = 32;
            const startX = width / 2 - boxW - gapX / 2;
            const bx = startX + (col === 0 ? boxW + gapX : 0);
            const by = height * 0.27 + row * (boxH + gapY) + (1 - itemReveal) * 24;

            ctx.fillStyle = palette.cardBg;
            drawRoundedRect(ctx, bx, by, boxW, boxH, 24);
            ctx.fill();
            ctx.strokeStyle = palette.cardBorder;
            ctx.lineWidth = 1.6;
            ctx.stroke();

            ctx.fillStyle = palette.textPrimary;
            ctx.font = '600 24px "Noto Naskh Arabic", sans-serif';
            const lines = wrapArabicText(ctx, feat, boxW - 44);
            lines.slice(0, 2).forEach((ln, li) => {
              ctx.fillText(
                ln,
                bx + boxW / 2,
                by + boxH / 2 + (lines.length > 1 ? (li === 0 ? -18 : 20) : 0)
              );
            });
          }
          ctx.restore();
        });
        ctx.restore();
      }
      // ==================== SCENE 4 (11.4s -> 14s): CTA CLOSING ====================
      else {
        const localT = t - 11.4;
        const p = easeOutCubic(clamp01(localT / 0.8));
        ctx.save();
        ctx.globalAlpha = p;

        drawIslamicRosette(
          ctx,
          width / 2,
          height * (isVertical ? 0.34 : 0.34),
          (isVertical ? 140 : 120) * (0.85 + 0.15 * p),
          t * 0.25,
          palette.gold,
          0.35
        );

        ctx.fillStyle = palette.textPrimary;
        ctx.font = `bold ${isVertical ? 74 : 68}px "Amiri", serif`;
        ctx.fillText(headline || 'المصحف الجامع', width / 2, height * 0.38);

        // CTA Button visual inside video
        const btnW = width * (isVertical ? 0.78 : 0.52);
        const btnH = isVertical ? 96 : 82;
        const btnX = (width - btnW) / 2;
        const btnY = height * 0.54;

        ctx.fillStyle = palette.gold;
        drawRoundedRect(ctx, btnX, btnY, btnW, btnH, 24);
        ctx.fill();

        ctx.fillStyle = palette.id === 'parchment_classic' ? '#FBF8F1' : '#09110E';
        ctx.font = `bold ${isVertical ? 30 : 27}px "Noto Naskh Arabic", sans-serif`;
        ctx.fillText(ctaText || 'ابدأ الآن مجاناً', width / 2, btnY + btnH / 2);

        ctx.fillStyle = palette.textMuted;
        ctx.font = `500 ${isVertical ? 24 : 22}px "Noto Naskh Arabic", sans-serif`;
        ctx.fillText('تطوير: محمد مصطفى صابر', width / 2, height * 0.84);
        ctx.restore();
      }
    },
    [aspect, ctaText, dimensions, headline, selectedFeatures, subtitle, themeId]
  );

  // Preview animation loop when not actively exporting
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (isExporting) return;

    drawFrameAt(ctx, elapsedRef.current);
    if (!isPlaying) return;

    let rafId = 0;
    let lastTs = performance.now();
    let lastUiSyncTs = lastTs;

    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - lastTs) / 1000);
      lastTs = now;
      elapsedRef.current = (elapsedRef.current + dt) % DURATION_SECONDS;
      if (now - lastUiSyncTs >= 100) {
        lastUiSyncTs = now;
        setElapsedSec(elapsedRef.current);
      }
      drawFrameAt(ctx, elapsedRef.current);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [drawFrameAt, isExporting, isPlaying]);

  const toggleFeature = (feat: string) => {
    setSelectedFeatures((prev) => {
      if (prev.includes(feat)) {
        return prev.length > 1 ? prev.filter((f) => f !== feat) : prev;
      }
      if (prev.length >= 4) {
        return [...prev.slice(1), feat];
      }
      return [...prev, feat];
    });
  };

  // Export real WebM/MP4 video at 30fps via MediaRecorder
  const handleExportVideo = async () => {
    const canvas = canvasRef.current;
    if (!canvas || isExporting) return;
    if (typeof canvas.captureStream !== 'function' || typeof MediaRecorder === 'undefined') {
      onShowToast('متصفحك الحالي لا يدعم تصدير الفيديو المباشر، جرب Chrome أو Edge أو Safari الحديث');
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsExporting(true);
    setExportProgress(0);
    setIsPlaying(false);

    let audioCtx: AudioContext | null = null;
    try {
      const videoStream = canvas.captureStream(30);
      const combinedStream = new MediaStream(videoStream.getVideoTracks());

      // Synthesize a serene, free harmonic background pad via Web Audio if enabled
      if (includeAmbientAudio && typeof AudioContext !== 'undefined') {
        try {
          audioCtx = new AudioContext();
          const dest = audioCtx.createMediaStreamDestination();
          const masterGain = audioCtx.createGain();
          masterGain.gain.setValueAtTime(0.001, audioCtx.currentTime);
          masterGain.gain.exponentialRampToValueAtTime(0.08, audioCtx.currentTime + 1.2);
          masterGain.gain.setValueAtTime(0.08, audioCtx.currentTime + DURATION_SECONDS - 1.5);
          masterGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + DURATION_SECONDS);
          masterGain.connect(dest);

          // Gentle Hijaz/pentatonic warm drone frequencies (C3, G3, Eb4)
          [130.81, 196.0, 311.13].forEach((freq, idx) => {
            if (!audioCtx) return;
            const osc = audioCtx.createOscillator();
            osc.type = idx === 2 ? 'sine' : 'triangle';
            osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
            const oscGain = audioCtx.createGain();
            oscGain.gain.value = idx === 0 ? 0.45 : idx === 1 ? 0.35 : 0.2;
            osc.connect(oscGain);
            oscGain.connect(masterGain);
            osc.start();
            osc.stop(audioCtx.currentTime + DURATION_SECONDS);
          });

          dest.stream.getAudioTracks().forEach((tr) => combinedStream.addTrack(tr));
        } catch {
          // Proceed video-only if audio stream creation fails
        }
      }

      const candidates = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
        'video/mp4',
      ];
      const supportedMime = candidates.find((m) => MediaRecorder.isTypeSupported(m)) || '';
      const isMp4 = supportedMime.includes('mp4');
      setExportedMimeExt(isMp4 ? 'mp4' : 'webm');

      const recorder = supportedMime
        ? new MediaRecorder(combinedStream, {
            mimeType: supportedMime,
            videoBitsPerSecond: 3_500_000,
          })
        : new MediaRecorder(combinedStream);

      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunks.push(ev.data);
      };

      const donePromise = new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          resolve(new Blob(chunks, { type: supportedMime || 'video/webm' }));
        };
      });

      recorder.start(250);
      const startPerf = performance.now();

      await new Promise<void>((resolve) => {
        let lastUiPct = -1;
        let lastUiTime = startPerf;
        const renderStep = (now: number) => {
          const sec = (now - startPerf) / 1000;
          if (sec >= DURATION_SECONDS) {
            drawFrameAt(ctx, DURATION_SECONDS - 0.01);
            setElapsedSec(DURATION_SECONDS);
            setExportProgress(100);
            resolve();
            return;
          }
          elapsedRef.current = sec;
          const nextPct = Math.round((sec / DURATION_SECONDS) * 100);
          if (nextPct !== lastUiPct || now - lastUiTime >= 150) {
            lastUiPct = nextPct;
            lastUiTime = now;
            setElapsedSec(sec);
            setExportProgress(nextPct);
          }
          drawFrameAt(ctx, sec);
          requestAnimationFrame(renderStep);
        };
        requestAnimationFrame(renderStep);
      });

      recorder.stop();
      const blob = await donePromise;
      const url = URL.createObjectURL(blob);
      setExportedVideoUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      onShowToast('تم إنشاء الفيديو الإعلاني مجاناً بنجاح! يمكنك معاينته وتحميله.');
    } catch {
      onShowToast('تعذر تصدير الفيديو، يرجى المحاولة مرة أخرى');
    } finally {
      if (audioCtx) {
        audioCtx.close().catch(() => {});
      }
      setIsExporting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8">
      {/* Header Card */}
      <section className="rounded-3xl ios-glass-card p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2 max-w-2xl">
          <div className="text-xs font-medium text-[#9A742E] dark:text-amber-400">
            استوديو مجاني بالكامل · بدون تكاليف أو مفاتيح مدفوعة · تصدير مباشر
          </div>
          <h1 className="font-amiri text-3xl sm:text-4xl font-bold text-[#1C1917] dark:text-[#F2EFE8]">
            صانع الفيديو الإعلاني لتطبيق المصحف الجامع
          </h1>
          <p className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
            أنشئ فيديو إعلانياً احترافياً للتطبيق باللغة العربية لمشاركته على واتساب، يوتيوب،
            إنستغرام ريلز أو تيك توك — يعمل مجاناً ١٠٠٪ داخل متصفحك مع موسيقى/خلفية صوتية هادئة.
          </p>
        </div>

        <button
          type="button"
          disabled={isExporting}
          onClick={() => void handleExportVideo()}
          className="ios-spring inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-[#14532D] hover:bg-[#114224] dark:bg-emerald-700 dark:hover:bg-emerald-600 text-[#FBF8F1] font-semibold text-sm shadow-sm whitespace-nowrap shrink-0 disabled:opacity-60"
        >
          <Film className="w-4 h-4" />
          <span>
            {isExporting
              ? `جاري تصدير الفيديو (${toArabicDigits(exportProgress)}٪)...`
              : 'تصدير وإنشاء الفيديو مجاناً'}
          </span>
        </button>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Controls Column (5 cols) */}
        <div className="lg:col-span-5 rounded-3xl ios-glass-card p-6 space-y-6">
          {/* Aspect Ratio */}
          <div className="space-y-2.5">
            <div className="text-xs font-semibold text-stone-700 dark:text-stone-300">
              مقاس الفيديو حسب المنصة
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={isExporting}
                onClick={() => setAspect('9:16')}
                className={`ios-spring p-3 rounded-xl text-xs font-medium text-center border ${
                  aspect === '9:16'
                    ? 'bg-[#14532D] dark:bg-emerald-700 text-[#FBF8F1] border-transparent'
                    : 'ios-glass-input text-stone-700 dark:text-stone-200 border-transparent'
                }`}
              >
                عمودي ٩:١٦ (ريلز / واتساب)
              </button>
              <button
                type="button"
                disabled={isExporting}
                onClick={() => setAspect('16:9')}
                className={`ios-spring p-3 rounded-xl text-xs font-medium text-center border ${
                  aspect === '16:9'
                    ? 'bg-[#14532D] dark:bg-emerald-700 text-[#FBF8F1] border-transparent'
                    : 'ios-glass-input text-stone-700 dark:text-stone-200 border-transparent'
                }`}
              >
                أفقي ١٦:٩ (يوتيوب / عرض)
              </button>
            </div>
          </div>

          {/* Theme Palette */}
          <div className="space-y-2.5">
            <div className="text-xs font-semibold text-stone-700 dark:text-stone-300">
              الهوية والألوان
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {Object.values(THEMES).map((th) => (
                <button
                  key={th.id}
                  type="button"
                  disabled={isExporting}
                  onClick={() => setThemeId(th.id)}
                  className={`ios-spring p-2.5 rounded-xl text-xs font-medium border flex items-center gap-2 ${
                    themeId === th.id
                      ? 'border-[#14532D] dark:border-emerald-400 bg-[#14532D]/10 dark:bg-emerald-500/15 text-stone-900 dark:text-stone-100'
                      : 'ios-glass-input border-transparent text-stone-700 dark:text-stone-300'
                  }`}
                >
                  <span
                    className="w-4 h-4 rounded-full shrink-0 border border-white/30"
                    style={{ backgroundColor: th.bgStart }}
                  />
                  <span className="truncate">{th.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Editable Copy */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label
                htmlFor="promo-headline"
                className="block text-xs font-semibold text-stone-700 dark:text-stone-300"
              >
                العنوان الرئيسي
              </label>
              <input
                id="promo-headline"
                type="text"
                maxLength={40}
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                className="w-full px-3.5 py-2 text-sm rounded-xl ios-glass-input text-stone-900 dark:text-stone-100"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="promo-subtitle"
                className="block text-xs font-semibold text-stone-700 dark:text-stone-300"
              >
                الوصف الترحيبي
              </label>
              <textarea
                id="promo-subtitle"
                rows={2}
                maxLength={120}
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                className="w-full px-3.5 py-2 text-sm rounded-xl ios-glass-input text-stone-900 dark:text-stone-100 resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="promo-cta"
                className="block text-xs font-semibold text-stone-700 dark:text-stone-300"
              >
                عبارة الختام (Call to Action)
              </label>
              <input
                id="promo-cta"
                type="text"
                maxLength={60}
                value={ctaText}
                onChange={(e) => setCtaText(e.target.value)}
                className="w-full px-3.5 py-2 text-sm rounded-xl ios-glass-input text-stone-900 dark:text-stone-100"
              />
            </div>
          </div>

          {/* Feature Selection */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-stone-700 dark:text-stone-300">
              المزايا التي ستظهر في الفيديو (حتى ٤ مزايا)
            </div>
            <div className="space-y-1.5">
              {FEATURE_POOL.map((feat) => {
                const active = selectedFeatures.includes(feat);
                return (
                  <button
                    key={feat}
                    type="button"
                    disabled={isExporting}
                    onClick={() => toggleFeature(feat)}
                    className={`ios-spring w-full text-right px-3 py-2 rounded-xl text-xs flex items-center justify-between gap-2 border ${
                      active
                        ? 'bg-[#14532D]/10 dark:bg-emerald-500/15 border-[#14532D]/40 dark:border-emerald-400/40 text-stone-900 dark:text-stone-100 font-medium'
                        : 'ios-glass-input border-transparent text-stone-600 dark:text-stone-400'
                    }`}
                  >
                    <span>{feat}</span>
                    {active && (
                      <CheckCircle2 className="w-4 h-4 text-[#14532D] dark:text-emerald-300 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Ambient Audio Option */}
          <button
            type="button"
            disabled={isExporting}
            onClick={() => setIncludeAmbientAudio((v) => !v)}
            className={`ios-spring w-full px-4 py-2.5 rounded-xl text-xs font-medium flex items-center justify-between border ${
              includeAmbientAudio
                ? 'bg-amber-500/12 border-amber-500/40 text-amber-900 dark:text-amber-300'
                : 'ios-glass-input border-transparent text-stone-600 dark:text-stone-300'
            }`}
          >
            <span className="flex items-center gap-2">
              {includeAmbientAudio ? (
                <Volume2 className="w-4 h-4" />
              ) : (
                <VolumeX className="w-4 h-4" />
              )}
              <span>إرفاق نغمة خلفية هادئة ومريحة في الفيديو</span>
            </span>
            <span>{includeAmbientAudio ? 'مفعّل' : 'صامت'}</span>
          </button>
        </div>

        {/* Live Preview & Export Output Column (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-3xl ios-glass-card p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-bold text-stone-900 dark:text-stone-100">
                <Sparkles className="w-4 h-4 text-[#9A742E] dark:text-amber-400" />
                <span>المعاينة الحية للفيديو ({toArabicDigits(DURATION_SECONDS)} ثانية)</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isExporting}
                  onClick={() => setIsPlaying((p) => !p)}
                  className="ios-spring inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl ios-glass-input text-xs font-medium text-stone-800 dark:text-stone-200 whitespace-nowrap shrink-0"
                >
                  {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}</span>
                </button>

                <button
                  type="button"
                  disabled={isExporting}
                  onClick={() => {
                    elapsedRef.current = 0;
                    setElapsedSec(0);
                    setIsPlaying(true);
                  }}
                  className="ios-spring inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl ios-glass-input text-xs font-medium text-stone-800 dark:text-stone-200 whitespace-nowrap shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>من البداية</span>
                </button>
              </div>
            </div>

            {/* Canvas Container */}
            <div className="flex justify-center bg-stone-950/85 rounded-2xl p-3 sm:p-5 overflow-hidden">
              <canvas
                ref={canvasRef}
                width={dimensions.width}
                height={dimensions.height}
                className={`rounded-xl shadow-2xl ${
                  aspect === '9:16'
                    ? 'max-h-[540px] w-auto aspect-[9/16]'
                    : 'w-full h-auto aspect-[16/9]'
                }`}
              />
            </div>

            {/* Scrubber & Export Progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400 tabular-nums">
                <span>
                  {toArabicDigits(Math.floor(elapsedSec))} ث / {toArabicDigits(DURATION_SECONDS)} ث
                </span>
                {isExporting && (
                  <span className="font-semibold text-[#14532D] dark:text-emerald-300">
                    جاري التسجيل والتصدير: {toArabicDigits(exportProgress)}٪
                  </span>
                )}
              </div>
              <div className="h-1.5 rounded-full bg-stone-200/80 dark:bg-stone-800/80 overflow-hidden">
                <div
                  className="h-full bg-[#14532D] dark:bg-emerald-500 transition-[width] duration-150"
                  style={{
                    width: `${Math.round(
                      ((isExporting ? exportProgress : (elapsedSec / DURATION_SECONDS) * 100) *
                        100) /
                        100
                    )}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Exported Downloadable Video Card */}
          {exportedVideoUrl && (
            <div className="rounded-3xl ios-glass-card p-6 space-y-4 border border-emerald-600/35 dark:border-emerald-400/35">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-amiri text-2xl font-bold text-stone-900 dark:text-stone-100">
                    الفيديو جاهز للتحميل والمشاركة!
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    صيغة الفيديو: {exportedMimeExt.toUpperCase()} · جودة عالية مجانية
                  </p>
                </div>

                <a
                  href={exportedVideoUrl}
                  download={`al-mushaf-promo-${aspect === '9:16' ? 'vertical' : 'landscape'}.${exportedMimeExt}`}
                  className="ios-spring inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#14532D] hover:bg-[#114224] dark:bg-emerald-700 dark:hover:bg-emerald-600 text-[#FBF8F1] text-sm font-semibold whitespace-nowrap shrink-0"
                >
                  <Download className="w-4 h-4" />
                  <span>تحميل ملف الفيديو</span>
                </a>
              </div>

              <video
                src={exportedVideoUrl}
                controls
                playsInline
                className="w-full max-h-[380px] rounded-2xl bg-black"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
