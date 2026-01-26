<script setup lang="ts">
import { dismissToast, useToastState } from '@/lib/toast'

const toastState = useToastState()
</script>

<template>
  <div class="toast-stack toast-stack--global" aria-live="polite" aria-atomic="true">
    <div
      v-for="toast in toastState.items"
      :key="toast.id"
      :class="['toast-card', `toast-card--${toast.tone}`]"
      role="status"
    >
      <div class="toast-main">
        <p class="toast-title">{{ toast.title }}</p>
        <p class="toast-sub">{{ toast.message }}</p>
      </div>
      <button class="toast-close" type="button" aria-label="Fermer" @click="dismissToast(toast.id)">
        x
      </button>
    </div>
  </div>
</template>

