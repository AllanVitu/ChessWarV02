import type { MatchRecord } from './matchesDb'

const toTimestamp = (value?: string | null): number => {
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : 0
}

export const filterMatchesByPeriod = (matches: MatchRecord[], days: number): MatchRecord[] => {
  const now = Date.now()
  const windowMs = Math.max(1, days) * 24 * 60 * 60 * 1000
  return matches.filter((match) => {
    const time = toTimestamp(match.finishedAt ?? match.createdAt)
    return time > 0 && now - time <= windowMs
  })
}

export const summarizeMatches = (matches: MatchRecord[]) => {
  const finished = matches.filter((match) => match.status === 'finished' || match.result)
  const wins = finished.filter((match) => match.result === 'win').length
  const losses = finished.filter((match) => match.result === 'loss').length
  const draws = finished.filter((match) => match.result === 'draw').length
  const total = finished.length
  const winRate = total ? Math.round((wins / total) * 100) : 0
  const totalEloDelta = finished.reduce((sum, match) => sum + (match.eloDelta ?? 0), 0)

  const sorted = [...finished].sort(
    (a, b) => toTimestamp(b.finishedAt ?? b.createdAt) - toTimestamp(a.finishedAt ?? a.createdAt),
  )
  let streak = 0
  for (const match of sorted) {
    if (match.result !== 'win') break
    streak += 1
  }

  return {
    total,
    wins,
    losses,
    draws,
    winRate,
    totalEloDelta,
    streak,
  }
}

export const buildEloSeries = (matches: MatchRecord[], startRating: number): number[] => {
  const sorted = [...matches].sort(
    (a, b) => toTimestamp(a.finishedAt ?? a.createdAt) - toTimestamp(b.finishedAt ?? b.createdAt),
  )
  const series: number[] = []
  let rating = startRating
  for (const match of sorted) {
    rating += match.eloDelta ?? 0
    series.push(rating)
  }
  return series
}
