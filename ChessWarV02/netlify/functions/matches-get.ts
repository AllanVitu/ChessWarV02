import { json } from './_shared/response'
import { sql } from './_shared/db'
import { requireUserId } from './_shared/auth'
import { ensureMatchesSeed } from './_shared/seed'

export const handler = async (event: { httpMethod: string; headers: Record<string, string | undefined> }) => {
  if (event.httpMethod !== 'GET') {
    return json(405, { ok: false, message: 'Methode non autorisee.' })
  }

  const userId = await requireUserId(event.headers)
  if (!userId) {
    return json(401, { ok: false, message: 'Session invalide.' })
  }

  await ensureMatchesSeed(userId)

  const matches = await sql<
    {
      id: string
      mode: string
      opponent: string
      status: string
      created_at: string
      last_move: string
      time_control: string
      side: string
      difficulty: string | null
    }[]
  >`
    SELECT id, mode, opponent, status, created_at, last_move, time_control, side, difficulty
    FROM matches
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
  `

  return json(200, {
    ok: true,
    matches: matches.map((match) => ({
      id: match.id,
      mode: match.mode,
      opponent: match.opponent,
      status: match.status,
      createdAt: match.created_at,
      lastMove: match.last_move,
      timeControl: match.time_control,
      side: match.side,
      difficulty: match.difficulty ?? undefined,
    })),
  })
}
