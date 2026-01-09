<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import DashboardLayout from '@/components/DashboardLayout.vue'
import { getMatchById, type DifficultyKey, type MatchRecord } from '@/lib/matchesDb'
import {
  applyMove,
  createInitialBoard,
  formatMove,
  getAiMove,
  getLegalMoves,
  type Move,
  type Side,
} from '@/lib/chessEngine'

const route = useRoute()
const matchId = computed(() => (route.params.id ? String(route.params.id) : ''))
const match = ref<MatchRecord | null>(null)

const mode = computed(() => match.value?.mode ?? 'IA')
const opponent = computed(() => match.value?.opponent ?? 'IA Sparring')
const timeControl = computed(() => match.value?.timeControl ?? '10+0')

const difficulty = ref<DifficultyKey>('intermediaire')

watch(
  matchId,
  async () => {
    if (!matchId.value) {
      match.value = null
      difficulty.value = 'intermediaire'
      return
    }
    match.value = await getMatchById(matchId.value)
    difficulty.value = match.value?.difficulty ?? 'intermediaire'
  },
  { immediate: true },
)

const sidePreference = computed(() => match.value?.side ?? 'Aleatoire')
const playerSide = computed<Side>(() => {
  if (sidePreference.value === 'Blancs') return 'white'
  if (sidePreference.value === 'Noirs') return 'black'
  const seed = Number.parseInt(matchId.value.slice(-1) || '0', 10)
  return seed % 2 === 0 ? 'white' : 'black'
})

const aiSide = computed(() => {
  if (mode.value !== 'IA') return null
  return playerSide.value === 'white' ? 'black' : 'white'
})

const board = ref(createInitialBoard())
const sideToMove = ref<Side>('white')
const selectedSquare = ref<string | null>(null)
const lastMove = ref<{ from: string; to: string } | null>(null)
const moveHistory = ref<{ ply: number; side: Side; notation: string }[]>([])
const aiThinking = ref(false)

const boardFiles = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
const boardRanks = [8, 7, 6, 5, 4, 3, 2, 1]

const legalMoves = computed(() => getLegalMoves(board.value, sideToMove.value))

const movesFromSelected = computed(() => {
  if (!selectedSquare.value) return []
  return legalMoves.value.filter((move) => move.from === selectedSquare.value)
})

const targetSquares = computed(() => new Set(movesFromSelected.value.map((move) => move.to)))

const canUserMove = computed(() => {
  if (mode.value !== 'IA') return true
  return sideToMove.value === playerSide.value
})

const isOwnedBySide = (piece: string, side: Side) => {
  if (!piece) return false
  return side === 'white' ? piece === piece.toUpperCase() : piece === piece.toLowerCase()
}

const applyAndRecord = (move: Move) => {
  board.value = applyMove(board.value, move)
  moveHistory.value = [
    ...moveHistory.value,
    {
      ply: moveHistory.value.length + 1,
      side: sideToMove.value,
      notation: formatMove(move),
    },
  ]
  lastMove.value = { from: move.from, to: move.to }
  selectedSquare.value = null
  sideToMove.value = sideToMove.value === 'white' ? 'black' : 'white'
}

const triggerAiMove = () => {
  if (aiThinking.value) return
  if (!aiSide.value || sideToMove.value !== aiSide.value) return
  aiThinking.value = true
  setTimeout(() => {
    const move = getAiMove(board.value, sideToMove.value, difficulty.value)
    if (move) {
      applyAndRecord(move)
    }
    aiThinking.value = false
  }, 500)
}

const handleSquareClick = (squareId: string, piece: string) => {
  if (!canUserMove.value) return

  if (!selectedSquare.value) {
    if (!piece || !isOwnedBySide(piece, sideToMove.value)) return
    selectedSquare.value = squareId
    return
  }

  if (squareId === selectedSquare.value) {
    selectedSquare.value = null
    return
  }

  const move = movesFromSelected.value.find((candidate) => candidate.to === squareId)
  if (!move) {
    if (piece && isOwnedBySide(piece, sideToMove.value)) {
      selectedSquare.value = squareId
    }
    return
  }

  applyAndRecord(move)
  triggerAiMove()
}

const handleAiMove = () => {
  triggerAiMove()
}

