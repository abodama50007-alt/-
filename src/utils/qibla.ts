export interface CityCoordinate {
  id: string;
  name: string;
  country: string;
  lat: number;
  lng: number;
}

export const KAABA_COORDS = {
  lat: 21.422487,
  lng: 39.826206,
};

export const PRESET_CITIES: CityCoordinate[] = [
  { id: 'cairo', name: 'القاهرة', country: 'مصر', lat: 30.0444, lng: 31.2357 },
  { id: 'alexandria', name: 'الإسكندرية', country: 'مصر', lat: 31.2001, lng: 29.9187 },
  { id: 'riyadh', name: 'الرياض', country: 'السعودية', lat: 24.7136, lng: 46.6753 },
  { id: 'jeddah', name: 'جدة', country: 'السعودية', lat: 21.4858, lng: 39.1925 },
  { id: 'madinah', name: 'المدينة المنورة', country: 'السعودية', lat: 24.5247, lng: 39.5692 },
  { id: 'makkah', name: 'مكة المكرمة', country: 'السعودية', lat: 21.3891, lng: 39.8579 },
  { id: 'dubai', name: 'دبي', country: 'الإمارات', lat: 25.2048, lng: 55.2708 },
  { id: 'abudhabi', name: 'أبوظبي', country: 'الإمارات', lat: 24.4539, lng: 54.3773 },
  { id: 'doha', name: 'الدوحة', country: 'قطر', lat: 25.2854, lng: 51.531 },
  { id: 'kuwait', name: 'الكويت', country: 'الكويت', lat: 29.3759, lng: 47.9774 },
  { id: 'manama', name: 'المنامة', country: 'البحرين', lat: 26.2285, lng: 50.586 },
  { id: 'muscat', name: 'مسقط', country: 'عُمان', lat: 23.588, lng: 58.3829 },
  { id: 'amman', name: 'عمّان', country: 'الأردن', lat: 31.9454, lng: 35.9284 },
  { id: 'jerusalem', name: 'القدس', country: 'فلسطين', lat: 31.7683, lng: 35.2137 },
  { id: 'beirut', name: 'بيروت', country: 'لبنان', lat: 33.8938, lng: 35.5018 },
  { id: 'damascus', name: 'دمشق', country: 'سوريا', lat: 33.5138, lng: 36.2765 },
  { id: 'baghdad', name: 'بغداد', country: 'العراق', lat: 33.3152, lng: 44.3661 },
  { id: 'rabat', name: 'الرباط', country: 'المغرب', lat: 34.0209, lng: -6.8416 },
  { id: 'algiers', name: 'الجزائر', country: 'الجزائر', lat: 36.7538, lng: 3.0588 },
  { id: 'tunis', name: 'تونس', country: 'تونس', lat: 36.8065, lng: 10.1815 },
  { id: 'istanbul', name: 'إسطنبول', country: 'تركيا', lat: 41.0082, lng: 28.9784 },
  { id: 'london', name: 'لندن', country: 'المملكة المتحدة', lat: 51.5074, lng: -0.1278 },
];

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDegrees(rad: number): number {
  return (rad * 180) / Math.PI;
}

/**
 * Great-circle initial bearing from (lat, lng) toward the Kaaba in degrees clockwise from True North (0..360)
 */
export function calculateQiblaBearing(lat: number, lng: number): number {
  const phi1 = toRadians(lat);
  const phi2 = toRadians(KAABA_COORDS.lat);
  const dLambda = toRadians(KAABA_COORDS.lng - lng);

  const y = Math.sin(dLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);

  const bearing = (toDegrees(Math.atan2(y, x)) + 360) % 360;
  return bearing;
}

/**
 * Haversine distance in kilometers to the Kaaba
 */
export function calculateDistanceToKaabaKm(lat: number, lng: number): number {
  const R = 6371;
  const dLat = toRadians(KAABA_COORDS.lat - lat);
  const dLng = toRadians(KAABA_COORDS.lng - lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat)) *
      Math.cos(toRadians(KAABA_COORDS.lat)) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Shortest signed angular difference (-180..180) from current heading to target bearing
 */
export function getSignedAngleDiff(targetDeg: number, currentDeg: number): number {
  return ((targetDeg - currentDeg + 540) % 360) - 180;
}

/**
 * Unwrap angle so CSS rotation never jumps 359 -> 1 backwards
 */
export function unwrapContinuousAngle(prevContinuous: number, nextRaw: number): number {
  const normalizedPrev = ((prevContinuous % 360) + 360) % 360;
  const delta = ((nextRaw - normalizedPrev + 540) % 360) - 180;
  return prevContinuous + delta;
}

export function getArabicCardinalLabel(deg: number): string {
  const normalized = ((deg % 360) + 360) % 360;
  const dirs = [
    'الشمال',
    'الشمال الشرقي',
    'الشرق',
    'الجنوب الشرقي',
    'الجنوب',
    'الجنوب الغربي',
    'الغرب',
    'الشمال الغربي',
  ];
  const idx = Math.round(normalized / 45) % 8;
  return dirs[idx];
}
