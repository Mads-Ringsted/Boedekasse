import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts', // built to /sw.js; never rename it
      registerType: 'prompt',
      injectRegister: false, // UpdatePrompt registers via virtual:pwa-register/react
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
      },
      includeManifestIcons: false, // globPatterns already precaches public/
      manifest: {
        id: '/',
        scope: '/',
        start_url: '/',
        name: 'Bødekasse',
        short_name: 'Bødekasse',
        lang: 'da',
        dir: 'ltr',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F2F3F8',
        theme_color: '#F2F3F8',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'maskable-icon-1024x1024.png',
            sizes: '1024x1024',
            type: 'image/png',
            purpose: 'maskable',
          },
          { src: 'app-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      devOptions: {
        enabled: false,
        type: 'module',
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts'],
  },
});
