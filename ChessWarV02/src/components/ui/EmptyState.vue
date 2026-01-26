<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    title?: string
    subtitle?: string
  }>(),
  {
    title: 'Aucune donnee',
    subtitle: '',
  },
)
</script>

<template>
  <div class="empty-state">
    <p class="empty-state__title">{{ props.title }}</p>
    <p v-if="props.subtitle" class="empty-state__subtitle">{{ props.subtitle }}</p>
    <slot />
  </div>
</template>
