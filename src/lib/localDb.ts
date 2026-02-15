import { apiFetch, getSessionToken } from './api'
import { isGuestSession } from './guest'
import { enqueueAction, isNetworkError, isOffline } from './offlineQueue'

export type GameResult = 'win' | 'loss' | 'draw'

export type GameRecord = {
  id: string
  opponent: string
  result: GameResult
  opening: string
  date: string
  moves: number
  accuracy: number
  pgn?: string
  finalFen?: string
  review?: {
    best?: number
    good?: number
    inaccuracies?: number
    mistakes?: number
    blunders?: number
  }
}

export type DashboardProfile = {
  id: string
  name: string
  title: string
  rating: number
  motto: string
  location: string
  lastSeen: string
  email: string
  avatarUrl: string
}

export type GoalProgress = {
  label: string
  progress: number
}

export type DashboardDb = {
  profile: DashboardProfile
  games: GameRecord[]
  goals: GoalProgress[]
}

const STORAGE_KEY = 'warchess.dashboard'
const LOCAL_GAMES_KEY = 'warchess.games.local'

const defaultDb: DashboardDb = {
  profile: {
    id: '',
    name: '',
    title: '',
    rating: 1200,
    motto: '',
    location: '',
    lastSeen: '',
    email: '',
    avatarUrl: '',
  },
  games: [],
  goals: [],
}

const guestProfile: Partial<DashboardProfile> = {
  name: 'Invite',
  title: 'Mode invite',
  rating: 1200,
  motto: 'Jouez librement, progressez ensuite.',
  location: 'Hors ligne',
  lastSeen: 'Maintenant',
  email: '',
}

let dashboardCache: DashboardDb | null = null
let dashboardPromise: Promise<DashboardDb> | null = null
let dashboardUpdatedAt = 0
const DASHBOARD_TTL = 60000

const readStorage = (): DashboardDb | null => {
  if (typeof window === 'undefined') return null
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored ? (JSON.parse(stored) as DashboardDb) : null
  } catch {
    return null
  }
}

const readLocalGames = (): GameRecord[] => {
  if (typeof window === 'undefined') return []
  try {
    const stored = window.localStorage.getItem(LOCAL_GAMES_KEY)
    return stored ? (JSON.parse(stored) as GameRecord[]) : []
  } catch {
    return []
  }
}

const writeLocalGames = (games: GameRecord[]): void => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LOCAL_GAMES_KEY, JSON.stringify(games))
  } catch {
    // Ignore storage failures (quota, private mode).
  }
}

const writeStorage = (payload: DashboardDb): void => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // Ignore storage failures (quota, private mode).
  }
}

const mapDashboard = (payload?: DashboardDb | null): DashboardDb => {
  if (!payload) return defaultDb
  return {
    profile: { ...defaultDb.profile, ...payload.profile },
    games: payload.games?.length ? payload.games : defaultDb.games,
    goals: payload.goals?.length ? payload.goals : defaultDb.goals,
  }
}

const applyGuestOverlay = (payload: DashboardDb): DashboardDb => {
  if (!isGuestSession()) return payload
  return {
    ...payload,
    profile: {
      ...payload.profile,
      ...guestProfile,
    },
  }
}

const mergeGames = (base: GameRecord[], local: GameRecord[]): GameRecord[] => {
  if (!local.length) return base
  const map = new Map<string, GameRecord>()
  for (const item of base) {
    map.set(item.id, item)
  }
  for (const item of local) {
    map.set(item.id, item)
  }
  return [...map.values()].sort((a, b) => {
    const left = new Date(b.date).getTime()
    const right = new Date(a.date).getTime()
    return (Number.isFinite(left) ? left : 0) - (Number.isFinite(right) ? right : 0)
  })
}

const mergeLocalGames = (payload: DashboardDb): DashboardDb => {
  const local = readLocalGames()
  if (!local.length) return payload
  return {
    ...payload,
    games: mergeGames(payload.games, local),
  }
}

export const clearDashboardCache = (): void => {
  dashboardCache = null
  dashboardPromise = null
  dashboardUpdatedAt = 0
}

const mergeDashboard = (target: DashboardDb, next: DashboardDb): void => {
  target.profile = { ...target.profile, ...next.profile }
  target.games = next.games
  target.goals = next.goals
}

export const getDashboardData = async (): Promise<DashboardDb> => {
  const stored = readStorage()
  const storedMapped = mergeLocalGames(applyGuestOverlay(mapDashboard(stored)))
  const storedAvatar = stored?.profile?.avatarUrl ?? ''
  if (!dashboardCache) {
    dashboardCache = storedMapped
  }

  if (!getSessionToken()) {
    return dashboardCache
  }

  const shouldRefresh = Date.now() - dashboardUpdatedAt > DASHBOARD_TTL
  if (!dashboardPromise && shouldRefresh) {
    dashboardPromise = apiFetch<{ ok: boolean; dashboard?: DashboardDb }>('dashboard-get')
      .then((response) => {
        if (!response.ok) return storedMapped
        const mapped = mapDashboard(response.dashboard)
        if (storedAvatar && !mapped.profile.avatarUrl) {
          mapped.profile.avatarUrl = storedAvatar
        }
        return mergeLocalGames(applyGuestOverlay(mapped))
      })
      .catch(() => storedMapped)
      .then((next) => {
        if (dashboardCache) {
          mergeDashboard(dashboardCache, next)
          writeStorage(dashboardCache)
          dashboardUpdatedAt = Date.now()
          return dashboardCache
        }
        dashboardCache = next
        writeStorage(next)
        dashboardUpdatedAt = Date.now()
        return next
      })
      .finally(() => {
        dashboardPromise = null
      })
  }

  return dashboardCache
}

export const saveDashboardData = async (next: DashboardDb): Promise<DashboardDb> => {
  dashboardCache = next
  writeStorage(next)
  dashboardUpdatedAt = Date.now()

  if (!getSessionToken()) {
    return next
  }

  if (isOffline()) {
    await enqueueAction('profile-save', { profile: next.profile })
    return next
  }

  try {
    const response = await apiFetch<{ ok: boolean; dashboard?: DashboardDb }>('dashboard-save', {
      method: 'POST',
      body: JSON.stringify({ profile: next.profile }),
    })

    const saved = response.ok ? mapDashboard(response.dashboard) : next
    if (response.ok && next.profile.avatarUrl && !saved.profile.avatarUrl) {
      saved.profile.avatarUrl = next.profile.avatarUrl
    }
    const mergedSaved = mergeLocalGames(saved)
    dashboardCache = mergedSaved
    writeStorage(mergedSaved)
    dashboardUpdatedAt = Date.now()
    return mergedSaved
  } catch (error) {
    if (isNetworkError(error) || isOffline()) {
      await enqueueAction('profile-save', { profile: next.profile })
    }
    return next
  }
}

export const saveLocalGameRecord = (record: GameRecord): void => {
  const current = readLocalGames()
  const deduped = current.filter((item) => item.id !== record.id)
  const next = [record, ...deduped].slice(0, 200)
  writeLocalGames(next)

  if (dashboardCache) {
    dashboardCache.games = mergeGames(dashboardCache.games, [record])
    writeStorage(dashboardCache)
  }
}