const squares = computed(() =>
  boardRanks.flatMap((rank, rowIndex) =>
    boardFiles.map((file, colIndex) => {
      const piece = board.value[rowIndex][colIndex]
      const squareId = `${file}${rank}`
      const isDark = (rowIndex + colIndex) % 2 === 1
      const tone = piece ? (piece === piece.toUpperCase() ? 'light' : 'dark') : ''
      const isSelected = selectedSquare.value === squareId
      const isTarget = targetSquares.value.has(squareId)
      const isLast = lastMove.value?.from === squareId || lastMove.value?.to === squareId

      return {
        id: squareId,
        piece,
        label: piece ? piece.toUpperCase() : '',
        dark: isDark,
        tone,
        isSelected,
        isTarget,
        isLast,
      }
    }),
  ),
)
</script>

<template>
  <DashboardLayout
    eyebrow="Partie"
    :title="`Match ${matchId || 'Libre'}`"
    :subtitle="`Mode ${mode} - ${opponent} - Cadence ${timeControl}`"
  >
    <section class="game-layout">
      <div class="panel game-board">
        <div class="panel-header">
          <div>
            <p class="panel-title">Plateau</p>
            <h3 class="panel-headline">Tour: {{ sideToMove === 'white' ? 'Blancs' : 'Noirs' }}</h3>
          </div>
          <span class="badge-soft">{{ mode === 'IA' ? 'IA active' : 'JcJ' }}</span>
        </div>

        <div class="board">
          <button
            v-for="square in squares"
            :key="square.id"
            type="button"
            :class="[
              'square',
              square.dark ? 'square--dark' : 'square--light',
              square.isLast ? 'square--last' : '',
              square.isSelected ? 'square--selected' : '',
              square.isTarget ? 'square--target' : '',
            ]"
            @click="handleSquareClick(square.id, square.piece)"
          >
            <span
              v-if="square.piece"
              :class="['piece', square.tone === 'light' ? 'piece--light' : 'piece--dark']"
            >
              {{ square.label }}
            </span>
          </button>
        </div>
      </div>

      <div class="panel game-panel">
        <div class="panel-header">
          <div>
            <p class="panel-title">Commandes</p>
            <h3 class="panel-headline">Gestion du match</h3>
          </div>
        </div>

        <div class="game-info">
          <div>
            <p class="metric-label">Votre couleur</p>
            <p class="metric-value">{{ playerSide === 'white' ? 'Blancs' : 'Noirs' }}</p>
          </div>
          <div>
            <p class="metric-label">Adversaire</p>
            <p class="metric-value">{{ opponent }}</p>
          </div>
          <div>
            <p class="metric-label">Cadence</p>
            <p class="metric-value">{{ timeControl }}</p>
          </div>
        </div>

        <div v-if="mode === 'IA'" class="game-ai">
          <p class="metric-label">Difficulte IA</p>
          <div class="segmented segmented--stack">
            <button
              type="button"
              :class="['segmented-button', difficulty === 'facile' && 'segmented-button--active']"
              @click="difficulty = 'facile'"
            >
              Facile
            </button>
            <button
              type="button"
              :class="['segmented-button', difficulty === 'intermediaire' && 'segmented-button--active']"
              @click="difficulty = 'intermediaire'"
            >
              Intermediaire
            </button>
            <button
              type="button"
              :class="['segmented-button', difficulty === 'difficile' && 'segmented-button--active']"
              @click="difficulty = 'difficile'"
            >
              Difficile
            </button>
            <button
              type="button"
              :class="['segmented-button', difficulty === 'maitre' && 'segmented-button--active']"
              @click="difficulty = 'maitre'"
            >
              Maitre
            </button>
          </div>

          <button class="button-primary" type="button" :disabled="aiThinking" @click="handleAiMove">
            {{ aiThinking ? 'IA en cours...' : 'Jouer le coup IA' }}
          </button>
        </div>

        <div class="panel-subsection">
          <p class="panel-title">Historique</p>
          <div class="move-list">
            <div v-if="!moveHistory.length" class="empty-state">Aucun coup joue.</div>
            <div v-for="move in moveHistory" :key="move.ply" class="move-item">
              <span class="move-ply">#{{ move.ply }}</span>
              <span class="move-side">{{ move.side === 'white' ? 'Blancs' : 'Noirs' }}</span>
              <span class="move-notation">{{ move.notation }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  </DashboardLayout>
</template>

