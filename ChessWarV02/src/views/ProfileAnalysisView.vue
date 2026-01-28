<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import DashboardLayout from '@/components/DashboardLayout.vue'
import { getDashboardData, type GameRecord } from '@/lib/localDb'
import { getProfileAiAnalysis } from '@/lib/profileAnalysis'

const analysis = getProfileAiAnalysis()

const games = ref<GameRecord[]>([])
const profileRating = ref(1800)
type PeriodKey = '7j' | '30j' | '90j'
type PeriodOption = { key: PeriodKey; label: string; games: number }

const selectedPeriod = ref<PeriodKey>('30j')

const periodOptions: PeriodOption[] = [
  { key: '7j', label: '7 jours', games: 5 },
  { key: '30j', label: '30 jours', games: 12 },
  { key: '90j', label: '90 jours', games: 24 },
]

const fallbackPeriod: PeriodOption = periodOptions[1] ?? periodOptions[0] ?? {
  key: '30j',
  label: '30 jours',
  games: 12,
}

const periodConfig = computed(
  () => periodOptions.find((period) => period.key === selectedPeriod.value) ?? fallbackPeriod,
)

const periodGames = computed(() => {
  const limit = periodConfig.value.games
  const slice = games.value.slice(0, limit)
  return slice.reverse()
})

const resultDelta = (result: GameRecord['result']) => {
  if (result === 'win') return 18
  if (result === 'draw') return 6
  return -12
}

const buildEloSeries = (items: GameRecord[], baseRating: number) => {
  if (!items.length) {
    return [baseRating - 6, baseRating]
  }
  const deltas = items.map((item) => resultDelta(item.result))
  const start = baseRating - deltas.reduce((sum, delta) => sum + delta, 0)
  let current = start
  const series = [current]
  for (const delta of deltas) {
    current += delta
    series.push(current)
  }
  return series
}

