import { json, options } from './_shared/response'
import { sql } from './_shared/db'
import { getTokenFromHeaders } from './_shared/auth'

export const handler = async (event: { httpMethod: string; headers: Record<string, string | undefined> }) => {
  if (event.httpMethod === 'OPTIONS') {
    return options()
  }
  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, message: 'Methode non autorisee.' })
  }

  const token = getTokenFromHeaders(event.headers)
  if (token) {
    await sql`
      DELETE FROM sessions
      WHERE token = ${token}
    `
  }

  return json(200, { ok: true })
}
