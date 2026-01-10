import crypto from 'node:crypto'
import { json, options } from './_shared/response'
import { sql } from './_shared/db'
import { ensureDashboardSeed, ensureMatchesSeed } from './_shared/seed'

const formatLastSeen = () => {
  const now = new Date()
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  return `Aujourd'hui ${hours}:${minutes}`
}

export const handler = async (event: { httpMethod: string; body?: string }) => {
  if (event.httpMethod === 'OPTIONS') {
    return options()
  }
  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, message: 'Methode non autorisee.' })
  }

  const payload = event.body ? (JSON.parse(event.body) as Record<string, string>) : {}
  const email = String(payload.email || '').trim().toLowerCase()
  const password = String(payload.password || '')

  if (!email || !password) {
    return json(400, { ok: false, message: 'Veuillez remplir tous les champs.' })
  }

  const users = await sql<
    { id: string; email: string; display_name: string; password_hash: string; password_salt: string; created_at: string }[]
  >`
    SELECT id, email, display_name, password_hash, password_salt, created_at
    FROM users
    WHERE email = ${email}
    LIMIT 1
  `

  if (!users.length) {
    return json(401, { ok: false, message: 'Identifiants invalides.' })
  }

  const user = users[0]
  const computedHash = crypto
    .pbkdf2Sync(password, user.password_salt, 120000, 32, 'sha256')
    .toString('hex')

  const stored = Buffer.from(user.password_hash, 'hex')
  const incoming = Buffer.from(computedHash, 'hex')

  if (stored.length !== incoming.length || !crypto.timingSafeEqual(stored, incoming)) {
    return json(401, { ok: false, message: 'Identifiants invalides.' })
  }

  const token = crypto.randomUUID()

  await sql`
    INSERT INTO sessions (token, user_id)
    VALUES (${token}, ${user.id})
  `

  const lastSeen = formatLastSeen()
  await ensureDashboardSeed(user.id, user.email, user.display_name, lastSeen)
  await ensureMatchesSeed(user.id)
  await sql`
    UPDATE profiles
    SET last_seen = ${lastSeen}
    WHERE user_id = ${user.id}
  `

  return json(200, {
    ok: true,
    message: 'Connexion reussie.',
    token,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      createdAt: user.created_at,
    },
  })
}
