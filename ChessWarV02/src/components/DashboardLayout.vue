<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import logoUrl from '@/assets/brand-icon.png'
import { getDashboardData, type DashboardDb } from '@/lib/localDb'
import { getSessionToken } from '@/lib/api'
import { clearSession } from '@/lib/auth'
import { clearMatchesCache } from '@/lib/matchesDb'
import { searchUsers, respondFriendRequest, type UserSearchItem } from '@/lib/users'
import {
  getNotifications,
  respondMatchInvite,
  type FriendRequestNotification,
  type MatchInviteNotification,
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
const profileTitle = computed(() => dashboard.value?.profile.title ?? 'Compte local')
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
const seenFriendIds = ref<string[]>([])
const seenMatchIds = ref<string[]>([])
const seenStorageKey = 'warchess.notifications.seen'
const notificationsPollMs = 20000
let notificationsTimer: ReturnType<typeof setInterval> | null = null

const friendCount = computed(() => friendRequests.value.length)
const matchCount = computed(() => matchInvites.value.length)
const hasNewFriend = computed(() =>
  friendRequests.value.some((request) => !seenFriendIds.value.includes(request.id)),
)
const hasNewMatch = computed(() =>
  matchInvites.value.some((invite) => !seenMatchIds.value.includes(invite.id)),
)

const resetSearch = () => {
  searchResults.value = []
  searchLoading.value = false
  searchMessage.value = ''
}

const loadSeenState = () => {
  if (typeof window === 'undefined') return
  try {
    const raw = window.localStorage.getItem(seenStorageKey)
    if (!raw) return
    const parsed = JSON.parse(raw) as { friendIds?: string[]; matchIds?: string[] }
    if (Array.isArray(parsed.friendIds)) {
      seenFriendIds.value = parsed.friendIds
    }
    if (Array.isArray(parsed.matchIds)) {
      seenMatchIds.value = parsed.matchIds
    }
  } catch {
    // Ignore malformed storage.
  }
}

const saveSeenState = () => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      seenStorageKey,
      JSON.stringify({
        friendIds: seenFriendIds.value,
        matchIds: seenMatchIds.value,
      }),
    )
  } catch {
    // Ignore storage failures.
  }
}

const markFriendSeen = () => {
  seenFriendIds.value = friendRequests.value.map((request) => request.id)
  saveSeenState()
}

const markMatchSeen = () => {
  seenMatchIds.value = matchInvites.value.map((invite) => invite.id)
  saveSeenState()
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
    return
  }

  if (!silent) {
    notificationsLoading.value = true
  }
  try {
    const data = await getNotifications()
    friendRequests.value = data.friendRequests
    matchInvites.value = data.matchInvites

    if (friendOpen.value) {
      markFriendSeen()
    }
    if (matchOpen.value) {
      markMatchSeen()
    }
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

const toggleFriendPanel = async () => {
  friendOpen.value = !friendOpen.value
  if (friendOpen.value) {
    matchOpen.value = false
    resetFriendNotice()
    await loadNotifications()
    markFriendSeen()
  }
}

const toggleMatchPanel = async () => {
  matchOpen.value = !matchOpen.value
  if (matchOpen.value) {
    friendOpen.value = false
    resetMatchNotice()
    await loadNotifications()
    markMatchSeen()
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
  loadSeenState()
  await loadNotifications()
  notificationsTimer = setInterval(() => {
    void loadNotifications(true)
  }, notificationsPollMs)
})

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside)
})

onBeforeUnmount(() => {
  if (searchTimer) {
    clearTimeout(searchTimer)
  }
  if (notificationsTimer) {
    clearInterval(notificationsTimer)
  }
  document.removeEventListener('mousedown', handleClickOutside)
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
  await clearSession()
  await router.push('/connexion')
}
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar reveal">
      <div class="brand">
        <div class="brand-mark">
          <img class="brand-logo" :src="logoUrl" alt="WarChess" />
        </div>
        <div>
          <p class="brand-title">WarChess</p>
          <p class="brand-sub">Operations Arena</p>
        </div>
      </div>

      <div class="nav-group">
        <p class="nav-title">General</p>
        <RouterLink to="/tableau-de-bord" class="nav-link" exact-active-class="nav-link--active">
          <span class="nav-dot"></span>
          Vue d'ensemble
        </RouterLink>
        <RouterLink to="/matchs" class="nav-link" active-class="nav-link--active">
          <span class="nav-dot"></span>
          Matchs
        </RouterLink>
        <RouterLink to="/jeu" class="nav-link" active-class="nav-link--active">
          <span class="nav-dot"></span>
          Partie
        </RouterLink>
      </div>

      <div class="nav-group">
        <p class="nav-title">Rapports</p>
        <RouterLink to="/profil/analyse" class="nav-link" active-class="nav-link--active">
          <span class="nav-dot"></span>
          Analyse du profil
        </RouterLink>
      </div>

      <div class="nav-group">
        <p class="nav-title">Social</p>
        <RouterLink to="/amis" class="nav-link" active-class="nav-link--active">
          <span class="nav-dot"></span>
          Amis
        </RouterLink>
      </div>

      <div class="nav-group">
        <p class="nav-title">Parametres</p>
        <RouterLink to="/parametres" class="nav-link" active-class="nav-link--active">
          <span class="nav-dot"></span>
          Parametres
        </RouterLink>
        <RouterLink to="/profil" class="nav-link" active-class="nav-link--active">
          <span class="nav-dot"></span>
          Profil & securite
        </RouterLink>
        <button class="nav-link nav-link--disabled" type="button" disabled>
          <span class="nav-dot"></span>
          Support
        </button>
      </div>

      <button class="logout" type="button" @click="handleLogout">Se deconnecter</button>
    </aside>

    <main class="main">
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
                type="text"
                placeholder="Rechercher joueurs, parties, ouvertures"
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
                <span class="search-meta">Elo {{ user.rating }}</span>
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

              <div v-if="matchOpen" class="notify-panel">
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

              <div v-if="friendOpen" class="notify-panel">
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
              <img v-if="profileAvatar" :src="profileAvatar" alt="Avatar" />
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
  </div>
</template>

