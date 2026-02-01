<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import logoUrl from '@/assets/brand-icon.png'
import BottomNav from '@/components/ui/BottomNav.vue'
import AppNavbar from '@/components/ui/AppNavbar.vue'
import { getDashboardData, type DashboardDb } from '@/lib/localDb'
import { getSessionToken } from '@/lib/api'
import { clearSession } from '@/lib/auth'
import { clearMatchesCache } from '@/lib/matchesDb'
import { isGuestSession } from '@/lib/guest'
import { searchUsers, respondFriendRequest, type UserSearchItem } from '@/lib/users'
import {
  getNotifications,
  markNotificationsRead,
  openNotificationsStream,
  respondMatchInvite,
  type FriendRequestNotification,
  type MatchInviteNotification,
  type MatchReadyNotification,
} from '@/lib/notifications'

type DashboardLayoutProps = {
  eyebrow?: string
  title: string
  subtitle?: string
}

const props = withDefaults(defineProps<DashboardLayoutProps>(), {
  eyebrow: 'Bon retour',
  subtitle: '',
})

const router = useRouter()
const dashboard = ref<DashboardDb | null>(null)
const profileName = computed(() => dashboard.value?.profile.name ?? 'Invite')
const profileTitle = computed(() => {
  if (isGuestSession() && !getSessionToken()) return 'Mode invite'
  return dashboard.value?.profile.title ?? 'Compte local'
})
const logoutLabel = computed(() =>
  isGuestSession() && !getSessionToken() ? 'Quitter' : 'Se deconnecter',
)

const navItems = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'Matchs', to: '/matchs' },
  { label: 'Studio', to: '/studio' },
  { label: 'Classement', to: '/leaderboard' },
  { label: 'Profil', to: '/profile' },
  { label: 'Parametres', to: '/settings' },
]
const profileAvatar = computed(() => dashboard.value?.profile.avatarUrl ?? '')
const profileInitials = computed(() => {
  const name = profileName.value.trim()
  if (!name) return '??'
  const parts = name.split(' ').filter(Boolean)
  const initials = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '')
  return initials.join('') || '??'
})

const searchQuery = ref('')
const searchResults = ref<UserSearchItem[]>([])
const searchLoading = ref(false)
const searchMessage = ref('')
const searchOpen = ref(false)
const searchGroup = ref<HTMLElement | null>(null)
const minSearchLength = 2
let searchTimer: ReturnType<typeof setTimeout> | null = null
let searchRequestId = 0

const friendRequests = ref<FriendRequestNotification[]>([])
const matchInvites = ref<MatchInviteNotification[]>([])
const matchReady = ref<MatchReadyNotification[]>([])
const notificationsLoading = ref(false)
const notificationsError = ref('')
const friendNotice = ref('')
const friendNoticeError = ref(false)
const matchNotice = ref('')
const matchNoticeError = ref(false)
const friendOpen = ref(false)
const matchOpen = ref(false)
const friendGroup = ref<HTMLElement | null>(null)
const matchGroup = ref<HTMLElement | null>(null)
let notificationsStream: EventSource | null = null
let streamRetry = 0
let streamReconnectTimer: ReturnType<typeof setTimeout> | null = null
let streamWatchdog: ReturnType<typeof setInterval> | null = null
let pollingTimer: ReturnType<typeof setInterval> | null = null
let lastStreamEventAt = 0
const STREAM_STALE_MS = 45000
const STREAM_BACKOFF_BASE = 1200
const STREAM_MAX_RETRY = 4
const POLL_INTERVAL_MS = 20000

const friendCount = computed(() => friendRequests.value.length)
const matchCount = computed(() => matchInvites.value.length)
const hasNewFriend = computed(() => friendRequests.value.some((request) => request.isNew))
const hasNewMatch = computed(() => matchInvites.value.some((invite) => invite.isNew))
const handledMatches = new Set<string>()
let redirectingMatch = false
const matchReadyToast = ref<MatchReadyNotification | null>(null)
const matchReadyCountdown = ref(0)
const matchReadyDelay = 5
let matchReadyTimer: ReturnType<typeof setInterval> | null = null
type IdleCallback = (deadline?: { didTimeout: boolean; timeRemaining: () => number }) => void

