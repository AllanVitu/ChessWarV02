<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import AppNavbar from '@/components/ui/AppNavbar.vue'
import IntroLoader from '@/components/ui/IntroLoader.vue'
import logoUrl from '@/assets/brand-icon.png'
import wordmarkUrl from '@/assets/brand-wordmark.png'
import { startGuestSession } from '@/lib/guest'
import { notifyInfo } from '@/lib/toast'
import { trackEvent } from '@/lib/telemetry'
import { preloadAssets, type PreloadProgress, type PreloadResult } from '@/lib/preloadAssets'

type LoaderError = {
  code: string
  message: string
  detail?: string
}

const router = useRouter()
const navItems = [
  { label: 'Matchs', to: '/matchs' },
  { label: 'Classement', to: '/leaderboard' },
  { label: 'Connexion', to: '/auth' },
]

const progress = ref<PreloadProgress>({
  loaded: 0,
  total: 1,
  percent: 0,
  stage: 'initializing',
})
const slow = ref(false)
const error = ref<LoaderError | null>(null)
const ready = ref(false)
const attempt = ref(0)
const lightMode = ref(false)
let slowTimer: ReturnType<typeof setTimeout> | null = null
let abortController: AbortController | null = null
let retryTimer: ReturnType<typeof setTimeout> | null = null

const assets = computed(() => [
  { url: logoUrl, label: 'Logo principal', weight: 1 },
  { url: wordmarkUrl, label: 'Wordmark', weight: 1, heavy: true },
  { url: `${import.meta.env.BASE_URL}android-chrome-512x512.png`, label: 'Icone HD', weight: 1, heavy: true },
])

const showLightMode = computed(() => !lightMode.value)
const isLoading = computed(() => !ready.value && !error.value)

const debugLog = (...args: unknown[]) => {
  if (import.meta.env.DEV) {
    console.debug('[intro]', ...args)
  }
}

const isChunkError = (message: string) =>
  message.includes('ChunkLoadError') || message.includes('Failed to fetch dynamically imported module')

const detectWebglSupport = () => {
  try {
    const canvas = document.createElement('canvas')
    return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
  } catch {
    return false
  }
}

const buildError = (result: PreloadResult) => {
  if (result.ok) return null
  const message = result.error.message || 'Une erreur est survenue.'
  const detail = [result.detail, result.error.stack].filter(Boolean).join('\n')
  return {
    code: result.code,
    message,
    detail: detail || undefined,
  }
}

const startLoading = async () => {
  if (abortController) {
    abortController.abort()
  }
  abortController = new AbortController()
  error.value = null
  ready.value = false
  slow.value = false
  progress.value = { loaded: 0, total: 1, percent: 0, stage: 'initializing' }

  if (slowTimer) clearTimeout(slowTimer)
  slowTimer = setTimeout(() => {
    slow.value = true
  }, 10000)

  const manifest = assets.value.filter((item) => (lightMode.value ? !item.heavy : true))
  debugLog('Preload manifest', manifest)

  const result = await preloadAssets(manifest, {
    signal: abortController.signal,
    onProgress: (next) => {
      progress.value = next
    },
  })

  if (slowTimer) {
    clearTimeout(slowTimer)
    slowTimer = null
  }

  if (result.ok) {
    ready.value = true
    progress.value = { ...progress.value, stage: 'ready', percent: 100 }
    return
  }

  const maybeChunk = result.error.message ? isChunkError(result.error.message) : false
  if (maybeChunk && attempt.value < 1) {
    attempt.value += 1
    retryTimer = setTimeout(() => {
      void startLoading()
    }, 1000)
    return
  }

  error.value = buildError(result)
}

const handleGuest = async () => {
  startGuestSession()
  notifyInfo('Mode invite', "Vous jouez en local sans compte.")
  trackEvent({ name: 'login_guest' })
  await router.push('/dashboard')
}

const handleRetry = () => {
  attempt.value = 0
  void startLoading()
}

