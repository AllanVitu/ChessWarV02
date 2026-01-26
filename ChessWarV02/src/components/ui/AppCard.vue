<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    tag?: string
    variant?: 'panel' | 'soft'
  }>(),
  {
    tag: 'div',
    variant: 'panel',
  },
)
</script>

<template>
  <component :is="props.tag" :class="[props.variant === 'panel' ? 'panel' : 'card-soft']">
    <slot />
  </component>
</template>
