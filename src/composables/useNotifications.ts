  import { ref, computed, onBeforeUnmount } from 'vue'
import { getSessionToken } from '@/lib/api'
import {
  getNotifications,
  markNotificationsRead,
  openNotificationsStream,
  type FriendRequestNotification,
  type MatchInviteNotification,
  type MatchReadyNotification,
} from '@/lib/notifications'

const STREAM_STALE_MS = 45000
const STREAM_BACKOFF_BASE = 1200
const STREAM_MAX_RETRY = 4
const POLL_INTERVAL_MS = 20000

export function useNotifications() {
  const friendRequests = ref<FriendRequestNotification[]>([])
  const matchInvites = ref<MatchInviteNotification[]>([])
  const matchReady = ref<MatchReadyNotification[]>([])
  const loading = ref(false)
  const error = ref('')

  let stream: EventSource | null = null
  let streamRetry = 0
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let watchdog: ReturnType<typeof setInterval> | null = null
  let pollingTimer: ReturnType<typeof setInterval> | null = null
  let lastStreamEventAt = 0

  const friendCount = computed(() => friendRequests.value.length)
  const matchCount = computed(() => matchInvites.value.length)
  const hasNewFriend = computed(() => friendRequests.value.some((r) => r.isNew))
  const hasNewMatch = computed(() => matchInvites.value.some((i) => i.isNew))

  let onMatchReadyCallback: ((ready: MatchReadyNotification[]) => void) | null = null
  const onMatchReady = (cb: (ready: MatchReadyNotification[]) => void) => {
    onMatchReadyCallback = cb
  }

  /* ── Load ── */

  const load = async (silent = false) => {
    if (!silent) error.value = ''
    if (!getSessionToken()) {
      friendRequests.value = []
      matchInvites.value = []
      matchReady.value = []
      return
    }
    if (!silent) loading.value = true
    try {
      const data = await getNotifications()
      friendRequests.value = data.friendRequests
      matchInvites.value = data.matchInvites
      matchReady.value = data.matchReady
      if (onMatchReadyCallback) onMatchReadyCallback(data.matchReady)
    } catch (err) {
      if (!silent) error.value = (err as Error).message
    } finally {
      if (!silent) loading.value = false
    }
  }

  /* ── Stream ── */

  const touchStream = () => {
    lastStreamEventAt = Date.now()
  }

  const stopPolling = () => {
    if (pollingTimer) {
      clearInterval(pollingTimer)
      pollingTimer = null
    }
  }

  const stopStreamTimers = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    if (watchdog) {
      clearInterval(watchdog)
      watchdog = null
    }
  }

  const stopStream = () => {
    if (!stream) return
    stream.close()
    stream = null
  }

  const startPolling = () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    if (pollingTimer) return
    stopStream()
    stopStreamTimers()
    void load(true)
    pollingTimer = setInterval(() => {
      void load(true)
    }, POLL_INTERVAL_MS)
  }

  const scheduleReconnect = () => {
    if (reconnectTimer) clearTimeout(reconnectTimer)
    const delay = Math.min(30000, STREAM_BACKOFF_BASE * Math.pow(2, streamRetry))
    reconnectTimer = setTimeout(() => {
      startStream()
    }, delay)
  }

  const startWatchdog = () => {
    if (watchdog) return
    watchdog = setInterval(() => {
      if (!stream) return
      if (Date.now() - lastStreamEventAt > STREAM_STALE_MS) {
        handleStreamError()
      }
    }, 10000)
  }

  const handleStreamError = () => {
    stopStream()
    stopStreamTimers()
    streamRetry += 1
    if (streamRetry >= STREAM_MAX_RETRY) {
      startPolling()
      return
    }
    scheduleReconnect()
  }

  const startStream = () => {
    if (document.hidden) return
    const token = getSessionToken()
    if (!token || stream) return
    stream = openNotificationsStream(
      token,
      (payload) => {
        touchStream()
        friendRequests.value = payload.friendRequests
        matchInvites.value = payload.matchInvites
        matchReady.value = payload.matchReady
        if (onMatchReadyCallback) onMatchReadyCallback(payload.matchReady)
        if (error.value) error.value = ''
      },
      () => {
        handleStreamError()
      },
    )
    streamRetry = 0
    touchStream()
    stopPolling()
    startWatchdog()
  }

  /* ── Mark read ── */

  const markFriendRead = async () => {
    try {
      await markNotificationsRead('friends')
      friendRequests.value = friendRequests.value.map((r) => ({ ...r, isNew: false }))
    } catch {
      // Ignore
    }
  }

  const markMatchRead = async () => {
    try {
      await markNotificationsRead('matches')
      matchInvites.value = matchInvites.value.map((i) => ({ ...i, isNew: false }))
    } catch {
      // Ignore
    }
  }

  /* ── Visibility / connectivity ── */

  const handleVisibilityChange = () => {
    if (document.hidden) {
      stopStream()
      stopStreamTimers()
      stopPolling()
      return
    }
    startStream()
    void load(true)
  }

  const handleOnline = () => {
    if (document.hidden) return
    startStream()
    void load(true)
  }

  const handleOffline = () => {
    stopStream()
    stopStreamTimers()
    stopPolling()
  }

  /* ── Dispose ── */

  const dispose = () => {
    stopStream()
    stopStreamTimers()
    stopPolling()
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  }

  const init = () => {
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    void load()
    startStream()
  }

  return {
    friendRequests,
    matchInvites,
    matchReady,
    loading,
    error,
    friendCount,
    matchCount,
    hasNewFriend,
    hasNewMatch,
    onMatchReady,
    load,
    startStream,
    stopStream,
    startPolling,
    stopPolling,
    markFriendRead,
    markMatchRead,
    handleVisibilityChange,
    handleOnline,
    handleOffline,
    init,
    dispose,
  }
}
