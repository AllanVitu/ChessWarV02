import { apiFetch, getSessionToken } from './api'

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

let dashboardCache: DashboardDb | null = null
let dashboardPromise: Promise<DashboardDb> | null = null

const mapDashboard = (payload?: DashboardDb | null): DashboardDb => {
  if (!payload) return defaultDb
  return {
    profile: { ...defaultDb.profile, ...payload.profile },
    games: payload.games?.length ? payload.games : defaultDb.games,
    goals: payload.goals?.length ? payload.goals : defaultDb.goals,
  }
}

export const clearDashboardCache = (): void => {
  dashboardCache = null
  dashboardPromise = null
}

export const getDashboardData = async (): Promise<DashboardDb> => {
  if (dashboardCache) return dashboardCache
  if (!getSessionToken()) {
    dashboardCache = defaultDb
    return defaultDb
  }

  if (!dashboardPromise) {
    dashboardPromise = apiFetch<{ ok: boolean; dashboard?: DashboardDb }>('dashboard-get')
      .then((response) => {
        if (!response.ok) return defaultDb
        return mapDashboard(response.dashboard)
      })
      .catch(() => defaultDb)
      .then((next) => {
        dashboardCache = next
        return next
      })
  }

  return dashboardPromise
}

export const saveDashboardData = async (next: DashboardDb): Promise<DashboardDb> => {
  dashboardCache = next

  if (!getSessionToken()) {
    return next
  }

  try {
    const response = await apiFetch<{ ok: boolean; dashboard?: DashboardDb }>('dashboard-save', {
      method: 'POST',
      body: JSON.stringify({ profile: next.profile }),
    })

    const saved = response.ok ? mapDashboard(response.dashboard) : next
    dashboardCache = saved
    return saved
  } catch {
    return next
  }
}
