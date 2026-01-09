import { json } from './_shared/response'
import { sql } from './_shared/db'
import { requireUserId } from './_shared/auth'

export const handler = async (event: {
  httpMethod: string
  headers: Record<string, string | undefined>
  body?: string
}) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, message: 'Methode non autorisee.' })
  }

  const userId = await requireUserId(event.headers)
  if (!userId) {
    return json(401, { ok: false, message: 'Session invalide.' })
  }

  const payload = event.body ? (JSON.parse(event.body) as Record<string, unknown>) : {}
  const profile = (payload.profile || {}) as Record<string, string>

  await sql`
    UPDATE profiles
    SET name = ${profile.name ?? ''},
        title = ${profile.title ?? ''},
        motto = ${profile.motto ?? ''},
        location = ${profile.location ?? ''}
    WHERE user_id = ${userId}
  `

  await sql`
    UPDATE users
    SET display_name = ${profile.name ?? ''}
    WHERE id = ${userId}
  `

  const profiles = await sql<
    { name: string; title: string; rating: number; motto: string; location: string; last_seen: string; email: string }[]
  >`
    SELECT name, title, rating, motto, location, last_seen, email
    FROM profiles
    WHERE user_id = ${userId}
    LIMIT 1
  `

  const games = await sql<
    { id: string; opponent: string; result: string; opening: string; date: string; moves: number; accuracy: number }[]
  >`
    SELECT id, opponent, result, opening, date, moves, accuracy
    FROM games
    WHERE user_id = ${userId}
    ORDER BY id DESC
  `

  const goals = await sql<{ label: string; progress: number }[]>`
    SELECT label, progress
    FROM goals
    WHERE user_id = ${userId}
    ORDER BY id ASC
  `

  const profileRow = profiles[0]

  return json(200, {
    ok: true,
    dashboard: {
      profile: {
        id: userId,
        name: profileRow?.name ?? profile.name ?? '',
        title: profileRow?.title ?? '',
        rating: profileRow?.rating ?? 0,
        motto: profileRow?.motto ?? '',
        location: profileRow?.location ?? '',
        lastSeen: profileRow?.last_seen ?? '',
        email: profileRow?.email ?? '',
      },
      games,
      goals,
    },
  })
}
