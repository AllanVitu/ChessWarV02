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

export type MatchOnlineState = {
  matchId: string
  status: string
  sideToMove: OnlineSide
  lastMove: string
  moveCount: number
  yourSide: OnlineSide
  moves: OnlineMove[]
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
