<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import DashboardLayout from '@/components/DashboardLayout.vue'
import LineChart from '@/components/charts/LineChart.vue'
import { getDashboardData, type GameRecord } from '@/lib/localDb'
import { getMatches, type MatchRecord } from '@/lib/matchesDb'
import { buildEloSeries, summarizeMatches, filterMatchesByPeriod } from '@/lib/stats'

const games = ref<GameRecord[]>([])
const matches = ref<MatchRecord[]>([])
const profileRating = ref(1200)

type PeriodKey = '7j' | '30j' | '90j'
const selectedPeriod = ref<PeriodKey>('30j')

const periodOptions = [
  { key: '7j', label: '7 jours', days: 7 },
  { key: '30j', label: '30 jours', days: 30 },
  { key: '90j', label: '90 jours', days: 90 },
] as const

type PeriodOption = (typeof periodOptions)[number]
const fallbackPeriod: PeriodOption = periodOptions[1] ?? periodOptions[0]

const periodConfig = computed<PeriodOption>(
  () => periodOptions.find((period) => period.key === selectedPeriod.value) ?? fallbackPeriod,
)

const periodMatches = computed(() =>
  filterMatchesByPeriod(matches.value, periodConfig.value.days).reverse(),
)

const eloSeries = computed(() => buildEloSeries(periodMatches.value, profileRating.value))
const chartLabels = computed(() => eloSeries.value.map((_, index) => `M${index + 1}`))
const chartDatasets = computed(() => [
  { label: 'Elo', data: eloSeries.value, color: 'rgba(242, 167, 101, 0.85)' },
])

const eloStats = computed(() => {
  const safeValues = eloSeries.value.length ? eloSeries.value : [0]
  const min = Math.min(...safeValues)
  const max = Math.max(...safeValues)
  return {
    min,
    max,
    start: safeValues[0] ?? 0,
    end: safeValues[safeValues.length - 1] ?? 0,
  }
})

const formatRating = (value: number) => Math.round(value).toString()

const summary = computed(() => summarizeMatches(matches.value))

const keyMetrics = computed(() => [
  { label: 'Winrate', value: `${summary.value.winRate}%`, detail: `${summary.value.wins}/${summary.value.total}` },
  {
    label: 'Elo delta',
    value: `${summary.value.totalEloDelta >= 0 ? '+' : ''}${summary.value.totalEloDelta}`,
    detail: 'Sur 30 jours',
  },
  {
    label: 'Precision',
    value: games.value.length
      ? `${Math.round(games.value.reduce((sum, game) => sum + (game.accuracy ?? 0), 0) / games.value.length)}%`
      : '0%',
    detail: 'Moyenne parties',
  },
  { label: 'Matchs JcJ', value: `${summary.value.total}`, detail: 'Historique' },
])

const focusAreas = computed(() =>
  games.value.length
    ? [
        { label: 'Regularite', progress: Math.min(100, summary.value.winRate) },
        {
          label: 'Precision',
          progress: Math.min(
            100,
            Math.round(
              games.value.reduce((sum, game) => sum + (game.accuracy ?? 0), 0) / games.value.length,
            ),
          ),
        },
      ]
    : [],
)

