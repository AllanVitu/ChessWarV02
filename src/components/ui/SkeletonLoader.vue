<script setup lang="ts">
withDefaults(
  defineProps<{
    width?: string
    height?: string
    radius?: string
    circle?: boolean
    lines?: number
  }>(),
  {
    width: '100%',
    height: '16px',
    radius: '8px',
    circle: false,
    lines: 1,
  },
)
</script>

<template>
  <div
    v-if="lines <= 1"
    class="skeleton"
    :class="{ 'skeleton--circle': circle }"
    :style="{
      width: circle ? height : width,
      height,
      borderRadius: circle ? '50%' : radius,
    }"
  />
  <div v-else class="skeleton-group">
    <div
      v-for="i in lines"
      :key="i"
      class="skeleton"
      :style="{
        width: i === lines ? '60%' : width,
        height,
        borderRadius: radius,
      }"
    />
  </div>
</template>

<style scoped>
.skeleton {
  background: linear-gradient(
    90deg,
    var(--panel-soft) 25%,
    rgba(255, 255, 255, 0.06) 50%,
    var(--panel-soft) 75%
  );
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.6s ease-in-out infinite;
}

.skeleton-group {
  display: grid;
  gap: 8px;
}

@keyframes skeleton-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton {
    animation: none;
    opacity: 0.5;
  }
}
</style>
