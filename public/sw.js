const CACHE_NAME = 'warchess-v6'
const DATA_CACHE = 'warchess-data-v1'
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.ico',
  '/favicon-16x16.png',
  '/favicon-32x32.png',
  '/favicon-48x48.png',
  '/favicon-64x64.png',
  '/favicon-128x128.png',
  '/favicon-256x256.png',
  '/favicon-512x512.png',
  '/apple-touch-icon.png',
  '/apple-touch-icon-152.png',
  '/apple-touch-icon-167.png',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
  '/icon-180.png',
  '/icon-192.png',
  '/icon-512.png',
  '/robots.txt',
  '/sitemap.xml',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME && key !== DATA_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

const shouldCacheApi = (request, url) => {
  if (request.headers.has('Authorization')) return false
  if (url.pathname.includes('notifications-stream')) return false
  return true
}

const networkFirst = async (request) => {
  const cache = await caches.open(DATA_CACHE)
  try {
    const response = await fetch(request)
    if (response && response.ok) {
      cache.put(request, response.clone())
    }
    return response
  } catch (error) {
    const cached = await cache.match(request)
    if (cached) return cached
    throw error
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api')) {
    if (!shouldCacheApi(request, url)) return
    event.respondWith(networkFirst(request))
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy))
          return response
        })
        .catch(() => caches.match('/index.html')),
    )
    return
  }

  event.respondWith(
    caches.match(request).then((cached) =>
      cached ||
      fetch(request).then((response) => {
        const copy = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
        return response
      }),
    ),
  )
})

self.addEventListener('sync', (event) => {
  if (event.tag !== 'warchess-sync') return
  event.waitUntil(
    self.clients
      .matchAll({ includeUncontrolled: true, type: 'window' })
      .then((clients) => {
        for (const client of clients) {
          client.postMessage({ type: 'flush-queue' })
        }
      }),
  )
})