const handleLightMode = () => {
  lightMode.value = true
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('warchess.lightMode', '1')
    document.documentElement.classList.add('ui-simple')
  }
  attempt.value = 0
  void startLoading()
}

const handleCopy = async () => {
  if (!error.value) return
  const detail = [
    `code: ${error.value.code}`,
    `message: ${error.value.message}`,
    error.value.detail ? `detail: ${error.value.detail}` : '',
    `userAgent: ${navigator.userAgent}`,
  ]
    .filter(Boolean)
    .join('\n')
  try {
    await navigator.clipboard.writeText(detail)
  } catch {
    // Ignore clipboard failures.
  }
}

const handleBack = async () => {
  await router.push('/intro')
}

const registerGlobalHandlers = () => {
  const handleError = (event: ErrorEvent) => {
    if (!isLoading.value) return
    const message = event.message || 'Erreur inconnue.'
    const code = isChunkError(message) ? 'CHUNK_LOAD_FAILED' : 'RUNTIME_ERROR'
    error.value = { code, message, detail: event.error?.stack }
    abortController?.abort()
  }

  const handleRejection = (event: PromiseRejectionEvent) => {
    if (!isLoading.value) return
    const reason = event.reason instanceof Error ? event.reason : new Error(String(event.reason))
    const message = reason.message || 'Promesse rejetee.'
    const code = isChunkError(message) ? 'CHUNK_LOAD_FAILED' : 'UNHANDLED_REJECTION'
    error.value = { code, message, detail: reason.stack }
    abortController?.abort()
  }

  window.addEventListener('error', handleError)
  window.addEventListener('unhandledrejection', handleRejection)

  return () => {
    window.removeEventListener('error', handleError)
    window.removeEventListener('unhandledrejection', handleRejection)
  }
}

let unregisterHandlers: (() => void) | null = null

onMounted(() => {
  unregisterHandlers = registerGlobalHandlers()

  if (typeof window !== 'undefined') {
    const storedLight = window.localStorage.getItem('warchess.lightMode') === '1'
    if (storedLight) {
      lightMode.value = true
      document.documentElement.classList.add('ui-simple')
    } else {
      document.documentElement.classList.remove('ui-simple')
    }
  }

  const supportsWebgl = detectWebglSupport()
  if (!supportsWebgl && !lightMode.value) {
    error.value = {
      code: 'WEBGL_UNSUPPORTED',
      message: 'Votre navigateur ne supporte pas WebGL.',
      detail: 'Activez l acceleration materielle ou passez en mode leger.',
    }
    slow.value = true
    return
  }

  void startLoading()
})

onBeforeUnmount(() => {
  if (slowTimer) clearTimeout(slowTimer)
  if (retryTimer) clearTimeout(retryTimer)
  if (abortController) abortController.abort()
  if (unregisterHandlers) unregisterHandlers()
})
</script>

