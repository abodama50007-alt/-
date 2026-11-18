import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'favicon.ico',
          'apple-touch-icon.png',
          'icon.svg',
          'privacy.html',
          '.well-known/assetlinks.json',
          'widgets/prayer-widget-template.json',
          'widgets/prayer-data.json',
        ],
        manifest: {
          id: '/',
          name: 'المصحف الجامع — القرآن الكريم',
          short_name: 'المصحف',
          description:
            'تطبيق قرآني متكامل يعمل دون إنترنت لقراءة القرآن الكريم بالرسم العثماني، التفسير، مواقيت الصلاة، القبلة، والأذكار.',
          theme_color: '#14532D',
          background_color: '#F5EFE2',
          display: 'standalone',
          orientation: 'any',
          prefer_related_applications: false,
          categories: ['books', 'education', 'lifestyle'],
          start_url: '/',
          scope: '/',
          dir: 'rtl',
          lang: 'ar',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
          shortcuts: [
            {
              name: 'قراءة المصحف الشريف',
              short_name: 'المصحف',
              description: 'فتح قارئ القرآن الكريم بالرسم العثماني',
              url: '/',
              icons: [{ src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
            },
            {
              name: 'ودجيت التاريخ ومواقيت الصلاة',
              short_name: 'الودجيت',
              description: 'عرض التاريخ الهجري والميلادي ومواقيت الصلاة كودجيت',
              url: '/?mode=widget',
              icons: [{ src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
            },
            {
              name: 'الأذكار والتسبيح',
              short_name: 'الأذكار',
              description: 'أذكار الصباح والمساء والسبحة الإلكترونية',
              url: '/?section=azkar',
              icons: [{ src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
            },
            {
              name: 'اختبار الحفظ والمسابقات',
              short_name: 'الحفظ',
              description: 'اختبر حفظك للقرآن الكريم وتنافس مع الأصدقاء',
              url: '/?section=competitions',
              icons: [{ src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
            },
          ],
          ...({
            widgets: [
              {
                name: 'ودجيت التاريخ ومواقيت الصلاة',
                short_name: 'الصلاة والتاريخ',
                description:
                  'يعرض التاريخ الهجري والميلادي ومواقيت الصلاة الخمس والعد التنازلي للصلاة القادمة.',
                tag: 'prayer-date-widget',
                ms_ac_template: '/widgets/prayer-widget-template.json',
                data: '/widgets/prayer-data.json',
                type: 'application/json',
                auth: false,
                update: 1800,
                icons: [
                  {
                    src: '/pwa-192x192.png',
                    sizes: '192x192',
                    type: 'image/png',
                  },
                ],
                screenshots: [
                  {
                    src: '/pwa-512x512.png',
                    sizes: '512x512',
                    label: 'ودجيت التاريخ الهجري ومواقيت الصلاة',
                  },
                ],
              },
            ],
          } as Record<string, unknown>),
        },
        workbox: {
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,json}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 30,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/api\.alquran\.cloud\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'alquran-api-cache',
                expiration: {
                  maxEntries: 800,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/api\.aladhan\.com\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'aladhan-prayer-cache',
                networkTimeoutSeconds: 4,
                expiration: {
                  maxEntries: 60,
                  maxAgeSeconds: 60 * 60 * 24 * 14,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/cdn\.(islamic\.network|aladhan\.com)\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'quran-audio-cache',
                expiration: {
                  maxEntries: 250,
                  maxAgeSeconds: 60 * 60 * 24 * 90,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
