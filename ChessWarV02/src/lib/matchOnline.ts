import { apiFetch, getSessionToken } from './api'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

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
  yourSide: OnlineSide
  moves: OnlineMove[]
  messages?: OnlineMessage[]
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
  result: 'resign' | 'draw',
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
