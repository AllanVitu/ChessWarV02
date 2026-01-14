<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import logoUrl from '@/assets/brand-icon.png'
import { getDashboardData, type DashboardDb } from '@/lib/localDb'
import { getSessionToken } from '@/lib/api'
import { clearSession } from '@/lib/auth'
import { searchUsers, type UserSearchItem } from '@/lib/users'

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

const resetSearch = () => {
  searchResults.value = []
  searchLoading.value = false
  searchMessage.value = ''
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

const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as Node | null
  if (!searchGroup.value || !target) return
  if (!searchGroup.value.contains(target)) {
    searchOpen.value = false
  }
}

const showSearchPanel = computed(() => {
  const hasQuery = searchQuery.value.trim().length >= minSearchLength
  return searchOpen.value && (hasQuery || searchLoading.value || !!searchMessage.value)
})

onMounted(async () => {
  dashboard.value = await getDashboardData()
})

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside)
})

onBeforeUnmount(() => {
  if (searchTimer) {
    clearTimeout(searchTimer)
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
            <button class="icon-button" type="button" aria-label="Notifications">
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
            </button>
            <button class="icon-button" type="button" aria-label="Messages">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M4 6h16v9H7l-3 3V6z"
                  stroke="currentColor"
                  stroke-width="1.6"
                  fill="none"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
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

