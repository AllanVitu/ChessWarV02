<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import DashboardLayout from '@/components/DashboardLayout.vue'
import AppModal from '@/components/ui/AppModal.vue'
import { getDashboardData, type DashboardDb, type DashboardProfile } from '@/lib/localDb'
import { buildTrendPaths, getProfileAiAnalysis } from '@/lib/profileAnalysis'
import { getMatches } from '@/lib/matchesDb'
import { getSessionToken } from '@/lib/api'

const dashboard = ref<DashboardDb | null>(null)
const router = useRouter()
const fallbackProfile: DashboardProfile = {
  id: '',
  name: 'Invite',
  title: '',
  rating: 0,
  motto: '',
  location: '',
  lastSeen: '',
  email: '',
  avatarUrl: '',
}

const profile = computed(() => dashboard.value?.profile ?? fallbackProfile)
const games = computed(() => dashboard.value?.games ?? [])
const goals = computed(() => dashboard.value?.goals ?? [])
const greetingTitle = computed(() =>
  dashboard.value ? `Bonjour, ${dashboard.value.profile.name}` : 'Bonjour',
)
const greetingSubtitle = computed(() => dashboard.value?.profile.motto ?? 'Analyse en cours.')
const onboardingOpen = ref(false)
const onboardingKey = 'warchess.onboarding.dismissed'

const onboardingSteps = [
  {
    title: 'Choisir un mode',
    text: 'Local, invite ou match classe pour trouver le bon rythme.',
  },
  {
    title: 'Jouer la partie',
    text: 'Lancez un duel rapide et suivez les coups en direct.',
  },
  {
    title: 'Analyser',
    text: 'Revoyez vos coups et vos stats pour progresser.',
  },
]

const checklistKey = 'warchess.checklist.completed'
const dailyKey = 'warchess.daily.completed'
const puzzleKey = 'warchess.daily.puzzle'
const completedSteps = ref<string[]>([])
const dailyDone = ref(false)
const puzzleRevealed = ref(false)

const readStorageList = (key: string) => {
  if (typeof window === 'undefined') return []
  try {
    const stored = window.localStorage.getItem(key)
    return stored ? (JSON.parse(stored) as string[]) : []
  } catch {
    return []
  }
}

const readStorageFlag = (key: string) => {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

const writeStorage = (key: string, value: string) => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Ignore storage failures.
  }
}

const todayKey = computed(() => new Date().toISOString().slice(0, 10))

const dailyChallenges = [
  {
    title: 'Defi du jour',
    description: "Gagnez une partie rapide en moins de 15 coups.",
    cta: 'Lancer un match',
    to: '/play',
  },
  {
    title: 'Sprint tactique',
    description: 'Enchainez 3 parties blitz pour monter en rythme.',
    cta: 'Jouer blitz',
    to: '/play',
  },
  {
    title: 'Focus ouverture',
    description: "Testez une nouvelle ouverture sur 2 parties.",
    cta: 'Demarrer',
    to: '/play',
  },
]

const dailyPuzzle = [
  {
    title: 'Puzzle rapide',
    description: 'Mat en 2 coups.',
    solution: '1. Qxf7+ Kxf7 2. Bc4+',
  },
  {
    title: 'Puzzle rapide',
    description: "Gagnez la dame en 2 coups.",
    solution: '1. Nd5! exd5 2. Qe7#',
  },
  {
    title: 'Puzzle rapide',
    description: 'Tactique de fourchette.',
    solution: '1. Nc7+ Kd8 2. Nxa8',
  },
]

const fallbackChallenge = {
  title: 'Defi du jour',
  description: "Gagnez une partie rapide en moins de 15 coups.",
  cta: 'Lancer un match',
  to: '/play',
}

const fallbackPuzzle = {
  title: 'Puzzle rapide',
  description: 'Mat en 2 coups.',
  solution: '1. Qxf7+ Kxf7 2. Bc4+',
}

