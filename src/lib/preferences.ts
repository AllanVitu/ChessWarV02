export type UiPreferences = {
  darkMode: boolean
  simplifiedUi: boolean
  language: string
  timezone: string
  cadence: string
  boardTheme: string
  haloTheme: 'blue' | 'red' | 'green' | 'violet' | 'amber' | 'teal' | 'slate'
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
const allowedBoardThemes = ['Theme sable', 'Theme contraste'] as const

const defaultPreferences: UiPreferences = {
  darkMode: false,
  simplifiedUi: false,
  language: 'Francais',
  timezone: 'Europe/Paris',
  cadence: '10+0 Rapide',
  boardTheme: 'Theme sable',
  haloTheme: 'blue',
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
  const merged = {
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
  if (!allowedBoardThemes.includes(merged.boardTheme as (typeof allowedBoardThemes)[number])) {
    merged.boardTheme = defaultPreferences.boardTheme
  }
  return merged
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
  const body = document.body
  const targets = body ? [root, body] : [root]
  targets.forEach((el) => {
    el.classList.toggle('theme-dark', preferences.darkMode)
    el.classList.toggle('ui-simple', preferences.simplifiedUi)
  })
  const haloThemes = [
    'theme-halo-blue',
    'theme-halo-red',
    'theme-halo-green',
    'theme-halo-violet',
    'theme-halo-amber',
    'theme-halo-teal',
    'theme-halo-slate',
  ]
  targets.forEach((el) => {
    haloThemes.forEach((theme) => el.classList.remove(theme))
  })
  const safeHalo = ['blue', 'red', 'green', 'violet', 'amber', 'teal', 'slate'].includes(
    preferences.haloTheme,
  )
    ? preferences.haloTheme
    : 'blue'
  targets.forEach((el) => {
    el.classList.add(`theme-halo-${safeHalo}`)
  })

  const boardThemes = ['board-theme-botanique', 'board-theme-sable', 'board-theme-contraste']
  targets.forEach((el) => {
    boardThemes.forEach((theme) => el.classList.remove(theme))
  })
  const boardThemeMap: Record<string, string> = {
    'Theme sable': 'board-theme-sable',
    'Theme contraste': 'board-theme-contraste',
  }
  const fallbackBoardClass = boardThemeMap['Theme sable'] ?? 'board-theme-sable'
  const boardClass = boardThemeMap[preferences.boardTheme] ?? fallbackBoardClass
  targets.forEach((el) => {
    el.classList.add(boardClass)
  })
}
