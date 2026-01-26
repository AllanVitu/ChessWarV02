<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { requestPasswordReset } from '@/lib/auth'
import { notifyError, notifySuccess } from '@/lib/toast'

const email = ref('')
const message = ref('')
const isError = ref(false)

const handleReset = () => {
  const result = requestPasswordReset(email.value)
  message.value = result.message
  isError.value = !result.ok
  if (result.ok) {
    notifySuccess('Lien envoye', result.message)
  } else {
    notifyError('Erreur', result.message)
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="panel auth-card">
      <p class="eyebrow">Mot de passe oublie</p>
      <h1>Reinitialiser votre acces</h1>
      <p class="subhead">Recevez un lien pour definir un nouveau mot de passe.</p>

      <form class="form-stack" @submit.prevent="handleReset">
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

        <button class="button-primary" type="submit">Envoyer le lien</button>
      </form>

      <p
        v-if="message"
        :class="['form-message', isError ? 'form-message--error' : 'form-message--success']"
        role="status"
      >
        {{ message }}
      </p>

      <div class="auth-links">
        <RouterLink to="/auth">Retour a la connexion</RouterLink>
      </div>
    </div>

    <div class="panel auth-side">
      <h2>Securite du compte</h2>
      <p class="subhead">
        Les liens de reinitialisation expirent rapidement pour proteger votre compte.
      </p>
      <ul class="auth-list">
        <li>Verifiez votre dossier spam si besoin.</li>
        <li>Choisissez un mot de passe unique.</li>
        <li>Activez les notifications de securite.</li>
      </ul>
    </div>
  </div>
</template>
