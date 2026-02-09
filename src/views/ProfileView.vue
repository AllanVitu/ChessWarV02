<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import DashboardLayout from '@/components/DashboardLayout.vue'
import { getDashboardData, saveDashboardData, type DashboardDb } from '@/lib/localDb'
import { getCurrentUser, updatePassword } from '@/lib/auth'
import { notifyError, notifySuccess } from '@/lib/toast'
import { isOffline } from '@/lib/offlineQueue'

const dashboard = ref<DashboardDb | null>(null)
const profileForm = reactive({
  name: '',
  title: '',
  motto: '',
  location: '',
  avatarUrl: '',
})

const profileMessage = ref('')
const profileError = ref(false)
const autoSaveStatus = ref('')
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null
let profileSnapshot = ''
let autoSaveReady = false
const profileEmail = computed(() => dashboard.value?.profile.email ?? '')
const avatarInitials = computed(() => {
  const name = profileForm.name.trim()
  if (!name) return '?'
  const parts = name.split(' ').filter(Boolean)
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || '?'
})

const passwordForm = reactive({
  current: '',
  next: '',
  confirm: '',
})

const passwordMessage = ref('')
const passwordError = ref(false)

onMounted(async () => {
  const data = await getDashboardData()
  dashboard.value = data
  profileForm.name = data.profile.name
  profileForm.title = data.profile.title
  profileForm.motto = data.profile.motto
  profileForm.location = data.profile.location
  profileForm.avatarUrl = data.profile.avatarUrl
  profileSnapshot = JSON.stringify(profileForm)
  autoSaveReady = true
})

const handleAvatarUpload = (event: Event) => {
  const input = event.target as HTMLInputElement | null
  const file = input?.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    if (typeof reader.result === 'string') {
      profileForm.avatarUrl = reader.result
    }
  }
  reader.readAsDataURL(file)
}

const persistProfile = async (silent = false) => {
  if (!dashboard.value) return
  dashboard.value.profile = {
    ...dashboard.value.profile,
    ...profileForm,
  }
  dashboard.value = await saveDashboardData(dashboard.value)
  const message = isOffline()
    ? 'Profil en attente de synchronisation.'
    : 'Profil mis a jour.'
  profileError.value = false
  if (!silent) {
    profileMessage.value = message
    notifySuccess('Profil', message)
  }
}

const saveProfile = async (event?: SubmitEvent) => {
  event?.preventDefault()
  await persistProfile(false)
}

watch(
  profileForm,
  () => {
    if (!autoSaveReady) return
    const snapshot = JSON.stringify(profileForm)
    if (snapshot === profileSnapshot) return
    profileSnapshot = snapshot
    autoSaveStatus.value = 'Sauvegarde automatique...'
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer)
    }
    autoSaveTimer = setTimeout(() => {
      void persistProfile(true).finally(() => {
        autoSaveStatus.value = isOffline()
          ? 'Sauvegarde en attente de connexion.'
          : 'Sauvegarde automatique terminee.'
      })
    }, 800)
  },
  { deep: true },
)

const savePassword = async () => {
  passwordMessage.value = ''
  passwordError.value = false

  if (!passwordForm.current || !passwordForm.next) {
    passwordMessage.value = 'Veuillez remplir tous les champs.'
    passwordError.value = true
    notifyError('Mot de passe', passwordMessage.value)
    return
  }

  if (passwordForm.next !== passwordForm.confirm) {
    passwordMessage.value = 'Les mots de passe ne correspondent pas.'
    passwordError.value = true
    notifyError('Mot de passe', passwordMessage.value)
    return
  }

  const user = await getCurrentUser()
  if (!user) {
    passwordMessage.value = 'Veuillez vous connecter pour modifier le mot de passe.'
    passwordError.value = true
    notifyError('Mot de passe', passwordMessage.value)
    return
  }

  const update = await updatePassword(passwordForm.current, passwordForm.next)
  passwordMessage.value = update.message
  passwordError.value = !update.ok
  if (update.ok) {
    passwordForm.current = ''
    passwordForm.next = ''
    passwordForm.confirm = ''
    notifySuccess('Mot de passe', passwordMessage.value)
  } else {
    notifyError('Mot de passe', passwordMessage.value)
  }
}
</script>

