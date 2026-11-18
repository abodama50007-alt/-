import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  CheckCircle2,
  Compass,
  LocateFixed,
  MapPin,
  Navigation,
  RefreshCw,
} from 'lucide-react';
import { toArabicDigits } from '../utils/arabic';
import {
  calculateDistanceToKaabaKm,
  calculateQiblaBearing,
  getArabicCardinalLabel,
  getSignedAngleDiff,
  PRESET_CITIES,
  unwrapContinuousAngle,
} from '../utils/qibla';

interface IOSDeviceOrientationEvent extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
}

interface DeviceOrientationConstructorWithPermission {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

import { SavedGeoLocation } from '../types/quran';

interface QiblaViewProps {
  externalLocation?: SavedGeoLocation;
  onLocationChange?: (loc: SavedGeoLocation) => void;
}

type SavedLocation = SavedGeoLocation;

type SensorStatus =
  | 'initializing'
  | 'needs-permission'
  | 'active'
  | 'denied'
  | 'unsupported';

const DEFAULT_LOCATION: SavedLocation = {
  lat: PRESET_CITIES[0].lat,
  lng: PRESET_CITIES[0].lng,
  label: `${PRESET_CITIES[0].name}، ${PRESET_CITIES[0].country}`,
  source: 'city',
  cityId: PRESET_CITIES[0].id,
};

const TICK_ANGLES = Array.from({ length: 72 }, (_, i) => i * 5);

export const QiblaView: React.FC<QiblaViewProps> = ({
  externalLocation,
  onLocationChange,
}) => {
  const [internalLocation, setInternalLocation] = useState<SavedLocation>(() => {
    try {
      const raw = localStorage.getItem('quran_qibla_location_v1');
      if (raw) {
        const parsed = JSON.parse(raw) as SavedLocation;
        if (typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
          return parsed;
        }
      }
    } catch {
      // ignore storage errors
    }
    return DEFAULT_LOCATION;
  });

  const location = externalLocation ?? internalLocation;
  const setLocation = (next: SavedLocation) => {
    setInternalLocation(next);
    onLocationChange?.(next);
  };

  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const [sensorStatus, setSensorStatus] = useState<SensorStatus>('initializing');
  const [rawHeading, setRawHeading] = useState<number>(0);
  const [manualHeading, setManualHeading] = useState<number>(0);
  const [continuousHeading, setContinuousHeading] = useState<number>(0);

  const continuousHeadingRef = useRef<number>(0);
  const wasAlignedRef = useRef<boolean>(false);

  // Persist selected/detected location
  useEffect(() => {
    try {
      localStorage.setItem('quran_qibla_location_v1', JSON.stringify(location));
    } catch {
      // ignore
    }
  }, [location]);

  const qiblaBearing = useMemo(
    () => calculateQiblaBearing(location.lat, location.lng),
    [location.lat, location.lng]
  );

  const distanceKm = useMemo(
    () => calculateDistanceToKaabaKm(location.lat, location.lng),
    [location.lat, location.lng]
  );

  const effectiveHeading = sensorStatus === 'active' ? rawHeading : manualHeading;

  // Keep continuous angle unwrapped for smooth CSS rotation without 359->0 jumps
  useEffect(() => {
    const nextCont = unwrapContinuousAngle(
      continuousHeadingRef.current,
      effectiveHeading
    );
    continuousHeadingRef.current = nextCont;
    setContinuousHeading(nextCont);
  }, [effectiveHeading]);

  const angleDiff = useMemo(
    () => getSignedAngleDiff(qiblaBearing, effectiveHeading),
    [qiblaBearing, effectiveHeading]
  );

  const isAligned = Math.abs(angleDiff) <= 5;

  // Subtle haptic pulse when aligning onto Qibla with live sensor
  useEffect(() => {
    if (sensorStatus === 'active' && isAligned && !wasAlignedRef.current) {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(25);
        } catch {
          // ignore unsupported vibration
        }
      }
    }
    wasAlignedRef.current = isAligned;
  }, [isAligned, sensorStatus]);

  const handleOrientationEvent = useCallback((event: Event) => {
    const ori = event as IOSDeviceOrientationEvent;
    let heading: number | null = null;

    if (
      typeof ori.webkitCompassHeading === 'number' &&
      !Number.isNaN(ori.webkitCompassHeading)
    ) {
      heading = ori.webkitCompassHeading;
    } else if (typeof ori.alpha === 'number' && !Number.isNaN(ori.alpha)) {
      const screenAngle =
        typeof window !== 'undefined' &&
        window.screen?.orientation &&
        typeof window.screen.orientation.angle === 'number'
          ? window.screen.orientation.angle
          : 0;
      heading = (360 - ori.alpha + screenAngle) % 360;
    }

    if (heading !== null) {
      const normalized = ((heading % 360) + 360) % 360;
      setSensorStatus('active');
      setRawHeading(normalized);
    }
  }, []);

  const attachSensorListeners = useCallback(() => {
    window.addEventListener(
      'deviceorientationabsolute',
      handleOrientationEvent,
      true
    );
    window.addEventListener('deviceorientation', handleOrientationEvent, true);
  }, [handleOrientationEvent]);

  // Initialize DeviceOrientationEvent sensor detection
  useEffect(() => {
    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) {
      setSensorStatus('unsupported');
      return;
    }

    const DeviceOrientationCtor =
      window.DeviceOrientationEvent as unknown as DeviceOrientationConstructorWithPermission;

    if (typeof DeviceOrientationCtor.requestPermission === 'function') {
      setSensorStatus('needs-permission');
      return;
    }

    attachSensorListeners();

    // If no orientation event fires within 1.4s (typical on desktop browsers), mark unsupported so manual mode is clearly shown
    const timeoutId = window.setTimeout(() => {
      setSensorStatus((prev) => (prev === 'initializing' ? 'unsupported' : prev));
    }, 1400);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener(
        'deviceorientationabsolute',
        handleOrientationEvent,
        true
      );
      window.removeEventListener(
        'deviceorientation',
        handleOrientationEvent,
        true
      );
    };
  }, [attachSensorListeners, handleOrientationEvent]);

  const requestIOSCompassPermission = async () => {
    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) {
      setSensorStatus('unsupported');
      return;
    }
    const DeviceOrientationCtor =
      window.DeviceOrientationEvent as unknown as DeviceOrientationConstructorWithPermission;

    if (typeof DeviceOrientationCtor.requestPermission === 'function') {
      try {
        const result = await DeviceOrientationCtor.requestPermission();
        if (result === 'granted') {
          setSensorStatus('initializing');
          attachSensorListeners();
          window.setTimeout(() => {
            setSensorStatus((prev) =>
              prev === 'initializing' ? 'unsupported' : prev
            );
          }, 1500);
        } else {
          setSensorStatus('denied');
        }
      } catch {
        setSensorStatus('denied');
      }
    }
  };

  const handleDetectGPS = () => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setGpsError('متصفحك لا يدعم خدمة تحديد الموقع الجغرافي');
      return;
    }
    setGpsLoading(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          label: 'موقعك الحالي (GPS)',
          source: 'gps',
        });
        setGpsLoading(false);
      },
      (err) => {
        setGpsLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGpsError('تم رفض إذن الموقع، يمكنك اختيار مدينتك يدوياً من القائمة');
        } else {
          setGpsError('تعذر تحديد الموقع حالياً، يمكنك اختيار أقرب مدينة يدوياً');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const turnGuidanceText = isAligned
    ? 'أنت تتجه نحو القبلة الشريفة'
    : angleDiff > 0
    ? `اتجه لليمين بمقدار ${toArabicDigits(Math.round(Math.abs(angleDiff)))}°`
    : `اتجه لليسار بمقدار ${toArabicDigits(Math.round(Math.abs(angleDiff)))}°`;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-28 space-y-8">
      {/* Header & Location Picker */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-stone-200/70 dark:border-stone-800/80 pb-6">
        <div>
          <h1 className="font-amiri text-3xl sm:text-4xl font-bold text-stone-900 dark:text-stone-100">
            تحديد اتجاه القبلة
          </h1>
          <p className="mt-1.5 text-sm text-stone-600 dark:text-stone-400">
            بوصلة تفاعلية بمستشعر الجهاز لتحديد اتجاه الكعبة المشرفة بدقة أينما كنت
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          <button
            type="button"
            onClick={handleDetectGPS}
            disabled={gpsLoading}
            className="ios-spring inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-medium rounded-xl bg-[#14532D] hover:bg-[#114224] dark:bg-emerald-700 dark:hover:bg-emerald-600 text-[#FBF8F1] shadow-sm disabled:opacity-60 whitespace-nowrap"
          >
            {gpsLoading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <LocateFixed className="w-3.5 h-3.5" />
            )}
            <span>{gpsLoading ? 'جاري التحديد...' : 'تحديد موقعي (GPS)'}</span>
          </button>

          <select
            aria-label="اختيار المدينة"
            value={location.source === 'city' ? location.cityId ?? '' : ''}
            onChange={(e) => {
              const chosen = PRESET_CITIES.find((c) => c.id === e.target.value);
              if (chosen) {
                setGpsError(null);
                setLocation({
                  lat: chosen.lat,
                  lng: chosen.lng,
                  label: `${chosen.name}، ${chosen.country}`,
                  source: 'city',
                  cityId: chosen.id,
                });
              }
            }}
            className="text-xs sm:text-sm rounded-xl ios-glass-input text-stone-800 dark:text-stone-200 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
          >
            <option value="">
              {location.source === 'gps' ? 'أو اختر مدينة...' : 'اختر مدينتك...'}
            </option>
            {PRESET_CITIES.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name} — {city.country}
              </option>
            ))}
          </select>
        </div>
      </div>

      {gpsError && (
        <div className="p-3.5 rounded-2xl ios-glass-card text-xs sm:text-sm text-amber-800 dark:text-amber-300 text-center">
          {gpsError}
        </div>
      )}

      {/* Main Liquid Glass Compass Stage */}
      <div className="ios-glass-card rounded-3xl p-6 sm:p-10 flex flex-col items-center gap-7 relative overflow-hidden">
        {/* Ambient Alignment Glow Behind Compass */}
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute w-80 h-80 rounded-full blur-[70px] transition-opacity duration-500 ${
            isAligned
              ? 'bg-emerald-500/30 dark:bg-emerald-400/25 opacity-100'
              : 'bg-amber-500/15 dark:bg-emerald-600/10 opacity-75'
          }`}
        />

        {/* Location Badge + Permission Button */}
        <div className="relative z-10 flex flex-wrap items-center justify-center gap-2.5 text-xs sm:text-sm">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl ios-glass-input text-stone-700 dark:text-stone-200">
            <MapPin className="w-3.5 h-3.5 text-[#14532D] dark:text-emerald-400" />
            <span>{location.label}</span>
          </span>

          {sensorStatus === 'needs-permission' && (
            <button
              type="button"
              onClick={requestIOSCompassPermission}
              className="ios-spring inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#9A742E] hover:bg-[#826124] text-white font-medium shadow-sm"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>تفعيل البوصلة الحية</span>
            </button>
          )}
        </div>

        {/* Frosted Liquid Glass Circular Compass Dial */}
        <div className="relative z-10 flex items-center justify-center my-1">
          {/* Fixed Device Top Lubber Line (Phone Heading Pointer) */}
          <div
            aria-hidden="true"
            className="absolute -top-3 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center"
          >
            <div
              className={`w-3.5 h-3.5 rotate-45 rounded-xs border transition-colors duration-300 ${
                isAligned
                  ? 'bg-[#14532D] dark:bg-emerald-400 border-white shadow-[0_0_16px_rgba(16,185,129,0.75)]'
                  : 'bg-[#9A742E] dark:bg-amber-400 border-white/80 shadow-sm'
              }`}
            />
          </div>

          {/* Outer Glass Bezel */}
          <div
            className={`relative w-[300px] h-[300px] sm:w-[356px] sm:h-[356px] rounded-full p-3 ios-glass-card transition-all duration-500 ${
              isAligned
                ? 'ring-4 ring-emerald-500/45 dark:ring-emerald-400/45 shadow-[0_0_55px_-8px_rgba(16,185,129,0.45)]'
                : 'ring-1 ring-white/50 dark:ring-white/10'
            }`}
          >
            {/* Inner Glass Dial Surface */}
            <div className="relative w-full h-full rounded-full ios-glass-input flex items-center justify-center overflow-hidden">
              {/* Rotating Compass Rose (-continuousHeading) */}
              <div
                className="absolute inset-0 transition-transform duration-150 ease-out will-change-transform"
                style={{ transform: `rotate(${-continuousHeading}deg)` }}
              >
                {/* SVG Degree Ticks */}
                <svg
                  viewBox="0 0 200 200"
                  className="w-full h-full"
                  aria-hidden="true"
                >
                  {TICK_ANGLES.map((deg) => {
                    const isMajor = deg % 30 === 0;
                    const isCardinal = deg % 90 === 0;
                    return (
                      <line
                        key={deg}
                        x1="100"
                        y1={isCardinal ? '8' : isMajor ? '10' : '12'}
                        x2="100"
                        y2={isCardinal ? '20' : isMajor ? '18' : '16'}
                        transform={`rotate(${deg} 100 100)`}
                        stroke="currentColor"
                        strokeWidth={isCardinal ? '1.8' : isMajor ? '1.3' : '0.8'}
                        className={
                          deg === 0
                            ? 'text-red-600 dark:text-red-400'
                            : isMajor
                            ? 'text-stone-600/75 dark:text-stone-300/70'
                            : 'text-stone-400/50 dark:text-stone-500/45'
                        }
                      />
                    );
                  })}
                </svg>

                {/* Arabic Cardinal Markers */}
                <span className="absolute top-6 left-1/2 -translate-x-1/2 text-xs font-bold text-red-600 dark:text-red-400 select-none">
                  ش
                </span>
                <span className="absolute bottom-6 left-1/2 -translate-x-1/2 text-xs font-semibold text-stone-600 dark:text-stone-400 select-none">
                  ج
                </span>
                <span className="absolute right-6 top-1/2 -translate-y-1/2 text-xs font-semibold text-stone-600 dark:text-stone-400 select-none">
                  ق
                </span>
                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-xs font-semibold text-stone-600 dark:text-stone-400 select-none">
                  غ
                </span>

                {/* Qibla Bearing Ray + Kaaba Medallion */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{ transform: `rotate(${qiblaBearing}deg)` }}
                >
                  {/* Directional Light Beam from Center to Kaaba */}
                  <div
                    className={`absolute left-1/2 -translate-x-1/2 top-9 bottom-1/2 w-1.5 rounded-full transition-colors duration-300 ${
                      isAligned
                        ? 'bg-gradient-to-t from-emerald-500/15 via-emerald-500/75 to-emerald-400'
                        : 'bg-gradient-to-t from-amber-500/10 via-[#9A742E]/70 to-amber-400'
                    }`}
                  />

                  {/* Kaaba Icon Medallion at Outer Ring */}
                  <div className="absolute top-5 left-1/2 -translate-x-1/2 flex flex-col items-center">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center border shadow-md transition-all duration-300 ${
                        isAligned
                          ? 'bg-[#14532D] border-emerald-300 scale-110 shadow-[0_0_20px_rgba(16,185,129,0.65)]'
                          : 'bg-[#1C1917] dark:bg-stone-950 border-[#D4AF37]'
                      }`}
                    >
                      {/* Stylized Kaaba Cube SVG */}
                      <svg
                        viewBox="0 0 24 24"
                        className="w-5 h-5"
                        fill="none"
                        aria-label="الكعبة المشرفة"
                      >
                        <rect
                          x="4"
                          y="5"
                          width="16"
                          height="15"
                          rx="1.5"
                          fill="#18181B"
                          stroke="#D4AF37"
                          strokeWidth="1.2"
                        />
                        <path
                          d="M4 9.5H20"
                          stroke="#FACC15"
                          strokeWidth="2"
                        />
                        <rect
                          x="10.5"
                          y="13"
                          width="3"
                          height="5"
                          rx="0.5"
                          fill="#D4AF37"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Center Frosted Liquid Glass Hub */}
              <motion.div
                animate={{ scale: isAligned ? 1.03 : 1 }}
                transition={{ type: 'spring', stiffness: 360, damping: 24 }}
                className={`relative z-20 w-36 h-36 sm:w-40 sm:h-40 rounded-full ios-glass-dock flex flex-col items-center justify-center text-center px-3 border transition-colors duration-300 ${
                  isAligned
                    ? 'border-emerald-500/50 dark:border-emerald-400/50'
                    : 'border-white/70 dark:border-white/15'
                }`}
              >
                <span className="text-[11px] text-stone-500 dark:text-stone-400">
                  اتجاه القبلة
                </span>
                <span className="text-3xl sm:text-4xl font-bold text-[#14532D] dark:text-emerald-300 tabular-nums my-0.5">
                  {toArabicDigits(Math.round(qiblaBearing))}°
                </span>
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-semibold leading-tight ${
                    isAligned
                      ? 'text-[#14532D] dark:text-emerald-300'
                      : 'text-[#9A742E] dark:text-amber-300'
                  }`}
                >
                  {isAligned && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                  <span>
                    {isAligned
                      ? 'باتجاه القبلة'
                      : angleDiff > 0
                      ? `يمين ${toArabicDigits(Math.round(Math.abs(angleDiff)))}°`
                      : `يسار ${toArabicDigits(Math.round(Math.abs(angleDiff)))}°`}
                  </span>
                </span>
              </motion.div>
            </div>
          </div>
        </div>

        {/* Live Status Message */}
        <div className="relative z-10 text-center space-y-2 max-w-md">
          <div
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-semibold transition-colors ${
              isAligned
                ? 'bg-[#14532D] text-[#FBF8F1] dark:bg-emerald-600 shadow-sm'
                : 'ios-glass-input text-stone-800 dark:text-stone-100'
            }`}
          >
            {isAligned ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <Navigation className="w-4 h-4 shrink-0 text-[#9A742E] dark:text-amber-400" />
            )}
            <span>{turnGuidanceText}</span>
          </div>

          <p className="text-xs text-stone-500 dark:text-stone-400">
            {sensorStatus === 'active'
              ? `مستشعر البوصلة نشط · اتجاه الجهاز الحالي ${toArabicDigits(Math.round(effectiveHeading))}°`
              : sensorStatus === 'needs-permission'
              ? 'اضغط على «تفعيل البوصلة الحية» أعلاه للسماح بالوصول لمستشعر الحركة'
              : sensorStatus === 'denied'
              ? 'تم رفض إذن مستشعر البوصلة — يمكنك تجربة الاتجاه باستخدام شريط المعايرة أدناه'
              : 'مستشعر البوصلة غير متاح على هذا الجهاز — حرّك شريط المعاينة لمطابقة الشمال'}
          </p>
        </div>

        {/* Manual Rotation Preview Slider (shown whenever live compass sensor isn't actively streaming) */}
        {sensorStatus !== 'active' && (
          <div className="relative z-10 w-full max-w-md p-4 rounded-2xl ios-glass-input space-y-2">
            <div className="flex items-center justify-between text-xs text-stone-600 dark:text-stone-300 tabular-nums">
              <span>معاينة اتجاه الجهاز يدوياً</span>
              <span className="font-semibold">
                {toArabicDigits(Math.round(manualHeading))}° (
                {getArabicCardinalLabel(manualHeading)})
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={359}
              value={manualHeading}
              onChange={(e) => setManualHeading(Number(e.target.value))}
              aria-label="محاكاة اتجاه البوصلة يدوياً"
              className="w-full accent-[#14532D] dark:accent-emerald-400 cursor-pointer h-1.5 rounded-full"
            />
          </div>
        )}
      </div>

      {/* Qibla Metrics & Calibration Info Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl ios-glass-card space-y-1.5">
          <div className="text-xs text-stone-500 dark:text-stone-400">
            زاوية القبلة من الشمال الحقيقي
          </div>
          <div className="text-2xl font-bold text-stone-900 dark:text-stone-100 tabular-nums">
            {toArabicDigits(Math.round(qiblaBearing))}°
          </div>
          <div className="text-xs font-medium text-[#14532D] dark:text-emerald-300">
            باتجاه {getArabicCardinalLabel(qiblaBearing)}
          </div>
        </div>

        <div className="p-5 rounded-2xl ios-glass-card space-y-1.5">
          <div className="text-xs text-stone-500 dark:text-stone-400">
            المسافة إلى الكعبة المشرفة
          </div>
          <div className="text-2xl font-bold text-stone-900 dark:text-stone-100 tabular-nums">
            {toArabicDigits(distanceKm)} كم
          </div>
          <div className="text-xs text-stone-500 dark:text-stone-400 tabular-nums">
            {location.lat.toFixed(2)}°، {location.lng.toFixed(2)}°
          </div>
        </div>

        <div className="p-5 rounded-2xl ios-glass-card space-y-1.5">
          <div className="text-xs text-stone-500 dark:text-stone-400">
            نصيحة لدقة البوصلة
          </div>
          <p className="text-xs sm:text-sm text-stone-700 dark:text-stone-300 leading-relaxed">
            أبقِ الهاتف مستوياً أفقياً، وفي حال عدم الاستقرار حرّك الجهاز في الهواء
            على شكل رقم (٨) بعيداً عن المعادن.
          </p>
        </div>
      </div>
    </div>
  );
};
