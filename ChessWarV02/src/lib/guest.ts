const GUEST_KEY = 'warchess.session.guest'

export const isGuestSession = (): boolean => {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(GUEST_KEY) === '1'
}

export const startGuestSession = (): void => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(GUEST_KEY, '1')
}

export const clearGuestSession = (): void => {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(GUEST_KEY)
}
