export type CacheClearResult = {
  ok: boolean
  message: string
}

export const clearApplicationCache = async (): Promise<CacheClearResult> => {
  if (typeof window === 'undefined') {
    return { ok: false, message: 'Action indisponible hors navigateur.' }
  }

  let removedCaches = 0
  if ('caches' in window) {
    const keys = await window.caches.keys()
    await Promise.all(keys.map((key) => window.caches.delete(key)))
    removedCaches = keys.length
  }

  let updatedServiceWorkers = 0
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(
      registrations.map(async (registration) => {
        await registration.update().catch(() => {})
      }),
    )
    updatedServiceWorkers = registrations.length
  }

  return {
    ok: true,
    message: `Cache vide (${removedCaches}) et SW verifies (${updatedServiceWorkers}). Rechargez la page.`,
  }
}
