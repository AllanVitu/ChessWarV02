<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import DashboardLayout from '@/components/DashboardLayout.vue'
import { clearMatchesHistory, getMatches, type MatchRecord } from '@/lib/matchesDb'

const matches = ref<MatchRecord[]>([])
const historyMessage = ref('')
const historyError = ref(false)
const router = useRouter()
const selectedMode = ref<'IA' | 'JcJ'>('IA')

const statusLabels = {
  planifie: 'Planifie',
  en_cours: 'En cours',
  termine: 'Termine',
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
  if (status === 'planifie') return 'Lancer'
  if (status === 'en_cours') return 'Reprendre'
  return 'Revoir'
}

const modeLabel = (mode: MatchRecord['mode']) => (mode === 'JcJ' ? 'Ami' : 'Ami')

const totalMatches = computed(() => matches.value.length)
const hasHistoryMatches = computed(() => matches.value.some((match) => match.status === 'termine'))
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
  matches.value = await getMatches()
})

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

const startNewMatch = async () => {
  try {
    window.sessionStorage.setItem('warchess.play.access', '1')
  } catch {
    // Ignore storage failures.
  }
  await router.push(`/play?allow=1&mode=${selectedMode.value.toLowerCase()}`)
}
</script>

<template>
  <DashboardLayout
    eyebrow="Matchs"
    title="Centre des matchs"
    subtitle="Creez, lancez et suivez vos parties en un seul endroit."
  >
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
            :class="selectedMode === 'JcJ' ? 'mode-pill--active' : ''"
            type="button"
            @click="selectedMode = 'JcJ'"
          >
            JcJ
          </button>
        </div>
        <div class="panel-actions">
          <button class="button-primary" type="button" @click="startNewMatch">Nouveau match</button>
          <RouterLink class="button-ghost" to="/amis">Inviter un ami</RouterLink>
        </div>
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
                {{ statusLabels[match.status] }}
              </span>
            </div>

            <div class="match-meta">
              <span>{{ modeLabel(match.mode) }}</span>
              <span>Cadence {{ match.timeControl }}</span>
              <span>{{ match.side }}</span>
            </div>

            <div class="match-footer">
              <span class="match-move">Dernier coup: {{ match.lastMove }}</span>
              <div class="match-actions">
                <RouterLink class="button-ghost" :to="`/jeu/${match.id}`">Ouvrir</RouterLink>
                <button class="button-primary" type="button">{{ actionLabel(match.status) }}</button>
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
