<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { registerUser } from '@/lib/auth'

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
    await router.push('/')
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="panel auth-card">
      <p class="eyebrow">Inscription</p>
      <h1>Creer votre compte</h1>
      <p class="subhead">Rejoignez l'arene et configurez votre profil de jeu.</p>

      <form class="form-stack" @submit.prevent="handleRegister">
        <label class="form-field">
          <span class="form-label">Nom d'affichage</span>
          <input v-model="displayName" class="form-input" type="text" placeholder="Votre pseudo" />
        </label>

        <label class="form-field">
          <span class="form-label">Email</span>
          <input v-model="email" class="form-input" type="email" placeholder="vous@exemple.com" />
        </label>

        <label class="form-field">
          <span class="form-label">Mot de passe</span>
          <input v-model="password" class="form-input" type="password" placeholder="8 caracteres minimum" />
        </label>

        <button class="button-primary" type="submit" :disabled="isLoading">
          {{ isLoading ? 'Creation...' : 'Creer le compte' }}
        </button>
      </form>

      <p v-if="message" :class="['form-message', isError ? 'form-message--error' : 'form-message--success']">
        {{ message }}
      </p>

      <div class="auth-links">
        <RouterLink to="/connexion">Deja un compte ? Se connecter</RouterLink>
      </div>
    </div>

    <div class="panel auth-side">
      <h2>Configuration rapide</h2>
      <p class="subhead">
        Choisissez votre style de jeu et recevez des analyses personnalisees.
      </p>
      <ul class="auth-list">
        <li>Profil Elo et historique de parties.</li>
        <li>Objectifs d'entrainement personnalises.</li>
        <li>IA multi-niveaux pour progresser.</li>
      </ul>
    </div>
  </div>
</template>
