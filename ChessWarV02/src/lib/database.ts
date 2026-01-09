import { ensureAuthStorage } from './auth'
import { getDashboardData } from './localDb'
import { getMatches } from './matchesDb'

export const ensureDatabaseReady = (): void => {
  ensureAuthStorage()
  getDashboardData()
  getMatches()
}
