<script setup lang="ts">
import { reactive, ref } from 'vue'
import DashboardLayout from '@/components/DashboardLayout.vue'
import { getDashboardData, saveDashboardData } from '@/lib/localDb'
import { getCurrentUser, loginUser, updatePassword } from '@/lib/auth'

const dashboard = ref(getDashboardData())
const profileForm = reactive({
  name: dashboard.value.profile.name,
  title: dashboard.value.profile.title,
  motto: dashboard.value.profile.motto,
  location: dashboard.value.profile.location,
})

const profileMessage = ref('')
const profileError = ref(false)

const passwordForm = reactive({
  current: '',
  next: '',
  confirm: '',
})

const passwordMessage = ref('')
const passwordError = ref(false)

const saveProfile = () => {
  dashboard.value.profile = {
    ...dashboard.value.profile,
    ...profileForm,
  }
  saveDashboardData(dashboard.value)
  profileMessage.value = 'Profil mis a jour.'
  profileError.value = false
}

const savePassword = async () => {
  passwordMessage.value = ''
  passwordError.value = false

  if (!passwordForm.current || !passwordForm.next) {
    passwordMessage.value = 'Veuillez remplir tous les champs.'
    passwordError.value = true
    return
  }

  if (passwordForm.next !== passwordForm.confirm) {
    passwordMessage.value = 'Les mots de passe ne correspondent pas.'
    passwordError.value = true
    return
  }

  const user = getCurrentUser()
  if (!user) {
    passwordMessage.value = 'Veuillez vous connecter pour modifier le mot de passe.'
    passwordError.value = true
    return
  }

  const authCheck = await loginUser(user.email, passwordForm.current)
  if (!authCheck.ok) {
    passwordMessage.value = 'Mot de passe actuel incorrect.'
    passwordError.value = true
    return
  }

  const update = await updatePassword(user.id, passwordForm.next)
  passwordMessage.value = update.message
  passwordError.value = !update.ok
  if (update.ok) {
    passwordForm.current = ''
    passwordForm.next = ''
    passwordForm.confirm = ''
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

          <label class="form-field">
            <span class="form-label">Email</span>
            <input class="form-input" type="email" :value="dashboard.profile.email" disabled />
          </label>

          <button class="button-primary" type="submit">Enregistrer</button>
        </form>

        <p v-if="profileMessage" :class="['form-message', profileError ? 'form-message--error' : 'form-message--success']">
          {{ profileMessage }}
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
            <input v-model="passwordForm.current" class="form-input" type="password" />
          </label>

          <label class="form-field">
            <span class="form-label">Nouveau mot de passe</span>
            <input v-model="passwordForm.next" class="form-input" type="password" />
          </label>

          <label class="form-field">
            <span class="form-label">Confirmer</span>
            <input v-model="passwordForm.confirm" class="form-input" type="password" />
          </label>

          <button class="button-primary" type="submit">Mettre a jour</button>
        </form>

        <p v-if="passwordMessage" :class="['form-message', passwordError ? 'form-message--error' : 'form-message--success']">
          {{ passwordMessage }}
        </p>
      </div>
    </section>
  </DashboardLayout>
</template>
