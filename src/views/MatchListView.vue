<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import DashboardLayout from '@/components/DashboardLayout.vue'
import AppModal from '@/components/ui/AppModal.vue'
import { clearMatchesHistory, getMatches, type MatchRecord } from '@/lib/matchesDb'
import type { BotPersona, DifficultyKey } from '@/lib/chessEngine'
import {
  getMatchmakingStatus,
  joinMatchmaking,
  leaveMatchmaking,
  type MatchmakingMode,
  type MatchmakingStatus,
} from '@/lib/matchmaking'

const matches = ref<MatchRecord[]>([])
const historyMessage = ref('')
const historyError = ref(false)
const router = useRouter()
const selectedMode = ref<'IA' | 'JcJ' | 'Histoire'>('IA')
const aiModalOpen = ref(false)
const aiDifficulty = ref<DifficultyKey>('intermediaire')
const aiPersona = ref<BotPersona>('equilibre')
const aiSide = ref<'Blancs' | 'Noirs' | 'Aleatoire'>('Aleatoire')
const aiTime = ref('10+0')
const pvpMode = ref<MatchmakingMode>('ranked')
const pvpSide = ref<'Blancs' | 'Noirs' | 'Aleatoire'>('Aleatoire')
const pvpTime = ref('10+0')
const matchmaking = ref<MatchmakingStatus>({ status: 'idle' })
const matchmakingMessage = ref('')
const matchmakingError = ref(false)
let matchmakingTimer: ReturnType<typeof setInterval> | null = null
const isOffline = ref(false)

const aiDifficultyOptions: Array<{ value: DifficultyKey; label: string }> = [
  { value: 'facile', label: 'Facile' },
  { value: 'intermediaire', label: 'Intermediaire' },
  { value: 'difficile', label: 'Difficile' },
  { value: 'maitre', label: 'Maitre' },
]

const aiPersonaOptions: Array<{ value: BotPersona; label: string }> = [
  { value: 'equilibre', label: 'Equilibre' },
  { value: 'agressif', label: 'Agressif' },
  { value: 'solide', label: 'Solide' },
  { value: 'fou', label: 'Chaos' },
]

const aiTimeOptions = ['5+0', '10+0', '15+10', '20+0', '30+0']

const statusLabels = {
  waiting: 'En attente',
  ready: 'Pret',
  started: 'En cours',
  finished: 'Termine',
  aborted: 'Annule',
}

const getInitials = (name: string) => {
  const trimmed = name.trim()
  if (!trimmed) return '?'
  return trimmed
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?'
}

const actionLabel = (status: MatchRecord['status']) => {
  if (status === 'waiting' || status === 'ready') return 'Ouvrir'
  if (status === 'started') return 'Reprendre'
  return 'Revoir'
}

const modeLabel = (mode: MatchRecord['mode']) => {
  if (mode === 'IA') return 'IA'
  if (mode === 'Histoire') return 'Histoire'
  return 'JcJ'
}

const totalMatches = computed(() => matches.value.length)
const hasHistoryMatches = computed(() =>
  matches.value.some((match) => match.status === 'finished' || match.status === 'aborted'),
)
const statusTotals = computed(() => {
  const totals = {
    waiting: 0,
    ready: 0,
    started: 0,
    finished: 0,
    aborted: 0,
  }
  for (const match of matches.value) {
    if (match.status in totals) {
      totals[match.status as keyof typeof totals] += 1
    }
  }
  return totals
})
const liveNow = computed(() => statusTotals.value.started)
const readyNow = computed(() => statusTotals.value.ready)
const waitingNow = computed(() => statusTotals.value.waiting)
const closedNow = computed(() => statusTotals.value.finished + statusTotals.value.aborted)
const queueStateLabel = computed(() => {
  if (isOffline.value) return 'Hors ligne'
  if (matchmaking.value.status === 'queued') return 'File active'
  if (matchmaking.value.status === 'matched') return 'Match trouve'
  return 'Aucune file'
})
const queueStateTone = computed(() => {
  if (matchmaking.value.status === 'queued') return 'match-queue-state--queued'
  if (matchmaking.value.status === 'matched') return 'match-queue-state--matched'
  return 'match-queue-state--idle'
})
const matchesPage = ref(1)
const matchesPageSize = 6
const visibleMatches = computed(() =>
  matches.value.slice(0, matchesPage.value * matchesPageSize),
)
const canLoadMoreMatches = computed(
  () => visibleMatches.value.length < matches.value.length,
)

watch(matches, () => {
  matchesPage.value = 1
})

