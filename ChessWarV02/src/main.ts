import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { ensureDatabaseReady } from './lib/database'
import { applyPreferences, loadPreferences } from './lib/preferences'
import { setupSeo } from './lib/seo'
import { setupTelemetry } from './lib/telemetry'
import { setupOfflineQueueSync } from './lib/offlineQueue'
import { expireSession } from './lib/auth'
import { setupObservability } from './lib/observability'

void ensureDatabaseReady()

applyPreferences(loadPreferences())

const app = createApp(App)

app.use(createPinia())
app.use(router)

setupSeo(router)
setupTelemetry(router)
setupObservability(router)
setupOfflineQueueSync()

app.mount('#app')

if (typeof document !== 'undefined') {
  document.documentElement.classList.add('app-ready')
  const loader = document.getElementById('app-loader')
  if (loader) {
    loader.setAttribute('aria-hidden', 'true')
    window.setTimeout(() => {
      loader.remove()
    }, 350)
  }
}

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

if (typeof window !== 'undefined') {
  window.addEventListener('auth:expired', () => {
    const current = router.currentRoute.value
    if (current.path.startsWith('/auth')) return
    try {
      window.sessionStorage.setItem('warchess.postLoginRedirect', current.fullPath)
    } catch {
      // Ignore storage failures.
    }
    expireSession()
    void router.push({ path: '/auth', query: { reason: 'expired' } })
  })
}