const resetSearch = () => {
  searchResults.value = []
  searchLoading.value = false
  searchMessage.value = ''
}

const resetFriendNotice = () => {
  friendNotice.value = ''
  friendNoticeError.value = false
}

const resetMatchNotice = () => {
  matchNotice.value = ''
  matchNoticeError.value = false
}

const initialsFor = (name: string) => {
  const trimmed = name.trim()
  if (!trimmed) return '?'
  return trimmed
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?'
}

const onlineLabel = (user: UserSearchItem) => {
  if (user.isOnline === true) return 'En ligne'
  if (user.isOnline === false) return 'Hors ligne'
  return 'Statut inconnu'
}

const onlineClass = (user: UserSearchItem) => {
  if (user.isOnline === true) return 'presence-dot--online'
  if (user.isOnline === false) return 'presence-dot--offline'
  return 'presence-dot--unknown'
}

const runSearch = async (query: string) => {
  if (!getSessionToken()) {
    searchMessage.value = 'Connectez-vous pour rechercher.'
    searchResults.value = []
    searchLoading.value = false
    return
  }

  const requestId = (searchRequestId += 1)
  searchLoading.value = true
  searchMessage.value = ''

  try {
    const results = await searchUsers(query)
    if (requestId !== searchRequestId) return
    searchResults.value = results
    if (!results.length) {
      searchMessage.value = 'Aucun joueur trouve.'
    }
  } catch (error) {
    if (requestId !== searchRequestId) return
    searchMessage.value = (error as Error).message
    searchResults.value = []
  } finally {
    if (requestId === searchRequestId) {
      searchLoading.value = false
    }
  }
}

const handleSelectUser = async (user: UserSearchItem) => {
  searchOpen.value = false
  searchQuery.value = ''
  resetSearch()
  await router.push(`/joueur/${user.id}`)
}

const loadNotifications = async (silent = false) => {
  if (!silent) {
    notificationsError.value = ''
  }

  if (!getSessionToken()) {
    friendRequests.value = []
    matchInvites.value = []
    matchReady.value = []
    return
  }

  if (!silent) {
    notificationsLoading.value = true
  }
  try {
    const data = await getNotifications()
    friendRequests.value = data.friendRequests
    matchInvites.value = data.matchInvites
    matchReady.value = data.matchReady
    void handleMatchReady(data.matchReady)
  } catch (error) {
    if (!silent) {
      notificationsError.value = (error as Error).message
    }
  } finally {
    if (!silent) {
      notificationsLoading.value = false
    }
  }
}

const touchStream = () => {
  lastStreamEventAt = Date.now()
}

const stopPolling = () => {
  if (pollingTimer) {
    clearInterval(pollingTimer)
    pollingTimer = null
  }
}

const startPolling = () => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return
  }
  if (pollingTimer) return
  stopNotificationsStream()
  stopStreamTimers()
  void loadNotifications(true)
  pollingTimer = setInterval(() => {
    void loadNotifications(true)
  }, POLL_INTERVAL_MS)
}

const scheduleStreamReconnect = () => {
  if (streamReconnectTimer) {
    clearTimeout(streamReconnectTimer)
  }
  const delay = Math.min(30000, STREAM_BACKOFF_BASE * Math.pow(2, streamRetry))
  streamReconnectTimer = setTimeout(() => {
    startNotificationsStream()
  }, delay)
}

const startStreamWatchdog = () => {
  if (streamWatchdog) return
  streamWatchdog = setInterval(() => {
    if (!notificationsStream) return
    if (Date.now() - lastStreamEventAt > STREAM_STALE_MS) {
      handleStreamError()
    }
  }, 10000)
}

const stopStreamTimers = () => {
  if (streamReconnectTimer) {
    clearTimeout(streamReconnectTimer)
    streamReconnectTimer = null
  }
  if (streamWatchdog) {
    clearInterval(streamWatchdog)
    streamWatchdog = null
  }
}

const handleStreamError = () => {
  stopNotificationsStream()
  stopStreamTimers()
  streamRetry += 1
  if (streamRetry >= STREAM_MAX_RETRY) {
    startPolling()
    return
  }
  scheduleStreamReconnect()
}

