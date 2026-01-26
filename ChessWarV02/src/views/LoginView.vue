<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { loginUser } from '@/lib/auth'
import { startGuestSession } from '@/lib/guest'
import { notifyError, notifyInfo, notifySuccess } from '@/lib/toast'
import { trackEvent } from '@/lib/telemetry'

const router = useRouter()
const email = ref('')
const password = ref('')
const showPassword = ref(false)
const message = ref('')
const isError = ref(false)
const isLoading = ref(false)
const authPageRef = ref<HTMLElement | null>(null)

const dailyStats = [
  '53% de victoires sur les parties rapides.',
  'Ouverture la plus jouee : Italienne.',
  'Moyenne de 32 coups par partie.',
  'Taux de precision moyen : 87%.',
  'Meilleure serie recente : 4 victoires.',
]

const dailyStat = computed(() => {
  const now = new Date()
  const seed = now.getFullYear() + now.getMonth() * 31 + now.getDate()
  return dailyStats[seed % dailyStats.length]
})

const activePlayers = computed(() => {
  const now = new Date()
  const wave = Math.sin((now.getHours() / 24) * Math.PI * 2)
  return Math.round(140 + wave * 35)
})

let parallaxFrame = 0
let pendingX = 0
let pendingY = 0
let parallaxEnabled = false

const applyParallax = () => {
  parallaxFrame = 0
  if (!authPageRef.value) return
  authPageRef.value.style.setProperty('--parallax-x', `${pendingX}px`)
  authPageRef.value.style.setProperty('--parallax-y', `${pendingY}px`)
}

const handlePointerMove = (event: PointerEvent) => {
  if (!authPageRef.value) return
  const rect = authPageRef.value.getBoundingClientRect()
  const relX = (event.clientX - rect.left) / rect.width - 0.5
  const relY = (event.clientY - rect.top) / rect.height - 0.5
  const maxOffset = 24
  pendingX = relX * maxOffset * 2
  pendingY = relY * maxOffset * 2
  if (!parallaxFrame) {
    parallaxFrame = window.requestAnimationFrame(applyParallax)
  }
}

const resetParallax = () => {
  pendingX = 0
  pendingY = 0
  if (!parallaxFrame) {
    parallaxFrame = window.requestAnimationFrame(applyParallax)
  }
}

const handleLogin = async () => {
  message.value = ''
  isError.value = false
  isLoading.value = true

  const result = await loginUser(email.value, password.value)
  isLoading.value = false
  message.value = result.message
  isError.value = !result.ok

  if (result.ok) {
    notifySuccess('Connexion reussie', result.message)
    trackEvent({ name: 'login' })
    await router.push('/dashboard')
    return
  }

  if (result.message) {
    notifyError('Connexion refusee', result.message)
  }
}

const handleGuest = async () => {
  startGuestSession()
  notifyInfo('Mode invite', "Vous jouez en local sans compte.")
  trackEvent({ name: 'login_guest' })
  await router.push('/dashboard')
}

onMounted(() => {
  if (typeof window === 'undefined') return
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const finePointer = window.matchMedia('(pointer: fine)').matches
  if (reducedMotion || !finePointer) return
  if (!authPageRef.value) return
  parallaxEnabled = true
  authPageRef.value.addEventListener('pointermove', handlePointerMove)
  authPageRef.value.addEventListener('pointerleave', resetParallax)
})

onBeforeUnmount(() => {
  if (parallaxFrame) {
    window.cancelAnimationFrame(parallaxFrame)
  }
  if (parallaxEnabled && authPageRef.value) {
    authPageRef.value.removeEventListener('pointermove', handlePointerMove)
    authPageRef.value.removeEventListener('pointerleave', resetParallax)
  }
})
</script>

<template>
  <div ref="authPageRef" class="auth-page auth-page--solo">
    <div class="auth-wordmark" aria-hidden="true"></div>
    <div class="auth-silhouette auth-silhouette--pawn" aria-hidden="true"></div>
    <div class="auth-silhouette auth-silhouette--knight" aria-hidden="true"></div>
    <div class="auth-orbit">
      <div class="auth-halo" aria-hidden="true"></div>
      <div class="panel auth-card auth-card--orbit">
        <div class="auth-stack">
          <p class="eyebrow">Connexion</p>
          <p class="auth-kicker">Retour sur le plateau</p>
          <h1 class="auth-title">Reprendre votre partie</h1>
          <p class="subhead auth-subhead">
            Accedez a vos matchs en cours, vos invites d'amis et vos analyses.
          </p>
          <div class="auth-status">
            <span class="status-dot" aria-hidden="true"></span>
            <span>Serveur en ligne</span>
            <span class="auth-status-count">{{ activePlayers }} joueurs actifs</span>
          </div>

          <form class="form-stack auth-form" @submit.prevent="handleLogin">
            <label class="form-field">
              <span class="form-label">Email</span>
              <input
                v-model="email"
                class="form-input"
                type="email"
                autocomplete="email"
                inputmode="email"
                placeholder="vous@exemple.com"
              />
            </label>

            <label class="form-field">
              <span class="form-label">Mot de passe</span>
              <div class="auth-input">
                <input
                  v-model="password"
                  class="form-input"
                  :type="showPassword ? 'text' : 'password'"
                  autocomplete="current-password"
                  placeholder="********"
                />
                <button
                  class="auth-toggle"
                  type="button"
                  :aria-pressed="showPassword"
                  :aria-label="showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'"
                  @click="showPassword = !showPassword"
                >
                  {{ showPassword ? 'Masquer' : 'Afficher' }}
                </button>
              </div>
            </label>

            <button class="button-primary" type="submit" :disabled="isLoading" :aria-busy="isLoading">
              {{ isLoading ? 'Connexion...' : 'Se connecter' }}
            </button>
            <button class="button-ghost" type="button" @click="handleGuest">Jouer en invite</button>
            <div v-if="isLoading" class="auth-progress" aria-hidden="true">
              <span class="auth-progress__bar"></span>
            </div>
            <p class="auth-note">Connexion securisee et synchronisee sur tous vos appareils.</p>
          </form>

          <p
            v-if="message"
            :class="['form-message', isError ? 'form-message--error' : 'form-message--success']"
            role="status"
          >
            {{ message }}
          </p>

          <div class="auth-stat">
            <span class="auth-stat-label">Stat du jour</span>
            <span class="auth-stat-value">{{ dailyStat }}</span>
          </div>

          <div class="auth-chips">
            <div class="auth-chip">
              <span class="auth-chip-dot auth-chip-dot--match"></span>
              Matchs amis
            </div>
            <div class="auth-chip">
              <span class="auth-chip-dot auth-chip-dot--analysis"></span>
              Analyse IA
            </div>
            <div class="auth-chip">
              <span class="auth-chip-dot auth-chip-dot--rank"></span>
              Classements
            </div>
          </div>

          <div class="auth-links">
            <RouterLink to="/mot-de-passe-oublie">Mot de passe oublie ?</RouterLink>
            <RouterLink to="/inscription">Creer un compte</RouterLink>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
