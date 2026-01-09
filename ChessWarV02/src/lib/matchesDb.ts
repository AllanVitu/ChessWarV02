export type MatchMode = 'JcJ' | 'IA'
export type MatchStatus = 'planifie' | 'en_cours' | 'termine'
export type DifficultyKey = 'facile' | 'intermediaire' | 'difficile' | 'maitre'

export type MatchRecord = {
  id: string
  mode: MatchMode
  opponent: string
  status: MatchStatus
  createdAt: string
  lastMove: string
  timeControl: string
  side: 'Blancs' | 'Noirs' | 'Aleatoire'
  difficulty?: DifficultyKey
}

const STORAGE_KEY = 'vertexchess.matches.v1'

const defaultMatches: MatchRecord[] = [
  {
    id: 'M-1042',
    mode: 'IA',
    opponent: 'IA Atlas',
    status: 'en_cours',
    createdAt: '09 Jan 19:10',
    lastMove: 'Cg1-f3',
    timeControl: '10+0',
    side: 'Blancs',
    difficulty: 'intermediaire',
  },
  {
    id: 'M-1038',
    mode: 'JcJ',
    opponent: 'L. Vernet',
    status: 'planifie',
    createdAt: '09 Jan 21:00',
    lastMove: '-',
    timeControl: '5+0',
    side: 'Noirs',
  },
  {
    id: 'M-1029',
    mode: 'IA',
    opponent: 'IA Nova',
    status: 'termine',
    createdAt: '07 Jan 18:35',
    lastMove: 'Dd1-e2',
    timeControl: '15+10',
    side: 'Blancs',
    difficulty: 'difficile',
  },
]

const hasStorage = () => typeof window !== 'undefined' && typeof localStorage !== 'undefined'

const safeParse = <T>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export const getMatches = (): MatchRecord[] => {
  if (!hasStorage()) return defaultMatches
  const stored = safeParse<MatchRecord[]>(localStorage.getItem(STORAGE_KEY), [])
  if (stored.length) return stored
  localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultMatches))
  return defaultMatches
}

export const saveMatches = (matches: MatchRecord[]): void => {
  if (!hasStorage()) return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(matches))
}

export const addMatch = (match: MatchRecord): MatchRecord[] => {
  const next = [...getMatches(), match]
  saveMatches(next)
  return next
}

export const getMatchById = (matchId: string): MatchRecord | null => {
  return getMatches().find((match) => match.id === matchId) ?? null
}