const challengeOfDay = computed(() => {
  const index = Math.abs(Number(todayKey.value.replace(/-/g, ''))) % dailyChallenges.length
  return dailyChallenges[index] ?? fallbackChallenge
})

const puzzleOfDay = computed(() => {
  const index = Math.abs(Number(todayKey.value.replace(/-/g, ''))) % dailyPuzzle.length
  return dailyPuzzle[index] ?? fallbackPuzzle
})

const checklistSteps = computed(() => {
  const autoProfile = profile.value.name && profile.value.name !== 'Invite'
  const autoGames = games.value.length > 0
  const autoFriend = completedSteps.value.includes('friend')
  return [
    {
      id: 'profile',
      title: 'Completer le profil',
      done: autoProfile || completedSteps.value.includes('profile'),
      to: '/profile',
    },
    {
      id: 'match',
      title: 'Jouer une partie',
      done: autoGames || completedSteps.value.includes('match'),
      to: '/play',
    },
    {
      id: 'friend',
      title: 'Ajouter un ami',
      done: autoFriend,
      to: '/amis',
    },
  ]
})

const toggleChecklist = (id: string) => {
  if (completedSteps.value.includes(id)) {
    completedSteps.value = completedSteps.value.filter((step) => step !== id)
  } else {
    completedSteps.value = [...completedSteps.value, id]
  }
  writeStorage(checklistKey, JSON.stringify(completedSteps.value))
}

const markDailyDone = () => {
  dailyDone.value = true
  writeStorage(`${dailyKey}:${todayKey.value}`, '1')
}

const togglePuzzle = () => {
  puzzleRevealed.value = !puzzleRevealed.value
  writeStorage(`${puzzleKey}:${todayKey.value}`, puzzleRevealed.value ? '1' : '0')
}

const resumeKey = 'warchess.resume.checked'
const resumeActiveMatch = async () => {
  if (typeof window === 'undefined') return
  if (window.sessionStorage.getItem(resumeKey)) return
  window.sessionStorage.setItem(resumeKey, '1')
  if (!getSessionToken()) return
  const active = (await getMatches()).find((match) => match.status === 'en_cours')
  if (active) {
    await router.push(`/jeu/${active.id}`)
  }
}

onMounted(async () => {
  dashboard.value = await getDashboardData()
  if (typeof window !== 'undefined' && !window.localStorage.getItem(onboardingKey)) {
    onboardingOpen.value = true
  }
  completedSteps.value = readStorageList(checklistKey)
  dailyDone.value = readStorageFlag(`${dailyKey}:${todayKey.value}`)
  puzzleRevealed.value = readStorageFlag(`${puzzleKey}:${todayKey.value}`)
  await resumeActiveMatch()
})

const closeOnboarding = () => {
  onboardingOpen.value = false
}

watch(onboardingOpen, (value, previous) => {
  if (previous && !value && typeof window !== 'undefined') {
    window.localStorage.setItem(onboardingKey, '1')
  }
})

const quickStats = [
  { label: 'Taux de victoire', value: '62%', change: '+4,2%', detail: '30 dernieres parties' },
  { label: 'Precision moyenne', value: '88%', change: '+1,6%', detail: 'Tendance saison' },
  { label: "Serie d'entrainement", value: '12 jours', change: '+3', detail: 'Rythme actuel' },
  { label: 'Taux de gaffes', value: '1,8%', change: '-0,4%', detail: 'Plus bas = mieux' },
]

const engineMetrics = [
  { label: 'Evaluation', value: '+1,2', note: 'Aux blancs de jouer' },
  { label: 'Meilleure ligne', value: 'e4 e5 Nf3', note: 'Profondeur 3 demi-coups' },
  { label: 'Menaces', value: '2 actives', note: 'Securite du roi' },
]

const evalBars = [24, 46, 38, 62, 48, 70, 56, 44]

const analysis = getProfileAiAnalysis()
const trendPaths = computed(() => buildTrendPaths(analysis.trend, 520, 180, 20))

