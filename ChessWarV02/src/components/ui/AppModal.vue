<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue'

type AppModalProps = {
  modelValue: boolean
  title?: string
}

const props = defineProps<AppModalProps>()
const emit = defineEmits<{ (event: 'update:modelValue', value: boolean): void }>()

const close = () => {
  emit('update:modelValue', false)
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    close()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <teleport to="body">
    <div v-if="props.modelValue" class="app-modal" role="dialog" aria-modal="true">
      <div class="app-modal__backdrop" @click="close"></div>
      <div class="app-modal__card">
        <header class="app-modal__header">
          <h2 class="app-modal__title">{{ props.title }}</h2>
          <button class="icon-button" type="button" aria-label="Fermer" @click="close">x</button>
        </header>
        <div class="app-modal__body">
          <slot />
        </div>
        <footer v-if="$slots.footer" class="app-modal__footer">
          <slot name="footer" />
        </footer>
      </div>
    </div>
  </teleport>
</template>
