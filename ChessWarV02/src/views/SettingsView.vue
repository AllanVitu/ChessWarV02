<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import DashboardLayout from '@/components/DashboardLayout.vue'
import {
  applyPreferences,
  getDefaultPreferences,
  loadPreferences,
  savePreferences,
} from '@/lib/preferences'

const preferences = reactive(loadPreferences())
const statusMessage = ref('')

watch(
  preferences,
  (next) => {
    savePreferences(next)
    applyPreferences(next)
  },
  { deep: true },
)

const languageOptions = ['Francais', 'English', 'Espanol'] as const
const timezoneOptions = ['Europe/Paris', 'Europe/London', 'America/Montreal'] as const
const cadenceOptions = ['10+0 Rapide', '5+0 Blitz', '15+10 Classique'] as const
const boardThemeOptions = ['Theme botanique', 'Theme sable', 'Theme contraste'] as const

const notificationSettings = [
  {
    key: 'matchAlerts',
    label: 'Alertes de match',
    hint: 'Rappels pour les parties planifiees.',
  },
  {
    key: 'matchResults',
    label: 'Resultats de partie',
    hint: 'Resume automatique apres chaque match.',
  },
  {
    key: 'tacticalTips',
    label: 'Conseils tactiques',
    hint: 'Suggestions basees sur vos parties.',
  },
] as const

const privacySettings = [
  {
    key: 'publicProfile',
    label: 'Profil public',
    hint: 'Afficher votre nom et votre Elo.',
  },
  {
    key: 'visibleHistory',
    label: 'Historique visible',
    hint: 'Autoriser les autres a voir vos matchs.',
  },
  {
    key: 'sharedStats',
    label: 'Statistiques partagees',
    hint: 'Afficher les tendances globales.',
  },
] as const

const handleSave = () => {
  savePreferences(preferences)
  applyPreferences(preferences)
  statusMessage.value = 'Parametres enregistres.'
}

const handleReset = () => {
  const defaults = getDefaultPreferences()
  Object.assign(preferences, defaults)
  savePreferences(preferences)
  applyPreferences(preferences)
  statusMessage.value = 'Parametres reinitialises.'
}
</script>

<template>
  <DashboardLayout
    eyebrow="Parametres"
    title="Parametres"
    subtitle="Ajustez votre experience et vos preferences."
  >
    <section class="settings-grid">
      <div class="panel settings-card">
        <div class="panel-header">
          <div>
            <p class="panel-title">Preferences generales</p>
            <h3 class="panel-headline">Interface & rythme</h3>
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
            <span class="form-label">Langue</span>
            <select v-model="preferences.language" class="form-input">
              <option v-for="option in languageOptions" :key="option" :value="option">
                {{ option }}
              </option>
            </select>
          </label>

          <label class="form-field">
            <span class="form-label">Fuseau horaire</span>
            <select v-model="preferences.timezone" class="form-input">
              <option v-for="option in timezoneOptions" :key="option" :value="option">
                {{ option }}
              </option>
            </select>
          </label>

          <label class="form-field">
            <span class="form-label">Cadence favorite</span>
            <select v-model="preferences.cadence" class="form-input">
              <option v-for="option in cadenceOptions" :key="option" :value="option">
                {{ option }}
              </option>
            </select>
          </label>

          <label class="form-field">
            <span class="form-label">Affichage plateau</span>
            <select v-model="preferences.boardTheme" class="form-input">
              <option v-for="option in boardThemeOptions" :key="option" :value="option">
                {{ option }}
              </option>
            </select>
          </label>
        </form>
      </div>

      <div class="panel settings-card">
        <div class="panel-header">
          <div>
            <p class="panel-title">Notifications</p>
            <h3 class="panel-headline">Ce que vous recevez</h3>
          </div>
        </div>

        <div class="setting-list">
          <label v-for="item in notificationSettings" :key="item.label" class="setting-item">
            <div>
              <p class="setting-label">{{ item.label }}</p>
              <p class="setting-hint">{{ item.hint }}</p>
            </div>
            <input v-model="preferences.notifications[item.key]" class="setting-toggle" type="checkbox" />
          </label>
        </div>
      </div>

      <div class="panel settings-card">
        <div class="panel-header">
          <div>
            <p class="panel-title">Confidentialite</p>
            <h3 class="panel-headline">Visibilite du profil</h3>
          </div>
        </div>

        <div class="setting-list">
          <label v-for="item in privacySettings" :key="item.label" class="setting-item">
            <div>
              <p class="setting-label">{{ item.label }}</p>
              <p class="setting-hint">{{ item.hint }}</p>
            </div>
            <input v-model="preferences.privacy[item.key]" class="setting-toggle" type="checkbox" />
          </label>
        </div>
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
          <button class="button-ghost" type="button" @click="handleReset">Reinitialiser</button>
          <button class="button-primary" type="button" @click="handleSave">Enregistrer</button>
        </div>

        <p v-if="statusMessage" class="form-message form-message--success">
          {{ statusMessage }}
        </p>
      </div>
    </section>
  </DashboardLayout>
</template>
