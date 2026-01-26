import type { Router, RouteLocationNormalizedLoaded } from 'vue-router'

export type SeoMeta = {
  title?: string
  description?: string
  image?: string
}

const DEFAULT_META: Required<SeoMeta> = {
  title: 'WarChess | Echecs nouvelle generation',
  description: "WarChess, plateforme d'echecs moderne pour jouer et progresser.",
  image: '/icon-512.png',
}

const getSiteUrl = (): string => {
  if (import.meta.env.VITE_SITE_URL) return import.meta.env.VITE_SITE_URL
  if (typeof window === 'undefined') return ''
  return window.location.origin
}

const setMetaTag = (key: string, value: string, attr: 'name' | 'property' = 'name') => {
  if (typeof document === 'undefined') return
  let element = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attr, key)
    document.head.appendChild(element)
  }
  element.setAttribute('content', value)
}

const setLinkTag = (rel: string, href: string) => {
  if (typeof document === 'undefined') return
  let element = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null
  if (!element) {
    element = document.createElement('link')
    element.setAttribute('rel', rel)
    document.head.appendChild(element)
  }
  element.setAttribute('href', href)
}

const applyMeta = (meta: SeoMeta, route: RouteLocationNormalizedLoaded) => {
  if (typeof document === 'undefined') return
  const merged = {
    ...DEFAULT_META,
    ...meta,
  }
  const title = meta.title ? `${meta.title} | WarChess` : DEFAULT_META.title
  document.title = title

  const description = meta.description ?? DEFAULT_META.description
  const image = meta.image ?? DEFAULT_META.image
  const url = `${getSiteUrl()}/#${route.path}`

  setMetaTag('description', description)
  setMetaTag('og:title', title, 'property')
  setMetaTag('og:description', description, 'property')
  setMetaTag('og:image', image, 'property')
  setMetaTag('og:url', url, 'property')
  setMetaTag('twitter:title', title)
  setMetaTag('twitter:description', description)
  setMetaTag('twitter:image', image)
  setLinkTag('canonical', url)
}

export const setupSeo = (router: Router): void => {
  router.afterEach((to) => {
    applyMeta((to.meta || {}) as SeoMeta, to)
  })
}