const buildEloChart = (values: number[]) => {
  const width = 520
  const height = 160
  const padding = 18
  const safeValues = values.length > 1 ? values : [values[0] ?? 0, values[0] ?? 0]
  const min = Math.min(...safeValues)
  const max = Math.max(...safeValues)
  const span = Math.max(1, max - min)
  const step = safeValues.length > 1 ? (width - padding * 2) / (safeValues.length - 1) : 0
  const scaleHeight = height - padding * 2

  const points = safeValues.map((value, index) => {
    const x = padding + step * index
    const y = height - padding - ((value - min) / span) * scaleHeight
    return { x, y, value }
  })

  const line = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`)
    .join(' ')
  const last = points[points.length - 1] ?? { x: padding, y: height - padding }
  const area = `${line} L${last.x} ${height - padding} L${padding} ${height - padding} Z`

  return {
    width,
    height,
    line,
    area,
    points,
    min,
    max,
    start: safeValues[0] ?? 0,
    end: safeValues[safeValues.length - 1] ?? 0,
  }
}

const eloSeries = computed(() => buildEloSeries(periodGames.value, profileRating.value))
const eloChart = computed(() => buildEloChart(eloSeries.value))
const eloLastPoint = computed(() => {
  const points = eloChart.value.points
  return points[points.length - 1] ?? { x: 0, y: 0 }
})

const formatRating = (value: number) => Math.round(value).toString()

const periodStats = computed(() => {
  const items = periodGames.value
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
  profileRating.value = data.profile.rating ?? 1800
})
</script>

<template>
  <DashboardLayout
    eyebrow="Analyse"
    title="Analyse du profil"
    subtitle="Synthese de performance et tendances recentes."
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
            <span class="badge-soft">Semaine 02</span>
          </div>

          <div class="stats-grid">
            <div v-for="metric in analysis.keyMetrics" :key="metric.label" class="panel stat-card">
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
            <svg
              :viewBox="`0 0 ${eloChart.width} ${eloChart.height}`"
              role="img"
              aria-label="Evolution de votre Elo"
            >
              <defs>
                <linearGradient id="eloGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="var(--halo-secondary-solid)" stop-opacity="0.35" />
                  <stop offset="100%" stop-color="var(--halo-secondary-solid)" stop-opacity="0" />
                </linearGradient>
              </defs>
              <path class="elo-area" :d="eloChart.area" fill="url(#eloGradient)" />
              <path class="elo-line" :d="eloChart.line" />
              <circle
                v-if="eloChart.points.length"
                class="elo-dot"
                :cx="eloLastPoint.x"
                :cy="eloLastPoint.y"
                r="4"
              />
            </svg>
            <div class="elo-range">
              <span>{{ formatRating(eloChart.min) }}</span>
              <span>{{ formatRating(eloChart.max) }}</span>
            </div>
          </div>

          <div class="elo-metrics">
            <div class="metric-card">
              <p class="metric-label">Depart</p>
              <p class="metric-value">{{ formatRating(eloChart.start) }}</p>
              <p class="metric-note">Debut de periode</p>
            </div>
            <div class="metric-card">
              <p class="metric-label">Fin</p>
              <p class="metric-value">{{ formatRating(eloChart.end) }}</p>
              <p class="metric-note">Actuel</p>
            </div>
            <div class="metric-card">
              <p class="metric-label">Variation</p>
              <p class="metric-value">
                {{ Math.round(eloChart.end - eloChart.start) >= 0 ? '+' : '' }}{{
                  Math.round(eloChart.end - eloChart.start)
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
            <button class="range-pill" type="button">Mensuel</button>
          </div>

          <div class="progress-list analysis-progress">
            <div v-for="focus in analysis.focusAreas" :key="focus.label" class="progress-item">
              <div class="progress-labels">
                <span>{{ focus.label }}</span>
                <span>{{ focus.progress }}%</span>
              </div>
              <div class="progress-bar">
                <span class="progress-fill" :style="{ width: `${focus.progress}%` }"></span>
              </div>
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-header">
            <div>
              <p class="panel-title">Moments forts</p>
              <h3 class="panel-headline">Ce qui fonctionne</h3>
            </div>
          </div>

          <div class="session-list">
            <div v-for="item in analysis.highlights" :key="item.title" class="session-item">
              <div>
                <p class="session-title">{{ item.title }}</p>
                <p class="session-time">{{ item.detail }}</p>
              </div>
              <span class="badge-soft">{{ item.tag }}</span>
            </div>
          </div>
        </div>
      </div>

      <aside class="right-column">
        <div class="panel">
          <div class="panel-header">
            <div>
              <p class="panel-title">Points d'alerte</p>
              <h3 class="panel-headline">A corriger</h3>
            </div>
          </div>

          <div class="session-list">
            <div v-for="item in analysis.alerts" :key="item.title" class="session-item">
              <div>
                <p class="session-title">{{ item.title }}</p>
                <p class="session-time">{{ item.detail }}</p>
              </div>
              <span class="badge-soft">{{ item.tag }}</span>
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-header">
            <div>
              <p class="panel-title">Analyse IA</p>
              <h3 class="panel-headline">Lecture automatique</h3>
            </div>
          </div>

          <div class="hero-metrics">
            <div v-for="signal in analysis.aiSignals" :key="signal.label" class="metric-card">
              <p class="metric-label">{{ signal.label }}</p>
              <p class="metric-value">{{ signal.value }}</p>
              <p class="metric-note">{{ signal.note }}</p>
            </div>
          </div>
        </div>

        <div class="panel leaderboard-card">
          <div class="panel-header">
            <div>
              <p class="panel-title">Adversaires cle</p>
              <h3 class="panel-headline">Styles a preparer</h3>
            </div>
          </div>

          <div class="leaderboard-list">
            <div v-for="rival in analysis.rivals" :key="rival.name" class="leaderboard-item">
              <div class="leaderboard-user">
                <div class="leaderboard-avatar">{{ rival.name.slice(0, 1) }}</div>
                <div>
                  <p class="leaderboard-name">{{ rival.name }}</p>
                  <p class="leaderboard-meta">{{ rival.note }}</p>
                </div>
              </div>
              <span class="leaderboard-delta">{{ rival.delta }}</span>
            </div>
          </div>
        </div>
      </aside>
    </section>
  </DashboardLayout>
</template>
