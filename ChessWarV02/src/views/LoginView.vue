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
    await router.push('/tableau-de-bord')
  }
}
</script>

<template>
  <div class="auth-page auth-page--solo">
    <div class="auth-orbit">
      <div class="panel auth-card auth-card--orbit">
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
    </div>
  </div>
</template>
