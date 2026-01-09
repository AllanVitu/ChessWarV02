<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import DashboardLayout from '@/components/DashboardLayout.vue'
import { getDashboardData, type DashboardDb, type DashboardProfile } from '@/lib/localDb'

const dashboard = ref<DashboardDb | null>(null)
const fallbackProfile: DashboardProfile = {
  id: '',
  name: 'Invite',
  title: '',
  rating: 0,
  motto: '',
  location: '',
  lastSeen: '',
  email: '',
}

const profile = computed(() => dashboard.value?.profile ?? fallbackProfile)
const games = computed(() => dashboard.value?.games ?? [])
const goals = computed(() => dashboard.value?.goals ?? [])
const greetingTitle = computed(() =>
  dashboard.value ? `Bonjour, ${dashboard.value.profile.name}` : 'Bonjour',
)
const greetingSubtitle = computed(() => dashboard.value?.profile.motto ?? 'Analyse en cours.')

onMounted(async () => {
  dashboard.value = await getDashboardData()
})
</script>

<template>
  <DashboardLayout
    eyebrow="Bon retour"
    :title="greetingTitle"
    :subtitle="greetingSubtitle"
  >
    <section class="content-grid">
      <div class="left-column">
        <div class="panel hero-card reveal">
          <div class="hero-header">
            <div>
              <p class="panel-title">Salle de match</p>
              <h2 class="panel-headline">Analyse en direct du plateau</h2>
              <p class="panel-sub">
                Suivez l'evaluation, les lignes candidates et la pression tactique d'un coup d'oeil.
              </p>
            </div>
            <div class="hero-actions">
              <button class="button-primary" type="button">Nouvelle partie</button>
              <button class="button-ghost" type="button">Analyser</button>
            </div>
          </div>

          <div class="hero-body">
            <div class="board">
              <div
                v-for="square in squares"
                :key="square.id"
                :class="[
                  'square',
                  square.dark ? 'square--dark' : 'square--light',
                  square.isLastMove ? 'square--last' : '',
                  square.isFocus ? 'square--focus' : '',
                ]"
              >
                <span
                  v-if="square.piece"
                  :class="[
                    'piece',
                    square.tone === 'light' ? 'piece--light' : 'piece--dark',
                  ]"
                >
                  {{ square.label }}
                </span>
              </div>
            </div>

            <div class="hero-metrics">
              <div v-for="metric in engineMetrics" :key="metric.label" class="metric-card">
                <p class="metric-label">{{ metric.label }}</p>
                <p class="metric-value">{{ metric.value }}</p>
                <p class="metric-note">{{ metric.note }}</p>
              </div>

              <div class="engine-card">
                <div class="engine-header">
                  <p class="metric-label">Elan</p>
                  <p class="metric-value">68%</p>
                </div>
                <div class="engine-bars">
                  <span
                    v-for="(bar, index) in evalBars"
                    :key="`bar-${index}`"
                    class="engine-bar"
                    :style="{ height: `${bar}%` }"
                  ></span>
                </div>
                <p class="metric-note">Courbe sur les 8 derniers demi-coups</p>
              </div>
            </div>
          </div>
        </div>

        <div class="stats-grid">
          <div v-for="stat in quickStats" :key="stat.label" class="panel stat-card reveal delay-1">
            <p class="stat-label">{{ stat.label }}</p>
            <p class="stat-value">{{ stat.value }}</p>
            <div class="stat-meta">
              <span class="stat-change">{{ stat.change }}</span>
              <span class="stat-detail">{{ stat.detail }}</span>
            </div>
          </div>
        </div>

        <div class="panel trend-card reveal delay-2">
          <div class="panel-header">
            <div>
              <p class="panel-title">Tendance de performance</p>
              <h3 class="panel-headline">Vitesse de classement</h3>
            </div>
            <button class="range-pill" type="button">Hebdomadaire</button>
          </div>

          <svg class="trend-chart" viewBox="0 0 520 180" aria-hidden="true">
            <defs>
              <linearGradient id="trendLine" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stop-color="#7fa881" />
                <stop offset="100%" stop-color="#4f8f5b" />
              </linearGradient>
              <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="rgba(127, 168, 129, 0.35)" />
                <stop offset="100%" stop-color="rgba(127, 168, 129, 0)" />
              </linearGradient>
            </defs>
            <path
              d="M20 140 C 70 120, 110 150, 160 120 C 210 90, 260 120, 310 105 C 360 90, 410 70, 460 80 C 490 85, 505 92, 510 100"
              fill="none"
              stroke="url(#trendLine)"
              stroke-width="3"
              stroke-linecap="round"
            />
            <path
              d="M20 140 C 70 120, 110 150, 160 120 C 210 90, 260 120, 310 105 C 360 90, 410 70, 460 80 C 490 85, 505 92, 510 100 L510 170 L20 170 Z"
              fill="url(#trendFill)"
            />
          </svg>

          <div class="trend-footer">
            <div v-for="item in trendHighlights" :key="item.label" class="trend-item">
              <p class="trend-label">{{ item.label }}</p>
              <p class="trend-value">{{ item.value }}</p>
              <p class="trend-note">{{ item.note }}</p>
            </div>
          </div>
        </div>

        <div class="panel table-card reveal delay-3">
          <div class="panel-header">
            <div>
              <p class="panel-title">Parties recentes</p>
              <h3 class="panel-headline">Details des matchs</h3>
            </div>
            <button class="range-pill" type="button">10 dernieres</button>
          </div>

          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Partie</th>
                  <th>Adversaire</th>
                  <th>Resultat</th>
                  <th>Ouverture</th>
                  <th>Coups</th>
                  <th>Precision</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="game in games" :key="game.id">
                  <td>{{ game.id }}</td>
                  <td>{{ game.opponent }}</td>
                  <td>
                    <span
                      :class="[
                        'result-pill',
                        `result--${game.result}`,
                      ]"
                    >
                      {{ resultLabels[game.result] }}
                    </span>
                  </td>
                  <td>{{ game.opening }}</td>
                  <td>{{ game.moves }}</td>
                  <td>{{ game.accuracy }}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <aside class="right-column">
        <div class="panel rating-card reveal">
          <div class="rating-header">
            <p class="panel-title">Score Elo</p>
            <p class="rating-meta">{{ profile.location }}</p>
          </div>

          <div class="rating-ring">
            <svg viewBox="0 0 120 120" aria-hidden="true">
              <defs>
              <linearGradient id="ratingGradient" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stop-color="#7fa881" />
                  <stop offset="100%" stop-color="#4f8f5b" />
              </linearGradient>
              </defs>
              <circle cx="60" cy="60" r="46" pathLength="100" class="ring-track" />
              <circle
                cx="60"
                cy="60"
                r="46"
                pathLength="100"
                class="ring-value"
                stroke="url(#ratingGradient)"
              />
            </svg>
            <div class="ring-center">
              <p class="ring-score">{{ profile.rating }}</p>
              <p class="ring-label">Classement rapide</p>
            </div>
          </div>

          <div class="rating-footer">
            <div>
              <p class="metric-label">Titre</p>
              <p class="metric-value">Objectif MI</p>
            </div>
            <div>
              <p class="metric-label">Derniere activite</p>
              <p class="metric-value">{{ profile.lastSeen }}</p>
            </div>
          </div>
        </div>

        <div class="panel focus-card reveal delay-1">
          <div class="panel-header">
            <div>
              <p class="panel-title">Focus d'entrainement</p>
              <h3 class="panel-headline">Indicateurs de progression</h3>
            </div>
            <button class="range-pill" type="button">Mensuel</button>
          </div>

          <div class="progress-list">
            <div v-for="goal in goals" :key="goal.label" class="progress-item">
              <div class="progress-labels">
                <span>{{ goal.label }}</span>
                <span>{{ goal.progress }}%</span>
              </div>
              <div class="progress-bar">
                <span class="progress-fill" :style="{ width: `${goal.progress}%` }"></span>
              </div>
            </div>
          </div>
        </div>

        <div class="panel session-card reveal delay-2">
          <div class="panel-header">
            <div>
              <p class="panel-title">Prochaines sessions</p>
              <h3 class="panel-headline">Plan du jour</h3>
            </div>
            <button class="range-pill" type="button">Aujourd'hui</button>
          </div>

          <div class="session-list">
            <div v-for="session in sessions" :key="session.title" class="session-item">
              <div>
                <p class="session-title">{{ session.title }}</p>
                <p class="session-time">{{ session.time }}</p>
              </div>
              <span class="session-length">{{ session.length }}</span>
            </div>
          </div>
        </div>

        <div class="panel leaderboard-card reveal delay-3">
          <div class="panel-header">
            <div>
              <p class="panel-title">Meilleurs joueurs</p>
              <h3 class="panel-headline">Elite du classement</h3>
            </div>
            <button class="range-pill" type="button">Region</button>
          </div>

          <div class="leaderboard-list">
            <div v-for="player in leaderboard" :key="player.name" class="leaderboard-item">
              <div class="leaderboard-user">
                <div class="leaderboard-avatar">{{ player.name.slice(0, 1) }}</div>
                <div>
                  <p class="leaderboard-name">{{ player.name }}</p>
                  <p class="leaderboard-meta">Elo {{ player.rating }}</p>
                </div>
              </div>
              <span class="leaderboard-delta">{{ player.delta }}</span>
            </div>
          </div>
        </div>
      </aside>
    </section>
  </DashboardLayout>
</template>

