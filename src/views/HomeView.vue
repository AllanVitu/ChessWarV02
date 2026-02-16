<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import DashboardLayout from '@/components/DashboardLayout.vue'
import AppModal from '@/components/ui/AppModal.vue'
import { getDashboardData, type DashboardDb, type DashboardProfile } from '@/lib/localDb'
import { getMatches, type MatchRecord } from '@/lib/matchesDb'
import { getSessionToken } from '@/lib/api'
import { getLeaderboard, type LeaderboardPlayer } from '@/lib/leaderboard'
import { summarizeMatches } from '@/lib/stats'
import { getStoryChapters, getStoryProgress, setActiveChapter, type StoryChapter } from '@/lib/story'
import { getPieceImage } from '@/lib/pieceAssets'

const dashboard = ref<DashboardDb | null>(null)
const matches = ref<MatchRecord[]>([])
const leaderboard = ref<LeaderboardPlayer[]>([])
const router = useRouter()

const fallbackProfile: DashboardProfile = {
  id: '',
  name: 'Invite',
  title: '',
  rating: 1200,
  motto: '',
  location: '',
  lastSeen: '',
  email: '',
  avatarUrl: '',
}

const profile = computed(() => dashboard.value?.profile ?? fallbackProfile)
const goals = computed(() => dashboard.value?.goals ?? [])
const greetingTitle = computed(() =>
  dashboard.value ? `Bonjour, ${dashboard.value.profile.name || 'joueur'}` : 'Bonjour',
)
const greetingSubtitle = computed(() => dashboard.value?.profile.motto ?? 'Pret pour votre session du jour ?')
const onboardingOpen = ref(false)
const onboardingKey = 'warchess.onboarding.dismissed'

const onboardingSteps = [
  {
    title: 'Choisir une session',
    text: 'Duel, entrainement ou histoire selon votre objectif.',
  },
  {
    title: 'Jouer avec intention',
    text: 'Lancez votre partie et suivez chaque tempo en direct.',
  },
  {
    title: 'Noter et progresser',
    text: 'Relisez les coups critiques et ajustez votre plan.',
  },
]

const checklistKey = 'warchess.checklist.completed'
const completedSteps = ref<string[]>([])

