const API_BASE = import.meta.env.VITE_API_BASE || '/api'

const TOKEN_KEY = 'warchess.session.token'
const DEFAULT_TIMEOUT_MS = 8000
const DEFAULT_TIMEOUT_MUTATION_MS = 12000
const DEFAULT_RETRY_DELAY_MS = 400
const INVALID_API_RESPONSE_MESSAGE =
  "Reponse API invalide. Verifiez la configuration /api et le rewrite Apache."
const REFRESH_PATH = import.meta.env.VITE_AUTH_REFRESH_PATH || ''
export const API_PROTOCOL_ERROR_EVENT = 'api:protocol-error'

const AUTH_EVENT = 'auth:expired'
let refreshPromise: Promise<string | null> | null = null

export class ApiProtocolError extends Error {
  readonly status: number
  readonly path: string
  readonly contentType: string

  constructor(message: string, status: number, path: string, contentType: string) {
    super(message)
    this.name = 'ApiProtocolError'
    this.status = status
    this.path = path
    this.contentType = contentType
  }
}

type ApiFetchOptions = RequestInit & {
  timeoutMs?: number
  retries?: number
  retryDelayMs?: number
  cacheKey?: string
  cacheTtlMs?: number
  dedupe?: boolean
  retryAuth?: boolean
}

type CachedEntry = {
  expiresAt: number
  value: unknown
}

const inFlight = new Map<string, Promise<unknown>>()
const responseCache = new Map<string, CachedEntry>()

export const getSessionToken = (): string | null => {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return null
  }
  return localStorage.getItem(TOKEN_KEY)
}

export const setSessionToken = (token: string | null): void => {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return
  }
  if (!token) {
    localStorage.removeItem(TOKEN_KEY)
    return
  }
  localStorage.setItem(TOKEN_KEY, token)
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const isRetryableStatus = (status: number) => status >= 500 || status === 429

const shouldRetryError = (error: unknown) => {
  if (!(error instanceof Error)) return false
  return error.name === 'AbortError' || /Network/i.test(error.message)
}

const emitAuthExpired = (status: number) => {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent(AUTH_EVENT, {
      detail: { status },
    }),
  )
}

const emitApiProtocolError = (detail: { path: string; status: number; contentType: string }) => {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent(API_PROTOCOL_ERROR_EVENT, {
      detail,
    }),
  )
}

