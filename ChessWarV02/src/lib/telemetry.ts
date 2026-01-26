import type { Router } from 'vue-router'

type TelemetryEvent = {
  name: string
  payload?: Record<string, unknown>
}

type TelemetryError = {
  message: string
  stack?: string
  context?: Record<string, unknown>
}

const ANALYTICS_ENDPOINT = import.meta.env.VITE_ANALYTICS_ENDPOINT as string | undefined
const ERROR_ENDPOINT = import.meta.env.VITE_ERROR_ENDPOINT as string | undefined
const CONSENT_KEY = 'warchess.analytics.consent'

const isBrowser = () => typeof window !== 'undefined'

const hasConsent = (): boolean => {
  if (!isBrowser()) return false
  try {
    return window.localStorage.getItem(CONSENT_KEY) === '1'
  } catch {
    return false
  }
}

export const setTelemetryConsent = (allowed: boolean): void => {
  if (!isBrowser()) return
  try {
    window.localStorage.setItem(CONSENT_KEY, allowed ? '1' : '0')
  } catch {
    // Ignore storage failures.
  }
}

export const shouldAskConsent = (): boolean => {
  if (!isBrowser()) return false
  if (!ANALYTICS_ENDPOINT) return false
  try {
    return window.localStorage.getItem(CONSENT_KEY) === null
  } catch {
    return false
  }
}

const canSend = (endpoint?: string): boolean => {
  if (!endpoint) return false
  if (!import.meta.env.PROD) return false
  if (!hasConsent()) return false
  return true
}

const sendPayload = (endpoint: string, payload: Record<string, unknown>) => {
  if (!canSend(endpoint)) return
  const body = JSON.stringify({
    ...payload,
    sentAt: new Date().toISOString(),
  })

  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, body)
      return
    }
  } catch {
    // Ignore beacon failures.
  }

  fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
    body,
  }).catch(() => {})
}

export const trackEvent = (event: TelemetryEvent): void => {
  if (!ANALYTICS_ENDPOINT) return
  sendPayload(ANALYTICS_ENDPOINT, {
    type: 'event',
    name: event.name,
    payload: event.payload ?? {},
  })
}

export const trackError = (error: TelemetryError): void => {
  if (!ERROR_ENDPOINT) return
  sendPayload(ERROR_ENDPOINT, {
    type: 'error',
    ...error,
  })
}

export const setupTelemetry = (router?: Router): void => {
  if (!isBrowser()) return

  if (router) {
    router.afterEach((to) => {
      trackEvent({
        name: 'page_view',
        payload: {
          path: to.fullPath,
        },
      })
    })
  }

  window.addEventListener('error', (event) => {
    trackError({
      message: event.message || 'Erreur inconnue',
      stack: event.error?.stack,
      context: {
        source: event.filename,
        line: event.lineno,
        column: event.colno,
      },
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason as Error | undefined
    trackError({
      message: reason?.message ?? 'Promise rejetee',
      stack: reason?.stack,
      context: {
        source: 'unhandledrejection',
      },
    })
  })
}
