import { apiFetch, getSessionToken } from './api'
import { enqueueAction, isNetworkError, isOffline } from './offlineQueue'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'
const WS_BASE = (() => {
  const raw = String(import.meta.env.VITE_WS_BASE || '').trim()
  if (!raw) return ''
  if (raw.startsWith('ws://') || raw.startsWith('wss://')) return raw
  if (raw.startsWith('https://')) return `wss://${raw.slice(8)}`
  if (raw.startsWith('http://')) return `ws://${raw.slice(7)}`
  return raw
})()

export type OnlineSide = 'white' | 'black'

export type OnlineMove = {
  ply: number
  side: OnlineSide
  from: string
  to: string
  notation: string
  createdAt: string
}

export type OnlineMessage = {
  id: number | string
  userId: string
  userName: string
  message: string
  createdAt: string
}

export type MatchOnlineState = {
  matchId: string
  whiteId?: string | null
  blackId?: string | null
  status: string
  sideToMove: OnlineSide
  lastMove: string
  moveCount: number
  createdAt?: string | null
  updatedAt?: string | null
  yourSide: OnlineSide
  mode?: 'Local' | 'IA' | 'JcJ' | null
  opponent?: string | null
  timeControl?: string | null
  side?: 'Blancs' | 'Noirs' | 'Aleatoire' | null
  moves: OnlineMove[]
  messages?: OnlineMessage[]
}

export type MatchSocketMessage = {
  type: string
  matchId?: string
  match?: MatchOnlineState
  message?: string
  event?: string
}

export const getMatchRoom = async (matchId: string): Promise<MatchOnlineState> => {
  const response = await apiFetch<{ ok: boolean; match?: MatchOnlineState }>(
    `match-room-get?matchId=${encodeURIComponent(matchId)}`,
  )
  if (!response.ok || !response.match) {
    throw new Error('Match introuvable.')
  }
  return response.match
}

export const addMatchMove = async (
  matchId: string,
  move: { from: string; to: string; notation: string },
): Promise<MatchOnlineState> => {
  if (isOffline()) {
    await enqueueAction('match-move', { matchId, ...move })
    throw new Error('Connexion hors ligne. Coup mis en attente.')
  }

  try {
    const response = await apiFetch<{ ok: boolean; match?: MatchOnlineState }>('match-move-add', {
      method: 'POST',
      body: JSON.stringify({
        matchId,
        from: move.from,
        to: move.to,
        notation: move.notation,
      }),
    })

    if (!response.ok || !response.match) {
      throw new Error('Impossible de jouer le coup.')
    }
    return response.match
  } catch (error) {
    if (isNetworkError(error) || isOffline()) {
      await enqueueAction('match-move', { matchId, ...move })
      throw new Error('Connexion instable. Coup mis en attente.')
    }
    throw error
  }
}

export const addMatchMessage = async (
  matchId: string,
  message: string,
): Promise<MatchOnlineState> => {
  const response = await apiFetch<{ ok: boolean; match?: MatchOnlineState }>('match-message-add', {
    method: 'POST',
    body: JSON.stringify({ matchId, message }),
  })

  if (!response.ok || !response.match) {
    throw new Error("Impossible d'envoyer le message.")
  }
  return response.match
}

export const finishMatch = async (
  matchId: string,
  result: 'resign' | 'draw' | 'timeout',
): Promise<MatchOnlineState> => {
  const response = await apiFetch<{ ok: boolean; match?: MatchOnlineState }>('match-finish', {
    method: 'POST',
    body: JSON.stringify({ matchId, result }),
  })

  if (!response.ok || !response.match) {
    throw new Error('Impossible de terminer le match.')
  }
  return response.match
}

export const openMatchStream = (
  matchId: string,
  onMessage: (payload: MatchOnlineState) => void,
  onError?: (event: Event) => void,
): EventSource | null => {
  const token = getSessionToken()
  if (!token) return null

  const source = new EventSource(
    `${API_BASE}/match-stream?matchId=${encodeURIComponent(matchId)}&token=${encodeURIComponent(token)}`,
  )

  source.addEventListener('match', (event) => {
    try {
      const data = JSON.parse((event as MessageEvent).data) as MatchOnlineState
      onMessage(data)
    } catch {
      // Ignore malformed payloads.
    }
  })

  if (onError) {
    source.addEventListener('error', onError)
  }

  return source
}

export const openMatchSocket = (
  matchId: string,
  onMessage: (payload: MatchSocketMessage) => void,
  onError?: (event: Event) => void,
): WebSocket | null => {
  if (!WS_BASE) return null
  const token = getSessionToken()
  if (!token || !matchId) return null

  const socket = new WebSocket(WS_BASE)
  const subscribe = JSON.stringify({ type: 'subscribe', matchId, token })

  socket.addEventListener('open', () => {
    socket.send(subscribe)
  })

  socket.addEventListener('message', (event) => {
    try {
      const data = JSON.parse(String(event.data)) as MatchSocketMessage
      onMessage(data)
    } catch {
      // Ignore malformed payloads.
    }
  })

  if (onError) {
    socket.addEventListener('error', onError)
  }

  return socket
}
