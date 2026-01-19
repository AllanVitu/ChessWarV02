import { apiFetch, getSessionToken } from './api'

export type MatchMode = 'Local' | 'IA' | 'JcJ'
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
    mode: 'Local',
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

let matchesCache: MatchRecord[] | null = null
let matchesPromise: Promise<MatchRecord[]> | null = null

export const clearMatchesCache = (): void => {
  matchesCache = null
  matchesPromise = null
}

export const getMatches = async (): Promise<MatchRecord[]> => {
  if (matchesCache) return matchesCache
  if (!getSessionToken()) {
    matchesCache = defaultMatches
    return defaultMatches
  }

  if (!matchesPromise) {
    matchesPromise = apiFetch<{ ok: boolean; matches?: MatchRecord[] }>('matches-get')
      .then((response) => (response.ok && response.matches?.length ? response.matches : defaultMatches))
      .catch(() => defaultMatches)
      .then((next) => {
        matchesCache = next
        return next
      })
  }

  return matchesPromise
}

export const saveMatches = (matches: MatchRecord[]): void => {
  matchesCache = matches
}

export const addMatch = async (match: MatchRecord): Promise<MatchRecord[]> => {
  if (!getSessionToken()) {
    const next = [...(await getMatches()), match]
    matchesCache = next
    return next
  }

  try {
    const response = await apiFetch<{ ok: boolean; matches?: MatchRecord[] }>('matches-add', {
      method: 'POST',
      body: JSON.stringify({ match }),
    })

    const next = response.ok && response.matches?.length ? response.matches : [...(await getMatches()), match]
    matchesCache = next
    return next
  } catch {
    const next = [...(await getMatches()), match]
    matchesCache = next
    return next
  }
}

export const getMatchById = async (matchId: string): Promise<MatchRecord | null> => {
  const matches = await getMatches()
  return matches.find((match) => match.id === matchId) ?? null
}

export const clearMatchesHistory = async (
  scope: 'history' | 'all' = 'history',
): Promise<{ ok: boolean; message: string; matches: MatchRecord[] }> => {
  const current = await getMatches()
  const filtered =
    scope === 'all' ? [] : current.filter((match) => match.status !== 'termine')

  if (!getSessionToken()) {
    matchesCache = filtered
    return {
      ok: true,
      message: "Historique efface.",
      matches: filtered,
    }
  }

  try {
    const response = await apiFetch<{
      ok: boolean
      message: string
      matches?: MatchRecord[]
    }>('matches-clear', {
      method: 'POST',
      body: JSON.stringify({ scope }),
    })

    const next = response.ok && response.matches ? response.matches : filtered
    matchesCache = next
    return { ok: response.ok, message: response.message, matches: next }
  } catch (error) {
    matchesCache = filtered
    return { ok: false, message: (error as Error).message, matches: filtered }
  }
}
