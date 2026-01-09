import { getDashboardData, saveDashboardData } from './localDb'

export type AuthUser = {
  id: string
  email: string
  displayName: string
  passwordHash: string
  createdAt: string
}

type AuthResult = {
  ok: boolean
  message: string
  user?: AuthUser
}

type SessionState = {
  userId: string
  lastLogin: string
}

const USERS_KEY = 'warchess.users.v1'
const SESSION_KEY = 'warchess.session.v1'

const hasStorage = () => typeof window !== 'undefined' && typeof localStorage !== 'undefined'

const safeParse = <T>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

const getUsers = (): AuthUser[] => {
  if (!hasStorage()) return []
  return safeParse<AuthUser[]>(localStorage.getItem(USERS_KEY), [])
}

const saveUsers = (users: AuthUser[]): void => {
  if (!hasStorage()) return
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

const getSession = (): SessionState | null => {
  if (!hasStorage()) return null
  return safeParse<SessionState | null>(localStorage.getItem(SESSION_KEY), null)
}

const setSession = (userId: string): void => {
  if (!hasStorage()) return
  const session: SessionState = { userId, lastLogin: new Date().toISOString() }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export const ensureAuthStorage = (): void => {
  if (!hasStorage()) return
  if (!localStorage.getItem(USERS_KEY)) {
    localStorage.setItem(USERS_KEY, JSON.stringify([]))
  }
  if (!localStorage.getItem(SESSION_KEY)) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(null))
  }
}

const syncProfile = (user: AuthUser): void => {
  const data = getDashboardData()
  const nextProfile = {
    ...data.profile,
    name: user.displayName || data.profile.name,
    email: user.email || data.profile.email,
  }
  saveDashboardData({ ...data, profile: nextProfile })
}

export const clearSession = (): void => {
  if (!hasStorage()) return
  localStorage.removeItem(SESSION_KEY)
}

const hashPassword = async (password: string): Promise<string> => {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const data = new TextEncoder().encode(password)
    const digest = await crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(digest))
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('')
  }

  return btoa(password)
}

export const getCurrentUser = (): AuthUser | null => {
  const session = getSession()
  if (!session) return null
  return getUsers().find((user) => user.id === session.userId) ?? null
}

export const registerUser = async (
  email: string,
  password: string,
  displayName: string,
): Promise<AuthResult> => {
  if (!hasStorage()) {
    return { ok: false, message: 'Stockage indisponible.' }
  }

  const users = getUsers()
  const normalizedEmail = email.trim().toLowerCase()

  if (!normalizedEmail || !password || !displayName) {
    return { ok: false, message: 'Veuillez remplir tous les champs.' }
  }

  if (users.some((user) => user.email === normalizedEmail)) {
    return { ok: false, message: 'Cet email est deja utilise.' }
  }

  const passwordHash = await hashPassword(password)
  const user: AuthUser = {
    id: `user-${Date.now()}`,
    email: normalizedEmail,
    displayName: displayName.trim(),
    passwordHash,
    createdAt: new Date().toISOString(),
  }

  const nextUsers = [...users, user]
  saveUsers(nextUsers)
  setSession(user.id)
  syncProfile(user)

  return { ok: true, message: 'Compte cree avec succes.', user }
}

export const loginUser = async (email: string, password: string): Promise<AuthResult> => {
  if (!hasStorage()) {
    return { ok: false, message: 'Stockage indisponible.' }
  }

  const users = getUsers()
  const normalizedEmail = email.trim().toLowerCase()
  const user = users.find((entry) => entry.email === normalizedEmail)

  if (!user) {
    return { ok: false, message: 'Identifiants invalides.' }
  }

  const passwordHash = await hashPassword(password)
  if (passwordHash !== user.passwordHash) {
    return { ok: false, message: 'Identifiants invalides.' }
  }

  setSession(user.id)
  syncProfile(user)

  return { ok: true, message: 'Connexion reussie.', user }
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

export const updatePassword = async (userId: string, nextPassword: string): Promise<AuthResult> => {
  if (!hasStorage()) {
    return { ok: false, message: 'Stockage indisponible.' }
  }

  const users = getUsers()
  const userIndex = users.findIndex((user) => user.id === userId)

  if (userIndex === -1) {
    return { ok: false, message: 'Utilisateur introuvable.' }
  }

  if (!nextPassword) {
    return { ok: false, message: 'Mot de passe requis.' }
  }

  const passwordHash = await hashPassword(nextPassword)
  const nextUsers = [...users]
  nextUsers[userIndex] = { ...nextUsers[userIndex], passwordHash }
  saveUsers(nextUsers)

  return { ok: true, message: 'Mot de passe mis a jour.' }
}

