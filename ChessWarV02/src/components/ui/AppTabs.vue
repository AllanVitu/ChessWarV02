<script setup lang="ts">
type TabItem = {
  id: string
  label: string
}

const props = defineProps<{
  tabs: TabItem[]
  modelValue: string
}>()

const emit = defineEmits<{ (event: 'update:modelValue', value: string): void }>()

const selectTab = (id: string) => {
  if (id === props.modelValue) return
  emit('update:modelValue', id)
}
</script>

<template>
  <div class="segmented" role="tablist">
    <button
      v-for="tab in props.tabs"
      :key="tab.id"
      :class="['segmented-button', tab.id === props.modelValue ? 'segmented-button--active' : '']"
      role="tab"
      type="button"
      :aria-selected="tab.id === props.modelValue"
      @click="selectTab(tab.id)"
    >
      {{ tab.label }}
    </button>
  </div>
</template>