onMounted(async () => {
  updateNetworkState()
  window.addEventListener('online', updateNetworkState)
  window.addEventListener('offline', updateNetworkState)

  matches.value = await getMatches()
  matchmaking.value = await getMatchmakingStatus()
  if (matchmaking.value.status === 'idle' && matchmaking.value.serviceMessage) {
    matchmakingMessage.value = matchmaking.value.serviceMessage
    matchmakingError.value = true
  }
  if (matchmaking.value.status === 'matched' && matchmaking.value.matchId) {
    await router.push(`/jeu/${matchmaking.value.matchId}`)
    return
  }
  if (matchmaking.value.status === 'queued') {
    matchmakingMessage.value = 'Recherche en cours...'
    matchmakingError.value = false
    startMatchmakingPoll()
  }
})

onBeforeUnmount(() => {
  stopMatchmakingPoll()
  window.removeEventListener('online', updateNetworkState)
  window.removeEventListener('offline', updateNetworkState)
})

const stopMatchmakingPoll = () => {
  if (matchmakingTimer) {
    clearInterval(matchmakingTimer)
    matchmakingTimer = null
  }
}

const startMatchmakingPoll = () => {
  if (matchmakingTimer) return
  matchmakingTimer = setInterval(async () => {
    await refreshMatchmakingStatus()
  }, 3000)
}

const updateNetworkState = () => {
  if (typeof navigator === 'undefined') return
  const wasOffline = isOffline.value
  isOffline.value = !navigator.onLine
  if (isOffline.value) {
    matchmakingMessage.value =
      "Connexion perdue. La file reste active localement; reprise automatique a la reconnexion."
    matchmakingError.value = true
    return
  }
  if (wasOffline && matchmaking.value.status === 'queued') {
    matchmakingMessage.value = 'Connexion retablie. Verification du matchmaking...'
    matchmakingError.value = false
    void refreshMatchmakingStatus()
  }
}

const refreshMatchmakingStatus = async () => {
  const status = await getMatchmakingStatus()

  if (
    status.status === 'idle' &&
    status.serviceMessage &&
    matchmaking.value.status === 'queued'
  ) {
    matchmakingMessage.value = status.serviceMessage
    matchmakingError.value = true
    return
  }

  matchmaking.value = status
  if (status.status === 'idle' && status.serviceMessage) {
    matchmakingMessage.value = status.serviceMessage
    matchmakingError.value = true
  } else if (status.status === 'queued') {
    matchmakingMessage.value = 'Recherche en cours...'
    matchmakingError.value = false
  } else if (status.status === 'idle') {
    matchmakingMessage.value = ''
    matchmakingError.value = false
  }

  if (status.status === 'matched' && status.matchId) {
    stopMatchmakingPoll()
    matchmakingMessage.value = 'Match trouve. Redirection...'
    matchmakingError.value = false
    await router.push(`/jeu/${status.matchId}`)
  }
}

const handleClearHistory = async () => {
  historyMessage.value = ''
  historyError.value = false

  if (!hasHistoryMatches.value) {
    historyMessage.value = 'Aucun match termine a effacer.'
    historyError.value = true
    return
  }

  const confirmed = window.confirm("Effacer l'historique des matchs termines ?")
  if (!confirmed) return

  const result = await clearMatchesHistory('history')
  matches.value = result.matches
  historyMessage.value = result.message
  historyError.value = !result.ok
}

const setPlayAccess = () => {
  try {
    window.sessionStorage.setItem('warchess.play.access', '1')
  } catch {
    // Ignore storage failures.
  }
}

const startAiMatch = async () => {
  setPlayAccess()
  aiModalOpen.value = false
  const params = new URLSearchParams({
    allow: '1',
    mode: 'ia',
    difficulty: aiDifficulty.value,
    persona: aiPersona.value,
    side: aiSide.value,
    time: aiTime.value,
  })
  await router.push(`/play?${params.toString()}`)
}

const startNewMatch = async () => {
  if (selectedMode.value === 'IA') {
    aiModalOpen.value = true
    return
  }
  if (selectedMode.value === 'Histoire') {
    await router.push('/histoire')
    return
  }
  matchmakingMessage.value = ''
  matchmakingError.value = false
  try {
    const status = await joinMatchmaking({
      mode: pvpMode.value,
      timeControl: pvpTime.value,
      side: pvpSide.value,
    })
    matchmaking.value = status
    if (status.status === 'matched' && status.matchId) {
      await router.push(`/jeu/${status.matchId}`)
      return
    }
    matchmakingMessage.value = 'Recherche en cours...'
    startMatchmakingPoll()
  } catch (error) {
    matchmakingMessage.value = (error as Error).message
    matchmakingError.value = true
  }
}

const cancelMatchmaking = async () => {
  await leaveMatchmaking()
  matchmaking.value = { status: 'idle' }
  matchmakingMessage.value = 'File annulee.'
  matchmakingError.value = false
  stopMatchmakingPoll()
}

const handleMatchAction = async (match: MatchRecord) => {
  await router.push(`/jeu/${match.id}`)
}
</script>

