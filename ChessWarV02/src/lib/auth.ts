import { apiFetch, getSessionToken, setSessionToken } from './api'
import { clearGuestSession } from './guest'
import { clearDashboardCache } from './localDb'
import { clearMatchesCache } from './matchesDb'

export type AuthUser = {
  id: string
  email: string
  displayName: string
  createdAt: string
}

type AuthResult = {
  ok: boolean
  message: string
  user?: AuthUser
}

const clearCaches = () => {
  clearDashboardCache()
  clearMatchesCache()
}

export const clearSession = async (): Promise<void> => {
  try {
    if (getSessionToken()) {
      await apiFetch('auth-logout', { method: 'POST' })
    }
  } catch {
    // Ignore logout errors to allow local cleanup.
  } finally {
    setSessionToken(null)
    clearGuestSession()
    clearCaches()
  }
}

export const getCurrentUser = async (): Promise<AuthUser | null> => {
  if (!getSessionToken()) return null
  try {
    const response = await apiFetch<{ ok: boolean; user?: AuthUser }>('auth-session')
    return response.ok ? response.user ?? null : null
  } catch {
    return null
  }
}

export const registerUser = async (
  email: string,
  password: string,
  displayName: string,
): Promise<AuthResult> => {
  if (!email || !password || !displayName) {
    return { ok: false, message: 'Veuillez remplir tous les champs.' }
  }

  try {
    const response = await apiFetch<{
      ok: boolean
      message: string
      user?: AuthUser
      token?: string
    }>('auth-register', {
      method: 'POST',
      body: JSON.stringify({
        email: email.trim(),
        password,
        displayName: displayName.trim(),
      }),
    })

    if (response.ok && response.token) {
      setSessionToken(response.token)
      clearGuestSession()
      clearCaches()
    }

    return { ok: response.ok, message: response.message, user: response.user }
  } catch (error) {
    return { ok: false, message: (error as Error).message }
  }
}

export const loginUser = async (email: string, password: string): Promise<AuthResult> => {
  if (!email || !password) {
    return { ok: false, message: 'Veuillez remplir tous les champs.' }
  }

  try {
    const response = await apiFetch<{
      ok: boolean
      message: string
      user?: AuthUser
      token?: string
    }>('auth-login', {
      method: 'POST',
      body: JSON.stringify({
        email: email.trim(),
        password,
      }),
    })

    if (response.ok && response.token) {
      setSessionToken(response.token)
      clearGuestSession()
      clearCaches()
    }

    return { ok: response.ok, message: response.message, user: response.user }
  } catch (error) {
    return { ok: false, message: (error as Error).message }
  }
}

export const requestPasswordReset = (email: string): AuthResult => {
  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail) {
    return { ok: false, message: 'Veuillez saisir un email.' }
  }

  return {
    ok: true,
    message: 'Si un compte existe, un lien de reinitialisation a ete envoye.'
  }
}

export const updatePassword = async (
  currentPassword: string,
  nextPassword: string,
): Promise<AuthResult> => {
  if (!currentPassword || !nextPassword) {
    return { ok: false, message: 'Veuillez remplir tous les champs.' }
  }

  try {
    const response = await apiFetch<{ ok: boolean; message: string }>('auth-password', {
      method: 'POST',
      body: JSON.stringify({
        currentPassword,
        nextPassword,
      }),
    })

    return { ok: response.ok, message: response.message }
  } catch (error) {
    return { ok: false, message: (error as Error).message }
  }
}
