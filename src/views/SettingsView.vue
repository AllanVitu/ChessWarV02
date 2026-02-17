<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import DashboardLayout from '@/components/DashboardLayout.vue'
import {
  applyPreferences,
  getDefaultPreferences,
  loadPreferences,
  savePreferences,
} from '@/lib/preferences'
import { notifyError, notifySuccess } from '@/lib/toast'
import { clearApplicationCache } from '@/lib/pwa'

const preferences = reactive(loadPreferences())
const statusMessage = ref('')
const autoSaveStatus = ref('')
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null
let autoSaveReady = false

watch(
  preferences,
  (next) => {
    savePreferences(next)
    applyPreferences(next)

    if (!autoSaveReady) return
    autoSaveStatus.value = 'Sauvegarde automatique...'
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer)
    }
    autoSaveTimer = setTimeout(() => {
      autoSaveStatus.value = 'Sauvegarde automatique terminee.'
    }, 600)
  },
  { deep: true },
)

const boardThemeOptions = ['Theme sable', 'Theme contraste'] as const
const haloThemeOptions = [
  { value: 'blue', label: 'Neon cyan' },
  { value: 'red', label: 'Impact rouge' },
  { value: 'green', label: 'Pulse vert' },
  { value: 'violet', label: 'Shock violet' },
  { value: 'amber', label: 'Arena ambre' },
  { value: 'teal', label: 'Teal tactique' },
  { value: 'slate', label: 'Slate pro' },
] as const

const handleSave = () => {
  savePreferences(preferences)
  applyPreferences(preferences)
  statusMessage.value = 'Parametres enregistres.'
  notifySuccess('Parametres', statusMessage.value)
}

const handleReset = () => {
  const defaults = getDefaultPreferences()
  Object.assign(preferences, defaults)
  savePreferences(preferences)
  applyPreferences(preferences)
  statusMessage.value = 'Parametres reinitialises.'
  notifySuccess('Parametres', statusMessage.value)
}

const handleClearCache = async () => {
  statusMessage.value = ''
  try {
    const result = await clearApplicationCache()
    statusMessage.value = result.message
    if (result.ok) {
      notifySuccess('Cache', result.message)
    } else {
      notifyError('Cache', result.message)
    }
  } catch {
    statusMessage.value = "Impossible de vider le cache de l'application."
    notifyError('Cache', statusMessage.value)
  }
}

onMounted(() => {
  autoSaveReady = true
})
</script>

<template>
  <DashboardLayout
    eyebrow="Parametres"
    title="Parametres"
    subtitle="Composez votre ambiance de jeu et vos preferences."
  >
    <section class="settings-grid">
      <div class="panel settings-card">
        <div class="panel-header">
          <div>
            <p class="panel-title">Preferences generales</p>
            <h3 class="panel-headline">Interface &amp; rythme</h3>
          </div>
        </div>

        <form class="form-stack">
          <div class="setting-list">
            <label class="setting-item">
              <div>
                <p class="setting-label">Mode sombre</p>
                <p class="setting-hint">Palette adaptee pour un confort visuel nocturne.</p>
              </div>
              <input v-model="preferences.darkMode" class="setting-toggle" type="checkbox" />
            </label>

            <label class="setting-item">
              <div>
                <p class="setting-label">Interface simplifiee</p>
                <p class="setting-hint">Masque les panneaux secondaires et epure l'ecran.</p>
              </div>
              <input v-model="preferences.simplifiedUi" class="setting-toggle" type="checkbox" />
            </label>
          </div>

          <label class="form-field">
            <span class="form-label">Affichage plateau</span>
            <select v-model="preferences.boardTheme" class="form-input">
              <option v-for="option in boardThemeOptions" :key="option" :value="option">
                {{ option }}
              </option>
            </select>
          </label>

          <label class="form-field">
            <span class="form-label">Theme broadcast</span>
            <div class="theme-picker" role="radiogroup" aria-label="Couleur du theme">
              <label
                v-for="option in haloThemeOptions"
                :key="option.value"
                class="theme-option"
                :class="[
                  `theme-halo-${option.value}`,
                  preferences.darkMode ? 'theme-dark' : '',
                  preferences.haloTheme === option.value ? 'theme-option--active' : '',
                ]"
              >
                <input
                  v-model="preferences.haloTheme"
                  class="theme-option-input"
                  type="radio"
                  name="haloTheme"
                  :value="option.value"
                />
                <span class="theme-swatch" aria-hidden="true"></span>
                <span class="theme-option-label">{{ option.label }}</span>
              </label>
            </div>
          </label>
        </form>
      </div>

      <div class="panel settings-card">
        <div class="panel-header">
          <div>
            <p class="panel-title">Options en preparation</p>
            <h3 class="panel-headline">Compte et notifications</h3>
          </div>
        </div>

        <p class="subhead">
          Les reglages de langue, fuseau, cadence, notifications et confidentialite seront reactives
          quand les APIs associees seront disponibles.
        </p>
      </div>

      <div class="panel settings-card">
        <div class="panel-header">
          <div>
            <p class="panel-title">Sauvegarde</p>
            <h3 class="panel-headline">Synchronisation locale</h3>
          </div>
        </div>

        <p class="subhead">
          Vos parametres sont sauvegardes localement pour un deploiement statique.
        </p>

        <div class="settings-actions">
          <RouterLink class="button-ghost" to="/perf">Voir diagnostics</RouterLink>
          <button class="button-ghost" type="button" @click="handleClearCache">
            Vider cache app
          </button>
          <button class="button-ghost" type="button" @click="handleReset">Reinitialiser</button>
          <button class="button-primary" type="button" @click="handleSave">Enregistrer</button>
        </div>

        <p v-if="statusMessage" class="form-message form-message--success" role="status">
          {{ statusMessage }}
        </p>
        <p v-else-if="autoSaveStatus" class="form-message form-message--success" role="status">
          {{ autoSaveStatus }}
        </p>
      </div>
    </section>
  </DashboardLayout>
</template>