const startNotificationsStream = () => {
  if (document.hidden) return
  const token = getSessionToken()
  if (!token || notificationsStream) return
  notificationsStream = openNotificationsStream(
    token,
    (payload) => {
      touchStream()
      friendRequests.value = payload.friendRequests
      matchInvites.value = payload.matchInvites
      matchReady.value = payload.matchReady
      void handleMatchReady(payload.matchReady)
      if (notificationsError.value) {
        notificationsError.value = ''
      }
    },
    () => {
      if (friendOpen.value || matchOpen.value) {
        notificationsError.value = 'Connexion temps reel interrompue.'
      }
      handleStreamError()
    },
  )
  streamRetry = 0
  touchStream()
  stopPolling()
  startStreamWatchdog()
}

const stopNotificationsStream = () => {
  if (!notificationsStream) return
  notificationsStream.close()
  notificationsStream = null
}

const handleVisibilityChange = () => {
  if (document.hidden) {
    stopNotificationsStream()
    stopStreamTimers()
    stopPolling()
    return
  }
  startNotificationsStream()
  void loadNotifications(true)
}

const handleOnline = () => {
  if (document.hidden) return
  startNotificationsStream()
  void loadNotifications(true)
}

const handleOffline = () => {
  stopNotificationsStream()
  stopStreamTimers()
  stopPolling()
}

const shouldPrefetch = () => {
  if (typeof navigator === 'undefined') return false
  const connection = (navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string }
  }).connection
  if (connection?.saveData) return false
  if (connection?.effectiveType && /2g/.test(connection.effectiveType)) return false
  return true
}

const prefetchPlay = () => {
  if (typeof window === 'undefined' || !shouldPrefetch()) return
  const requestIdle =
    (window as Window & { requestIdleCallback?: (cb: IdleCallback) => number })
      .requestIdleCallback ?? ((cb: IdleCallback) => window.setTimeout(cb, 800))
  requestIdle(() => {
    void import('@/views/GameView.vue')
  })
}

const markFriendRead = async () => {
  try {
    await markNotificationsRead('friends')
    friendRequests.value = friendRequests.value.map((request) => ({
      ...request,
      isNew: false,
    }))
  } catch {
    // Ignore read failures.
  }
}

const markMatchRead = async () => {
  try {
    await markNotificationsRead('matches')
    matchInvites.value = matchInvites.value.map((invite) => ({
      ...invite,
      isNew: false,
    }))
  } catch {
    // Ignore read failures.
  }
}

const stopMatchReadyTimer = () => {
  if (matchReadyTimer) {
    clearInterval(matchReadyTimer)
    matchReadyTimer = null
  }
}

const playMatchReadyAlert = () => {
  try {
    if ('vibrate' in navigator) {
      navigator.vibrate([120, 60, 120])
    }
  } catch {
    // Ignore vibration failures.
  }

  try {
    const AudioContextCtor =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextCtor) return
    const context = new AudioContextCtor()
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = 'triangle'
    oscillator.frequency.value = 880
    gain.gain.value = 0.06
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start()
    setTimeout(() => {
      oscillator.stop()
      context.close().catch(() => {})
    }, 200)
  } catch {
    // Ignore audio failures.
  }
}

const cancelMatchReady = () => {
  stopMatchReadyTimer()
  matchReadyToast.value = null
  matchReadyCountdown.value = 0
  redirectingMatch = false
}

const joinMatchReady = async () => {
  if (!matchReadyToast.value || redirectingMatch) return

  const matchId = matchReadyToast.value.matchId
  stopMatchReadyTimer()
  matchReadyToast.value = null
  matchReadyCountdown.value = 0
  redirectingMatch = true

  const current = router.currentRoute.value
  const currentId = typeof current.params.id === 'string' ? current.params.id : ''
  if (!(current.name === 'play' && currentId === matchId)) {
    clearMatchesCache()
    matchOpen.value = false
    await router.push(`/jeu/${matchId}`)
  }

  redirectingMatch = false
}

