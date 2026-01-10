import { json, options } from './_shared/response'
import { sql } from './_shared/db'
import { requireUserId } from './_shared/auth'
import { ensureDashboardSeed } from './_shared/seed'

const formatLastSeenFallback = () => {
  const now = new Date()
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  return `Aujourd'hui ${hours}:${minutes}`
}

export const handler = async (event: { httpMethod: string; headers: Record<string, string | undefined> }) => {
  if (event.httpMethod === 'OPTIONS') {
    return options()
  }
  if (event.httpMethod !== 'GET') {
    return json(405, { ok: false, message: 'Methode non autorisee.' })
  }

  const userId = await requireUserId(event.headers)
  if (!userId) {
    return json(401, { ok: false, message: 'Session invalide.' })
  }

  const users = await sql<{ id: string; email: string; display_name: string }[]>`
    SELECT id, email, display_name
    FROM users
    WHERE id = ${userId}
    LIMIT 1
  `

  if (!users.length) {
    return json(404, { ok: false, message: 'Utilisateur introuvable.' })
  }

  const user = users[0]
  await ensureDashboardSeed(user.id, user.email, user.display_name, formatLastSeenFallback())

  const profiles = await sql<
    { name: string; title: string; rating: number; motto: string; location: string; last_seen: string; email: string }[]
  >`
    SELECT name, title, rating, motto, location, last_seen, email
    FROM profiles
    WHERE user_id = ${user.id}
    LIMIT 1
  `

  const games = await sql<
    { id: string; opponent: string; result: string; opening: string; date: string; moves: number; accuracy: number }[]
  >`
    SELECT id, opponent, result, opening, date, moves, accuracy
    FROM games
    WHERE user_id = ${user.id}
    ORDER BY id DESC
  `

  const goals = await sql<{ label: string; progress: number }[]>`
    SELECT label, progress
    FROM goals
    WHERE user_id = ${user.id}
    ORDER BY id ASC
  `

  const profile = profiles[0]

  return json(200, {
    ok: true,
    dashboard: {
      profile: {
        id: user.id,
        name: profile?.name ?? user.display_name,
        title: profile?.title ?? '',
        rating: profile?.rating ?? 0,
        motto: profile?.motto ?? '',
        location: profile?.location ?? '',
        lastSeen: profile?.last_seen ?? '',
        email: profile?.email ?? user.email,
      },
      games,
      goals,
    },
  })
}
