import { json, options } from './_shared/response'
import { sql } from './_shared/db'
import { requireUserId } from './_shared/auth'

export const handler = async (event: {
  httpMethod: string
  headers: Record<string, string | undefined>
  body?: string
}) => {
  if (event.httpMethod === 'OPTIONS') {
    return options()
  }
  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, message: 'Methode non autorisee.' })
  }

  const userId = await requireUserId(event.headers)
  if (!userId) {
    return json(401, { ok: false, message: 'Session invalide.' })
  }

  const payload = event.body ? (JSON.parse(event.body) as Record<string, unknown>) : {}
  const match = (payload.match || {}) as Record<string, string>

  if (!match.id || !match.mode || !match.status) {
    return json(400, { ok: false, message: 'Match invalide.' })
  }

  await sql`
    INSERT INTO matches
      (id, user_id, mode, opponent, status, created_at, last_move, time_control, side, difficulty)
    VALUES
      (${match.id}, ${userId}, ${match.mode}, ${match.opponent ?? ''}, ${match.status},
       ${match.createdAt ?? ''}, ${match.lastMove ?? ''}, ${match.timeControl ?? ''},
       ${match.side ?? ''}, ${match.difficulty ?? null})
  `

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
    matches: matches.map((item) => ({
      id: item.id,
      mode: item.mode,
      opponent: item.opponent,
      status: item.status,
      createdAt: item.created_at,
      lastMove: item.last_move,
      timeControl: item.time_control,
      side: item.side,
      difficulty: item.difficulty ?? undefined,
    })),
  })
}
