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

const defaultDb: DashboardDb = {
  profile: {
    id: 'player-01',
    name: 'Katherine Murphy',
    title: "Capitaine d'arene",
    rating: 2142,
    motto: "Chaque coup ecrit l'histoire.",
    location: 'Paris, FR',
    lastSeen: "Aujourd'hui 09:42",
    email: 'k.murphy@warchess.app',
    avatarUrl: '',
  },
  games: [
    {
      id: 'G-1042',
      opponent: 'M. Zhou',
      result: 'win',
      opening: 'Defense sicilienne',
      date: '24 Jan',
      moves: 38,
      accuracy: 91,
    },
    {
      id: 'G-1041',
      opponent: 'L. Martinez',
      result: 'draw',
      opening: 'Gambit dame',
      date: '23 Jan',
      moves: 52,
      accuracy: 87,
    },
    {
      id: 'G-1038',
      opponent: 'H. Nordin',
      result: 'loss',
      opening: 'Caro-Kann',
      date: '21 Jan',
      moves: 44,
      accuracy: 82,
    },
    {
      id: 'G-1034',
      opponent: 'I. Patel',
      result: 'win',
      opening: 'Ruy Lopez',
      date: '18 Jan',
      moves: 33,
      accuracy: 93,
    },
  ],
  goals: [
    { label: 'Conversion en finale', progress: 72 },
    { label: 'Vision tactique', progress: 65 },
    { label: "Preparation d'ouverture", progress: 58 },
  ],
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
  const storedMapped = applyGuestOverlay(mapDashboard(stored))
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
        return applyGuestOverlay(mapped)
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
    dashboardCache = saved
    writeStorage(saved)
    dashboardUpdatedAt = Date.now()
    return saved
  } catch (error) {
    if (isNetworkError(error) || isOffline()) {
      await enqueueAction('profile-save', { profile: next.profile })
    }
    return next
  }
}
