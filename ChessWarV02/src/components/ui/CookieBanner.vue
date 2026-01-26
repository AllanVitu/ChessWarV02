<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { setTelemetryConsent, shouldAskConsent } from '@/lib/telemetry'

const visible = ref(false)

onMounted(() => {
  visible.value = shouldAskConsent()
})

const accept = () => {
  setTelemetryConsent(true)
  visible.value = false
}

const reject = () => {
  setTelemetryConsent(false)
  visible.value = false
}
</script>

<template>
  <div v-if="visible" class="cookie-banner" role="dialog" aria-live="polite" aria-label="Consentement">
    <div class="cookie-banner__content">
      <p class="cookie-banner__title">Respect de votre vie privee</p>
      <p class="cookie-banner__text">
        Nous utilisons des mesures anonymes pour ameliorer WarChess. Vous pouvez refuser a tout moment.
      </p>
    </div>
    <div class="cookie-banner__actions">
      <button class="button-ghost" type="button" @click="reject">Refuser</button>
      <button class="button-primary" type="button" @click="accept">Accepter</button>
    </div>
  </div>
</template>
