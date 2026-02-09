import { apiFetch } from './api'

export type MatchmakingMode = 'ranked' | 'friendly'

export type MatchmakingStatus =
  | { status: 'idle' }
  | { status: 'queued'; mode: MatchmakingMode; timeControl: string; side: string; queuedAt?: string }
  | { status: 'matched'; matchId: string; matchStatus?: string }

export const joinMatchmaking = async (payload: {
  mode: MatchmakingMode
  timeControl: string
  side: 'Blancs' | 'Noirs' | 'Aleatoire'
}): Promise<MatchmakingStatus> => {
  const response = await apiFetch<{ ok: boolean; status?: string; matchId?: string }>('matchmake-join', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error('Impossible de rejoindre la file.')
  }

  if (response.status === 'matched' && response.matchId) {
    return { status: 'matched', matchId: response.matchId }
  }

  return {
    status: 'queued',
    mode: payload.mode,
    timeControl: payload.timeControl,
    side: payload.side,
  }
}

export const getMatchmakingStatus = async (): Promise<MatchmakingStatus> => {
  const response = await apiFetch<{
    ok: boolean
    status?: string
    matchId?: string
    matchStatus?: string
    mode?: MatchmakingMode
    timeControl?: string
    side?: string
    queuedAt?: string
  }>('matchmake-status')

  if (!response.ok) {
    return { status: 'idle' }
  }

  if (response.status === 'matched' && response.matchId) {
    return { status: 'matched', matchId: response.matchId, matchStatus: response.matchStatus }
  }

  if (response.status === 'queued') {
    return {
      status: 'queued',
      mode: response.mode ?? 'ranked',
      timeControl: response.timeControl ?? '10+0',
      side: response.side ?? 'Aleatoire',
      queuedAt: response.queuedAt,
    }
  }

  return { status: 'idle' }
}

export const leaveMatchmaking = async (): Promise<void> => {
  await apiFetch<{ ok: boolean }>('matchmake-leave', {
    method: 'POST',
    body: JSON.stringify({}),
  })
}
