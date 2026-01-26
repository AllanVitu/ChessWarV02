import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { ensureDatabaseReady } from './lib/database'
import { applyPreferences, loadPreferences } from './lib/preferences'
import { setupSeo } from './lib/seo'
import { setupTelemetry } from './lib/telemetry'

void ensureDatabaseReady()

applyPreferences(loadPreferences())

const app = createApp(App)

app.use(createPinia())
app.use(router)

setupSeo(router)
setupTelemetry(router)

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