const tryRefreshToken = async (): Promise<string | null> => {
  if (!REFRESH_PATH) return null
  if (refreshPromise) return refreshPromise
  refreshPromise = fetch(`${API_BASE}/${REFRESH_PATH}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(getSessionToken() ? { Authorization: `Bearer ${getSessionToken()}` } : {}),
    },
  })
    .then(async (response) => {
      if (!response.ok) return null
      const text = await response.text()
      const data = text ? (JSON.parse(text) as { token?: string }) : {}
      if (data.token) {
        setSessionToken(data.token)
        return data.token
      }
      return null
    })
    .catch(() => null)
    .finally(() => {
      refreshPromise = null
    })
  return refreshPromise
}

export const apiFetch = async <T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> => {
  const {
    timeoutMs,
    retries,
    retryDelayMs,
    cacheKey,
    cacheTtlMs,
    dedupe,
    retryAuth,
    ...requestInit
  } = options
  const headers = new Headers(requestInit.headers)
  const method = (requestInit.method || 'GET').toUpperCase()
  const hasBody = typeof requestInit.body !== 'undefined'
  const isFormData =
    typeof FormData !== 'undefined' && requestInit.body instanceof FormData
  if (!headers.has('Content-Type') && method !== 'GET' && hasBody && !isFormData) {
    headers.set('Content-Type', 'application/json')
  }

  const token = getSessionToken()
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const cacheIdentifier =
    cacheKey ??
    [
      method,
      path,
      token ?? '',
      typeof requestInit.body === 'string' ? requestInit.body : '',
    ].join('|')
  const useDedupe = dedupe ?? method === 'GET'
  const shouldCache = method === 'GET' && !!cacheTtlMs && cacheTtlMs > 0

  if (shouldCache) {
    const cached = responseCache.get(cacheIdentifier)
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value as T
    }
    if (cached) {
      responseCache.delete(cacheIdentifier)
    }
  }

  if (useDedupe) {
    const existing = inFlight.get(cacheIdentifier)
    if (existing) {
      return existing as Promise<T>
    }
  }

  const runFetch = async (): Promise<T> => {
    const maxRetries = retries ?? (method === 'GET' ? 1 : 0)
    const delayMs = retryDelayMs ?? DEFAULT_RETRY_DELAY_MS
    const timeout =
      timeoutMs ?? (method === 'GET' ? DEFAULT_TIMEOUT_MS : DEFAULT_TIMEOUT_MUTATION_MS)
    const allowAuthRefresh = retryAuth ?? true

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const controller = new AbortController()
      const onAbort = () => controller.abort()
      if (requestInit.signal) {
        requestInit.signal.addEventListener('abort', onAbort, { once: true })
      }

      const timeoutId = setTimeout(() => controller.abort(), timeout)

      try {
        const response = await fetch(`${API_BASE}/${path}`, {
          ...requestInit,
          headers,
          signal: controller.signal,
        })

        const text = await response.text()
        const trimmed = text.trim()
        const contentType = (response.headers.get('content-type') || '').toLowerCase()
        const isJsonPayload =
          contentType.includes('json') || trimmed.startsWith('{') || trimmed.startsWith('[')
        const isHtmlPayload =
          contentType.includes('text/html') ||
          /^<!doctype html/i.test(trimmed) ||
          /^<html[\s>]/i.test(trimmed)
        let data: T = {} as T

        if (trimmed) {
          if (isHtmlPayload) {
            emitApiProtocolError({ path, status: response.status, contentType })
            throw new ApiProtocolError(INVALID_API_RESPONSE_MESSAGE, response.status, path, contentType)
          }
          if (isJsonPayload) {
            try {
              data = JSON.parse(trimmed) as T
            } catch {
              emitApiProtocolError({ path, status: response.status, contentType })
              throw new ApiProtocolError(INVALID_API_RESPONSE_MESSAGE, response.status, path, contentType)
            }
          } else {
            emitApiProtocolError({ path, status: response.status, contentType })
            throw new ApiProtocolError(INVALID_API_RESPONSE_MESSAGE, response.status, path, contentType)
          }
        }

        if (!response.ok) {
          const message = (data as { message?: string }).message || 'Erreur serveur.'
          const isAuthPath = path.startsWith('auth') || path === REFRESH_PATH
          if ((response.status === 401 || response.status === 403) && allowAuthRefresh && !isAuthPath) {
            const refreshed = await tryRefreshToken()
            if (refreshed) {
              return apiFetch<T>(path, {
                ...options,
                retryAuth: false,
              })
            }
            emitAuthExpired(response.status)
          }
          if (attempt < maxRetries && isRetryableStatus(response.status)) {
            await delay(delayMs * Math.pow(2, attempt))
            continue
          }
          throw new Error(message)
        }

        if (shouldCache) {
          responseCache.set(cacheIdentifier, {
            expiresAt: Date.now() + (cacheTtlMs ?? 0),
            value: data,
          })
        }

        return data
      } catch (error) {
        if (requestInit.signal?.aborted) {
          throw error
        }
        if (attempt < maxRetries && shouldRetryError(error)) {
          await delay(delayMs * Math.pow(2, attempt))
          continue
        }
        throw error
      } finally {
        clearTimeout(timeoutId)
        if (requestInit.signal) {
          requestInit.signal.removeEventListener('abort', onAbort)
        }
      }
    }

    throw new Error('Erreur serveur.')
  }

  const promise = runFetch()
  if (useDedupe) {
    inFlight.set(cacheIdentifier, promise)
    promise.finally(() => {
      inFlight.delete(cacheIdentifier)
    })
  }

  return promise
}