<template>
  <DashboardLayout
    eyebrow="Profil"
    title="Parametres du compte"
    subtitle="Gerez vos informations et la securite du compte."
  >
    <section class="profile-grid">
      <div class="panel profile-card">
        <div class="panel-header">
          <div>
            <p class="panel-title">Profil public</p>
            <h3 class="panel-headline">Identite et preferences</h3>
          </div>
        </div>

        <form class="form-stack" @submit.prevent="saveProfile">
          <label class="form-field">
            <span class="form-label">Nom</span>
            <input v-model="profileForm.name" class="form-input" type="text" />
          </label>

          <label class="form-field">
            <span class="form-label">Titre</span>
            <input v-model="profileForm.title" class="form-input" type="text" />
          </label>

          <label class="form-field">
            <span class="form-label">Devise</span>
            <input v-model="profileForm.motto" class="form-input" type="text" />
          </label>

          <label class="form-field">
            <span class="form-label">Localisation</span>
            <input v-model="profileForm.location" class="form-input" type="text" />
          </label>

          <div class="form-field">
            <span class="form-label">Avatar</span>
            <div class="avatar-field">
              <div class="avatar-preview">
                <img
                  v-if="profileForm.avatarUrl"
                  :src="profileForm.avatarUrl"
                  alt="Avatar profil"
                  width="72"
                  height="72"
                  loading="lazy"
                  decoding="async"
                />
                <span v-else>{{ avatarInitials }}</span>
              </div>
              <div class="avatar-controls">
                <input
                  v-model="profileForm.avatarUrl"
                  class="form-input"
                  type="url"
                  placeholder="https://"
                />
                <input
                  class="form-input avatar-file"
                  type="file"
                  accept="image/*"
                  @change="handleAvatarUpload"
                />
                <button class="button-ghost" type="button" @click="profileForm.avatarUrl = ''">
                  Retirer l'avatar
                </button>
              </div>
            </div>
          </div>

          <label class="form-field">
            <span class="form-label">Email</span>
            <input class="form-input" type="email" :value="profileEmail" disabled />
          </label>

          <button class="button-primary" type="submit">Enregistrer</button>
        </form>

        <p
          v-if="profileMessage"
          :class="['form-message', profileError ? 'form-message--error' : 'form-message--success']"
          role="status"
        >
          {{ profileMessage }}
        </p>
        <p v-else-if="autoSaveStatus" class="form-message form-message--success" role="status">
          {{ autoSaveStatus }}
        </p>
      </div>

      <div class="panel profile-card">
        <div class="panel-header">
          <div>
            <p class="panel-title">Securite</p>
            <h3 class="panel-headline">Changer le mot de passe</h3>
          </div>
        </div>

        <form class="form-stack" @submit.prevent="savePassword">
          <label class="form-field">
            <span class="form-label">Mot de passe actuel</span>
            <input
              v-model="passwordForm.current"
              class="form-input"
              type="password"
              autocomplete="current-password"
            />
          </label>

          <label class="form-field">
            <span class="form-label">Nouveau mot de passe</span>
            <input
              v-model="passwordForm.next"
              class="form-input"
              type="password"
              autocomplete="new-password"
            />
          </label>

          <label class="form-field">
            <span class="form-label">Confirmer</span>
            <input
              v-model="passwordForm.confirm"
              class="form-input"
              type="password"
              autocomplete="new-password"
            />
          </label>

          <button class="button-primary" type="submit">Mettre a jour</button>
        </form>

        <p
          v-if="passwordMessage"
          :class="['form-message', passwordError ? 'form-message--error' : 'form-message--success']"
          role="status"
        >
          {{ passwordMessage }}
        </p>
      </div>

      <div class="panel profile-card">
        <div class="panel-header">
          <div>
            <p class="panel-title">Navigation</p>
            <h3 class="panel-headline">Raccourcis utiles</h3>
          </div>
        </div>
        <div class="card-actions">
          <RouterLink class="button-primary" to="/matchs">Voir historique</RouterLink>
          <RouterLink class="button-ghost" to="/leaderboard">Classement</RouterLink>
          <RouterLink class="button-ghost" to="/settings">Parametres</RouterLink>
        </div>
      </div>
    </section>
  </DashboardLayout>
</template>
