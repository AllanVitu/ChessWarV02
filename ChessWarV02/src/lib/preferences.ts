export type UiPreferences = {
  darkMode: boolean
  simplifiedUi: boolean
}

const STORAGE_KEY = 'warchess.preferences'

const defaultPreferences: UiPreferences = {
  darkMode: false,
  simplifiedUi: false,
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
  return { ...defaultPreferences, ...stored }
}

export const savePreferences = (preferences: UiPreferences): void => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
}

export const applyPreferences = (preferences: UiPreferences): void => {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.classList.toggle('theme-dark', preferences.darkMode)
  root.classList.toggle('ui-simple', preferences.simplifiedUi)
}
