<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import DashboardLayout from '@/components/DashboardLayout.vue'
import { clearMatchesCache, getMatchById, type DifficultyKey, type MatchRecord } from '@/lib/matchesDb'
import { getCurrentUser } from '@/lib/auth'
import {
  addMatchMessage,
  addMatchMove,
  finishMatch,
  getMatchRoom,
  openMatchStream,
  type MatchOnlineState,
  type OnlineMessage,
  type OnlineMove,
} from '@/lib/matchOnline'
import { createMatchInvite } from '@/lib/notifications'
import {
  applyMove,
  createInitialBoard,
  evaluateBoard,
  formatMove,
  getAiMove,
  getLegalMoves,
  type Move,
  type Side,
} from '@/lib/chessEngine'

const route = useRoute()
const router = useRouter()
const matchId = computed(() => (route.params.id ? String(route.params.id) : ''))
const match = ref<MatchRecord | null>(null)
const onlineMoves = ref<OnlineMove[]>([])
const onlineMessages = ref<OnlineMessage[]>([])
const onlineSide = ref<'white' | 'black'>('white')
const onlineSideToMove = ref<'white' | 'black'>('white')
const onlineWhiteId = ref<string | null>(null)
const onlineBlackId = ref<string | null>(null)
const onlineStatus = ref('active')
const onlineMode = ref<MatchRecord['mode'] | null>(null)
const onlineOpponent = ref<string | null>(null)
const onlineTimeControl = ref<string | null>(null)
const onlineLoading = ref(false)
const onlineError = ref('')
const onlinePending = ref(false)
let onlineStream: EventSource | null = null
const chatInput = ref('')
const chatPending = ref(false)
const chatError = ref('')
const chatListRef = ref<HTMLDivElement | null>(null)
const rematchNotice = ref('')
const rematchNoticeError = ref(false)
const finishNotice = ref('')
const finishNoticeError = ref(false)
const whiteClockMs = ref(0)
const blackClockMs = ref(0)
const clockTickAt = ref(0)
const timeoutTriggered = ref(false)
const clockNotice = ref('')
const clockNoticeError = ref(false)
let clockTimer: ReturnType<typeof setInterval> | null = null
const localMatchEnded = ref(false)
const currentUserId = ref('')
let onlinePollTimer: ReturnType<typeof setInterval> | null = null

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
const forceOnline = computed(() => isUuid(matchId.value))
const mode = computed<MatchRecord['mode']>(() =>
  forceOnline.value ? 'JcJ' : match.value?.mode ?? onlineMode.value ?? 'IA',
)
const isOnline = computed(() => mode.value === 'JcJ')
const modeLabel = computed(() => (mode.value === 'JcJ' ? 'En ligne' : mode.value))
const opponent = computed(() => {
  const direct = match.value?.opponent ?? onlineOpponent.value
  if (direct) return direct
  return forceOnline.value ? 'Adversaire' : 'IA Sparring'
})
const timeControl = computed(() => match.value?.timeControl ?? onlineTimeControl.value ?? '10+0')
const sideLabel = computed(() => (mode.value === 'Local' ? 'Camp joueur 1' : 'Votre couleur'))
const opponentLabel = computed(() => (mode.value === 'Local' ? 'Joueur 2' : 'Adversaire'))
const onlineNote = computed(() => {
  if (!isOnline.value) return ''
  if (onlineLoading.value) return 'Connexion au match en ligne...'
  if (onlinePending.value) return 'Envoi du coup...'
  if (onlineStatus.value !== 'active') return 'Match termine. Vous pouvez proposer une revanche.'
  return sideToMove.value === playerSide.value ? 'A vous de jouer.' : "En attente du coup adverse."
})

const difficulty = ref<DifficultyKey>('intermediaire')

const ensureCurrentUserId = async () => {
  if (currentUserId.value) return
  const user = await getCurrentUser()
  currentUserId.value = user?.id ?? ''
}

