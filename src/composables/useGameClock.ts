import { ref, computed, type Ref, type ComputedRef } from 'vue'
import type { Side } from '@/lib/chessEngine'

export interface ClockConfig {
  initialMs: number
  incrementMs: number
}

export interface UseGameClockOptions {
  isOnline: ComputedRef<boolean>
  sideToMove: Ref<Side>
  matchEnded: ComputedRef<boolean>
  clockConfig: ComputedRef<ClockConfig>
  getServerNow: () => number
  onTimeout: () => void
}

export function useGameClock(options: UseGameClockOptions) {
  const { isOnline, sideToMove, matchEnded, clockConfig, getServerNow, onTimeout } = options

  const whiteClockMs = ref(0)
  const blackClockMs = ref(0)
  const clockTickAt = ref(0)
  const timeoutTriggered = ref(false)
  const clockNotice = ref('')
  const clockNoticeError = ref(false)
  let clockTimer: ReturnType<typeof setInterval> | null = null

  const formatClock = (ms: number) => {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const clockTone = (ms: number) => {
    if (ms <= 10000) return 'player-clock--danger'
    if (ms <= 30000) return 'player-clock--warning'
    return ''
  }

  const whiteClockLabel = computed(() => formatClock(whiteClockMs.value))
  const blackClockLabel = computed(() => formatClock(blackClockMs.value))

  const checkTimeout = () => {
    if (timeoutTriggered.value) return
    if (whiteClockMs.value === 0 || blackClockMs.value === 0) {
      timeoutTriggered.value = true
      onTimeout()
    }
  }

  const stopClock = () => {
    if (clockTimer) {
      clearInterval(clockTimer)
      clockTimer = null
    }
  }

  const startClock = () => {
    stopClock()
    clockTickAt.value = isOnline.value ? getServerNow() : Date.now()
    clockTimer = setInterval(() => {
      if (matchEnded.value) {
        clockTickAt.value = isOnline.value ? getServerNow() : Date.now()
        return
      }
      const now = isOnline.value ? getServerNow() : Date.now()
      const elapsed = now - clockTickAt.value
      clockTickAt.value = now
      if (sideToMove.value === 'white') {
        whiteClockMs.value = Math.max(0, whiteClockMs.value - elapsed)
      } else {
        blackClockMs.value = Math.max(0, blackClockMs.value - elapsed)
      }
      checkTimeout()
    }, 250)
  }

  const commitClockTick = () => {
    if (matchEnded.value) return
    const now = isOnline.value ? getServerNow() : Date.now()
    const elapsed = now - clockTickAt.value
    clockTickAt.value = now
    if (sideToMove.value === 'white') {
      whiteClockMs.value = Math.max(0, whiteClockMs.value - elapsed)
    } else {
      blackClockMs.value = Math.max(0, blackClockMs.value - elapsed)
    }
  }

  const applyIncrement = (side: Side) => {
    const { incrementMs } = clockConfig.value
    if (incrementMs <= 0) return
    if (side === 'white') {
      whiteClockMs.value += incrementMs
    } else {
      blackClockMs.value += incrementMs
    }
  }

  const resetClocks = () => {
    const { initialMs } = clockConfig.value
    whiteClockMs.value = initialMs
    blackClockMs.value = initialMs
    timeoutTriggered.value = false
    clockNotice.value = ''
    clockNoticeError.value = false
    clockTickAt.value = Date.now()
    startClock()
  }

  const dispose = () => {
    stopClock()
  }

  return {
    whiteClockMs,
    blackClockMs,
    clockTickAt,
    timeoutTriggered,
    clockNotice,
    clockNoticeError,
    whiteClockLabel,
    blackClockLabel,
    formatClock,
    clockTone,
    checkTimeout,
    stopClock,
    startClock,
    commitClockTick,
    applyIncrement,
    resetClocks,
    dispose,
  }
}
