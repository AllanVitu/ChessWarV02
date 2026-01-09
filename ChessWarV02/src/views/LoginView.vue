<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { loginUser } from '@/lib/auth'

const router = useRouter()
const email = ref('')
const password = ref('')
const message = ref('')
const isError = ref(false)
const isLoading = ref(false)

const handleLogin = async () => {
  message.value = ''
  isError.value = false
  isLoading.value = true

  const result = await loginUser(email.value, password.value)
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
      <p class="eyebrow">Connexion</p>
      <h1>Reprendre votre partie</h1>
      <p class="subhead">Accedez a votre tableau de bord et vos matchs en cours.</p>

      <form class="form-stack" @submit.prevent="handleLogin">
        <label class="form-field">
          <span class="form-label">Email</span>
          <input v-model="email" class="form-input" type="email" placeholder="vous@exemple.com" />
        </label>

        <label class="form-field">
          <span class="form-label">Mot de passe</span>
          <input v-model="password" class="form-input" type="password" placeholder="********" />
        </label>

        <button class="button-primary" type="submit" :disabled="isLoading">
          {{ isLoading ? 'Connexion...' : 'Se connecter' }}
        </button>
      </form>

      <p v-if="message" :class="['form-message', isError ? 'form-message--error' : 'form-message--success']">
        {{ message }}
      </p>

      <div class="auth-links">
        <RouterLink to="/mot-de-passe-oublie">Mot de passe oublie ?</RouterLink>
        <RouterLink to="/inscription">Creer un compte</RouterLink>
      </div>
    </div>

    <div class="panel auth-side">
      <h2>Console VertexChess</h2>
      <p class="subhead">
        Des analyses IA, un suivi Elo et un centre de match concu pour les joueurs competitifs.
      </p>
      <ul class="auth-list">
        <li>Evaluation en direct et courbes de rythme.</li>
        <li>Creation rapide de matchs JcJ ou IA.</li>
        <li>Sessions d'entrainement planifiees.</li>
      </ul>
    </div>
  </div>
</template>
