import type { Router } from 'vue-router'

type ErrorSample = {
  id: string
  message: string
  stack?: string
  time: string
  context?: Record<string, unknown>
}

type PerfSample = {
  id: string
  type: 'navigation' | 'route'
  name: string
  value: number
  time: string
  meta?: Record<string, unknown>
}

const ERROR_KEY = 'warchess.observability.errors'
const PERF_KEY = 'warchess.observability.perf'
const MAX_ITEMS = 50

const isBrowser = () => typeof window !== 'undefined'

const loadList = <T>(key: string): T[] => {
  if (!isBrowser()) return []
  try {
    const stored = window.localStorage.getItem(key)
    return stored ? (JSON.parse(stored) as T[]) : []
  } catch {
    return []
  }
}

const saveList = <T>(key: string, items: T[]) => {
  if (!isBrowser()) return
  try {
    window.localStorage.setItem(key, JSON.stringify(items.slice(-MAX_ITEMS)))
  } catch {
    // Ignore storage failures.
  }
}

const pushItem = <T>(key: string, item: T) => {
  const list = loadList<T>(key)
  list.push(item)
  saveList(key, list)
}

const buildId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

export const captureError = (message: string, stack?: string, context?: Record<string, unknown>) => {
  pushItem<ErrorSample>(ERROR_KEY, {
    id: buildId(),
    message,
    stack,
    context,
    time: new Date().toISOString(),
  })
}

export const capturePerf = (name: string, value: number, meta?: Record<string, unknown>) => {
  pushItem<PerfSample>(PERF_KEY, {
    id: buildId(),
    type: 'navigation',
    name,
    value,
    meta,
    time: new Date().toISOString(),
  })
}

export const captureRoutePerf = (name: string, value: number, meta?: Record<string, unknown>) => {
  pushItem<PerfSample>(PERF_KEY, {
    id: buildId(),
    type: 'route',
    name,
    value,
    meta,
    time: new Date().toISOString(),
  })
}

export const getErrorSamples = (): ErrorSample[] => loadList<ErrorSample>(ERROR_KEY)

export const getPerfSamples = (): PerfSample[] => loadList<PerfSample>(PERF_KEY)

export const clearObservability = () => {
  saveList(ERROR_KEY, [])
  saveList(PERF_KEY, [])
}

export const setupObservability = (router?: Router): void => {
  if (!isBrowser()) return

  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
  if (nav) {
    capturePerf('ttfb', nav.responseStart - nav.requestStart)
    capturePerf('domContentLoaded', nav.domContentLoadedEventEnd - nav.startTime)
    capturePerf('load', nav.loadEventEnd - nav.startTime)
  }

  if (router) {
    let routeStart = 0
    router.beforeEach(() => {
      routeStart = performance.now()
    })
    router.afterEach((to) => {
      if (routeStart > 0) {
        captureRoutePerf('route-change', performance.now() - routeStart, {
          path: to.fullPath,
        })
      }
    })
  }

  window.addEventListener('error', (event) => {
    captureError(event.message || 'Erreur inconnue', event.error?.stack, {
      source: event.filename,
      line: event.lineno,
      column: event.colno,
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason as Error | undefined
    captureError(reason?.message ?? 'Promise rejetee', reason?.stack, {
      source: 'unhandledrejection',
    })
  })
}
