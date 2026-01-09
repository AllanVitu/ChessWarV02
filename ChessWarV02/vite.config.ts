import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

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

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  base: command === 'serve' ? '/' : resolveBase(),
  build: {
    outDir: resolveOutDir(),
  },
  plugins: [
    vue(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
}))
