export type HaloTheme = 'blue' | 'red' | 'green' | 'violet' | 'amber' | 'teal' | 'slate'

export type UiPreferences = {
  darkMode: boolean
  simplifiedUi: boolean
  language: string
  timezone: string
  cadence: string
  boardTheme: string
  haloTheme: HaloTheme
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

type ThemePalette = {
  accent: string
  accentStrong: string
  accent2: string
  accent3: string
  accentGlow: string
  accentSheen: string
  accentViolet: string
  haloSecondary: string
  haloSecondaryStrong: string
  haloSecondarySolid: string
  focusRing: string
  accentContrast: string
}

const STORAGE_KEY = 'warchess.preferences'
const allowedBoardThemes = ['Theme sable', 'Theme contraste'] as const
const allowedHaloThemes: HaloTheme[] = ['blue', 'red', 'green', 'violet', 'amber', 'teal', 'slate']

const haloPalettes: Record<HaloTheme, ThemePalette> = {
  blue: {
    accent: '#22d3ee',
    accentStrong: '#0891b2',
    accent2: '#3b82f6',
    accent3: '#7dd3fc',
    accentGlow: 'rgba(34, 211, 238, 0.38)',
    accentSheen: 'rgba(59, 130, 246, 0.28)',
    accentViolet: 'rgba(59, 130, 246, 0.2)',
    haloSecondary: 'rgba(59, 130, 246, 0.24)',
    haloSecondaryStrong: 'rgba(59, 130, 246, 0.38)',
    haloSecondarySolid: '#3b82f6',
    focusRing: '0 0 0 3px rgba(59, 130, 246, 0.42)',
    accentContrast: '#03111a',
  },
  red: {
    accent: '#fb7185',
    accentStrong: '#e11d48',
    accent2: '#f97316',
    accent3: '#fda4af',
    accentGlow: 'rgba(251, 113, 133, 0.36)',
    accentSheen: 'rgba(249, 115, 22, 0.3)',
    accentViolet: 'rgba(251, 113, 133, 0.2)',
    haloSecondary: 'rgba(225, 29, 72, 0.24)',
    haloSecondaryStrong: 'rgba(225, 29, 72, 0.36)',
    haloSecondarySolid: '#e11d48',
    focusRing: '0 0 0 3px rgba(225, 29, 72, 0.4)',
    accentContrast: '#22040b',
  },
  green: {
    accent: '#34d399',
    accentStrong: '#059669',
    accent2: '#22c55e',
    accent3: '#86efac',
    accentGlow: 'rgba(52, 211, 153, 0.36)',
    accentSheen: 'rgba(34, 197, 94, 0.3)',
    accentViolet: 'rgba(16, 185, 129, 0.2)',
    haloSecondary: 'rgba(16, 185, 129, 0.24)',
    haloSecondaryStrong: 'rgba(16, 185, 129, 0.36)',
    haloSecondarySolid: '#10b981',
    focusRing: '0 0 0 3px rgba(16, 185, 129, 0.4)',
    accentContrast: '#04150c',
  },
  violet: {
    accent: '#a78bfa',
    accentStrong: '#7c3aed',
    accent2: '#6366f1',
    accent3: '#c4b5fd',
    accentGlow: 'rgba(167, 139, 250, 0.36)',
    accentSheen: 'rgba(99, 102, 241, 0.3)',
    accentViolet: 'rgba(124, 58, 237, 0.22)',
    haloSecondary: 'rgba(124, 58, 237, 0.24)',
    haloSecondaryStrong: 'rgba(124, 58, 237, 0.36)',
    haloSecondarySolid: '#7c3aed',
    focusRing: '0 0 0 3px rgba(124, 58, 237, 0.4)',
    accentContrast: '#130726',
  },
  amber: {
    accent: '#f59e0b',
    accentStrong: '#d97706',
    accent2: '#ea580c',
    accent3: '#fbbf24',
    accentGlow: 'rgba(245, 158, 11, 0.38)',
    accentSheen: 'rgba(234, 88, 12, 0.3)',
    accentViolet: 'rgba(245, 158, 11, 0.2)',
    haloSecondary: 'rgba(245, 158, 11, 0.24)',
    haloSecondaryStrong: 'rgba(245, 158, 11, 0.36)',
    haloSecondarySolid: '#f59e0b',
    focusRing: '0 0 0 3px rgba(245, 158, 11, 0.42)',
    accentContrast: '#211103',
  },
  teal: {
    accent: '#2dd4bf',
    accentStrong: '#0f766e',
    accent2: '#14b8a6',
    accent3: '#5eead4',
    accentGlow: 'rgba(45, 212, 191, 0.36)',
    accentSheen: 'rgba(20, 184, 166, 0.3)',
    accentViolet: 'rgba(45, 212, 191, 0.2)',
    haloSecondary: 'rgba(20, 184, 166, 0.24)',
    haloSecondaryStrong: 'rgba(20, 184, 166, 0.36)',
    haloSecondarySolid: '#14b8a6',
    focusRing: '0 0 0 3px rgba(20, 184, 166, 0.4)',
    accentContrast: '#031714',
  },
  slate: {
    accent: '#a3b5cc',
    accentStrong: '#64748b',
    accent2: '#475569',
    accent3: '#cbd5e1',
    accentGlow: 'rgba(163, 181, 204, 0.34)',
    accentSheen: 'rgba(71, 85, 105, 0.3)',
    accentViolet: 'rgba(100, 116, 139, 0.2)',
    haloSecondary: 'rgba(100, 116, 139, 0.24)',
    haloSecondaryStrong: 'rgba(100, 116, 139, 0.36)',
    haloSecondarySolid: '#64748b',
    focusRing: '0 0 0 3px rgba(100, 116, 139, 0.4)',
    accentContrast: '#080d14',
  },
}

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
  if (!allowedHaloThemes.includes(merged.haloTheme as HaloTheme)) {
    merged.haloTheme = defaultPreferences.haloTheme
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
  const safeHalo = allowedHaloThemes.includes(preferences.haloTheme) ? preferences.haloTheme : 'blue'
  targets.forEach((el) => {
    el.classList.add(`theme-halo-${safeHalo}`)
  })

  const palette = haloPalettes[safeHalo]
  root.style.setProperty('--accent', palette.accent)
  root.style.setProperty('--accent-strong', palette.accentStrong)
  root.style.setProperty('--accent-2', palette.accent2)
  root.style.setProperty('--accent-3', palette.accent3)
  root.style.setProperty('--accent-glow', palette.accentGlow)
  root.style.setProperty('--accent-sheen', palette.accentSheen)
  root.style.setProperty('--accent-violet', palette.accentViolet)
  root.style.setProperty('--halo-secondary', palette.haloSecondary)
  root.style.setProperty('--halo-secondary-strong', palette.haloSecondaryStrong)
  root.style.setProperty('--halo-secondary-solid', palette.haloSecondarySolid)
  root.style.setProperty('--focus-ring', palette.focusRing)
  root.style.setProperty('--accent-contrast', palette.accentContrast)

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
