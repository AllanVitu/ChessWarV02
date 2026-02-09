<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { registerUser } from '@/lib/auth'
import { startGuestSession } from '@/lib/guest'
import { notifyError, notifyInfo, notifySuccess } from '@/lib/toast'
import { trackEvent } from '@/lib/telemetry'

const router = useRouter()
const displayName = ref('')
const email = ref('')
const password = ref('')
const message = ref('')
const isError = ref(false)
const isLoading = ref(false)

const handleRegister = async () => {
  message.value = ''
  isError.value = false
  isLoading.value = true

  const result = await registerUser(email.value, password.value, displayName.value)
  isLoading.value = false
  message.value = result.message
  isError.value = !result.ok

  if (result.ok) {
    notifySuccess('Compte cree', result.message)
    trackEvent({ name: 'signup' })
    await router.push('/dashboard')
    return
  }

  if (result.message) {
    notifyError('Inscription refusee', result.message)
  }
}

const handleGuest = async () => {
  startGuestSession()
  notifyInfo('Mode invite', "Vous jouez en local sans compte.")
  trackEvent({ name: 'login_guest' })
  await router.push('/dashboard')
}
</script>

<template>
  <div class="auth-page auth-page--solo">
    <div class="auth-orbit">
      <div class="panel auth-card auth-card--orbit">
      <p class="eyebrow">Inscription</p>
      <h1>Creer votre compte</h1>
      <p class="subhead">Rejoignez l'arene et configurez votre profil de jeu.</p>

      <form class="form-stack" @submit.prevent="handleRegister">
        <label class="form-field">
          <span class="form-label">Nom d'affichage</span>
          <input
            v-model="displayName"
            class="form-input"
            type="text"
            autocomplete="name"
            placeholder="Votre pseudo"
          />
        </label>

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
          <input
            v-model="password"
            class="form-input"
            type="password"
            autocomplete="new-password"
            placeholder="8 caracteres minimum"
          />
        </label>

        <button class="button-primary" type="submit" :disabled="isLoading" :aria-busy="isLoading">
          {{ isLoading ? 'Creation...' : 'Creer le compte' }}
        </button>
        <button class="button-ghost" type="button" @click="handleGuest">Jouer en invite</button>
      </form>

      <p
        v-if="message"
        :class="['form-message', isError ? 'form-message--error' : 'form-message--success']"
        role="status"
      >
        {{ message }}
      </p>

      <div class="auth-links">
        <RouterLink to="/auth">Deja un compte ? Se connecter</RouterLink>
      </div>
      </div>
    </div>
  </div>
</template>
