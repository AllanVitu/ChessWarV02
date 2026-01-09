import crypto from 'node:crypto'
import { json } from './_shared/response'
import { sql } from './_shared/db'
import { requireUserId } from './_shared/auth'

export const handler = async (event: { httpMethod: string; body?: string; headers: Record<string, string | undefined> }) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, message: 'Methode non autorisee.' })
  }

  const userId = await requireUserId(event.headers)
  if (!userId) {
    return json(401, { ok: false, message: 'Session invalide.' })
  }

  const payload = event.body ? (JSON.parse(event.body) as Record<string, string>) : {}
  const currentPassword = String(payload.currentPassword || '')
  const nextPassword = String(payload.nextPassword || '')

  if (!currentPassword || !nextPassword) {
    return json(400, { ok: false, message: 'Veuillez remplir tous les champs.' })
  }

  const users = await sql<{ password_hash: string; password_salt: string }[]>`
    SELECT password_hash, password_salt
    FROM users
    WHERE id = ${userId}
    LIMIT 1
  `

  if (!users.length) {
    return json(404, { ok: false, message: 'Utilisateur introuvable.' })
  }

  const user = users[0]
  const computedHash = crypto
    .pbkdf2Sync(currentPassword, user.password_salt, 120000, 32, 'sha256')
    .toString('hex')

  const stored = Buffer.from(user.password_hash, 'hex')
  const incoming = Buffer.from(computedHash, 'hex')

  if (stored.length !== incoming.length || !crypto.timingSafeEqual(stored, incoming)) {
    return json(401, { ok: false, message: 'Mot de passe actuel incorrect.' })
  }

  const nextSalt = crypto.randomBytes(16).toString('hex')
  const nextHash = crypto
    .pbkdf2Sync(nextPassword, nextSalt, 120000, 32, 'sha256')
    .toString('hex')

  await sql`
    UPDATE users
    SET password_hash = ${nextHash},
        password_salt = ${nextSalt}
    WHERE id = ${userId}
  `

  return json(200, { ok: true, message: 'Mot de passe mis a jour.' })
}
