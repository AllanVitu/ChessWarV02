<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import DashboardLayout from '@/components/DashboardLayout.vue'
import AppTabs from '@/components/ui/AppTabs.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { getLeaderboard, type LeaderboardPlayer, type LeaderboardScope } from '@/lib/leaderboard'

const tabs = [
  { id: 'global', label: 'Global' },
  { id: 'monthly', label: 'Mensuel' },
  { id: 'friends', label: 'Amis' },
]

const activeTab = ref<LeaderboardScope>('global')
const query = ref('')
const page = ref(1)
const pageSize = 10
const players = ref<LeaderboardPlayer[]>([])
const loading = ref(false)
const error = ref('')

const fetchLeaderboard = async () => {
  loading.value = true
  error.value = ''
  try {
    const result = await getLeaderboard(activeTab.value, 1, 50)
    players.value = result.players
    error.value = result.serviceMessage ?? ''
  } catch (err) {
    error.value = (err as Error).message
    players.value = []
  } finally {
    loading.value = false
  }
}

const filteredPlayers = computed(() => {
  const list = players.value ?? []
  const trimmed = query.value.trim().toLowerCase()
  if (!trimmed) return list
  return list.filter((player) => player.name.toLowerCase().includes(trimmed))
})
const topPlayer = computed(() => players.value[0] ?? null)
const averageRating = computed(() => {
  if (!players.value.length) return 0
  const total = players.value.reduce((sum, player) => sum + player.rating, 0)
  return Math.round(total / players.value.length)
})
const liveSignalLabel = computed(() => {
  if (loading.value) return 'Signal: synchronisation...'
  if (error.value) return 'Signal: indisponible'
  return `Signal: ${filteredPlayers.value.length} joueurs`
})

const visiblePlayers = computed(() =>
  filteredPlayers.value.slice(0, page.value * pageSize),
)

const canLoadMore = computed(() => visiblePlayers.value.length < filteredPlayers.value.length)
const deltaClass = (delta: number) => {
  if (delta > 0) return 'leaderboard-delta--up'
  if (delta < 0) return 'leaderboard-delta--down'
  return 'leaderboard-delta--flat'
}
const rankClass = (rank: number) => {
  if (rank === 1) return 'leaderboard-rank--gold'
  if (rank === 2) return 'leaderboard-rank--silver'
  if (rank === 3) return 'leaderboard-rank--bronze'
  return ''
}

const resetQuery = () => {
  query.value = ''
  page.value = 1
}

watch([activeTab, query], () => {
  page.value = 1
})

watch(activeTab, () => {
  void fetchLeaderboard()
})

onMounted(async () => {
  await fetchLeaderboard()
})
</script>

<template>
  <DashboardLayout
    eyebrow="Classement"
    title="Tableau des meilleurs joueurs"
    subtitle="Suivez votre position et lancez un match en un clic."
  >
    <section class="leaderboard-page">
      <div class="panel leaderboard-hero">
        <div>
          <p class="panel-title">Live ranking</p>
          <h2 class="panel-headline">Classement WarChess</h2>
          <p class="panel-sub">
            Comparez vos performances en temps reel et defiez les meilleurs.
          </p>
          <div class="leaderboard-hud">
            <article class="leaderboard-hud-card">
              <p class="leaderboard-hud-label">Leader</p>
              <p class="leaderboard-hud-value">{{ topPlayer ? topPlayer.name : '--' }}</p>
            </article>
            <article class="leaderboard-hud-card">
              <p class="leaderboard-hud-label">Elo moyen</p>
              <p class="leaderboard-hud-value">{{ averageRating || '--' }}</p>
            </article>
            <article class="leaderboard-hud-card">
              <p class="leaderboard-hud-label">Signal</p>
              <p class="leaderboard-hud-value">{{ liveSignalLabel }}</p>
            </article>
          </div>
          <div class="leaderboard-cta">
          <RouterLink class="button-primary" to="/matchs">Lancer un match</RouterLink>
            <RouterLink class="button-ghost" to="/profil/analyse">Voir mon analyse</RouterLink>
          </div>
        </div>

        <div class="leaderboard-controls">
          <AppTabs v-model="activeTab" :tabs="tabs" />
          <p class="leaderboard-live-note">{{ liveSignalLabel }}</p>
          <label class="search">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.6" fill="none" />
              <path d="M16.5 16.5L21 21" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
            </svg>
            <input
              v-model="query"
              type="search"
              placeholder="Rechercher un joueur"
              aria-label="Rechercher un joueur"
            />
          </label>
        </div>
      </div>

      <div class="panel leaderboard-table">
        <div class="leaderboard-table__header">
          <span>Rang</span>
          <span>Joueur</span>
          <span>Elo</span>
          <span>Delta</span>
          <span></span>
        </div>

        <EmptyState
          v-if="loading"
          title="Chargement du classement"
          subtitle="Synchronisation des statistiques en cours."
        />

        <EmptyState
          v-else-if="error"
          title="Classement indisponible"
          :subtitle="error"
        >
          <button class="button-ghost" type="button" @click="fetchLeaderboard">Reessayer</button>
        </EmptyState>

        <EmptyState
          v-else-if="!filteredPlayers.length"
          title="Aucun joueur trouve"
          subtitle="Essayez un autre filtre ou une recherche differente."
        >
          <button class="button-ghost" type="button" @click="resetQuery">Reinitialiser</button>
        </EmptyState>

        <div v-else class="leaderboard-table__body">
          <div v-for="player in visiblePlayers" :key="player.id" class="leaderboard-row">
            <span :class="['leaderboard-rank', rankClass(player.rank)]">#{{ player.rank }}</span>
            <div class="leaderboard-player">
              <div class="leaderboard-avatar">{{ player.name.slice(0, 1) }}</div>
              <div>
                <p class="leaderboard-name">{{ player.name }}</p>
                <p class="leaderboard-meta">Equipe WarChess</p>
              </div>
            </div>
            <span class="leaderboard-rating">{{ player.rating }}</span>
            <span :class="['leaderboard-delta', deltaClass(player.delta)]">
              {{ player.delta >= 0 ? '+' : '' }}{{ player.delta }}
            </span>
            <RouterLink class="button-ghost" :to="`/joueur/${player.id}`">Voir</RouterLink>
          </div>
          <button
            v-if="canLoadMore"
            class="button-ghost"
            type="button"
            @click="page += 1"
          >
            Afficher plus
          </button>
        </div>
      </div>
    </section>
  </DashboardLayout>
</template>
