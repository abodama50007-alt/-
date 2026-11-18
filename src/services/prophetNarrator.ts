export type NarratorVoiceId = 'Charon' | 'Fenrir' | 'Kore' | 'browser';

export interface NarratorVoiceOption {
  id: NarratorVoiceId;
  label: string;
  subtitle: string;
  mode: 'ai' | 'browser';
}

export const NARRATOR_VOICES: NarratorVoiceOption[] = [
  {
    id: 'Charon',
    label: 'الراوي الحكيم',
    subtitle: 'صوت هادئ وقور',
    mode: 'ai',
  },
  {
    id: 'Fenrir',
    label: 'الراوي الرصين',
    subtitle: 'نبرة قصصية عميقة',
    mode: 'ai',
  },
  {
    id: 'Kore',
    label: 'الراوية',
    subtitle: 'صوت واضح دافئ',
    mode: 'ai',
  },
  {
    id: 'browser',
    label: 'القارئ الفوري',
    subtitle: 'يعمل دون إنترنت',
    mode: 'browser',
  },
];

// Client-side object URL cache so replaying a chapter requires no second fetch
const clientAudioUrlCache = new Map<string, string>();

function base64WavToObjectUrl(base64: string, mimeType = 'audio/wav'): string {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType });
  return URL.createObjectURL(blob);
}

export async function fetchProphetNarrationAudio(params: {
  text: string;
  voiceName: Exclude<NarratorVoiceId, 'browser'>;
  prophetName?: string;
  chapterHeading?: string;
  signal?: AbortSignal;
}): Promise<string> {
  const cleanText = params.text.trim();
  const cacheKey = `${params.voiceName}::${cleanText}`;
  const cached = clientAudioUrlCache.get(cacheKey);
  if (cached) return cached;

  const res = await fetch('/api/prophets/narrate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: params.signal,
    body: JSON.stringify({
      text: cleanText,
      voiceName: params.voiceName,
      prophetName: params.prophetName,
      chapterHeading: params.chapterHeading,
    }),
  });

  if (!res.ok) {
    const errBody = (await res.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
    };
    throw new Error(errBody.message || errBody.error || 'NARRATION_UNAVAILABLE');
  }

  const data = (await res.json()) as { audioBase64?: string; mimeType?: string };
  if (!data.audioBase64) {
    throw new Error('NO_AUDIO_DATA');
  }

  const url = base64WavToObjectUrl(
    data.audioBase64,
    data.mimeType || 'audio/wav'
  );
  clientAudioUrlCache.set(cacheKey, url);
  return url;
}

export function selectBestArabicSpeechVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return null;
  }
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  const exactSaudi = voices.find((v) =>
    v.lang.toLowerCase().startsWith('ar-sa')
  );
  if (exactSaudi) return exactSaudi;

  const anyArabic = voices.find((v) => v.lang.toLowerCase().startsWith('ar'));
  return anyArabic ?? null;
}

export function splitArabicTextForSpeech(text: string): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];

  // Split around Arabic sentence punctuation while keeping chunks balanced for Web Speech API
  const sentences = cleaned
    .split(/(?<=[.،؛:!؟])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let buffer = '';
  for (const s of sentences) {
    if ((buffer + ' ' + s).trim().length <= 180) {
      buffer = (buffer + ' ' + s).trim();
    } else {
      if (buffer) chunks.push(buffer);
      buffer = s;
    }
  }
  if (buffer) chunks.push(buffer);
  return chunks.length ? chunks : [cleaned];
}
