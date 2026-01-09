import crypto from 'node:crypto'
import { json } from './_shared/response'
import { sql } from './_shared/db'
import { ensureDashboardSeed, ensureMatchesSeed } from './_shared/seed'

const formatLastSeen = () => {
  const now = new Date()
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  return `Aujourd'hui ${hours}:${minutes}`
}

export const handler = async (event: { httpMethod: string; body?: string }) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, message: 'Methode non autorisee.' })
  }

  const payload = event.body ? (JSON.parse(event.body) as Record<string, string>) : {}
  const email = String(payload.email || '').trim().toLowerCase()
  const password = String(payload.password || '')
  const displayName = String(payload.displayName || '').trim()

  if (!email || !password || !displayName) {
    return json(400, { ok: false, message: 'Veuillez remplir tous les champs.' })
  }

  const existing = await sql<{ id: string }[]>`
    SELECT id
    FROM users
    WHERE email = ${email}
    LIMIT 1
  `

  if (existing.length) {
    return json(409, { ok: false, message: 'Cet email est deja utilise.' })
  }

  const salt = crypto.randomBytes(16).toString('hex')
  const passwordHash = crypto
    .pbkdf2Sync(password, salt, 120000, 32, 'sha256')
    .toString('hex')

  const created = await sql<
    { id: string; email: string; display_name: string; created_at: string }[]
  >`
    INSERT INTO users
      (email, display_name, password_hash, password_salt)
    VALUES
      (${email}, ${displayName}, ${passwordHash}, ${salt})
    RETURNING id, email, display_name, created_at
  `

  const user = created[0]
  const token = crypto.randomUUID()

  await sql`
    INSERT INTO sessions (token, user_id)
    VALUES (${token}, ${user.id})
  `

  const lastSeen = formatLastSeen()
  await ensureDashboardSeed(user.id, user.email, user.display_name, lastSeen)
  await ensureMatchesSeed(user.id)

  return json(200, {
    ok: true,
    message: 'Compte cree avec succes.',
    token,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      createdAt: user.created_at,
    },
  })
}
