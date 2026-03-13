import { ref, type Ref } from 'vue'
import {
  getMatchRoom,
  markMatchReady,
  openMatchSocket,
  openMatchStream,
  sendMatchPresence,
  type MatchOnlineState,
  type MatchSocketMessage,
} from '@/lib/matchOnline'

type RealtimeTransport = 'auto' | 'ws' | 'sse' | 'poll'
type ActiveTransport = Exclude<RealtimeTransport, 'auto'>

export interface UseOnlineMatchOptions {
  matchId: Ref<string>
  onStateUpdate: (state: MatchOnlineState) => void
}

const resolvePreferredTransport = (): RealtimeTransport => {
  const raw = String(import.meta.env.VITE_MATCH_TRANSPORT || '')
    .trim()
    .toLowerCase()
  if (raw === 'ws' || raw === 'sse' || raw === 'poll' || raw === 'auto') return raw
  return 'auto'
}

export function useOnlineMatch(options: UseOnlineMatchOptions) {
  const { matchId, onStateUpdate } = options
  const preferredTransport = resolvePreferredTransport()

  const activeTransport = ref<ActiveTransport | null>(null)
  const onlineLoading = ref(false)
  const onlineError = ref('')
  const onlinePending = ref(false)

  let onlineStream: EventSource | null = null
  let onlineSocket: WebSocket | null = null
  let onlineRefreshPending = false
  let onlinePollTimer: ReturnType<typeof setInterval> | null = null
  let presenceTimer: ReturnType<typeof setInterval> | null = null
  let readyTimer: ReturnType<typeof setInterval> | null = null

  const readyCountdown = ref(0)
  const serverOffsetMs = ref(0)

  const getServerNow = () => Date.now() + serverOffsetMs.value

  const updateServerOffset = (state: MatchOnlineState) => {
    if (!state.serverTime) return
    const server = new Date(state.serverTime).getTime()
    if (!Number.isFinite(server)) return
    serverOffsetMs.value = server - Date.now()
  }

  /* ── Stop helpers ── */

  const stopSocket = () => {
    if (!onlineSocket) return
    const socket = onlineSocket
    onlineSocket = null
    socket.close()
    if (activeTransport.value === 'ws') activeTransport.value = null
  }

  const stopStream = () => {
    if (onlineStream) {
      onlineStream.close()
      onlineStream = null
    }
    if (activeTransport.value === 'sse') activeTransport.value = null
  }

  const stopPolling = () => {
    if (onlinePollTimer) {
      clearInterval(onlinePollTimer)
      onlinePollTimer = null
    }
    if (activeTransport.value === 'poll') activeTransport.value = null
  }

  const stopReadyTimer = () => {
    if (readyTimer) {
      clearInterval(readyTimer)
      readyTimer = null
    }
  }

  const stopPresenceTimer = () => {
    if (presenceTimer) {
      clearInterval(presenceTimer)
      presenceTimer = null
    }
  }

  /* ── Refresh / handle messages ── */

  const refreshState = async (silent = false) => {
    if (!matchId.value || onlineRefreshPending) return
    onlineRefreshPending = true
    try {
      const state = await getMatchRoom(matchId.value)
      onStateUpdate(state)
      if (onlineError.value) onlineError.value = ''
    } catch (error) {
      if (!silent) onlineError.value = (error as Error).message
    } finally {
      onlineRefreshPending = false
    }
  }

  const handleSocketMessage = async (payload: MatchSocketMessage) => {
    if (!payload || payload.matchId !== matchId.value) return
    if (payload.type === 'state' && payload.match) {
      onStateUpdate(payload.match)
      if (onlineError.value) onlineError.value = ''
      return
    }
    if (payload.type === 'match-update') {
      await refreshState()
      return
    }
    if (payload.type === 'error') {
      onlineError.value = payload.message || 'Erreur temps reel.'
    }
  }

  /* ── Start helpers ── */

  const startPolling = () => {
    stopSocket()
    stopStream()
    if (onlinePollTimer) return
    activeTransport.value = 'poll'
    onlinePollTimer = setInterval(async () => {
      await refreshState(true)
    }, 3000)
  }

  const startStream = (): boolean => {
    if (!matchId.value) return false
    stopSocket()
    stopStream()
    stopPolling()
    onlineStream = openMatchStream(
      matchId.value,
      (payload) => {
        onStateUpdate(payload)
        if (onlineError.value) onlineError.value = ''
      },
      () => {
        if (!onlineError.value) {
          onlineError.value = 'Connexion temps reel interrompue.'
        }
        startPolling()
      },
    )
    if (!onlineStream) {
      startPolling()
      return false
    }
    activeTransport.value = 'sse'
    return true
  }

  const startSocketChannel = (): boolean => {
    if (!matchId.value) return false
    stopSocket()
    stopStream()
    stopPolling()
    const socket = openMatchSocket(matchId.value, (payload) => {
      void handleSocketMessage(payload)
    })
    if (!socket) return false

    onlineSocket = socket
    activeTransport.value = 'ws'

    const fallback = () => {
      if (onlineSocket !== socket) return
      onlineSocket = null
      if (!onlineError.value) {
        onlineError.value = 'Connexion temps reel interrompue.'
      }
      if (preferredTransport === 'ws' || preferredTransport === 'auto') {
        if (startStream()) return
      }
      startPolling()
    }

    socket.addEventListener('error', fallback)
    socket.addEventListener('close', () => fallback())
    return true
  }

  const startRealtime = () => {
    if (!matchId.value) return
    stopPolling()
    stopStream()
    stopSocket()

    if (preferredTransport === 'poll') {
      startPolling()
      return
    }
    if (preferredTransport === 'sse') {
      if (!startStream()) startPolling()
      return
    }
    if (preferredTransport === 'ws') {
      if (!startSocketChannel() && !startStream()) startPolling()
      return
    }
    if (startSocketChannel()) return
    if (startStream()) return
    startPolling()
  }

  const startPresence = () => {
    if (presenceTimer || !matchId.value) return
    presenceTimer = setInterval(async () => {
      if (!matchId.value) return
      try {
        const state = await sendMatchPresence(matchId.value)
        onStateUpdate(state)
      } catch {
        // Ignore presence failures.
      }
    }, 8000)
  }

  const syncReadyCountdown = (state: MatchOnlineState) => {
    if (state.status !== 'ready' || !state.startAt) {
      readyCountdown.value = 0
      stopReadyTimer()
      return
    }
    const startTime = new Date(state.startAt).getTime()
    if (!Number.isFinite(startTime)) {
      readyCountdown.value = 0
      stopReadyTimer()
      return
    }
    const compute = () => {
      const diff = Math.ceil((startTime - getServerNow()) / 1000)
      readyCountdown.value = Math.max(0, diff)
      if (readyCountdown.value <= 0) stopReadyTimer()
    }
    compute()
    if (!readyTimer) readyTimer = setInterval(compute, 250)
  }

  /* ── Public API ── */

  const loadMatch = async () => {
    if (!matchId.value) return
    onlineLoading.value = true
    onlineError.value = ''
    stopPolling()
    stopStream()
    stopSocket()
    try {
      const state = await getMatchRoom(matchId.value)
      onStateUpdate(state)
      startRealtime()
      startPresence()
    } catch (error) {
      onlineError.value = (error as Error).message
      startPolling()
    } finally {
      onlineLoading.value = false
    }
  }

  const handleReady = async () => {
    if (!matchId.value) return
    try {
      const state = await markMatchReady(matchId.value)
      onStateUpdate(state)
    } catch (error) {
      onlineError.value = (error as Error).message
    }
  }

  const reset = () => {
    stopSocket()
    stopStream()
    stopPolling()
    stopReadyTimer()
    stopPresenceTimer()
    activeTransport.value = null
    onlineLoading.value = false
    onlineError.value = ''
    onlinePending.value = false
    readyCountdown.value = 0
    serverOffsetMs.value = 0
  }

  const dispose = () => {
    reset()
  }

  return {
    activeTransport,
    onlineLoading,
    onlineError,
    onlinePending,
    readyCountdown,
    serverOffsetMs,
    getServerNow,
    updateServerOffset,
    syncReadyCountdown,
    loadMatch,
    handleReady,
    refreshState,
    startRealtime,
    stopSocket,
    stopStream,
    stopPolling,
    stopReadyTimer,
    stopPresenceTimer,
    startClock: startRealtime,
    reset,
    dispose,
  }
}