const highlights = computed(() => {
  if (!games.value.length) return []
  const openingCounts = games.value.reduce<Record<string, number>>((acc, item) => {
    const key = item.opening || 'Inconnue'
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})
  const favoriteOpening =
    Object.entries(openingCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '---'
  return [{ title: 'Ouverture favorite', detail: favoriteOpening, tag: 'Stable' }]
})

const periodStats = computed(() => {
  const items = games.value
  const total = items.length
  if (!total) {
    return [
      { label: 'Matchs joues', value: '0', note: 'Aucune partie' },
      { label: 'Taux de victoire', value: '0%', note: '0 victoires' },
      { label: 'Precision moyenne', value: '0%', note: '---' },
      { label: 'Ouverture favorite', value: '---', note: '---' },
    ]
  }

  const wins = items.filter((item) => item.result === 'win').length
  const winRate = Math.round((wins / total) * 100)
  const avgAccuracy = Math.round(
    items.reduce((sum, item) => sum + (item.accuracy ?? 0), 0) / total,
  )
  const avgMoves = Math.round(items.reduce((sum, item) => sum + (item.moves ?? 0), 0) / total)
  const openingCounts = items.reduce<Record<string, number>>((acc, item) => {
    const key = item.opening || 'Inconnue'
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})
  const favoriteOpening =
    Object.entries(openingCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '---'

  return [
    { label: 'Matchs joues', value: `${total}`, note: `${wins} victoires` },
    { label: 'Taux de victoire', value: `${winRate}%`, note: `Moyenne ${avgMoves} coups` },
    { label: 'Precision moyenne', value: `${avgAccuracy}%`, note: 'Sur ce segment' },
    { label: 'Ouverture favorite', value: favoriteOpening, note: `${openingCounts[favoriteOpening] ?? 0} parties` },
  ]
})

onMounted(async () => {
  const data = await getDashboardData()
  games.value = data.games ?? []
  profileRating.value = data.profile.rating ?? 1200
  matches.value = await getMatches()
})
</script>

<template>
  <DashboardLayout
    eyebrow="Analyse"
    title="Analyse du profil"
    subtitle="Synthese de performance et tendances recentes."
    :breadcrumbs="[{ label: 'Profil', to: '/profile' }, { label: 'Analyse' }]"
  >
    <section class="content-grid">
      <div class="left-column">
        <div class="panel hero-card">
          <div class="panel-header">
            <div>
              <p class="panel-title">Apercu general</p>
              <h2 class="panel-headline">Niveau et progression</h2>
              <p class="panel-sub">Suivi des stats cles sur vos 30 derniers matchs.</p>
            </div>
            <span class="badge-soft">{{ periodConfig.label }}</span>
          </div>

          <div class="stats-grid">
            <div v-for="metric in keyMetrics" :key="metric.label" class="panel stat-card">
              <p class="stat-label">{{ metric.label }}</p>
              <p class="stat-value">{{ metric.value }}</p>
              <div class="stat-meta">
                <span class="stat-change">{{ metric.detail }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="panel elo-panel">
          <div class="panel-header">
            <div>
              <p class="panel-title">Courbe Elo</p>
              <h3 class="panel-headline">Evolution recente</h3>
              <p class="panel-sub">Basee sur vos derniers matchs.</p>
            </div>
            <div class="segmented elo-periods">
              <button
                v-for="period in periodOptions"
                :key="period.key"
                type="button"
                :class="['segmented-button', selectedPeriod === period.key && 'segmented-button--active']"
                @click="selectedPeriod = period.key"
              >
                {{ period.label }}
              </button>
            </div>
          </div>

          <div class="elo-chart">
            <LineChart :labels="chartLabels" :datasets="chartDatasets" />
            <div class="elo-range">
              <span>{{ formatRating(eloStats.min) }}</span>
              <span>{{ formatRating(eloStats.max) }}</span>
            </div>
          </div>

          <div class="elo-metrics">
            <div class="metric-card">
              <p class="metric-label">Depart</p>
              <p class="metric-value">{{ formatRating(eloStats.start) }}</p>
              <p class="metric-note">Debut de periode</p>
            </div>
            <div class="metric-card">
              <p class="metric-label">Fin</p>
              <p class="metric-value">{{ formatRating(eloStats.end) }}</p>
              <p class="metric-note">Actuel</p>
            </div>
            <div class="metric-card">
              <p class="metric-label">Variation</p>
              <p class="metric-value">
                {{ Math.round(eloStats.end - eloStats.start) >= 0 ? '+' : '' }}{{
                  Math.round(eloStats.end - eloStats.start)
                }}
              </p>
              <p class="metric-note">Sur la periode</p>
            </div>
          </div>

          <div class="period-metrics">
            <div v-for="metric in periodStats" :key="metric.label" class="metric-card">
              <p class="metric-label">{{ metric.label }}</p>
              <p class="metric-value">{{ metric.value }}</p>
              <p class="metric-note">{{ metric.note }}</p>
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-header">
            <div>
              <p class="panel-title">Axes prioritaires</p>
              <h3 class="panel-headline">Progression ciblee</h3>
            </div>
            <span class="range-pill">Mensuel</span>
          </div>

          <div v-if="focusAreas.length" class="progress-list analysis-progress">
            <div v-for="focus in focusAreas" :key="focus.label" class="progress-item">
              <div class="progress-labels">
                <span>{{ focus.label }}</span>
                <span>{{ focus.progress }}%</span>
              </div>
              <div class="progress-bar">
                <span class="progress-fill" :style="{ width: `${focus.progress}%` }"></span>
              </div>
            </div>
          </div>
          <p v-else class="panel-sub">Aucune donnee de progression disponible.</p>
        </div>

        <div class="panel">
          <div class="panel-header">
            <div>
              <p class="panel-title">Moments forts</p>
              <h3 class="panel-headline">Ce qui fonctionne</h3>
            </div>
          </div>

          <div v-if="highlights.length" class="session-list">
            <div v-for="item in highlights" :key="item.title" class="session-item">
              <div>
                <p class="session-title">{{ item.title }}</p>
                <p class="session-time">{{ item.detail }}</p>
              </div>
              <span class="badge-soft">{{ item.tag }}</span>
            </div>
          </div>
          <p v-else class="panel-sub">Aucun highlight pour le moment.</p>
        </div>
      </div>

      <aside class="right-column">
        <div class="panel">
          <div class="panel-header">
            <div>
              <p class="panel-title">Resume JcJ</p>
              <h3 class="panel-headline">Stats essentielles</h3>
            </div>
          </div>

          <div class="hero-metrics">
            <div class="metric-card">
              <p class="metric-label">Matchs termines</p>
              <p class="metric-value">{{ summary.total }}</p>
              <p class="metric-note">{{ summary.wins }} victoires</p>
            </div>
            <div class="metric-card">
              <p class="metric-label">Winrate</p>
              <p class="metric-value">{{ summary.winRate }}%</p>
              <p class="metric-note">{{ summary.draws }} nuls</p>
            </div>
            <div class="metric-card">
              <p class="metric-label">Elo delta</p>
              <p class="metric-value">{{ summary.totalEloDelta >= 0 ? '+' : '' }}{{ summary.totalEloDelta }}</p>
              <p class="metric-note">Sur 30 jours</p>
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-header">
            <div>
              <p class="panel-title">Navigation</p>
              <h3 class="panel-headline">Actions utiles</h3>
            </div>
          </div>

          <div class="card-actions">
            <RouterLink class="button-primary" to="/matchs">Voir historique</RouterLink>
            <RouterLink class="button-ghost" to="/leaderboard">Classement</RouterLink>
            <RouterLink class="button-ghost" to="/profile">Profil</RouterLink>
          </div>
        </div>
      </aside>
    </section>
  </DashboardLayout>
</template>
