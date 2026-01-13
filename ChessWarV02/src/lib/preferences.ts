export type UiPreferences = {
  darkMode: boolean
  simplifiedUi: boolean
  language: string
  timezone: string
  cadence: string
  boardTheme: string
  notifications: {
    matchAlerts: boolean
    matchResults: boolean
    tacticalTips: boolean
  }
  privacy: {
    publicProfile: boolean
    visibleHistory: boolean
    sharedStats: boolean
  }
}

const STORAGE_KEY = 'warchess.preferences'

const defaultPreferences: UiPreferences = {
  darkMode: false,
  simplifiedUi: false,
  language: 'Francais',
  timezone: 'Europe/Paris',
  cadence: '10+0 Rapide',
  boardTheme: 'Theme botanique',
  notifications: {
    matchAlerts: true,
    matchResults: true,
    tacticalTips: false,
  },
  privacy: {
    publicProfile: true,
    visibleHistory: false,
    sharedStats: true,
  },
}

const readStorage = (): Partial<UiPreferences> => {
  if (typeof window === 'undefined') return {}
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored ? (JSON.parse(stored) as Partial<UiPreferences>) : {}
  } catch {
    return {}
  }
}

export const loadPreferences = (): UiPreferences => {
  const stored = readStorage()
  return {
    ...defaultPreferences,
    ...stored,
    notifications: {
      ...defaultPreferences.notifications,
      ...(stored.notifications ?? {}),
    },
    privacy: {
      ...defaultPreferences.privacy,
      ...(stored.privacy ?? {}),
    },
  }
}

export const savePreferences = (preferences: UiPreferences): void => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
}

export const getDefaultPreferences = (): UiPreferences => ({
  ...defaultPreferences,
  notifications: { ...defaultPreferences.notifications },
  privacy: { ...defaultPreferences.privacy },
})

export const applyPreferences = (preferences: UiPreferences): void => {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.classList.toggle('theme-dark', preferences.darkMode)
  root.classList.toggle('ui-simple', preferences.simplifiedUi)
}