const sessions = [
  { title: 'Sprint tactique', time: '11:00', length: '15 min' },
  { title: "Laboratoire d'ouverture", time: '14:30', length: '30 min' },
  { title: 'Revue de finale', time: '19:00', length: '40 min' },
]

const leaderboard = [
  { name: 'I. Alvarez', rating: 2548, delta: '+12' },
  { name: 'C. Russo', rating: 2492, delta: '+8' },
  { name: 'T. Holm', rating: 2451, delta: '+5' },
  { name: 'J. Park', rating: 2422, delta: '+4' },
]

const resultLabels: Record<string, string> = {
  win: 'Victoire',
  loss: 'Defaite',
  draw: 'Nul',
}

const boardFiles = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
const boardRanks = [8, 7, 6, 5, 4, 3, 2, 1]
const pieceSymbols: Record<string, string> = {
  p: '♟',
  r: '♜',
  n: '♞',
  b: '♝',
  q: '♛',
  k: '♚',
  P: '♙',
  R: '♖',
  N: '♘',
  B: '♗',
  Q: '♕',
  K: '♔',
}

const boardState = [
  ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
  ['p', 'p', 'p', '', '', 'p', 'p', 'p'],
  ['', '', '', 'p', '', '', '', ''],
  ['', '', '', '', 'p', '', '', ''],
  ['', '', 'P', '', 'P', '', '', ''],
  ['', '', '', 'N', '', 'N', '', ''],
  ['P', 'P', '', 'P', '', 'P', 'P', 'P'],
  ['R', '', 'B', 'Q', 'K', 'B', '', 'R'],
]

const lastMoveSquares = new Set(['e2', 'e4'])
const focusSquare = 'f7'

const squares = boardRanks.flatMap((rank, rowIndex) =>
  boardFiles.map((file, colIndex) => {
    const piece = boardState[rowIndex]?.[colIndex] ?? ''
    const squareId = `${file}${rank}`
    const isDark = (rowIndex + colIndex) % 2 === 1
    const tone = piece ? (piece === piece.toUpperCase() ? 'light' : 'dark') : ''

    return {
      id: squareId,
      dark: isDark,
      piece,
      tone,
      symbol: pieceSymbols[piece] ?? '',
      isLastMove: lastMoveSquares.has(squareId),
      isFocus: squareId === focusSquare,
    }
  }),
)
</script>

