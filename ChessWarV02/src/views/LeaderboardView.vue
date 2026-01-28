<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import DashboardLayout from '@/components/DashboardLayout.vue'
import AppTabs from '@/components/ui/AppTabs.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

const tabs = [
  { id: 'global', label: 'Global' },
  { id: 'monthly', label: 'Mensuel' },
  { id: 'friends', label: 'Amis' },
]

const activeTab = ref('global')
const query = ref('')
const page = ref(1)
const pageSize = 10

const leaderboard = {
  global: [
    { id: 'p-01', rank: 1, name: 'I. Alvarez', rating: 2548, delta: '+12' },
    { id: 'p-02', rank: 2, name: 'C. Russo', rating: 2492, delta: '+8' },
    { id: 'p-03', rank: 3, name: 'T. Holm', rating: 2451, delta: '+5' },
    { id: 'p-04', rank: 4, name: 'J. Park', rating: 2422, delta: '+4' },
    { id: 'p-05', rank: 5, name: 'S. Nguyen', rating: 2384, delta: '+2' },
  ],
  monthly: [
    { id: 'p-06', rank: 1, name: 'M. Silva', rating: 2362, delta: '+24' },
    { id: 'p-07', rank: 2, name: 'L. Bernard', rating: 2328, delta: '+18' },
    { id: 'p-08', rank: 3, name: 'D. Miller', rating: 2291, delta: '+14' },
  ],
  friends: [
    { id: 'p-09', rank: 1, name: 'A. Carter', rating: 2012, delta: '+6' },
    { id: 'p-10', rank: 2, name: 'N. Lopez', rating: 1988, delta: '+4' },
  ],
} as const

const filteredPlayers = computed(() => {
  const list = leaderboard[activeTab.value as keyof typeof leaderboard] ?? []
  const trimmed = query.value.trim().toLowerCase()
  if (!trimmed) return list
  return list.filter((player) => player.name.toLowerCase().includes(trimmed))
})

const visiblePlayers = computed(() =>
  filteredPlayers.value.slice(0, page.value * pageSize),
)

const canLoadMore = computed(() => visiblePlayers.value.length < filteredPlayers.value.length)

const resetQuery = () => {
  query.value = ''
  page.value = 1
}

watch([activeTab, query], () => {
  page.value = 1
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
          <div class="leaderboard-cta">
            <RouterLink class="button-primary" to="/play">Lancer un match</RouterLink>
            <RouterLink class="button-ghost" to="/profil/analyse">Voir mon analyse</RouterLink>
          </div>
        </div>

        <div class="leaderboard-controls">
          <AppTabs v-model="activeTab" :tabs="tabs" />
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
          v-if="!filteredPlayers.length"
          title="Aucun joueur trouve"
          subtitle="Essayez un autre filtre ou une recherche differente."
        >
          <button class="button-ghost" type="button" @click="resetQuery">Reinitialiser</button>
        </EmptyState>

        <div v-else class="leaderboard-table__body">
          <div v-for="player in visiblePlayers" :key="player.id" class="leaderboard-row">
            <span class="leaderboard-rank">#{{ player.rank }}</span>
            <div class="leaderboard-player">
              <div class="leaderboard-avatar">{{ player.name.slice(0, 1) }}</div>
              <div>
                <p class="leaderboard-name">{{ player.name }}</p>
                <p class="leaderboard-meta">Equipe WarChess</p>
              </div>
            </div>
            <span class="leaderboard-rating">{{ player.rating }}</span>
            <span class="leaderboard-delta">{{ player.delta }}</span>
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
