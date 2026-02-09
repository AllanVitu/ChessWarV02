<script setup lang="ts">
import { computed } from 'vue'

type ChartDataset = {
  label: string
  data: number[]
  color?: string
}

const props = defineProps<{
  labels: string[]
  datasets: ChartDataset[]
}>()

const width = 600
const height = 220
const padding = 24

const flatValues = computed(() => props.datasets.flatMap((dataset) => dataset.data))
const minValue = computed(() => (flatValues.value.length ? Math.min(...flatValues.value) : 0))
const maxValue = computed(() => (flatValues.value.length ? Math.max(...flatValues.value) : 1))
const rangeValue = computed(() => {
  const range = maxValue.value - minValue.value
  return range === 0 ? 1 : range
})

const buildPath = (values: number[]) => {
  if (!values.length) return ''
  const count = values.length
  const step = count > 1 ? (width - padding * 2) / (count - 1) : 0
  return values
    .map((value, index) => {
      const x = padding + step * index
      const y =
        height -
        padding -
        ((value - minValue.value) / rangeValue.value) * (height - padding * 2)
      return `${index === 0 ? 'M' : 'L'}${x} ${y}`
    })
    .join(' ')
}

const chartPaths = computed(() =>
  props.datasets.map((dataset) => ({
    label: dataset.label,
    color: dataset.color ?? 'rgba(148, 163, 184, 0.9)',
    path: buildPath(dataset.data),
  })),
)
</script>

<template>
  <div class="line-chart">
    <svg :viewBox="`0 0 ${width} ${height}`" role="img" aria-label="Graphique de progression">
      <path
        v-for="dataset in chartPaths"
        :key="dataset.label"
        :d="dataset.path"
        fill="none"
        :stroke="dataset.color"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  </div>
</template>

<style scoped>
.line-chart {
  width: 100%;
}

.line-chart svg {
  display: block;
  width: 100%;
  height: auto;
}
</style>
