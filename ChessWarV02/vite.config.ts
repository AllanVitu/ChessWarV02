import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { VitePWA } from 'vite-plugin-pwa'
import { visualizer } from 'rollup-plugin-visualizer'

const resolveBase = () => {
  const explicit = process.env.VITE_BASE ?? process.env.BASE_URL
  if (explicit) {
    return explicit.endsWith('/') ? explicit : `${explicit}/`
  }

  if (process.env.NETLIFY) {
    return '/'
  }

  const repo = process.env.GITHUB_REPOSITORY?.split('/')[1]
  if (!repo) {
    return './'
  }

  if (repo.endsWith('.github.io')) {
    return '/'
  }

  return `/${repo}/`
}

const resolveOutDir = () => {
  if (process.env.NETLIFY) {
    return 'dist'
  }
  return process.env.VITE_OUT_DIR ?? 'docs'
}

const isAnalyze = Boolean(process.env.ANALYZE)

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  base: command === 'serve' ? '/' : resolveBase(),
  build: {
    target: 'es2022',
    treeshake: true,
    assetsInlineLimit: 8192,
    chunkSizeWarningLimit: 220,
    outDir: resolveOutDir(),
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalized = id.replace(/\\/g, '/')
          if (normalized.includes('node_modules')) {
            if (
              normalized.includes('vue') ||
              normalized.includes('pinia') ||
              normalized.includes('vue-router')
            ) {
              return 'vendor-vue'
            }
          }
          if (normalized.includes('src/lib/chessEngine')) {
            return 'engine'
          }
        },
      },
    },
  },
  plugins: [
    vue(),
    vueDevTools(),
    VitePWA({
      strategies: 'generateSW',
      injectRegister: null, // conserve le register manuel dans main.ts
      filename: 'sw.js',
      registerType: 'prompt',
      manifest: false,
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon-512.png', 'robots.txt'],
      workbox: {
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 6,
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 5 },
            },
          },
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
    isAnalyze
      ? visualizer({
          filename: 'dist/stats.html',
          gzipSize: true,
          brotliSize: true,
          open: false,
        })
      : null,
  ].filter(Boolean),
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
}))
