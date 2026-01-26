<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    label: string
    modelValue: string
    type?: string
    placeholder?: string
  }>(),
  {
    type: 'text',
    placeholder: '',
  },
)

const emit = defineEmits<{ (event: 'update:modelValue', value: string): void }>()

const onInput = (event: Event) => {
  const target = event.target as HTMLInputElement | null
  emit('update:modelValue', target?.value ?? '')
}
</script>

<template>
  <label class="form-field">
    <span class="form-label">{{ props.label }}</span>
    <input
      class="form-input"
      :type="props.type"
      :placeholder="props.placeholder"
      :value="props.modelValue"
      @input="onInput"
    />
  </label>
</template>
