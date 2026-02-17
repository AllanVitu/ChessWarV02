import { ApiProtocolError, apiFetch } from './api'

export type LeaderboardScope = 'global' | 'monthly' | 'friends'

export type LeaderboardPlayer = {
  id: string
  rank: number
  name: string
  rating: number
  delta: number
}

export type LeaderboardResult = {
  players: LeaderboardPlayer[]
  serviceMessage?: string
}

const LEADERBOARD_SERVICE_MESSAGE =
  "Classement temporairement indisponible. Verifiez l'API /api puis reessayez."

export const getLeaderboard = async (
  scope: LeaderboardScope,
  page = 1,
  pageSize = 20,
): Promise<LeaderboardResult> => {
  const params = new URLSearchParams({
    scope,
    page: String(page),
    pageSize: String(pageSize),
  })

  try {
    const response = await apiFetch<{ ok: boolean; players?: LeaderboardPlayer[] }>(
      `leaderboard-get?${params.toString()}`,
    )
    if (!response.ok || !response.players) {
      return { players: [], serviceMessage: LEADERBOARD_SERVICE_MESSAGE }
    }
    return { players: response.players }
  } catch (error) {
    if (error instanceof ApiProtocolError) {
      return { players: [], serviceMessage: LEADERBOARD_SERVICE_MESSAGE }
    }
    if (error instanceof Error && /Network|Failed to fetch|AbortError/i.test(error.message)) {
      return { players: [], serviceMessage: 'Connexion instable. Nouvelle tentative possible.' }
    }
    return { players: [], serviceMessage: LEADERBOARD_SERVICE_MESSAGE }
  }
}
