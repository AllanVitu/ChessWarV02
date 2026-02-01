<script setup lang="ts">
import { computed } from 'vue'

type LoaderError = {
  code: string
  message: string
  detail?: string
}

const props = defineProps<{
  title: string
  subtitle: string
  percent: number
  stage: string
  current?: string
  slow: boolean
  error?: LoaderError | null
  showLightMode?: boolean
}>()

defineEmits<{
  (e: 'retry'): void
  (e: 'light-mode'): void
  (e: 'copy'): void
  (e: 'back'): void
}>()

const stageLabel = computed(() => {
  if (props.error) return 'Erreur'
  if (props.stage === 'ready') return 'Pret !'
  if (props.stage === 'compiling') return 'Compilation...'
  if (props.stage === 'downloading') return 'Telechargement...'
  return 'Initialisation...'
})
</script>

<template>
  <section class="intro-loader" role="status" aria-live="polite">
    <div class="intro-loader__panel">
      <div class="intro-loader__brand">
        <div class="intro-loader__logo" aria-hidden="true">
          <span>WC</span>
        </div>
        <div>
          <h1 class="intro-loader__title">{{ props.title }}</h1>
          <p class="intro-loader__subtitle">{{ props.subtitle }}</p>
        </div>
      </div>

      <div class="intro-loader__progress">
        <div class="intro-loader__spinner" aria-hidden="true"></div>
        <div class="intro-loader__bar">
          <span class="intro-loader__fill" :style="{ width: `${props.percent}%` }"></span>
        </div>
        <div class="intro-loader__meta">
          <span class="intro-loader__stage">{{ stageLabel }}</span>
          <span class="intro-loader__percent">{{ props.percent }}%</span>
        </div>
        <p v-if="props.current" class="intro-loader__current">{{ props.current }}</p>
      </div>

      <div v-if="props.slow && !props.error" class="intro-loader__slow">
        <p>Ca prend plus de temps que prevu...</p>
        <div class="intro-loader__actions">
          <button class="button-primary" type="button" @click="$emit('retry')">Reessayer</button>
          <button
            v-if="props.showLightMode"
            class="button-ghost"
            type="button"
            @click="$emit('light-mode')"
          >
            Continuer en mode leger
          </button>
        </div>
      </div>

      <div v-if="props.error" class="intro-loader__error">
        <h2>{{ props.error.code }}</h2>
        <p>{{ props.error.message }}</p>
        <p v-if="props.error.detail" class="intro-loader__detail">{{ props.error.detail }}</p>
        <div class="intro-loader__actions">
          <button class="button-primary" type="button" @click="$emit('retry')">Reessayer</button>
          <button
            v-if="props.showLightMode"
            class="button-ghost"
            type="button"
            @click="$emit('light-mode')"
          >
            Continuer en mode leger
          </button>
          <button class="button-ghost" type="button" @click="$emit('copy')">Copier les details</button>
          <button class="button-outline" type="button" @click="$emit('back')">Retour a l'accueil</button>
        </div>
      </div>
    </div>
  </section>
</template>
