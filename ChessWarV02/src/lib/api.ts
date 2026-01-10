const API_BASE = import.meta.env.VITE_API_BASE || '/api'

const TOKEN_KEY = 'warchess.session.token'

export const getSessionToken = (): string | null => {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return null
  }
  return localStorage.getItem(TOKEN_KEY)
}

export const setSessionToken = (token: string | null): void => {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return
  }
  if (!token) {
    localStorage.removeItem(TOKEN_KEY)
    return
  }
  localStorage.setItem(TOKEN_KEY, token)
}

export const apiFetch = async <T>(
  path: string,
  options: RequestInit = {},
): Promise<T> => {
  const headers = new Headers(options.headers)
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const token = getSessionToken()
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(`${API_BASE}/${path}`, {
    ...options,
    headers,
  })

  const text = await response.text()
  const data = text ? (JSON.parse(text) as T) : ({} as T)

  if (!response.ok) {
    throw new Error((data as { message?: string }).message || 'Erreur serveur.')
  }

  return data
}