watch(
  matchId,
  async () => {
    stopOnlineStream()
    stopClock()
    onlineMoves.value = []
    onlineMessages.value = []
    onlineError.value = ''
    onlinePending.value = false
    onlineSide.value = 'white'
    onlineSideToMove.value = 'white'
    onlineWhiteId.value = null
    onlineBlackId.value = null
    onlineStatus.value = 'active'
    onlineMode.value = null
    onlineOpponent.value = null
    onlineTimeControl.value = null
    chatInput.value = ''
    chatPending.value = false
    chatError.value = ''
    rematchNotice.value = ''
    rematchNoticeError.value = false
    finishNotice.value = ''
    finishNoticeError.value = false
    whiteClockMs.value = 0
    blackClockMs.value = 0
    clockTickAt.value = 0
    timeoutTriggered.value = false
    clockNotice.value = ''
    clockNoticeError.value = false
    localMatchEnded.value = false
    if (!matchId.value) {
      match.value = null
      difficulty.value = 'intermediaire'
      return
    }

    const shouldLoadOnline = forceOnline.value
    if (shouldLoadOnline) {
      onlineMode.value = 'JcJ'
    }

    match.value = await getMatchById(matchId.value)
    difficulty.value = match.value?.difficulty ?? 'intermediaire'
    if (match.value?.mode === 'JcJ') {
      await loadOnlineMatch()
    } else if (match.value) {
      resetLocalClocks()
    } else if (shouldLoadOnline) {
      await loadOnlineMatch()
    }
  },
  { immediate: true },
)

const sidePreference = computed(() => match.value?.side ?? 'Aleatoire')
const playerSide = computed<Side>(() => {
  if (isOnline.value) return onlineSide.value
  if (sidePreference.value === 'Blancs') return 'white'
  if (sidePreference.value === 'Noirs') return 'black'
  const seed = Number.parseInt(matchId.value.slice(-1) || '0', 10)
  return seed % 2 === 0 ? 'white' : 'black'
})

const aiSide = computed(() => {
  if (mode.value !== 'IA') return null
  return playerSide.value === 'white' ? 'black' : 'white'
})

const matchEnded = computed(() =>
  isOnline.value ? onlineStatus.value !== 'active' : localMatchEnded.value,
)
const opponentId = computed(() => {
  if (!isOnline.value) return ''
  return playerSide.value === 'white' ? onlineBlackId.value ?? '' : onlineWhiteId.value ?? ''
})

const parseTimeControl = (value: string) => {
  const trimmed = value.trim()
  const match = /^(\d+)(?:\+(\d+))?$/.exec(trimmed)
  if (!match) {
    return { initialMs: 10 * 60 * 1000, incrementMs: 0 }
  }
  const minutes = Math.max(1, Number.parseInt(match[1] ?? '10', 10))
  const increment = Math.max(0, Number.parseInt(match[2] ?? '0', 10))
  return { initialMs: minutes * 60 * 1000, incrementMs: increment * 1000 }
}

const clockConfig = computed(() => parseTimeControl(timeControl.value))

