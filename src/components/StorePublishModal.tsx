import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  FileCheck2,
  Globe,
  Loader2,
  Package,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Store,
  X,
  XCircle,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { isAdminUser } from '../firebase';
import { APP_SHARE_URL } from '../utils/share';

interface StorePublishModalProps {
  open: boolean;
  user?: User | null;
  onClose: () => void;
  onShowToast: (msg: string) => void;
}

interface ReadinessItem {
  id: string;
  label: string;
  passed: boolean | null;
  detail: string;
}

type StoreTab = 'google_play' | 'apple_store' | 'microsoft_other';

export const StorePublishModal: React.FC<StorePublishModalProps> = ({
  open,
  user,
  onClose,
  onShowToast,
}) => {
  const authorized = isAdminUser(user);
  const [activeStore, setActiveStore] = useState<StoreTab>('google_play');
  const [checking, setChecking] = useState(false);
  const [checks, setChecks] = useState<ReadinessItem[]>([]);
  const [packageName, setPackageName] = useState('com.mushaf.jamee');
  const [sha256Input, setSha256Input] = useState(
    'AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99'
  );

  const liveBaseUrl = useMemo(() => {
    if (typeof window !== 'undefined' && window.location.origin.startsWith('https://')) {
      return window.location.origin;
    }
    return APP_SHARE_URL;
  }, []);

  const privacyPolicyUrl = `${liveBaseUrl}/privacy.html`;

  const generatedAssetLinksJson = useMemo(() => {
    const cleanPkg =
      packageName.trim().replace(/[^a-zA-Z0-9_.]/g, '') || 'com.mushaf.jamee';
    const cleanSha = sha256Input.trim().toUpperCase();
    return JSON.stringify(
      [
        {
          relation: ['delegate_permission/common.handle_all_urls'],
          target: {
            namespace: 'android_app',
            package_name: cleanPkg,
            sha256_cert_fingerprints: [cleanSha],
          },
        },
      ],
      null,
      2
    );
  }, [packageName, sha256Input]);

  const runReadinessChecks = async () => {
    setChecking(true);
    const results: ReadinessItem[] = [];

    const isHttps =
      typeof window !== 'undefined' &&
      (window.location.protocol === 'https:' ||
        window.location.hostname === 'localhost');
    results.push({
      id: 'https',
      label: 'بروتوكول HTTPS الآمن',
      passed: isHttps,
      detail: isHttps
        ? 'الموقع يعمل عبر HTTPS ومقبول لدى المتاجر'
        : 'يتطلب النشر رابط HTTPS فعلي',
    });

    const hasSw =
      typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
    let swActive = false;
    if (hasSw) {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        swActive = Boolean(reg);
      } catch {
        swActive = false;
      }
    }
    results.push({
      id: 'sw',
      label: 'خدمة العمل دون إنترنت (Service Worker)',
      passed: hasSw && swActive,
      detail: swActive
        ? 'مفعّلة وتعمل في الخلفية'
        : hasSw
        ? 'مدعومة وستتفعّل بعد تحميل الصفحات'
        : 'غير مدعومة في هذا المتصفح',
    });

    const probeAsset = async (
      id: string,
      label: string,
      url: string,
      okDetail: string,
      failDetail: string
    ) => {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        results.push({
          id,
          label,
          passed: res.ok,
          detail: res.ok ? okDetail : failDetail,
        });
      } catch {
        results.push({
          id,
          label,
          passed: false,
          detail: failDetail,
        });
      }
    };

    await Promise.all([
      probeAsset(
        'manifest',
        'ملف Web App Manifest',
        '/manifest.webmanifest',
        'مكتمل ومزود بالأيقونات والاختصارات',
        'تحقق من ملف manifest بعد البناء'
      ),
      probeAsset(
        'icons',
        'أيقونات المتاجر (192px و 512px و Maskable)',
        '/pwa-maskable-512x512.png',
        'متوفرة بمقاسات أندرويد و iOS المطلوبة',
        'تأكد من وجود ملفات الأيقونات داخل public'
      ),
      probeAsset(
        'privacy',
        'صفحة سياسة الخصوصية (/privacy.html)',
        '/privacy.html',
        'متاحة للوصول المباشر لمراجعي المتاجر',
        'لم يتم العثور على صفحة الخصوصية'
      ),
      probeAsset(
        'assetlinks',
        'ملف توثيق أندرويد (.well-known/assetlinks.json)',
        '/.well-known/assetlinks.json',
        'جاهز — حدّث بصمة SHA-256 عند التوقيع',
        'لم يتم العثور على assetlinks.json'
      ),
    ]);

    setChecks(results);
    setChecking(false);
  };

  useEffect(() => {
    if (open && authorized) {
      void runReadinessChecks();
    }
  }, [open, authorized]);

  if (!authorized) return null;

  const copyText = (text: string, label: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => onShowToast(`تم نسخ ${label}`))
      .catch(() => onShowToast('تعذر النسخ التلقائي'));
  };

  const storeShortDesc =
    'المصحف الشريف بالرسم العثماني، التلاوات، التفسير، مواقيت الصلاة، الأذكار واختبار الحفظ.';
  const storeLongDesc = `تطبيق «المصحف الجامع» رفيقك اليومي لقراءة القرآن الكريم بالرسم العثماني وتدبّر آياته بيسر وطمأنينة، ويعمل دون إنترنت.

أبرز المزايا:
• قراءة القرآن الكريم كاملاً بنمط الآيات أو صفحات مصحف المدينة (٦٠٤ صفحات) مع التفسير الميسر والجلالين.
• الاستماع لأكثر من ١٧٠ قارئاً مع التكرار والوضع الليلي للتحفيظ.
• اختبار الحفظ التفاعلي لاختيار أي سورة أو جزء بإخفاء كلمات أو الآية كاملة مع سجل إنجاز ونقاط.
• مواقيت الصلاة الدقيقة حسب موقعك مع أصوات الأذان، واتجاه القبلة الشريفة.
• إدارة ختمات متعددة وتنظيم الورد اليومي والختمات الجماعية مع الأهل والأصدقاء.
• أذكار الصباح والمساء، حصن المسلم، جوامع الدعاء، السبحة الإلكترونية، وقصص الأنبياء كاملة.`;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="store-publish-modal-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-md"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-3xl ios-glass-card shadow-2xl border border-white/50 dark:border-white/15 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-4 px-6 py-5 border-b border-stone-200/70 dark:border-white/10 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-[#14532D]/12 dark:bg-emerald-500/20 text-[#14532D] dark:text-emerald-300 flex items-center justify-center shrink-0">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h2
                    id="store-publish-modal-title"
                    className="font-amiri text-2xl font-bold text-stone-900 dark:text-stone-100"
                  >
                    تجهيز ونشر التطبيق على المتاجر
                  </h2>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    Google Play Store · Apple App Store · Microsoft Store
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="إغلاق"
                className="ios-spring min-h-[44px] min-w-[44px] rounded-xl ios-glass-input flex items-center justify-center text-stone-600 dark:text-stone-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto px-6 py-5 space-y-6">
              {/* 1. Live Readiness Audit */}
              <section className="rounded-2xl ios-glass-input p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-bold text-[#14532D] dark:text-emerald-300">
                    <ShieldCheck className="w-4 h-4" />
                    <span>فحص جاهزية النشر على المتاجر</span>
                  </div>
                  <button
                    type="button"
                    disabled={checking}
                    onClick={() => void runReadinessChecks()}
                    className="ios-spring inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/80 dark:bg-stone-900/80 text-xs font-medium text-stone-700 dark:text-stone-200"
                  >
                    {checking ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    <span>إعادة الفحص</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {checks.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl bg-white/70 dark:bg-stone-900/60 border border-stone-200/70 dark:border-white/10 p-3 flex items-start gap-2.5"
                    >
                      {item.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400 mt-0.5 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-stone-900 dark:text-stone-100">
                          {item.label}
                        </div>
                        <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                          {item.detail}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* 2. Key URLs Needed By Stores */}
              <section className="rounded-2xl ios-glass-input p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-stone-900 dark:text-stone-100">
                  <Globe className="w-4 h-4 text-[#14532D] dark:text-emerald-300" />
                  <span>الروابط الأساسية المطلوبة في لوحة تحكم المتاجر</span>
                </div>

                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/70 dark:bg-stone-900/60 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                        رابط التطبيق الرسمي (Shared HTTPS URL):
                      </div>
                      <div
                        dir="ltr"
                        className="text-xs text-stone-500 dark:text-stone-400 truncate text-right"
                      >
                        {APP_SHARE_URL}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyText(APP_SHARE_URL, 'رابط التطبيق')}
                      className="ios-spring min-h-[44px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#14532D] text-white text-xs font-medium shrink-0"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>نسخ الرابط</span>
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/70 dark:bg-stone-900/60 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                        رابط سياسة الخصوصية الإلزامي (Privacy Policy URL):
                      </div>
                      <div
                        dir="ltr"
                        className="text-xs text-stone-500 dark:text-stone-400 truncate text-right"
                      >
                        {privacyPolicyUrl}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href="/privacy.html"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ios-spring min-h-[44px] inline-flex items-center gap-1 px-3 py-1.5 rounded-xl ios-glass-input text-xs font-medium text-[#14532D] dark:text-emerald-300"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>معاينة</span>
                      </a>
                      <button
                        type="button"
                        onClick={() =>
                          copyText(privacyPolicyUrl, 'رابط سياسة الخصوصية')
                        }
                        className="ios-spring min-h-[44px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#14532D] text-white text-xs font-medium"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>نسخ</span>
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              {/* 3. Store Packaging Paths */}
              <section className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  {(
                    [
                      { id: 'google_play' as StoreTab, label: 'متجر Google Play (أندرويد)' },
                      { id: 'apple_store' as StoreTab, label: 'متجر Apple App Store (آيفون)' },
                      { id: 'microsoft_other' as StoreTab, label: 'Microsoft Store و AppGallery' },
                    ]
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveStore(tab.id)}
                      className={`ios-spring min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold ${
                        activeStore === tab.id
                          ? 'bg-[#14532D] dark:bg-emerald-700 text-white'
                          : 'ios-glass-input text-stone-700 dark:text-stone-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {activeStore === 'google_play' && (
                  <div className="rounded-2xl ios-glass-input p-5 space-y-4">
                    <div className="flex items-center gap-2 text-sm font-bold text-[#14532D] dark:text-emerald-300">
                      <Smartphone className="w-4 h-4" />
                      <span>أسهل طريقتين للنشر على Google Play Store</span>
                    </div>

                    <div className="space-y-2 text-xs text-stone-700 dark:text-stone-300 leading-relaxed">
                      <p className="font-semibold text-stone-900 dark:text-stone-100">
                        الطريقة ١ (الأسرع بدون برمجة إضافية — عبر PWABuilder TWA):
                      </p>
                      <ol className="list-decimal list-inside space-y-1.5">
                        <li>
                          انشر التطبيق أولاً عبر زر النشر للحصول على الرابط العام الثابت ثم انسخ رابط التطبيق أعلاه.
                        </li>
                        <li>
                          افتح{' '}
                          <a
                            href="https://www.pwabuilder.com/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#14532D] dark:text-emerald-300 underline font-semibold"
                          >
                            PWABuilder.com
                          </a>{' '}
                          والصق الرابط ثم اختر <strong>Package for Stores &gt; Android (Google Play)</strong>.
                        </li>
                        <li>
                          حدّد معرف الحزمة (<span dir="ltr">com.mushaf.jamee</span>) ونزّل حزمة <strong>.aab</strong> الموقّعة وارفعها إلى <strong>Google Play Console</strong>.
                        </li>
                        <li>
                          انسخ بصمة <strong>SHA-256</strong> من Google Play App Signing أو ملف <code>assetlinks.json</code> المرفق مع PWABuilder وضعها في الأسفل لتحديث <code>public/.well-known/assetlinks.json</code> لإخفاء شريط المتصفح داخل تطبيق الأندرويد.
                        </li>
                      </ol>
                    </div>

                    <div className="rounded-xl bg-white/70 dark:bg-stone-900/60 p-3.5 space-y-2.5 border border-stone-200/70 dark:border-white/10">
                      <div className="text-xs font-semibold text-stone-800 dark:text-stone-200">
                        الطريقة ٢ (بناء أصلي عبر Capacitor الجاهز في المشروع):
                      </div>
                      <div className="flex items-center justify-between gap-2 rounded-lg bg-stone-900 text-emerald-300 p-2.5 text-[11px]" dir="ltr">
                        <code>npm run build &amp;&amp; npm i @capacitor/core @capacitor/cli @capacitor/android &amp;&amp; npx cap add android &amp;&amp; npx cap open android</code>
                        <button
                          type="button"
                          onClick={() =>
                            copyText(
                              'npm run build && npm i @capacitor/core @capacitor/cli @capacitor/android && npx cap add android && npx cap open android',
                              'أمر Capacitor للأندرويد'
                            )
                          }
                          className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white shrink-0"
                          aria-label="نسخ الأمر"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Digital Asset Links Builder */}
                    <div className="rounded-xl bg-white/70 dark:bg-stone-900/60 p-4 space-y-3 border border-stone-200/70 dark:border-white/10">
                      <div className="flex items-center gap-2 text-xs font-bold text-[#9A742E] dark:text-amber-400">
                        <FileCheck2 className="w-4 h-4" />
                        <span>مُولّد ملف توثيق الدومين (assetlinks.json)</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <input
                          type="text"
                          dir="ltr"
                          value={packageName}
                          onChange={(e) => setPackageName(e.target.value)}
                          placeholder="com.mushaf.jamee"
                          className="px-3 py-2 rounded-xl ios-glass-input text-xs text-stone-900 dark:text-stone-100"
                        />
                        <input
                          type="text"
                          dir="ltr"
                          value={sha256Input}
                          onChange={(e) => setSha256Input(e.target.value)}
                          placeholder="SHA-256 fingerprint from Play Console"
                          className="px-3 py-2 rounded-xl ios-glass-input text-xs text-stone-900 dark:text-stone-100"
                        />
                      </div>
                      <pre
                        dir="ltr"
                        className="rounded-xl bg-stone-950 text-stone-100 p-3 text-[11px] overflow-x-auto"
                      >
                        {generatedAssetLinksJson}
                      </pre>
                      <button
                        type="button"
                        onClick={() =>
                          copyText(generatedAssetLinksJson, 'محتوى assetlinks.json')
                        }
                        className="ios-spring min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#14532D] text-white text-xs font-medium"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>نسخ assetlinks.json المحدّث</span>
                      </button>
                    </div>
                  </div>
                )}

                {activeStore === 'apple_store' && (
                  <div className="rounded-2xl ios-glass-input p-5 space-y-3.5">
                    <div className="flex items-center gap-2 text-sm font-bold text-[#14532D] dark:text-emerald-300">
                      <Package className="w-4 h-4" />
                      <span>خطوات النشر على متجر Apple App Store (iPhone و iPad)</span>
                    </div>
                    <ol className="text-xs text-stone-700 dark:text-stone-300 space-y-2 list-decimal list-inside leading-relaxed">
                      <li>
                        يتطلب متجر آبل حساب مطور في <strong>Apple Developer Program</strong> وجهاز Mac عليه برنامج <strong>Xcode</strong> لتوقيع وبناء تطبيق iOS.
                      </li>
                      <li>
                        تم تجهيز ملف الإعداد <code>capacitor.config.json</code> بمعرف <code>com.mushaf.jamee</code> وأيقونة <code>apple-touch-icon.png</code> لفتح المشروع مباشرة على iOS:
                      </li>
                    </ol>
                    <div className="flex items-center justify-between gap-2 rounded-xl bg-stone-900 text-emerald-300 p-3 text-[11px]" dir="ltr">
                      <code>npm run build &amp;&amp; npm i @capacitor/core @capacitor/cli @capacitor/ios &amp;&amp; npx cap add ios &amp;&amp; npx cap open ios</code>
                      <button
                        type="button"
                        onClick={() =>
                          copyText(
                            'npm run build && npm i @capacitor/core @capacitor/cli @capacitor/ios && npx cap add ios && npx cap open ios',
                            'أمر Capacitor للآيفون'
                          )
                        }
                        className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white shrink-0"
                        aria-label="نسخ الأمر"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
                      بعد فتح Xcode: فعّل قدرات الموقع الجغرافي (Location When In Use) والإشعارات، ثم اختر <strong>Product &gt; Archive</strong> وارفع الحزمة إلى <strong>App Store Connect</strong> مع رابط سياسة الخصوصية أعلاه.
                    </p>
                  </div>
                )}

                {activeStore === 'microsoft_other' && (
                  <div className="rounded-2xl ios-glass-input p-5 space-y-3 text-xs text-stone-700 dark:text-stone-300 leading-relaxed">
                    <div className="text-sm font-bold text-[#14532D] dark:text-emerald-300">
                      النشر على Microsoft Store و Huawei AppGallery
                    </div>
                    <ul className="list-disc list-inside space-y-2">
                      <li>
                        <strong>Microsoft Store (ويندوز ١٠ و ١١):</strong> ادخل إلى PWABuilder والصق رابط التطبيق ثم اختر حزمة <strong>Windows (.msix)</strong> وارفعها في <strong>Microsoft Partner Center</strong> (يعمل التطبيق كتطبيق سطح مكتب كامل بدون إنترنت).
                      </li>
                      <li>
                        <strong>Huawei AppGallery و Amazon Appstore:</strong> يمكنك رفع نفس ملف الحزمة المولّد من Capacitor أو PWABuilder مباشرة دون الحاجة لتعديل الكود، مع إرفاق رابط سياسة الخصوصية.
                      </li>
                    </ul>
                  </div>
                )}
              </section>

              {/* 4. Store Listing Copy Ready to Paste */}
              <section className="rounded-2xl ios-glass-input p-4 space-y-3">
                <div className="text-sm font-bold text-stone-900 dark:text-stone-100">
                  نصوص بطاقة التطبيق الجاهزة لمتاجر التطبيقات
                </div>

                <div className="space-y-2 text-xs">
                  <div className="rounded-xl bg-white/70 dark:bg-stone-900/60 p-3 flex items-center justify-between gap-2">
                    <div>
                      <span className="font-semibold text-stone-800 dark:text-stone-200">
                        الوصف القصير (أقل من ٨٠ حرفاً):{' '}
                      </span>
                      <span className="text-stone-600 dark:text-stone-400">
                        {storeShortDesc}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyText(storeShortDesc, 'الوصف القصير')}
                      className="ios-spring px-3 py-1.5 rounded-lg ios-glass-input text-xs font-medium shrink-0"
                    >
                      نسخ
                    </button>
                  </div>

                  <div className="rounded-xl bg-white/70 dark:bg-stone-900/60 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-stone-800 dark:text-stone-200">
                        الوصف الكامل للمتجر:
                      </span>
                      <button
                        type="button"
                        onClick={() => copyText(storeLongDesc, 'الوصف الكامل')}
                        className="ios-spring px-3 py-1.5 rounded-lg ios-glass-input text-xs font-medium shrink-0"
                      >
                        نسخ الوصف
                      </button>
                    </div>
                    <p className="text-stone-600 dark:text-stone-400 whitespace-pre-line leading-relaxed">
                      {storeLongDesc}
                    </p>
                  </div>
                </div>
              </section>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
