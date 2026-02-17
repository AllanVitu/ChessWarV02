<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterView } from 'vue-router'
import AppToasts from '@/components/ui/AppToasts.vue'
import CookieBanner from '@/components/ui/CookieBanner.vue'
import { flushQueue, subscribeQueue } from '@/lib/offlineQueue'
import { API_PROTOCOL_ERROR_EVENT } from '@/lib/api'
import { notifyError } from '@/lib/toast'

const isOnline = ref(true)
const pendingCount = ref(0)
let stopQueueWatch: (() => void) | null = null
let lastProtocolToastAt = 0

const updateOnline = () => {
  if (typeof navigator === 'undefined') return
  isOnline.value = navigator.onLine
}

const handleApiProtocolError = (event: Event) => {
  const now = Date.now()
  if (now - lastProtocolToastAt < 6000) {
    return
  }
  lastProtocolToastAt = now
  const customEvent = event as CustomEvent<{ path?: string }>
  const path = customEvent.detail?.path ?? '/api'
  notifyError('Service API', `Reponse invalide sur ${path}. Verifiez le rewrite Apache /api.`)
}

const retry = () => {
  if (typeof window === 'undefined') return
  window.location.reload()
}

onMounted(() => {
  if (typeof window === 'undefined') return
  updateOnline()
  window.addEventListener('online', updateOnline)
  window.addEventListener('offline', updateOnline)
  window.addEventListener(API_PROTOCOL_ERROR_EVENT, handleApiProtocolError as EventListener)
  stopQueueWatch = subscribeQueue((count) => {
    pendingCount.value = count
  })
})

onBeforeUnmount(() => {
  if (typeof window === 'undefined') return
  window.removeEventListener('online', updateOnline)
  window.removeEventListener('offline', updateOnline)
  window.removeEventListener(API_PROTOCOL_ERROR_EVENT, handleApiProtocolError as EventListener)
  if (stopQueueWatch) {
    stopQueueWatch()
    stopQueueWatch = null
  }
})
</script>

<template>
  <div v-if="!isOnline" class="offline-banner" role="status" aria-live="polite">
    <div>
      <p class="offline-banner__title">Vous etes hors ligne.</p>
      <p class="offline-banner__text">Certaines actions peuvent etre indisponibles.</p>
    </div>
    <button class="button-ghost" type="button" @click="retry">Reessayer</button>
  </div>

  <div v-else-if="pendingCount" class="offline-banner offline-banner--pending" role="status">
    <div>
      <p class="offline-banner__title">Actions en attente</p>
      <p class="offline-banner__text">
        {{ pendingCount }} action{{ pendingCount > 1 ? 's' : '' }} en cours de synchronisation.
      </p>
    </div>
    <button class="button-ghost" type="button" @click="flushQueue">Synchroniser</button>
  </div>

  <RouterView />
  <AppToasts />
  <CookieBanner />
</template>
