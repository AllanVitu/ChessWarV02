<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import DashboardLayout from '@/components/DashboardLayout.vue'
import {
  addMatch,
  getMatches,
  type DifficultyKey,
  type MatchMode,
  type MatchRecord,
} from '@/lib/matchesDb'

const matches = ref<MatchRecord[]>([])
const formMessage = ref('')
const formError = ref(false)

const form = reactive({
  mode: 'IA' as MatchMode,
  opponent: '',
  difficulty: 'intermediaire' as DifficultyKey,
  timeControl: '10+0',
  side: 'Aleatoire' as MatchRecord['side'],
})

const difficultyLabels: Record<DifficultyKey, string> = {
  facile: 'Facile',
  intermediaire: 'Intermediaire',
  difficile: 'Difficile',
  maitre: 'Maitre',
}

const statusLabels = {
  planifie: 'Planifie',
  en_cours: 'En cours',
  termine: 'Termine',
}

const aiNames: Record<DifficultyKey, string> = {
  facile: 'IA Nova',
  intermediaire: 'IA Atlas',
  difficile: 'IA Helios',
  maitre: 'IA Zenith',
}

const formattedNow = () => new Date().toISOString().slice(0, 16).replace('T', ' ')

const actionLabel = (status: MatchRecord['status']) => {
  if (status === 'planifie') return 'Lancer'
  if (status === 'en_cours') return 'Reprendre'
  return 'Revoir'
}

const totalMatches = computed(() => matches.value.length)

onMounted(async () => {
  matches.value = await getMatches()
})

const handleCreateMatch = async () => {
  formMessage.value = ''
  formError.value = false

  if (form.mode === 'JcJ' && !form.opponent.trim()) {
    formMessage.value = 'Veuillez saisir un adversaire.'
    formError.value = true
    return
  }

  const id = `M-${Math.floor(1000 + Math.random() * 9000)}`
  const opponent = form.mode === 'IA' ? aiNames[form.difficulty] : form.opponent.trim()

  const match: MatchRecord = {
    id,
    mode: form.mode,
    opponent,
    status: 'planifie',
    createdAt: formattedNow(),
    lastMove: '-',
    timeControl: form.timeControl,
    side: form.side,
    difficulty: form.mode === 'IA' ? form.difficulty : undefined,
  }

  matches.value = await addMatch(match)
  form.opponent = ''
  formMessage.value = 'Match cree avec succes.'
  formError.value = false
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
          <span class="badge-soft">{{ totalMatches }} matchs</span>
        </div>

        <form class="form-stack" @submit.prevent="handleCreateMatch">
          <div class="form-field">
            <span class="form-label">Mode</span>
            <div class="segmented">
              <button
                type="button"
                :class="['segmented-button', form.mode === 'JcJ' && 'segmented-button--active']"
                @click="form.mode = 'JcJ'"
              >
                JcJ
              </button>
              <button
                type="button"
                :class="['segmented-button', form.mode === 'IA' && 'segmented-button--active']"
                @click="form.mode = 'IA'"
              >
                IA
              </button>
            </div>
          </div>

          <label v-if="form.mode === 'JcJ'" class="form-field">
            <span class="form-label">Adversaire</span>
            <input v-model="form.opponent" class="form-input" type="text" placeholder="Pseudo ou email" />
          </label>

          <div v-else class="form-field">
            <span class="form-label">Difficulte IA</span>
            <div class="segmented">
              <button
                v-for="level in Object.keys(difficultyLabels)"
                :key="level"
                type="button"
                :class="[
                  'segmented-button',
                  form.difficulty === level && 'segmented-button--active',
                ]"
                @click="form.difficulty = level as DifficultyKey"
              >
                {{ difficultyLabels[level as DifficultyKey] }}
              </button>
            </div>
          </div>

          <label class="form-field">
            <span class="form-label">Cadence</span>
            <select v-model="form.timeControl" class="form-input">
              <option value="3+2">3+2 Blitz</option>
              <option value="5+0">5+0 Blitz</option>
              <option value="10+0">10+0 Rapide</option>
              <option value="15+10">15+10 Classique</option>
            </select>
          </label>

          <label class="form-field">
            <span class="form-label">Couleur</span>
            <select v-model="form.side" class="form-input">
              <option value="Aleatoire">Aleatoire</option>
              <option value="Blancs">Blancs</option>
              <option value="Noirs">Noirs</option>
            </select>
          </label>

          <button class="button-primary" type="submit">Creer le match</button>
        </form>

        <p v-if="formMessage" :class="['form-message', formError ? 'form-message--error' : 'form-message--success']">
          {{ formMessage }}
        </p>
      </div>

      <div class="panel match-list">
        <div class="panel-header">
          <div>
            <p class="panel-title">Liste des matchs</p>
            <h3 class="panel-headline">Historique et en cours</h3>
          </div>
        </div>

        <div class="match-cards">
          <article v-for="match in matches" :key="match.id" class="match-card">
            <div class="match-row">
              <div>
                <p class="match-id">{{ match.id }}</p>
                <p class="match-opponent">{{ match.opponent }}</p>
              </div>
              <span :class="['match-status', `match-status--${match.status}`]">
                {{ statusLabels[match.status] }}
              </span>
            </div>

            <div class="match-meta">
              <span>{{ match.mode }}</span>
              <span>Cadence {{ match.timeControl }}</span>
              <span v-if="match.difficulty">IA {{ difficultyLabels[match.difficulty] }}</span>
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
        </div>
      </div>
    </section>
  </DashboardLayout>
</template>

