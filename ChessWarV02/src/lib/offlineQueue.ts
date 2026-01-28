import { apiFetch, getSessionToken } from './api'

type OfflineActionType = 'profile-save' | 'friend-request' | 'match-move' | 'match-invite'

type OfflineAction = {
  id: string
  type: OfflineActionType
  payload: Record<string, unknown>
  createdAt: string
  attempts: number
}

type QueueListener = (count: number) => void

const STORAGE_KEY = 'warchess.offline.queue'
const MAX_ATTEMPTS = 5

let queue: OfflineAction[] = []
let loaded = false
let flushing = false
const listeners = new Set<QueueListener>()

const isBrowser = () => typeof window !== 'undefined'

export const isOffline = (): boolean => {
  if (!isBrowser() || typeof navigator === 'undefined') return false
  return navigator.onLine === false
}

export const isNetworkError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false
  if (error.name === 'AbortError') return true
  return /Network|Failed to fetch|load failed/i.test(error.message)
}

const loadQueue = () => {
  if (loaded || !isBrowser()) return
  loaded = true
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    queue = stored ? (JSON.parse(stored) as OfflineAction[]) : []
  } catch {
    queue = []
  }
}

const persistQueue = () => {
  if (!isBrowser()) return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(queue))
  } catch {
    // Ignore storage failures.
  }
}

const notify = () => {
  for (const listener of listeners) {
    listener(queue.length)
  }
}

export const subscribeQueue = (listener: QueueListener): (() => void) => {
  loadQueue()
  listeners.add(listener)
  listener(queue.length)
  return () => {
    listeners.delete(listener)
  }
}

export const getQueueCount = (): number => {
  loadQueue()
  return queue.length
}

export const clearOfflineQueue = (): void => {
  loadQueue()
  queue = []
  persistQueue()
  notify()
}

const registerSync = () => {
  if (!isBrowser()) return
  if (!('serviceWorker' in navigator)) return
  const supportsSync = 'SyncManager' in window
  if (!supportsSync) return
  navigator.serviceWorker.ready
    .then((registration) => {
      const syncManager = (
        registration as ServiceWorkerRegistration & {
          sync?: { register: (tag: string) => Promise<void> }
        }
      ).sync
      if (!syncManager) return
      return syncManager.register('warchess-sync')
    })
    .catch(() => {})
}

const buildActionId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

export const enqueueAction = async (
  type: OfflineActionType,
  payload: Record<string, unknown>,
): Promise<string> => {
  loadQueue()
  if (type === 'profile-save') {
    queue = queue.filter((item) => item.type !== 'profile-save')
  }
  const action: OfflineAction = {
    id: buildActionId(),
    type,
    payload,
    createdAt: new Date().toISOString(),
    attempts: 0,
  }
  queue.push(action)
  persistQueue()
  notify()
  registerSync()
  if (!isOffline()) {
    void flushQueue()
  }
  return action.id
}

const executeAction = async (action: OfflineAction) => {
  switch (action.type) {
    case 'profile-save': {
      const profile = action.payload.profile as Record<string, unknown> | undefined
      if (!profile) return
      await apiFetch('dashboard-save', {
        method: 'POST',
        body: JSON.stringify({ profile }),
        dedupe: false,
      })
      return
    }
    case 'friend-request': {
      const userId = action.payload.userId as string | undefined
      if (!userId) return
      await apiFetch('friends-request', {
        method: 'POST',
        body: JSON.stringify({ userId }),
        dedupe: false,
      })
      return
    }
    case 'match-invite': {
      const userId = action.payload.userId as string | undefined
      if (!userId) return
      await apiFetch('match-invite-create', {
        method: 'POST',
        body: JSON.stringify({
          userId,
          timeControl: action.payload.timeControl ?? '10+0',
          requesterSide: action.payload.requesterSide ?? 'Aleatoire',
        }),
        dedupe: false,
      })
      return
    }
    case 'match-move': {
      const matchId = action.payload.matchId as string | undefined
      const from = action.payload.from as string | undefined
      const to = action.payload.to as string | undefined
      const notation = action.payload.notation as string | undefined
      if (!matchId || !from || !to || !notation) return
      await apiFetch('match-move-add', {
        method: 'POST',
        body: JSON.stringify({ matchId, from, to, notation }),
        dedupe: false,
      })
      return
    }
    default:
      return
  }
}

export const flushQueue = async (): Promise<void> => {
  loadQueue()
  if (flushing) return
  if (isOffline()) return
  if (!getSessionToken()) return
  if (!queue.length) return

  flushing = true
  const nextQueue: OfflineAction[] = []

  for (let index = 0; index < queue.length; index += 1) {
    const action = queue[index]
    if (!action) continue
    if (action.attempts >= MAX_ATTEMPTS) {
      continue
    }
    try {
      await executeAction(action)
    } catch (error) {
      action.attempts += 1
      if (isOffline() || isNetworkError(error)) {
        nextQueue.push(action, ...queue.slice(index + 1))
        break
      }
      if (action.attempts < MAX_ATTEMPTS) {
        nextQueue.push(action)
      }
    }
  }

  queue = nextQueue
  persistQueue()
  notify()
  flushing = false
}

export const setupOfflineQueueSync = (): void => {
  loadQueue()
  notify()
  if (!isOffline()) {
    void flushQueue()
  }
  if (!isBrowser()) return
  window.addEventListener('online', () => {
    void flushQueue()
  })
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'flush-queue') {
        void flushQueue()
      }
    })
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      void flushQueue()
    }
  })
}
