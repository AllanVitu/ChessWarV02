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

const STORAGE_KEY = 'warchess.dashboard.v1'

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

const mergeDefaults = (data: Partial<DashboardDb>): DashboardDb => ({
  profile: { ...defaultDb.profile, ...data.profile },
  games: data.games?.length ? data.games : defaultDb.games,
  goals: data.goals?.length ? data.goals : defaultDb.goals,
})

const safeParse = (raw: string | null): DashboardDb | null => {
  if (!raw) return null
  try {
    return JSON.parse(raw) as DashboardDb
  } catch {
    return null
  }
}

export const getDashboardData = (): DashboardDb => {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return defaultDb
  }

  const parsed = safeParse(localStorage.getItem(STORAGE_KEY))
  if (parsed) {
    const merged = mergeDefaults(parsed)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
    return merged
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultDb))
  return defaultDb
}

export const saveDashboardData = (next: DashboardDb): void => {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}
