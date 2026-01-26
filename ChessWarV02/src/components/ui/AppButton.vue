<script setup lang="ts">
import { computed, useAttrs } from 'vue'

type ButtonVariant = 'primary' | 'ghost' | 'outline'

const props = withDefaults(
  defineProps<{
    variant?: ButtonVariant
    loading?: boolean
  }>(),
  {
    variant: 'primary',
    loading: false,
  },
)

const attrs = useAttrs()

const classes = computed(() => [
  props.variant === 'primary' ? 'button-primary' : '',
  props.variant === 'ghost' ? 'button-ghost' : '',
  props.variant === 'outline' ? 'button-outline' : '',
  props.loading ? 'is-loading' : '',
])

const isDisabled = computed(() => attrs.disabled !== undefined || props.loading)
</script>

<template>
  <button v-bind="attrs" :class="classes" :disabled="isDisabled" :aria-busy="props.loading">
    <span v-if="props.loading" class="button-spinner" aria-hidden="true"></span>
    <span><slot /></span>
  </button>
</template>
