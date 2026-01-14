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
      <div class="auth-halo" aria-hidden="true"></div>
      <div class="panel auth-card auth-card--orbit">
        <div class="auth-stack">
          <p class="eyebrow">Connexion</p>
          <p class="auth-kicker">Retour sur le plateau</p>
          <h1 class="auth-title">Reprendre votre partie</h1>
          <p class="subhead auth-subhead">
            Accedez a vos matchs en cours, vos invites d'amis et vos analyses.
          </p>

          <form class="form-stack auth-form" @submit.prevent="handleLogin">
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
            <p class="auth-note">Connexion securisee et synchronisee sur tous vos appareils.</p>
          </form>

          <p v-if="message" :class="['form-message', isError ? 'form-message--error' : 'form-message--success']">
            {{ message }}
          </p>

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