<template>
  <DashboardLayout eyebrow="Bon retour" :title="greetingTitle" :subtitle="greetingSubtitle">
    <AppModal v-model="onboardingOpen" title="Demarrage rapide">
      <ol class="onboarding-list">
        <li v-for="step in onboardingSteps" :key="step.title" class="onboarding-step">
          <p class="onboarding-step__title">{{ step.title }}</p>
          <p class="onboarding-step__text">{{ step.text }}</p>
        </li>
      </ol>
      <template #footer>
        <button class="button-ghost" type="button" @click="closeOnboarding">Plus tard</button>
        <RouterLink class="button-primary" to="/play" @click="closeOnboarding">Jouer maintenant</RouterLink>
      </template>
    </AppModal>

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
              <RouterLink class="button-primary" to="/play">Nouvelle partie</RouterLink>
              <button class="button-ghost" type="button" @click="onboardingOpen = true">
                Mini tutoriel
              </button>
            </div>
          </div>

          <div class="hero-body">
            <div class="board" aria-hidden="true">
              <div v-for="square in squares" :key="square.id" :class="[
                'square',
                square.dark ? 'square--dark' : 'square--light',
                square.isLastMove ? 'square--last' : '',
                square.isFocus ? 'square--focus' : '',
              ]">
                <span v-if="square.piece" :class="[
                  'piece',
                  square.tone === 'light' ? 'piece--light' : 'piece--dark',
                ]">
                  {{ square.symbol }}
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
                  <span v-for="(bar, index) in evalBars" :key="`bar-${index}`" class="engine-bar"
                    :style="{ height: `${bar}%` }"></span>
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
              <p class="panel-title">Analyse IA du profil</p>
              <h3 class="panel-headline">Vitesse de classement</h3>
            </div>
            <button class="range-pill" type="button">Hebdomadaire</button>
          </div>

          <svg class="trend-chart" viewBox="0 0 520 180" aria-hidden="true">
            <defs>
              <linearGradient id="trendLine" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stop-color="var(--analysis-blue)" />
                <stop offset="33%" stop-color="var(--analysis-green)" />
                <stop offset="66%" stop-color="var(--analysis-red)" />
                <stop offset="100%" stop-color="var(--analysis-orange)" />
              </linearGradient>
              <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="var(--analysis-blue)" stop-opacity="0.3" />
                <stop offset="45%" stop-color="var(--analysis-green)" stop-opacity="0.22" />
                <stop offset="75%" stop-color="var(--analysis-red)" stop-opacity="0.16" />
                <stop offset="92%" stop-color="var(--analysis-orange)" stop-opacity="0.1" />
                <stop offset="100%" stop-color="var(--analysis-orange)" stop-opacity="0" />
              </linearGradient>
            </defs>
            <path :d="trendPaths.line" fill="none" stroke="url(#trendLine)" stroke-width="3" stroke-linecap="round" />
            <path :d="trendPaths.area" fill="url(#trendFill)" />
          </svg>

          <div class="trend-footer">
            <div v-for="item in analysis.trendHighlights" :key="item.label" class="trend-item">
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
                    <span :class="[
                      'result-pill',
                      `result--${game.result}`,
                    ]">
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
                  <stop offset="0%" stop-color="#4ade80" />
                  <stop offset="100%" stop-color="#22c55e" />
                </linearGradient>
              </defs>
              <circle cx="60" cy="60" r="46" pathLength="100" class="ring-track" />
              <circle cx="60" cy="60" r="46" pathLength="100" class="ring-value" stroke="url(#ratingGradient)" />
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

        <div class="panel reveal delay-1">
          <div class="panel-header">
            <div>
              <p class="panel-title">Checklist</p>
              <h3 class="panel-headline">Progres rapide</h3>
            </div>
          </div>

          <div class="onboarding-list">
            <div v-for="step in checklistSteps" :key="step.id" class="onboarding-step checklist-step">
              <div class="checklist-row">
                <span :class="['checklist-dot', step.done ? 'checklist-dot--done' : '']"></span>
                <p class="onboarding-step__title">{{ step.title }}</p>
              </div>
              <div class="card-actions">
                <RouterLink class="button-ghost" :to="step.to">Ouvrir</RouterLink>
                <button class="button-ghost" type="button" @click="toggleChecklist(step.id)">
                  {{ step.done ? 'Annuler' : 'Terminer' }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="panel reveal delay-2">
          <div class="panel-header">
            <div>
              <p class="panel-title">{{ challengeOfDay.title }}</p>
              <h3 class="panel-headline">Objectif du jour</h3>
            </div>
          </div>

          <p class="panel-sub">{{ challengeOfDay.description }}</p>
          <div class="card-actions">
            <RouterLink class="button-primary" :to="challengeOfDay.to">{{ challengeOfDay.cta }}</RouterLink>
            <button class="button-ghost" type="button" :disabled="dailyDone" @click="markDailyDone">
              {{ dailyDone ? 'Valide' : 'Marquer termine' }}
            </button>
          </div>
        </div>

        <div class="panel reveal delay-3">
          <div class="panel-header">
            <div>
              <p class="panel-title">{{ puzzleOfDay.title }}</p>
              <h3 class="panel-headline">Puzzle rapide</h3>
            </div>
            <button class="range-pill" type="button" @click="togglePuzzle">
              {{ puzzleRevealed ? 'Masquer' : 'Voir solution' }}
            </button>
          </div>

          <p class="panel-sub">{{ puzzleOfDay.description }}</p>
          <p v-if="puzzleRevealed" class="empty-state__subtitle">{{ puzzleOfDay.solution }}</p>
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