const readStorageList = (key: string) => {
  if (typeof window === 'undefined') return []
  try {
    const stored = window.localStorage.getItem(key)
    return stored ? (JSON.parse(stored) as string[]) : []
  } catch {
    return []
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

const checklistSteps = computed(() => {
  const autoProfile = Boolean(profile.value.name && profile.value.name !== 'Invite')
  const autoGames = matches.value.length > 0
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
      to: '/matchs',
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

const resumeKey = 'warchess.resume.checked'
const resumeActiveMatch = async () => {
  if (typeof window === 'undefined') return
  if (window.sessionStorage.getItem(resumeKey)) return
  window.sessionStorage.setItem(resumeKey, '1')
  if (!getSessionToken()) return
  const active = matches.value.find((match) => match.status === 'started')
  if (active) {
    await router.push(`/jeu/${active.id}`)
  }
}

const actionCards = [
  {
    title: 'Session rapide',
    description: 'Lancez un duel classe ou amical.',
    to: '/matchs',
  },
  {
    title: 'Chronique',
    description: 'Poursuivez la campagne chapitre par chapitre.',
    to: '/histoire',
  },
  {
    title: 'Carnet d analyse',
    description: 'Revoyez vos parties et vos tendances.',
    to: '/profil/analyse',
  },
  {
    title: 'Table des maitres',
    description: 'Situez votre Elo dans la ligue.',
    to: '/leaderboard',
  },
]

const summary = computed(() => summarizeMatches(matches.value))

const quickStats = computed(() => [
  {
    label: 'Elo',
    value: profile.value.rating.toString(),
    detail: profile.value.title || 'Niveau actuel',
  },
  {
    label: 'Winrate',
    value: `${summary.value.winRate}%`,
    detail: `${summary.value.wins}/${summary.value.total} victoires`,
  },
  {
    label: 'Serie',
    value: `${summary.value.streak} victoires`,
    detail: 'Streak actif',
  },
  {
    label: 'Elo delta',
    value: `${summary.value.totalEloDelta >= 0 ? '+' : ''}${summary.value.totalEloDelta}`,
    detail: '30 derniers jours',
  },
])

const recentMatches = computed(() => matches.value.slice(0, 6))
const statusLabels: Record<string, string> = {
  waiting: 'En attente',
  ready: 'Pret',
  started: 'En cours',
  finished: 'Termine',
  aborted: 'Annule',
}

const storyChapters = getStoryChapters()
const storyProgress = ref(getStoryProgress())
const nextChapter = computed<StoryChapter | null>(() => {
  if (!storyChapters.length) return null
  const completed = new Set(storyProgress.value.completed)
  return storyChapters.find((chapter) => !completed.has(chapter.id)) ?? storyChapters[0] ?? null
})
const nextChapterLink = computed(() =>
  nextChapter.value ? `/histoire/${nextChapter.value.id}` : '/histoire',
)

const leaderboardPreview = computed(() => leaderboard.value.slice(0, 5))

const handleStartChapter = (chapterId: number) => {
  setActiveChapter(chapterId)
}

onMounted(async () => {
  dashboard.value = await getDashboardData()
  matches.value = await getMatches()
  if (getSessionToken()) {
    leaderboard.value = await getLeaderboard('global', 1, 10)
  }
  if (typeof window !== 'undefined' && !window.localStorage.getItem(onboardingKey)) {
    onboardingOpen.value = true
  }
  completedSteps.value = readStorageList(checklistKey)
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

const boardFiles = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
const boardRanks = [8, 7, 6, 5, 4, 3, 2, 1]
const pieceSymbols: Record<string, string> = {
  p: 'p',
  r: 'r',
  n: 'n',
  b: 'b',
  q: 'q',
  k: 'k',
  P: 'P',
  R: 'R',
  N: 'N',
  B: 'B',
  Q: 'Q',
  K: 'K',
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
      image: piece ? getPieceImage(piece) : '',
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
        <RouterLink class="button-primary" to="/matchs" @click="closeOnboarding">Jouer maintenant</RouterLink>
      </template>
    </AppModal>

    <section class="content-grid">
      <div class="left-column">
        <div class="panel hero-card reveal">
          <div class="hero-header">
            <div>
              <p class="panel-title">Mission du jour</p>
              <h2 class="panel-headline">Table de commandement</h2>
              <p class="panel-sub">
                Suivez votre forme, vos matchs et votre programme d etude depuis un seul espace.
              </p>
            </div>
            <div class="hero-actions">
              <RouterLink class="button-primary" to="/matchs">Demarrer un duel</RouterLink>
              <button class="button-ghost" type="button" @click="onboardingOpen = true">
                Voir le guide
              </button>
            </div>
          </div>

          <div class="hero-body">
            <div class="board" aria-hidden="true">
              <div class="board-grid">
                <div v-for="square in squares" :key="square.id" :class="[
                  'square',
                  square.dark ? 'square--dark' : 'square--light',
                  square.isLastMove ? 'square--last' : '',
                  square.isFocus ? 'square--focus' : '',
                ]">
                  <img
                    v-if="square.piece && square.image"
                    :src="square.image"
                    alt=""
                    aria-hidden="true"
                    :class="[
                      'piece',
                      'piece-img',
                      square.tone === 'light' ? 'piece--light' : 'piece--dark',
                    ]"
                  />
                  <span
                    v-else-if="square.piece"
                    :class="[
                      'piece',
                      square.tone === 'light' ? 'piece--light' : 'piece--dark',
                    ]"
                  >
                    {{ square.symbol }}
                  </span>
                </div>
              </div>
            </div>

            <div class="hero-metrics">
              <div v-for="stat in quickStats" :key="stat.label" class="metric-card">
                <p class="metric-label">{{ stat.label }}</p>
                <p class="metric-value">{{ stat.value }}</p>
                <p class="metric-note">{{ stat.detail }}</p>
              </div>
            </div>
          </div>
        </div>

        <div class="rubric-grid">
          <article v-for="card in actionCards" :key="card.title" class="panel rubric-card reveal delay-1">
            <p class="rubric-title">{{ card.title }}</p>
            <p class="rubric-sub">{{ card.description }}</p>
            <div class="card-actions">
              <RouterLink class="button-ghost" :to="card.to">Ouvrir</RouterLink>
            </div>
          </article>
        </div>

        <div class="panel table-card reveal delay-2">
          <div class="panel-header">
            <div>
              <p class="panel-title">Journal recent</p>
              <h3 class="panel-headline">Chronologie JcJ</h3>
            </div>
            <RouterLink class="range-pill" to="/matchs">Voir tout</RouterLink>
          </div>

          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Match</th>
                  <th>Adversaire</th>
                  <th>Statut</th>
                  <th>Cadence</th>
                  <th>Dernier coup</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="match in recentMatches" :key="match.id">
                  <td>{{ match.id }}</td>
                  <td>{{ match.opponent }}</td>
                  <td>{{ statusLabels[match.status] ?? match.status }}</td>
                  <td>{{ match.timeControl }}</td>
                  <td>{{ match.lastMove || '-' }}</td>
                </tr>
                <tr v-if="!recentMatches.length">
                  <td colspan="5">Aucun match termine.</td>
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
            <p class="rating-meta">{{ profile.location || 'Profil' }}</p>
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
              <p class="ring-label">Elo saison</p>
            </div>
          </div>

          <div class="rating-footer">
            <div>
              <p class="metric-label">Titre</p>
              <p class="metric-value">{{ profile.title || '---' }}</p>
            </div>
            <div>
              <p class="metric-label">Derniere activite</p>
              <p class="metric-value">{{ profile.lastSeen || '---' }}</p>
            </div>
          </div>
        </div>

        <div class="panel reveal delay-1">
          <div class="panel-header">
            <div>
              <p class="panel-title">Plan de progression</p>
              <h3 class="panel-headline">Rituels rapides</h3>
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
              <p class="panel-title">Chronique</p>
              <h3 class="panel-headline">Chapitre suivant</h3>
            </div>
          </div>

          <div v-if="nextChapter" class="session-item">
            <div>
              <p class="session-title">{{ nextChapter.title }}</p>
              <p class="session-time">{{ nextChapter.summary }}</p>
            </div>
            <span class="badge-soft">{{ nextChapter.difficulty }}</span>
          </div>
          <div class="card-actions">
            <RouterLink
              class="button-primary"
              :to="nextChapterLink"
              @click="nextChapter && handleStartChapter(nextChapter.id)"
            >
              Continuer
            </RouterLink>
            <RouterLink class="button-ghost" to="/histoire">Voir tous les chapitres</RouterLink>
          </div>
        </div>

        <div class="panel focus-card reveal delay-2">
          <div class="panel-header">
            <div>
              <p class="panel-title">Atelier d entrainement</p>
              <h3 class="panel-headline">Objectifs de la semaine</h3>
            </div>
          </div>

          <div v-if="goals.length" class="progress-list">
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
          <p v-else class="panel-sub">Aucun objectif defini pour le moment.</p>
        </div>

        <div class="panel leaderboard-card reveal delay-3">
          <div class="panel-header">
            <div>
              <p class="panel-title">Classement</p>
              <h3 class="panel-headline">Table des maitres</h3>
            </div>
            <RouterLink class="range-pill" to="/leaderboard">Voir le podium</RouterLink>
          </div>

          <div v-if="leaderboardPreview.length" class="leaderboard-list">
            <div v-for="player in leaderboardPreview" :key="player.id" class="leaderboard-item">
              <div class="leaderboard-user">
                <div class="leaderboard-avatar">{{ player.name.slice(0, 1) }}</div>
                <div>
                  <p class="leaderboard-name">{{ player.name }}</p>
                  <p class="leaderboard-meta">Elo {{ player.rating }}</p>
                </div>
              </div>
              <span class="leaderboard-delta">
                {{ player.delta >= 0 ? '+' : '' }}{{ player.delta }}
              </span>
            </div>
          </div>
          <p v-else class="panel-sub">Podium indisponible.</p>
        </div>
      </aside>
    </section>
  </DashboardLayout>
</template>