const formatClock = (ms: number) => {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

const clockTone = (ms: number) => {
  if (ms <= 10000) return 'player-clock--danger'
  if (ms <= 30000) return 'player-clock--warning'
  return ''
}

const whiteClockLabel = computed(() => formatClock(whiteClockMs.value))
const blackClockLabel = computed(() => formatClock(blackClockMs.value))

const clockActive = computed(() => {
  if (isOnline.value) {
    return onlineStatus.value === 'active' && !onlineLoading.value && !onlinePending.value
  }
  return !localMatchEnded.value
})

const board = ref(createInitialBoard())
const sideToMove = ref<Side>('white')
const selectedSquare = ref<string | null>(null)
const lastMove = ref<{ from: string; to: string } | null>(null)
const moveHistory = ref<{ ply: number; side: Side; notation: string }[]>([])
const aiThinking = ref(false)
const analysis = ref<{ score: number; bestMove: Move | null }>({
  score: 0,
  bestMove: null,
})
let aiTimeout: ReturnType<typeof setTimeout> | null = null

const boardFiles = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
const boardRanks = [8, 7, 6, 5, 4, 3, 2, 1]
const squareToCoords = (square: string) => {
  const file = square[0] ?? ''
  const rank = Number(square[1])
  const col = boardFiles.indexOf(file)
  return { row: 8 - rank, col: col === -1 ? 0 : col }
}
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

const legalMoves = computed(() => getLegalMoves(board.value, sideToMove.value))

const movesFromSelected = computed(() => {
  if (!selectedSquare.value) return []
  return legalMoves.value.filter((move) => move.from === selectedSquare.value)
})

const targetSquares = computed(() => new Set(movesFromSelected.value.map((move) => move.to)))

const canUserMove = computed(() => {
  if (isOnline.value) {
    return (
      onlineStatus.value === 'active' &&
      !onlineLoading.value &&
      !onlinePending.value &&
      sideToMove.value === playerSide.value
    )
  }
  if (localMatchEnded.value) return false
  if (mode.value !== 'IA') return true
  return sideToMove.value === playerSide.value
})

const whiteLabel = computed(() => {
  if (mode.value === 'Local') return 'Joueur 1'
  return playerSide.value === 'white' ? 'Vous' : opponent.value
})

const blackLabel = computed(() => {
  if (mode.value === 'Local') return 'Joueur 2'
  return playerSide.value === 'black' ? 'Vous' : opponent.value
})

const initialsFrom = (label: string) => {
  const clean = label.trim()
  if (!clean) return '?'
  return clean
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?'
}

const applyOnlineMoves = (moves: OnlineMove[]) => {
  let nextBoard = createInitialBoard()
  const history: { ply: number; side: Side; notation: string }[] = []
  let last: { from: string; to: string } | null = null

  for (const move of moves) {
    const coords = squareToCoords(move.from)
    const piece = nextBoard[coords.row]?.[coords.col] ?? ''
    if (!piece) {
      continue
    }
    nextBoard = applyMove(nextBoard, { from: move.from, to: move.to, piece })
    history.push({
      ply: move.ply,
      side: move.side === 'white' ? 'white' : 'black',
      notation: move.notation,
    })
    last = { from: move.from, to: move.to }
  }

  board.value = nextBoard
  moveHistory.value = history
  lastMove.value = last
  selectedSquare.value = null
}

const applyOnlineState = (state: MatchOnlineState) => {
  onlineMoves.value = state.moves ?? []
  onlineMessages.value = state.messages ?? []
  let resolvedSide = state.yourSide
  if (currentUserId.value) {
    if (state.whiteId && state.whiteId === currentUserId.value) {
      resolvedSide = 'white'
    } else if (state.blackId && state.blackId === currentUserId.value) {
      resolvedSide = 'black'
    }
  }
  onlineSide.value = resolvedSide ?? 'white'
  onlineSideToMove.value = state.sideToMove
  onlineWhiteId.value = state.whiteId ?? null
  onlineBlackId.value = state.blackId ?? null
  onlineStatus.value = state.status ?? 'active'
  onlineMode.value = (state.mode as MatchRecord['mode'] | null) ?? 'JcJ'
  if (state.opponent) {
    onlineOpponent.value = state.opponent
  }
  if (state.timeControl) {
    onlineTimeControl.value = state.timeControl
  }
  sideToMove.value = state.sideToMove
  onlinePending.value = false
  applyOnlineMoves(onlineMoves.value)
  syncOnlineClocks(state)
}

const stopClock = () => {
  if (clockTimer) {
    clearInterval(clockTimer)
    clockTimer = null
  }
}

const checkTimeout = () => {
  if (timeoutTriggered.value) return
  if (whiteClockMs.value === 0 || blackClockMs.value === 0) {
    timeoutTriggered.value = true
    void handleTimeout()
  }
}

const startClock = () => {
  stopClock()
  clockTickAt.value = Date.now()
  clockTimer = setInterval(() => {
    if (!clockActive.value || matchEnded.value) {
      clockTickAt.value = Date.now()
      return
    }
    const now = Date.now()
    const elapsed = now - clockTickAt.value
    clockTickAt.value = now
    if (sideToMove.value === 'white') {
      whiteClockMs.value = Math.max(0, whiteClockMs.value - elapsed)
    } else {
      blackClockMs.value = Math.max(0, blackClockMs.value - elapsed)
    }
    checkTimeout()
  }, 250)
}

const commitClockTick = () => {
  if (!clockActive.value || matchEnded.value) return
  const now = Date.now()
  const elapsed = now - clockTickAt.value
  clockTickAt.value = now
  if (sideToMove.value === 'white') {
    whiteClockMs.value = Math.max(0, whiteClockMs.value - elapsed)
  } else {
    blackClockMs.value = Math.max(0, blackClockMs.value - elapsed)
  }
}

const applyIncrement = (side: Side) => {
  const { incrementMs } = clockConfig.value
  if (incrementMs <= 0) return
  if (side === 'white') {
    whiteClockMs.value += incrementMs
  } else {
    blackClockMs.value += incrementMs
  }
}

const resetLocalClocks = () => {
  const { initialMs } = clockConfig.value
  whiteClockMs.value = initialMs
  blackClockMs.value = initialMs
  localMatchEnded.value = false
  timeoutTriggered.value = false
  clockNotice.value = ''
  clockNoticeError.value = false
  clockTickAt.value = Date.now()
  startClock()
}

const syncOnlineClocks = (state: MatchOnlineState) => {
  const { initialMs, incrementMs } = clockConfig.value
  let whiteLeft = initialMs
  let blackLeft = initialMs
  const parseTimestamp = (value?: string | null) => {
    if (!value) return null
    const time = new Date(value).getTime()
    return Number.isFinite(time) ? time : null
  }
  const startAt = parseTimestamp(state.createdAt) ?? Date.now()
  let lastTime = startAt

  for (const move of state.moves ?? []) {
    const moveTime = parseTimestamp(move.createdAt)
    if (!moveTime) continue
    const elapsed = Math.max(0, moveTime - lastTime)
    if (move.side === 'white') {
      whiteLeft = Math.max(0, whiteLeft - elapsed + incrementMs)
    } else {
      blackLeft = Math.max(0, blackLeft - elapsed + incrementMs)
    }
    lastTime = moveTime
  }

  if (state.status === 'active') {
    const elapsed = Math.max(0, Date.now() - lastTime)
    if (state.sideToMove === 'white') {
      whiteLeft = Math.max(0, whiteLeft - elapsed)
    } else {
      blackLeft = Math.max(0, blackLeft - elapsed)
    }
  }

  if (!Number.isFinite(whiteLeft) || !Number.isFinite(blackLeft)) {
    whiteLeft = initialMs
    blackLeft = initialMs
  }
  if (
    state.status === 'active' &&
    (!state.moves || state.moves.length === 0) &&
    (whiteLeft <= 0 || blackLeft <= 0)
  ) {
    whiteLeft = initialMs
    blackLeft = initialMs
  }

  whiteClockMs.value = whiteLeft
  blackClockMs.value = blackLeft
  clockTickAt.value = Date.now()
  timeoutTriggered.value = state.status !== 'active'
  checkTimeout()

  if (state.status === 'active') {
    startClock()
  } else {
    stopClock()
  }
}

const stopOnlineStream = () => {
  if (onlineStream) {
    onlineStream.close()
    onlineStream = null
  }
}

const stopOnlinePolling = () => {
  if (onlinePollTimer) {
    clearInterval(onlinePollTimer)
    onlinePollTimer = null
  }
}

const startOnlinePolling = () => {
  if (onlinePollTimer) return
  onlinePollTimer = setInterval(async () => {
    if (!matchId.value) return
    try {
      const state = await getMatchRoom(matchId.value)
      applyOnlineState(state)
    } catch {
      // Ignore polling errors to avoid noisy loops.
    }
  }, 3000)
}

const loadOnlineMatch = async () => {
  if (!matchId.value) return
  onlineLoading.value = true
  onlineError.value = ''
  stopOnlinePolling()
  await ensureCurrentUserId()
  try {
    const state = await getMatchRoom(matchId.value)
    applyOnlineState(state)
    stopOnlineStream()
    onlineStream = openMatchStream(
      matchId.value,
      (payload) => {
        applyOnlineState(payload)
        if (onlineError.value) {
          onlineError.value = ''
        }
      },
      () => {
        if (!onlineError.value) {
          onlineError.value = 'Connexion temps reel interrompue.'
        }
        startOnlinePolling()
      },
    )
    if (!onlineStream) {
      startOnlinePolling()
    }
  } catch (error) {
    onlineError.value = (error as Error).message
    startOnlinePolling()
  } finally {
    onlineLoading.value = false
  }
}

const evaluationValue = computed(() => {
  const score = analysis.value.score
  const formatted = score.toFixed(1)
  return `${score >= 0 ? '+' : ''}${formatted}`
})

const evaluationNote = computed(() => {
  const score = analysis.value.score
  if (score >= 1.5) return 'Avantage blancs'
  if (score <= -1.5) return 'Avantage noirs'
  if (score >= 0.3) return 'Leger avantage blancs'
  if (score <= -0.3) return 'Leger avantage noirs'
  return 'Position equilibree'
})

const suggestedLine = computed(() => {
  const move = analysis.value.bestMove
  return move ? formatMove(move) : 'Aucun coup disponible'
})

const isOwnedBySide = (piece: string, side: Side) => {
  if (!piece) return false
  return side === 'white' ? piece === piece.toUpperCase() : piece === piece.toLowerCase()
}

const applyAndRecord = (move: Move) => {
  if (!isOnline.value) {
    commitClockTick()
    applyIncrement(sideToMove.value)
    checkTimeout()
  }
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
  clockTickAt.value = Date.now()
}

const updateAnalysis = () => {
  analysis.value = {
    score: evaluateBoard(board.value),
    bestMove: getAiMove(board.value, sideToMove.value, difficulty.value),
  }
}

const triggerAiMove = () => {
  if (aiThinking.value) return
  if (localMatchEnded.value) return
  if (!aiSide.value || sideToMove.value !== aiSide.value) return
  aiThinking.value = true
  if (aiTimeout) {
    clearTimeout(aiTimeout)
  }
  aiTimeout = setTimeout(() => {
    const move = getAiMove(board.value, sideToMove.value, difficulty.value)
    if (move) {
      applyAndRecord(move)
    }
    aiThinking.value = false
    aiTimeout = null
  }, 500)
}

const submitOnlineMove = async (move: Move) => {
  if (!matchId.value) return
  if (onlineStatus.value !== 'active') return
  onlinePending.value = true
  onlineError.value = ''
  stopClock()
  try {
    const state = await addMatchMove(matchId.value, {
      from: move.from,
      to: move.to,
      notation: formatMove(move),
    })
    applyOnlineState(state)
  } catch (error) {
    onlineError.value = (error as Error).message
  } finally {
    onlinePending.value = false
  }
}

const formatChatTime = (value: string) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const handleSendChat = async () => {
  if (!matchId.value || !isOnline.value) return
  const next = chatInput.value.trim()
  if (!next) return

  chatPending.value = true
  chatError.value = ''
  try {
    const state = await addMatchMessage(matchId.value, next)
    applyOnlineState(state)
    chatInput.value = ''
    await nextTick()
    if (chatListRef.value) {
      chatListRef.value.scrollTop = chatListRef.value.scrollHeight
    }
  } catch (error) {
    chatError.value = (error as Error).message
  } finally {
    chatPending.value = false
  }
}

const handleRematch = async () => {
  if (!opponentId.value) {
    rematchNotice.value = 'Adversaire introuvable.'
    rematchNoticeError.value = true
    return
  }

  rematchNotice.value = ''
  rematchNoticeError.value = false
  try {
    const response = await createMatchInvite(opponentId.value, timeControl.value, 'Aleatoire')
    rematchNotice.value = response.message
    rematchNoticeError.value = !response.ok
    if (response.ok && response.status === 'accepted' && response.matchId) {
      clearMatchesCache()
      await router.push(`/jeu/${response.matchId}`)
    }
  } catch (error) {
    rematchNotice.value = (error as Error).message
    rematchNoticeError.value = true
  }
}

const handleFinishMatch = async (result: 'resign' | 'draw' | 'timeout') => {
  if (!matchId.value || !isOnline.value) return
  finishNotice.value = ''
  finishNoticeError.value = false
  try {
    const state = await finishMatch(matchId.value, result)
    applyOnlineState(state)
    if (result === 'draw') {
      finishNotice.value = 'Match nul enregistre.'
    } else if (result === 'timeout') {
      finishNotice.value = 'Temps ecoule.'
    } else {
      finishNotice.value = 'Match termine.'
    }
  } catch (error) {
    finishNotice.value = (error as Error).message
    finishNoticeError.value = true
  }
}

const handleTimeout = async () => {
  if (matchEnded.value) return
  stopClock()
  if (isOnline.value) {
    await handleFinishMatch('timeout')
    return
  }
  if (aiTimeout) {
    clearTimeout(aiTimeout)
    aiTimeout = null
  }
  aiThinking.value = false
  localMatchEnded.value = true
  clockNotice.value = 'Temps ecoule. Match termine.'
  clockNoticeError.value = true
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

  if (isOnline.value) {
    void submitOnlineMove(move)
    return
  }

  applyAndRecord(move)
  triggerAiMove()
}

const handleAiMove = () => {
  triggerAiMove()
}

const resetMatch = () => {
  if (aiTimeout) {
    clearTimeout(aiTimeout)
    aiTimeout = null
  }
  board.value = createInitialBoard()
  sideToMove.value = 'white'
  selectedSquare.value = null
  lastMove.value = null
  moveHistory.value = []
  aiThinking.value = false
  updateAnalysis()
}

const handleAbandon = async () => {
  if (isOnline.value) {
    if (matchEnded.value) return
    await handleFinishMatch('resign')
    return
  }
  await router.push('/tableau-de-bord')
}

const handleDraw = async () => {
  if (isOnline.value) {
    if (matchEnded.value) return
    await handleFinishMatch('draw')
    return
  }
  await router.push('/tableau-de-bord')
}

const handleReset = () => {
  if (isOnline.value) {
    onlineError.value = 'Action indisponible en multijoueur.'
    return
  }
  localMatchEnded.value = false
  resetMatch()
  resetLocalClocks()
}

const handleLeaveMatch = async () => {
  await router.push('/tableau-de-bord')
}

watch([board, sideToMove, difficulty], updateAnalysis, { immediate: true })

watch(
  () => onlineMessages.value.length,
  async () => {
    await nextTick()
    if (chatListRef.value) {
      chatListRef.value.scrollTop = chatListRef.value.scrollHeight
    }
  },
)

onBeforeUnmount(() => {
  stopOnlineStream()
  stopOnlinePolling()
  stopClock()
  if (aiTimeout) {
    clearTimeout(aiTimeout)
    aiTimeout = null
  }
})

const squares = computed(() =>
  boardRanks.flatMap((rank, rowIndex) =>
    boardFiles.map((file, colIndex) => {
      const piece = board.value[rowIndex]?.[colIndex] ?? ''
      const squareId = `${file}${rank}`
      const isDark = (rowIndex + colIndex) % 2 === 1
      const tone = piece ? (piece === piece.toUpperCase() ? 'light' : 'dark') : ''
      const isSelected = selectedSquare.value === squareId
      const isTarget = targetSquares.value.has(squareId)
      const isLast = lastMove.value?.from === squareId || lastMove.value?.to === squareId
      const isArrival = lastMove.value?.to === squareId

      return {
        id: squareId,
        piece,
        symbol: pieceSymbols[piece] ?? '',
        dark: isDark,
        tone,
        isSelected,
        isTarget,
        isLast,
        isArrival,
      }
    }),
  ),
)
</script>

<template>
  <DashboardLayout
    eyebrow="Partie"
    :title="`Match ${matchId || 'Libre'}`"
    :subtitle="`Mode ${modeLabel} - ${opponent} - Cadence ${timeControl}`"
  >
    <section class="game-layout">
      <div class="game-stack">
        <div class="panel game-board">
          <div class="panel-header">
            <div>
              <p class="panel-title">Plateau</p>
              <h3 class="panel-headline">Tour: {{ sideToMove === 'white' ? 'Blancs' : 'Noirs' }}</h3>
            </div>
            <span class="badge-soft">{{ mode === 'IA' ? 'IA active' : mode === 'JcJ' ? 'En ligne' : 'Local' }}</span>
          </div>

          <p v-if="onlineNote" class="form-message form-message--success">{{ onlineNote }}</p>
          <p v-if="onlineError" class="form-message form-message--error">{{ onlineError }}</p>
          <p
            v-if="clockNotice"
            :class="['form-message', clockNoticeError ? 'form-message--error' : 'form-message--success']"
          >
            {{ clockNotice }}
          </p>

          <div class="player-strip">
            <div
              :class="['player-chip', sideToMove === 'white' && 'player-chip--active']"
            >
              <div class="player-avatar">{{ initialsFrom(whiteLabel) }}</div>
              <div class="player-info">
                <p class="player-name">{{ whiteLabel }}</p>
                <p class="player-meta">Blancs</p>
              </div>
              <div :class="['player-clock', clockTone(whiteClockMs)]">{{ whiteClockLabel }}</div>
            </div>
            <span class="vs-pill">VS</span>
            <div
              :class="['player-chip', sideToMove === 'black' && 'player-chip--active']"
            >
              <div class="player-avatar">{{ initialsFrom(blackLabel) }}</div>
              <div class="player-info">
                <p class="player-name">{{ blackLabel }}</p>
                <p class="player-meta">Noirs</p>
              </div>
              <div :class="['player-clock', clockTone(blackClockMs)]">{{ blackClockLabel }}</div>
            </div>
          </div>

          <div class="board-wrap">
            <div class="board">
              <button
                v-for="square in squares"
                :key="square.id"
                type="button"
                :class="[
                  'square',
                  square.dark ? 'square--dark' : 'square--light',
                  square.isLast ? 'square--last' : '',
                  square.isArrival ? 'square--arrival' : '',
                  square.isSelected ? 'square--selected' : '',
                  square.isTarget ? 'square--target' : '',
                ]"
                @click="handleSquareClick(square.id, square.piece)"
              >
                <span
                  v-if="square.piece"
                  :class="[
                    'piece',
                    square.tone === 'light' ? 'piece--light' : 'piece--dark',
                    square.isArrival ? 'piece--impact' : '',
                  ]"
                >
                  {{ square.symbol }}
                </span>
              </button>
            </div>
          </div>
        </div>

        <div class="panel game-actions">
          <div>
            <p class="panel-title">Actions</p>
            <h3 class="panel-headline">Fin de match</h3>
            <p class="panel-sub">Gerez la partie en cours en un clic.</p>
          </div>
          <button class="button-ghost game-action" type="button" :disabled="matchEnded" @click="handleAbandon">
            Abandonner
          </button>
          <button class="button-ghost game-action" type="button" :disabled="matchEnded" @click="handleDraw">
            Match Nul
          </button>
          <button class="button-primary game-action" type="button" :disabled="isOnline" @click="handleReset">
            Reinitialiser
          </button>

          <p
            v-if="finishNotice"
            :class="['form-message', finishNoticeError ? 'form-message--error' : 'form-message--success']"
          >
            {{ finishNotice }}
          </p>

          <div v-if="isOnline && matchEnded" class="game-rematch">
            <p class="panel-title">Revanche</p>
            <p class="panel-sub">Proposez une nouvelle partie a votre adversaire.</p>
            <div class="game-rematch-actions">
              <button class="button-primary" type="button" @click="handleRematch">
                Proposer une revanche
              </button>
              <button class="button-ghost" type="button" @click="handleLeaveMatch">
                Retour au tableau
              </button>
            </div>
            <p
              v-if="rematchNotice"
              :class="['form-message', rematchNoticeError ? 'form-message--error' : 'form-message--success']"
            >
              {{ rematchNotice }}
            </p>
          </div>
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
            <p class="metric-label">{{ sideLabel }}</p>
            <p class="metric-value">{{ playerSide === 'white' ? 'Blancs' : 'Noirs' }}</p>
          </div>
          <div>
            <p class="metric-label">{{ opponentLabel }}</p>
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

        <div class="panel-subsection game-analysis">
          <p class="panel-title">Analyse IA</p>
          <div class="analysis-grid">
            <div class="metric-card">
              <p class="metric-label">Evaluation</p>
              <p class="metric-value">{{ evaluationValue }}</p>
              <p class="metric-note">{{ evaluationNote }}</p>
            </div>
            <div class="metric-card">
              <p class="metric-label">Ligne suggeree</p>
              <p class="metric-value">{{ suggestedLine }}</p>
              <p class="metric-note">Proposition issue du moteur local.</p>
            </div>
          </div>
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

        <div v-if="isOnline" class="panel-subsection match-chat">
          <p class="panel-title">Chat</p>
          <div ref="chatListRef" class="chat-list">
            <div v-if="!onlineMessages.length" class="empty-state">Aucun message.</div>
            <div v-for="message in onlineMessages" :key="message.id" class="chat-item">
              <div class="chat-row">
                <span class="chat-name">{{ message.userName }}</span>
                <span class="chat-time">{{ formatChatTime(message.createdAt) }}</span>
              </div>
              <p class="chat-text">{{ message.message }}</p>
            </div>
          </div>
          <div class="chat-input-row">
            <input
              v-model="chatInput"
              type="text"
              placeholder="Ecrire un message..."
              :disabled="chatPending || onlineLoading"
              @keydown.enter.prevent="handleSendChat"
            />
            <button
              class="button-primary"
              type="button"
              :disabled="chatPending || onlineLoading || !chatInput.trim()"
              @click="handleSendChat"
            >
              {{ chatPending ? 'Envoi...' : 'Envoyer' }}
            </button>
          </div>
          <p v-if="chatError" class="form-message form-message--error">{{ chatError }}</p>
        </div>
      </div>
    </section>
  </DashboardLayout>
</template>