<template>
  <IntroLoader
    v-if="!ready || error"
    title="WarChess"
    subtitle="Chargement de l'arene..."
    :percent="progress.percent"
    :stage="progress.stage"
    :current="progress.current"
    :slow="slow"
    :error="error"
    :show-light-mode="showLightMode"
    @retry="handleRetry"
    @light-mode="handleLightMode"
    @copy="handleCopy"
    @back="handleBack"
  />

  <section v-else class="landing-page">
    <AppNavbar :items="navItems" brand-label="WarChess" :brand-logo="logoUrl">
      <template #actions>
        <button class="button-ghost landing-guest" type="button" @click="handleGuest">
          Jouer en invite
        </button>
      </template>
    </AppNavbar>

    <div class="landing-hero">
      <div class="landing-copy">
        <p class="eyebrow">Nouvelle generation</p>
        <h1 class="landing-title">WarChess</h1>
        <p class="landing-subtitle">
          L'arene d'echecs premium pour jouer, progresser et analyser en quelques minutes.
        </p>
        <div class="landing-actions">
          <RouterLink class="button-primary" to="/matchs">Lancer un match</RouterLink>
          <RouterLink class="button-ghost" to="/help">Voir les regles (2 min)</RouterLink>
        </div>
        <div class="landing-proof">
          <div class="landing-proof__item">
            <p class="landing-proof__value">12 480</p>
            <p class="landing-proof__label">parties jouees</p>
          </div>
          <div class="landing-proof__item">
            <p class="landing-proof__value">2 min</p>
            <p class="landing-proof__label">pour demarrer</p>
          </div>
          <div class="landing-proof__item">
            <p class="landing-proof__value">4.9/5</p>
            <p class="landing-proof__label">satisfaction</p>
          </div>
        </div>
      </div>

      <div class="landing-visual">
        <div class="landing-visual__card">
          <p class="panel-title">Live arena</p>
          <h2 class="panel-headline">Match express</h2>
          <p class="panel-sub">
            Tableau fluide, reponse immediate, analyse legere et immersive.
          </p>
          <div class="landing-visual__grid" aria-hidden="true">
            <span v-for="index in 16" :key="index" class="landing-visual__tile"></span>
          </div>
        </div>
        <div class="landing-visual__stats">
          <div class="stat-chip">
            <p class="stat-chip-label">Elo moyen</p>
            <p class="stat-chip-value">1640</p>
          </div>
          <div class="stat-chip">
            <p class="stat-chip-label">Temps moyen</p>
            <p class="stat-chip-value">12 min</p>
          </div>
          <div class="stat-chip">
            <p class="stat-chip-label">Analyse IA</p>
            <p class="stat-chip-value">Temps reel</p>
          </div>
        </div>
      </div>
    </div>

    <section class="landing-features">
      <div class="landing-section">
        <p class="eyebrow">Fonctionnalites</p>
        <h2 class="landing-section__title">Tout pour jouer et progresser</h2>
      </div>
      <div class="landing-cards">
        <article class="feature-card">
          <h3>Parties rapides</h3>
          <p>Lancez un match en quelques secondes avec des cadences adaptees.</p>
        </article>
        <article class="feature-card">
          <h3>Classement vivant</h3>
          <p>Suivez votre progression et comparez-vous a vos amis.</p>
        </article>
        <article class="feature-card">
          <h3>Progression &amp; analyse</h3>
          <p>Statistiques claires, revues de parties et objectifs hebdo.</p>
        </article>
      </div>
    </section>

    <section class="landing-onboarding">
      <div class="landing-section">
        <p class="eyebrow">Demarrage</p>
        <h2 class="landing-section__title">3 etapes pour entrer dans l'arene</h2>
      </div>
      <ol class="landing-steps">
        <li>
          <span class="landing-step__count">01</span>
          <div>
            <h3>Choisir un mode</h3>
            <p>Invite, classe ou local selon votre rythme du jour.</p>
          </div>
        </li>
        <li>
          <span class="landing-step__count">02</span>
          <div>
            <h3>Jouer la partie</h3>
            <p>Interface rapide, feedback instantane, controle total.</p>
          </div>
        </li>
        <li>
          <span class="landing-step__count">03</span>
          <div>
            <h3>Analyser</h3>
            <p>Revoyez vos coups, detectez les patterns, progressez.</p>
          </div>
        </li>
      </ol>
    </section>

    <section class="landing-cta">
      <div>
        <p class="eyebrow">Pret a jouer</p>
        <h2 class="landing-section__title">Decouvrez votre meilleur niveau.</h2>
        <p class="landing-section__text">
          Lancez une partie maintenant ou consultez les regles en 2 minutes.
        </p>
      </div>
      <div class="landing-actions">
        <RouterLink class="button-primary" to="/matchs">Lancer un match</RouterLink>
        <RouterLink class="button-ghost" to="/help">Voir les regles</RouterLink>
      </div>
    </section>

    <footer class="landing-footer">
      <p>WarChess - Arena chess experience</p>
      <div class="landing-footer__links">
        <RouterLink to="/help">Aide</RouterLink>
        <RouterLink to="/auth">Connexion</RouterLink>
      </div>
    </footer>
  </section>
</template>
