import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    // App shell is cached by a service worker so the field UI opens with no connection.
    VitePWA({
      registerType: 'autoUpdate',
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'], navigateFallback: '/index.html' },
      manifest: {
        name: 'Rounds — offline field inspections',
        short_name: 'Rounds',
        theme_color: '#1f6feb',
        background_color: '#0f1215',
        display: 'standalone',
        icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
    }),
  ],
  server: { port: 5173, fs: { allow: ['..'] } },

});