<template>
  <DashboardLayout
    eyebrow="Matchs"
    title="Centre des matchs"
    subtitle="Creez, lancez et suivez vos parties en un seul endroit."
  >
    <AppModal v-model="aiModalOpen" title="Match IA">
      <div class="form-stack">
        <label class="form-field">
          <span class="form-label">Difficulte</span>
          <select v-model="aiDifficulty" class="form-input">
            <option v-for="option in aiDifficultyOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>

        <label class="form-field">
          <span class="form-label">Personnalite</span>
          <select v-model="aiPersona" class="form-input">
            <option v-for="option in aiPersonaOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>

        <div class="form-field">
          <span class="form-label">Couleur</span>
          <div class="segmented">
            <button
              class="segmented-button"
              :class="aiSide === 'Blancs' ? 'segmented-button--active' : ''"
              type="button"
              @click="aiSide = 'Blancs'"
            >
              Blancs
            </button>
            <button
              class="segmented-button"
              :class="aiSide === 'Noirs' ? 'segmented-button--active' : ''"
              type="button"
              @click="aiSide = 'Noirs'"
            >
              Noirs
            </button>
            <button
              class="segmented-button"
              :class="aiSide === 'Aleatoire' ? 'segmented-button--active' : ''"
              type="button"
              @click="aiSide = 'Aleatoire'"
            >
              Aleatoire
            </button>
          </div>
        </div>

        <label class="form-field">
          <span class="form-label">Temps</span>
          <select v-model="aiTime" class="form-input">
            <option v-for="time in aiTimeOptions" :key="time" :value="time">
              {{ time }}
            </option>
          </select>
        </label>
      </div>

      <template #footer>
        <button class="button-ghost" type="button" @click="aiModalOpen = false">Annuler</button>
        <button class="button-primary" type="button" @click="startAiMatch">Lancer</button>
      </template>
    </AppModal>

    <section class="match-layout">
      <div class="panel match-create">
        <div class="panel-header">
          <div>
            <p class="panel-title">Nouveau match</p>
            <h3 class="panel-headline">Configurer une partie</h3>
          </div>
          <div class="panel-actions">
            <span class="badge-soft">{{ totalMatches }} matchs</span>
          </div>
        </div>

        <p class="panel-sub">
          Tous les nouveaux matchs se lancent depuis ici, puis basculent vers l'arene de jeu IA ou JcJ.
        </p>
        <div class="match-broadcast-strip">
          <article class="match-broadcast-card match-broadcast-card--live">
            <p class="match-broadcast-label">Live</p>
            <p class="match-broadcast-value">{{ liveNow }}</p>
          </article>
          <article class="match-broadcast-card match-broadcast-card--ready">
            <p class="match-broadcast-label">Ready</p>
            <p class="match-broadcast-value">{{ readyNow }}</p>
          </article>
          <article class="match-broadcast-card match-broadcast-card--queue">
            <p class="match-broadcast-label">File</p>
            <p class="match-broadcast-value">{{ waitingNow }}</p>
          </article>
          <article class="match-broadcast-card match-broadcast-card--closed">
            <p class="match-broadcast-label">Clotures</p>
            <p class="match-broadcast-value">{{ closedNow }}</p>
          </article>
        </div>
        <p :class="['match-queue-state', queueStateTone]">{{ queueStateLabel }}</p>
        <div class="mode-toggle">
          <button
            class="button-ghost mode-pill"
            :class="selectedMode === 'IA' ? 'mode-pill--active' : ''"
            type="button"
            @click="selectedMode = 'IA'"
          >
            IA
          </button>
          <button
            class="button-ghost mode-pill"
            :class="selectedMode === 'Histoire' ? 'mode-pill--active' : ''"
            type="button"
            @click="selectedMode = 'Histoire'"
          >
            Histoire
          </button>
          <button
            class="button-ghost mode-pill"
            :class="selectedMode === 'JcJ' ? 'mode-pill--active' : ''"
            type="button"
            @click="selectedMode = 'JcJ'"
          >
            JcJ
          </button>
        </div>
        <div v-if="selectedMode === 'JcJ'" class="form-stack matchmake-form">
          <label class="form-field">
            <span class="form-label">Type de match</span>
            <div class="segmented">
              <button
                class="segmented-button"
                :class="pvpMode === 'ranked' ? 'segmented-button--active' : ''"
                type="button"
                @click="pvpMode = 'ranked'"
              >
                Classe
              </button>
              <button
                class="segmented-button"
                :class="pvpMode === 'friendly' ? 'segmented-button--active' : ''"
                type="button"
                @click="pvpMode = 'friendly'"
              >
                Amical
              </button>
            </div>
          </label>

          <div class="form-field">
            <span class="form-label">Couleur</span>
            <div class="segmented">
              <button
                class="segmented-button"
                :class="pvpSide === 'Blancs' ? 'segmented-button--active' : ''"
                type="button"
                @click="pvpSide = 'Blancs'"
              >
                Blancs
              </button>
              <button
                class="segmented-button"
                :class="pvpSide === 'Noirs' ? 'segmented-button--active' : ''"
                type="button"
                @click="pvpSide = 'Noirs'"
              >
                Noirs
              </button>
              <button
                class="segmented-button"
                :class="pvpSide === 'Aleatoire' ? 'segmented-button--active' : ''"
                type="button"
                @click="pvpSide = 'Aleatoire'"
              >
                Aleatoire
              </button>
            </div>
          </div>

          <label class="form-field">
            <span class="form-label">Temps</span>
            <select v-model="pvpTime" class="form-input">
              <option v-for="time in aiTimeOptions" :key="`pvp-${time}`" :value="time">
                {{ time }}
              </option>
            </select>
          </label>
        </div>
        <div class="panel-actions">
          <button class="button-primary" type="button" @click="startNewMatch">Nouveau match</button>
          <RouterLink class="button-ghost" to="/entrainement">Entrainement</RouterLink>
          <RouterLink class="button-ghost" to="/amis">Inviter un ami</RouterLink>
        </div>
        <div v-if="selectedMode === 'JcJ' && matchmaking.status === 'queued'" class="panel-matchmaking">
          <p class="panel-sub">File en cours: {{ matchmaking.mode }} - {{ matchmaking.timeControl }}</p>
          <button class="button-ghost" type="button" @click="cancelMatchmaking">Annuler la file</button>
        </div>
        <p
          v-if="matchmakingMessage"
          :class="['form-message', matchmakingError ? 'form-message--error' : 'form-message--success']"
        >
          {{ matchmakingMessage }}
        </p>
      </div>

      <div class="panel match-list">
        <div class="panel-header">
          <div>
            <p class="panel-title">Liste des matchs</p>
            <h3 class="panel-headline">Historique et en cours</h3>
          </div>
          <div class="panel-actions">
            <button
              class="button-ghost"
              type="button"
              :disabled="!hasHistoryMatches"
              @click="handleClearHistory"
            >
              Effacer l'historique
            </button>
          </div>
        </div>
        <div class="match-status-grid">
          <span class="match-status-chip match-status-chip--waiting">Attente {{ statusTotals.waiting }}</span>
          <span class="match-status-chip match-status-chip--ready">Ready {{ statusTotals.ready }}</span>
          <span class="match-status-chip match-status-chip--started">Live {{ statusTotals.started }}</span>
          <span class="match-status-chip match-status-chip--finished">Termines {{ statusTotals.finished }}</span>
          <span class="match-status-chip match-status-chip--aborted">Annules {{ statusTotals.aborted }}</span>
        </div>

          <div class="match-cards">
            <div v-if="!matches.length" class="empty-state">
              <p class="empty-state__title">Aucun match JcJ pour le moment.</p>
              <p class="empty-state__subtitle">Invitez un ami pour commencer.</p>
              <RouterLink class="button-primary" to="/amis">Trouver un ami</RouterLink>
            </div>
            <article v-for="match in visibleMatches" :key="match.id" class="match-card">
              <div class="match-row">
                <div class="match-ident">
                  <div class="match-avatar">{{ getInitials(match.opponent) }}</div>
                  <div>
                    <p class="match-id">{{ match.id }}</p>
                  <p class="match-opponent">{{ match.opponent }}</p>
                </div>
              </div>
              <span :class="['match-status', `match-status--${match.status}`]">
                {{ statusLabels[match.status] ?? 'Inconnu' }}
              </span>
            </div>
            <div :class="['match-signal-bar', `match-signal-bar--${match.status}`]"></div>

            <div class="match-meta">
              <span>{{ modeLabel(match.mode) }}</span>
              <span>Cadence {{ match.timeControl }}</span>
              <span>{{ match.side }}</span>
            </div>

            <div class="match-footer">
              <span class="match-move">Dernier coup: {{ match.lastMove }}</span>
              <div class="match-actions">
                <RouterLink class="button-ghost" :to="`/jeu/${match.id}`">Ouvrir</RouterLink>
                <button class="button-primary" type="button" @click="handleMatchAction(match)">
                  {{ actionLabel(match.status) }}
                </button>
              </div>
              </div>
            </article>
            <button
              v-if="canLoadMoreMatches"
              class="button-ghost"
              type="button"
              @click="matchesPage += 1"
            >
              Afficher plus
            </button>
          </div>

        <p
          v-if="historyMessage"
          :class="['form-message', historyError ? 'form-message--error' : 'form-message--success']"
          role="status"
        >
          {{ historyMessage }}
        </p>
      </div>
    </section>
  </DashboardLayout>
</template>
