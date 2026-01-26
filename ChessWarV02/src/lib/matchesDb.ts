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

const defaultMatches: MatchRecord[] = []

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
      .then((next) => next.filter((match) => match.mode === 'JcJ'))
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
