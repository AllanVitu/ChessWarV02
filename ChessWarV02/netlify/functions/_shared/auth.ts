import { sql } from './db'

const extractToken = (headers: Record<string, string | undefined>) => {
  const authHeader = headers.authorization || headers.Authorization
  if (!authHeader) return null
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }
  return authHeader
}

export const requireUserId = async (headers: Record<string, string | undefined>) => {
  const token = extractToken(headers)
  if (!token) return null

  const sessions = await sql<{ user_id: string }[]>`
    SELECT user_id
    FROM sessions
    WHERE token = ${token}
    LIMIT 1
  `

  if (!sessions.length) return null
  return sessions[0].user_id
}

export const getTokenFromHeaders = (headers: Record<string, string | undefined>) =>
  extractToken(headers)
