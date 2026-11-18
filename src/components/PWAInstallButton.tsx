import React, { useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useLanguage } from '../i18n/LanguageContext';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  compact = false,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const { t } = useLanguage();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        title={t('installAppTitle')}
        className={`ios-spring inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#14532D]/12 hover:bg-[#14532D]/20 dark:bg-emerald-500/20 dark:hover:bg-emerald-500/30 text-[#14532D] dark:text-emerald-300 font-medium whitespace-nowrap shrink-0 ${
          compact ? 'px-2.5 py-2 text-xs' : 'px-4 py-2.5 text-sm'
        }`}
      >
        <Download className="w-4 h-4 shrink-0" />
        <span className={compact ? 'hidden xl:inline' : ''}>
          {t('installApp')}
        </span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          title={t('installOnIOSTitle')}
          className={`ios-spring inline-flex items-center justify-center gap-1.5 rounded-xl ios-glass-input text-[#14532D] dark:text-emerald-300 font-medium whitespace-nowrap shrink-0 ${
            compact ? 'px-2.5 py-2 text-xs' : 'px-4 py-2.5 text-sm'
          }`}
        >
          <Share className="w-3.5 h-3.5 shrink-0" />
          <span className={compact ? 'hidden xl:inline' : ''}>
            {t('installOnIOS')}
          </span>
        </button>

        {showIOSGuide && (
          <div
            role="dialog"
            aria-modal="true"
            onClick={() => setShowIOSGuide(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/55 backdrop-blur-md p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-3xl ios-glass-card p-6 shadow-2xl space-y-4 text-start"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-amiri text-xl font-bold text-stone-900 dark:text-stone-100">
                  {t('installIOSHeading')}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label={t('close')}
                  className="w-8 h-8 rounded-xl ios-glass-input flex items-center justify-center text-stone-600 dark:text-stone-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ol className="text-sm text-stone-700 dark:text-stone-300 space-y-2 list-decimal list-inside leading-relaxed">
                <li>
                  {t('installIOSStep1Before')}{' '}
                  <strong>{t('installIOSStep1Bold')}</strong>{' '}
                  {t('installIOSStep1After')}
                </li>
                <li>
                  {t('installIOSStep2Before')}{' '}
                  <strong>{t('installIOSStep2Bold')}</strong>
                  {t('installIOSStep2After')}
                </li>
                <li>{t('installIOSStep3')}</li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="ios-spring w-full py-2.5 rounded-xl bg-[#14532D] text-white text-sm font-medium"
              >
                {t('ok')}
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
