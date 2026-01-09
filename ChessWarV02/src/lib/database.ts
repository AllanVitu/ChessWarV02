import { getSessionToken } from './api'
import { getDashboardData } from './localDb'
import { getMatches } from './matchesDb'

export const ensureDatabaseReady = async (): Promise<void> => {
  if (!getSessionToken()) return
  await Promise.allSettled([getDashboardData(), getMatches()])
}
