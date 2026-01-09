import { json } from './_shared/response'
import { sql } from './_shared/db'
import { requireUserId } from './_shared/auth'

export const handler = async (event: { httpMethod: string; headers: Record<string, string | undefined> }) => {
  if (event.httpMethod !== 'GET') {
    return json(405, { ok: false, message: 'Methode non autorisee.' })
  }

  const userId = await requireUserId(event.headers)
  if (!userId) {
    return json(401, { ok: false, message: 'Session invalide.' })
  }

  const users = await sql<{ id: string; email: string; display_name: string; created_at: string }[]>`
    SELECT id, email, display_name, created_at
    FROM users
    WHERE id = ${userId}
    LIMIT 1
  `

  if (!users.length) {
    return json(401, { ok: false, message: 'Session invalide.' })
  }

  const user = users[0]
  return json(200, {
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      createdAt: user.created_at,
    },
  })
}
