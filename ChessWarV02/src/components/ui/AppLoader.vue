<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    label?: string
  }>(),
  {
    label: 'Chargement...',
  },
)
</script>

<template>
  <div class="app-loader-inline" role="status" aria-live="polite">
    <span class="app-loader-inline__spinner" aria-hidden="true"></span>
    <span class="app-loader-inline__label">{{ props.label }}</span>
  </div>
</template>
