/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: true,
    allowedHosts: [
      '8c05-41-202-219-74.ngrok-free.app' // Autorise ton URL ngrok actuelle
    ]
  },
  build: {
    // Phase 8 — explicit manual chunks to keep the main bundle under 250 KB.
    // The previous build emitted a 502 KB index.js because recharts + framer-motion
    // were bundled together. Splitting them lets the browser cache them once.
    rollupOptions: {
      output: {
        // A single React-runtime chunk keeps react / react-dom / scheduler and
        // every React-coupled lib together. Manually splitting them into many
        // vendor chunks created a cross-chunk initialisation cycle that read
        // `React.memo` before React was defined → white screen in production.
        manualChunks: {
          'vendor-react': [
            'react', 'react-dom', 'react-dom/client', 'scheduler',
            'react-router', 'react-router-dom',
            '@tanstack/react-query', '@emotion/react',
          ],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  test: {
    // Vitest runs in jsdom so React components can mount in tests.
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // Only collect unit/component tests under src/ — the Playwright specs in
    // e2e/ use @playwright/test and must NOT be picked up by Vitest.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
    coverage: {
      reporter: ['text', 'json-summary'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.d.ts', 'src/main.tsx', 'src/test/**'],
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
      manifest: {
        name: 'Globus Engineering — ERP & Portail Client',
        short_name: 'Globus',
        description: "Plateforme de suivi de chantier et de gestion d'entreprise BTP",
        theme_color: '#1a365d',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'any',
        scope: '/',
        start_url: '/',
        lang: 'fr',
        categories: ['business', 'productivity'],
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
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          {
            name: 'Espace Client',
            short_name: 'Client',
            description: "Accéder au portail client",
            url: '/espace-client',
            icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }],
          },
          {
            name: 'ERP',
            short_name: 'ERP',
            description: "Tableau de bord ERP",
            url: '/erp',
            icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }],
          },
        ],
      },
      workbox: {
        // Pre-cache app shell + immutable assets
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        // Skip very large precache entries (BIM viewer is loaded from CDN)
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          // Public CMS GETs — fast stale-while-revalidate
          {
            urlPattern: /\/api\/v1\/cms\/.*$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'cms-api',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Static uploads (project photos, signed docs)
          {
            urlPattern: /\/uploads\/.*\.(?:png|jpg|jpeg|webp|svg|gif)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'uploads-images',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // External Autodesk viewer assets (heavy, immutable per version)
          {
            urlPattern: /^https:\/\/developer\.api\.autodesk\.com\/modelderivative\//i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'autodesk-viewer',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Google Fonts
          {
            urlPattern: /^https:\/\/fonts\.(?:gstatic|googleapis)\.com\//i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
        // Don't intercept the auth or WebSocket calls
        navigateFallbackDenylist: [/^\/api\//, /^\/ws\//, /^\/health/, /^\/uploads\//],
      },
    })
  ],
})
