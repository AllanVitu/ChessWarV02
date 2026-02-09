import { apiFetch } from './api'

export type LeaderboardScope = 'global' | 'monthly' | 'friends'

export type LeaderboardPlayer = {
  id: string
  rank: number
  name: string
  rating: number
  delta: number
}

export const getLeaderboard = async (
  scope: LeaderboardScope,
  page = 1,
  pageSize = 20,
): Promise<LeaderboardPlayer[]> => {
  const params = new URLSearchParams({
    scope,
    page: String(page),
    pageSize: String(pageSize),
  })

  const response = await apiFetch<{ ok: boolean; players?: LeaderboardPlayer[] }>(
    `leaderboard-get?${params.toString()}`,
  )
  if (!response.ok || !response.players) return []
  return response.players
}
