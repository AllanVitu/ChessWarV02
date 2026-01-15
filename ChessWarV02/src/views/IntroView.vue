<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const touchStartY = ref(0)
const touchStartX = ref(0)
const mouseStartY = ref(0)
const mouseStartX = ref(0)
const mouseTracking = ref(false)
const navigating = ref(false)

const goToLogin = () => {
  if (navigating.value) return
  navigating.value = true
  void router.push('/connexion')
}

const handleTouchStart = (event: TouchEvent) => {
  const touch = event.touches[0]
  if (!touch) return
  touchStartY.value = touch.clientY
  touchStartX.value = touch.clientX
}

const handleTouchEnd = (event: TouchEvent) => {
  const touch = event.changedTouches[0]
  if (!touch) return
  const deltaY = touchStartY.value - touch.clientY
  const deltaX = Math.abs(touchStartX.value - touch.clientX)
  if (deltaY > 80 && deltaX < 60) {
    goToLogin()
  }
}

const handleMouseDown = (event: MouseEvent) => {
  if (event.button !== 0) return
  mouseTracking.value = true
  mouseStartY.value = event.clientY
  mouseStartX.value = event.clientX
}

const handleMouseUp = (event: MouseEvent) => {
  if (!mouseTracking.value) return
  mouseTracking.value = false
  const deltaY = mouseStartY.value - event.clientY
  const deltaX = Math.abs(mouseStartX.value - event.clientX)
  if (deltaY > 80 && deltaX < 60) {
    goToLogin()
  }
}

const handleWheel = (event: WheelEvent) => {
  if (event.deltaY > 60) {
    goToLogin()
  }
}
</script>

<template>
  <section
    class="intro-page"
    @touchstart="handleTouchStart"
    @touchend="handleTouchEnd"
    @mousedown="handleMouseDown"
    @mouseup="handleMouseUp"
    @wheel="handleWheel"
  >
    <div class="intro-glow" aria-hidden="true"></div>
    <div class="intro-center">
      <h1 class="intro-title">CloudChess</h1>
      <p class="intro-subtitle">La partie commence dans les nuages.</p>
    </div>
    <div class="intro-hint" aria-hidden="true">
      <span>Glissez vers le haut</span>
      <span class="intro-arrow"></span>
    </div>
  </section>
</template>
