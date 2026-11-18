export const APP_SHARE_URL =
  'https://ais-pre-jc7ffghbzjt7tdomkikjfh-553112389121.europe-west2.run.app';

export const APP_DEFAULT_SHARE_TEXT =
  'انضم إليّ في تطبيق «المصحف الجامع» — قراءة القرآن الكريم، التفاسير، قصص الأنبياء، الأذكار، ومنافسات الحفظ والسنة المباشرة مع الأصدقاء!';

export function getAppShareUrl(querySuffix = ''): string {
  if (!querySuffix) return APP_SHARE_URL;
  return `${APP_SHARE_URL}${querySuffix.startsWith('?') ? querySuffix : `?${querySuffix}`}`;
}

export function buildWhatsAppShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function buildTelegramShareUrl(url: string, text: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fallback below
  }
  return false;
}

export async function shareNativeOrCopy(params: {
  title: string;
  text: string;
  url?: string;
}): Promise<'shared' | 'copied' | 'failed'> {
  const url = params.url || APP_SHARE_URL;
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title: params.title,
        text: params.text,
        url,
      });
      return 'shared';
    } catch {
      // user cancelled or unavailable -> try clipboard
    }
  }
  const copied = await copyTextToClipboard(`${params.text}\n${url}`);
  return copied ? 'copied' : 'failed';
}