const handleMatchReady = async (items: MatchReadyNotification[]) => {
  if (!items.length || redirectingMatch) return
  const next = items.find((item) => !handledMatches.has(item.matchId))
  if (!next) return

  handledMatches.add(next.matchId)
  matchReadyToast.value = next
  matchReadyCountdown.value = matchReadyDelay
  playMatchReadyAlert()

  try {
    await markNotificationsRead('match-ready')
  } catch {
    // Ignore read failures.
  }

  stopMatchReadyTimer()
  matchReadyTimer = setInterval(() => {
    if (matchReadyCountdown.value <= 1) {
      void joinMatchReady()
      return
    }
    matchReadyCountdown.value -= 1
  }, 1000)
}

const toggleFriendPanel = async () => {
  friendOpen.value = !friendOpen.value
  if (friendOpen.value) {
    matchOpen.value = false
    resetFriendNotice()
    await loadNotifications()
    await markFriendRead()
  }
}

const toggleMatchPanel = async () => {
  matchOpen.value = !matchOpen.value
  if (matchOpen.value) {
    friendOpen.value = false
    resetMatchNotice()
    await loadNotifications()
    await markMatchRead()
  }
}

const handleFriendResponse = async (
  request: FriendRequestNotification,
  action: 'accept' | 'decline',
) => {
  resetFriendNotice()
  try {
    const response = await respondFriendRequest(request.user.id, action)
    friendNotice.value = response.message
    friendNoticeError.value = !response.ok
    if (response.ok) {
      friendRequests.value = friendRequests.value.filter((item) => item.id !== request.id)
    }
  } catch (error) {
    friendNotice.value = (error as Error).message
    friendNoticeError.value = true
  }
}

const handleMatchResponse = async (
  invite: MatchInviteNotification,
  action: 'accept' | 'decline',
) => {
  resetMatchNotice()
  try {
    const response = await respondMatchInvite(invite.id, action)
    matchNotice.value = response.message
    matchNoticeError.value = !response.ok
    if (response.ok) {
      matchInvites.value = matchInvites.value.filter((item) => item.id !== invite.id)
      if (action === 'accept' && response.matchId) {
        clearMatchesCache()
        matchOpen.value = false
        await router.push(`/jeu/${response.matchId}`)
      }
    }
  } catch (error) {
    matchNotice.value = (error as Error).message
    matchNoticeError.value = true
  }
}

const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as Node | null
  if (!target) return

  if (searchGroup.value && !searchGroup.value.contains(target)) {
    searchOpen.value = false
  }
  if (friendGroup.value && !friendGroup.value.contains(target)) {
    friendOpen.value = false
  }
  if (matchGroup.value && !matchGroup.value.contains(target)) {
    matchOpen.value = false
  }
}

const showSearchPanel = computed(() => {
  const hasQuery = searchQuery.value.trim().length >= minSearchLength
  return searchOpen.value && (hasQuery || searchLoading.value || !!searchMessage.value)
})

onMounted(async () => {
  dashboard.value = await getDashboardData()
  await loadNotifications()
  startNotificationsStream()
  prefetchPlay()
})

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
})

onBeforeUnmount(() => {
  if (searchTimer) {
    clearTimeout(searchTimer)
  }
  stopMatchReadyTimer()
  stopNotificationsStream()
  stopStreamTimers()
  stopPolling()
  document.removeEventListener('mousedown', handleClickOutside)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  window.removeEventListener('online', handleOnline)
  window.removeEventListener('offline', handleOffline)
})

watch(searchQuery, (value) => {
  if (searchTimer) {
    clearTimeout(searchTimer)
  }

  const trimmed = value.trim()
  if (!trimmed) {
    resetSearch()
    return
  }

  if (trimmed.length < minSearchLength) {
    searchResults.value = []
    searchLoading.value = false
    searchMessage.value = 'Entrez au moins 2 caracteres.'
    return
  }

  searchTimer = setTimeout(() => {
    void runSearch(trimmed)
  }, 300)
})

const handleLogout = async () => {
  stopNotificationsStream()
  stopStreamTimers()
  stopPolling()
  stopMatchReadyTimer()
  await clearSession()
  await router.push('/auth')
}
</script>

