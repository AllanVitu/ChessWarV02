import { ApiProtocolError, apiFetch } from './api'

export type MatchmakingMode = 'ranked' | 'friendly'

export type MatchmakingStatus =
  | { status: 'idle'; serviceMessage?: string }
  | { status: 'queued'; mode: MatchmakingMode; timeControl: string; side: string; queuedAt?: string }
  | { status: 'matched'; matchId: string; matchStatus?: string }

const MATCHMAKING_SERVICE_MESSAGE =
  "Matchmaking indisponible pour le moment. Verifiez l'API /api puis reessayez."

const toServiceMessage = (error: unknown): string => {
  if (error instanceof ApiProtocolError) {
    return MATCHMAKING_SERVICE_MESSAGE
  }
  if (error instanceof Error && /Network|Failed to fetch|AbortError/i.test(error.message)) {
    return 'Connexion instable. Verification automatique en cours.'
  }
  return MATCHMAKING_SERVICE_MESSAGE
}

export const joinMatchmaking = async (payload: {
  mode: MatchmakingMode
  timeControl: string
  side: 'Blancs' | 'Noirs' | 'Aleatoire'
}): Promise<MatchmakingStatus> => {
  let response: { ok: boolean; status?: string; matchId?: string }
  try {
    response = await apiFetch<{ ok: boolean; status?: string; matchId?: string }>('matchmake-join', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  } catch (error) {
    throw new Error(toServiceMessage(error))
  }

  if (!response.ok) {
    throw new Error(MATCHMAKING_SERVICE_MESSAGE)
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
  try {
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
  } catch (error) {
    return {
      status: 'idle',
      serviceMessage: toServiceMessage(error),
    }
  }
}

export const leaveMatchmaking = async (): Promise<void> => {
  try {
    await apiFetch<{ ok: boolean }>('matchmake-leave', {
      method: 'POST',
      body: JSON.stringify({}),
    })
  } catch {
    // Ignore leave failures to keep UI responsive.
  }
}