<template>
  <a class="skip-link" href="#main-content">Aller au contenu</a>
  <div class="app-shell">
    <AppNavbar
      class="app-navbar--dashboard"
      :items="navItems"
      brand-label="WarChess"
      :brand-logo="logoUrl"
    >
      <template #actions>
        <div class="dashboard-nav-actions">
          <RouterLink class="button-ghost nav-action" to="/amis">Amis</RouterLink>
          <RouterLink class="app-navbar__link nav-action" to="/help">Aide &amp; regles</RouterLink>
          <button class="button-outline nav-action" type="button" @click="handleLogout">
            {{ logoutLabel }}
          </button>
        </div>
      </template>
    </AppNavbar>
    <div class="toast-stack" aria-live="polite" aria-atomic="true">
      <div v-if="matchReadyToast" class="toast-card" role="status">
        <div class="toast-main">
          <p class="toast-title">Match accepte</p>
          <p class="toast-sub">
            {{ matchReadyToast.from.name }} a accepte votre invitation - {{ matchReadyToast.timeControl }}.
          </p>
          <p class="toast-timer">Redirection dans {{ matchReadyCountdown }}s</p>
        </div>
        <div class="toast-actions">
          <button class="button-primary" type="button" @click="joinMatchReady">Rejoindre</button>
          <button class="button-ghost" type="button" @click="cancelMatchReady">Annuler</button>
        </div>
      </div>
    </div>
    <main id="main-content" class="main">
      <header class="topbar">
        <div class="welcome">
          <p class="eyebrow">{{ props.eyebrow }}</p>
          <h1 class="headline">{{ props.title }}</h1>
          <p v-if="props.subtitle" class="subhead">{{ props.subtitle }}</p>
        </div>

        <div class="top-actions">
          <div ref="searchGroup" class="search-group">
            <label class="search">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.6" fill="none" />
                <path
                  d="M16.5 16.5L21 21"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                />
              </svg>
              <input
                v-model="searchQuery"
                type="search"
                placeholder="Rechercher joueurs, parties, ouvertures"
                aria-label="Rechercher"
                @focus="searchOpen = true"
                @keydown.escape="searchOpen = false"
              />
            </label>

            <div v-if="showSearchPanel" class="search-panel">
              <p class="search-title">Joueurs</p>
              <p v-if="searchLoading" class="search-status">Recherche en cours...</p>
              <button
                v-for="user in searchResults"
                :key="user.id"
                class="search-item"
                type="button"
                @mousedown.prevent="handleSelectUser(user)"
              >
                <span class="search-avatar">{{ initialsFor(user.name) }}</span>
                <span class="search-main">
                  <span class="search-name">{{ user.name }}</span>
                  <span class="search-sub">{{ user.title || 'Profil public' }}</span>
                </span>
                <span class="search-meta">
                  <span
                    :class="['presence-dot', onlineClass(user)]"
                    aria-hidden="true"
                  ></span>
                  {{ onlineLabel(user) }} - Elo {{ user.rating }}
                </span>
              </button>
              <p v-if="!searchLoading && searchMessage" class="search-status">{{ searchMessage }}</p>
            </div>
          </div>

          <div class="top-buttons">
            <div ref="matchGroup" class="notify-group">
              <button
                class="icon-button notify-button"
                type="button"
                aria-label="Notifications de match"
                :aria-expanded="matchOpen"
                aria-controls="match-panel"
                @click="toggleMatchPanel"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M12 4a5 5 0 0 0-5 5v2.8l-1.4 2.2h12.8L17 11.8V9a5 5 0 0 0-5-5z"
                    stroke="currentColor"
                    stroke-width="1.6"
                    fill="none"
                  />
                  <path
                    d="M9.5 18a2.5 2.5 0 0 0 5 0"
                    stroke="currentColor"
                    stroke-width="1.6"
                    fill="none"
                  />
                </svg>
                <span v-if="matchCount" class="notify-badge">{{ matchCount }}</span>
                <span v-if="hasNewMatch" class="notify-dot"></span>
              </button>

              <div v-if="matchOpen" id="match-panel" class="notify-panel" role="region" aria-label="Invitations de match">
                <p class="notify-title">Invitations de match</p>
                <p v-if="notificationsLoading" class="notify-status">Chargement...</p>
                <p v-if="!notificationsLoading && notificationsError" class="notify-status notify-status--error">
                  {{ notificationsError }}
                </p>
                <div v-for="invite in matchInvites" :key="invite.id" class="notify-item">
                  <span class="notify-avatar">{{ initialsFor(invite.from.name) }}</span>
                  <span class="notify-main">
                    <span class="notify-name">{{ invite.from.name }}</span>
                    <span class="notify-sub">Invitation de match - {{ invite.timeControl }}</span>
                  </span>
                  <span class="notify-actions">
                    <button
                      class="notify-action button-primary"
                      type="button"
                      @click="handleMatchResponse(invite, 'accept')"
                    >
                      Accepter
                    </button>
                    <button
                      class="notify-action button-ghost"
                      type="button"
                      @click="handleMatchResponse(invite, 'decline')"
                    >
                      Refuser
                    </button>
                  </span>
                </div>
                <p
                  v-if="!notificationsLoading && !matchInvites.length && !notificationsError"
                  class="notify-status"
                >
                  Aucune invitation.
                </p>
                <p
                  v-if="matchNotice"
                  :class="['notify-status', matchNoticeError ? 'notify-status--error' : 'notify-status--success']"
                >
                  {{ matchNotice }}
                </p>
              </div>
            </div>

            <div ref="friendGroup" class="notify-group">
              <button
                class="icon-button notify-button"
                type="button"
                aria-label="Demandes d'amis"
                :aria-expanded="friendOpen"
                aria-controls="friend-panel"
                @click="toggleFriendPanel"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M4 6h16v9H7l-3 3V6z"
                    stroke="currentColor"
                    stroke-width="1.6"
                    fill="none"
                    stroke-linejoin="round"
                  />
                </svg>
                <span v-if="friendCount" class="notify-badge">{{ friendCount }}</span>
                <span v-if="hasNewFriend" class="notify-dot"></span>
              </button>

              <div
                v-if="friendOpen"
                id="friend-panel"
                class="notify-panel"
                role="region"
                aria-label="Demandes d'amis"
              >
                <p class="notify-title">Demandes d'amis</p>
                <p v-if="notificationsLoading" class="notify-status">Chargement...</p>
                <p v-if="!notificationsLoading && notificationsError" class="notify-status notify-status--error">
                  {{ notificationsError }}
                </p>
                <div v-for="request in friendRequests" :key="request.id" class="notify-item">
                  <span class="notify-avatar">{{ initialsFor(request.user.name) }}</span>
                  <span class="notify-main">
                    <span class="notify-name">{{ request.user.name }}</span>
                    <span class="notify-sub">Demande d'ami</span>
                  </span>
                  <span class="notify-actions">
                    <button
                      class="notify-action button-primary"
                      type="button"
                      @click="handleFriendResponse(request, 'accept')"
                    >
                      Accepter
                    </button>
                    <button
                      class="notify-action button-ghost"
                      type="button"
                      @click="handleFriendResponse(request, 'decline')"
                    >
                      Refuser
                    </button>
                  </span>
                </div>
                <p
                  v-if="!notificationsLoading && !friendRequests.length && !notificationsError"
                  class="notify-status"
                >
                  Aucune demande.
                </p>
                <p
                  v-if="friendNotice"
                  :class="['notify-status', friendNoticeError ? 'notify-status--error' : 'notify-status--success']"
                >
                  {{ friendNotice }}
                </p>
              </div>
            </div>
          </div>

          <div class="user-pill">
            <div class="avatar">
              <img
                v-if="profileAvatar"
                :src="profileAvatar"
                alt="Avatar"
                width="36"
                height="36"
                loading="lazy"
                decoding="async"
              />
              <span v-else>{{ profileInitials }}</span>
            </div>
            <div>
              <p class="user-name">{{ profileName }}</p>
              <p class="user-meta">{{ profileTitle }}</p>
            </div>
          </div>
        </div>
      </header>

      <slot />
    </main>

    <BottomNav />
  </div>
</template>
