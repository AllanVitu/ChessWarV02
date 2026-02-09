<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import DashboardLayout from '@/components/DashboardLayout.vue'
import { clearMatchesCache, getMatchById, type MatchRecord } from '@/lib/matchesDb'
import { getCurrentUser } from '@/lib/auth'
import {
  addMatchMessage,
  addMatchMove,
  finishMatch,
  getMatchRoom,
  markMatchReady,
  openMatchSocket,
  openMatchStream,
  sendMatchPresence,
  type MatchOnlineState,
  type MatchSocketMessage,
  type MatchStatus,
  type OnlineMessage,
  type OnlineMove,
} from '@/lib/matchOnline'
import { createMatchInvite } from '@/lib/notifications'
import {
  applyMove,
  createInitialBoard,
  formatMove,
  getLegalMoves,
  getAiMove,
  type DifficultyKey,
  type Move,
  type Side,
} from '@/lib/chessEngine'
import { trackEvent } from '@/lib/telemetry'
import { getPieceImage } from '@/lib/pieceAssets'

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
const onlineWhiteReadyAt = ref<string | null>(null)
const onlineBlackReadyAt = ref<string | null>(null)
const onlineStatus = ref<MatchStatus>('waiting')
const onlineMode = ref<MatchRecord['mode'] | null>(null)
const onlineOpponent = ref<string | null>(null)
const onlineTimeControl = ref<string | null>(null)
const onlineLoading = ref(false)
const onlineError = ref('')
const onlinePending = ref(false)
let onlineStream: EventSource | null = null
let onlineSocket: WebSocket | null = null
let onlineRefreshPending = false
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
let trackedMatch = ''
const localSeed = ref(Math.floor(Math.random() * 1000))
const aiPending = ref(false)
let aiTimer: ReturnType<typeof setTimeout> | null = null
const serverOffsetMs = ref(0)
const readyCountdown = ref(0)
let readyTimer: ReturnType<typeof setInterval> | null = null
let presenceTimer: ReturnType<typeof setInterval> | null = null

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
const forceOnline = computed(() => isUuid(matchId.value))
const queryValue = (value: unknown) => {
  if (Array.isArray(value)) return value[0] ?? ''
  return typeof value === 'string' ? value : ''
}

const localModeQuery = computed(() => queryValue(route.query.mode).toLowerCase())
const localMode = computed<MatchRecord['mode']>(() => {
  if (localModeQuery.value === 'ia') return 'IA'
  if (localModeQuery.value === 'histoire') return 'Histoire'
  return 'Local'
})
const localSide = computed<'Blancs' | 'Noirs' | 'Aleatoire'>(() => {
  const value = queryValue(route.query.side)
  if (value === 'Blancs' || value === 'Noirs' || value === 'Aleatoire') return value
  return 'Aleatoire'
})
const localTimeControl = computed(() => {
  const value = queryValue(route.query.time).trim()
  if (!value) return '10+0'
  if (/^\d+(?:\+\d+)?$/.test(value)) return value
  return '10+0'
})
const localDifficulty = computed<DifficultyKey>(() => {
  const value = queryValue(route.query.difficulty)
  if (value === 'facile' || value === 'intermediaire' || value === 'difficile' || value === 'maitre') {
    return value
  }
  return 'intermediaire'
})
const localChapter = computed(() => {
  const value = Number.parseInt(queryValue(route.query.chapter), 10)
  return Number.isFinite(value) ? value : 0
})

const mode = computed<MatchRecord['mode']>(() => {
  if (!matchId.value) return localMode.value
  return forceOnline.value ? 'JcJ' : match.value?.mode ?? onlineMode.value ?? 'JcJ'
})
const isOnline = computed(() => mode.value === 'JcJ')
const isAiMatch = computed(() => mode.value === 'IA' || mode.value === 'Histoire')
const modeLabel = computed(() => (mode.value === 'JcJ' ? 'En ligne' : mode.value))
const opponent = computed(() => {
  if (isAiMatch.value) return 'IA'
  const direct = match.value?.opponent ?? onlineOpponent.value
  if (direct) return direct
  return 'Adversaire'
})
const timeControl = computed(() => {
  if (!matchId.value) return localTimeControl.value
  return match.value?.timeControl ?? onlineTimeControl.value ?? '10+0'
})
const sideLabel = computed(() =>
  mode.value === 'Local' && !isAiMatch.value ? 'Camp joueur 1' : 'Votre couleur',
)
const opponentLabel = computed(() =>
  mode.value === 'Local' && !isAiMatch.value ? 'Joueur 2' : 'Adversaire',
)
const modeSubtitle = computed(() => {
  if (mode.value === 'Histoire' && localChapter.value) {
    return `Mode ${modeLabel.value} - Chapitre ${localChapter.value} - Cadence ${timeControl.value}`
  }
  return `Mode ${modeLabel.value} - ${opponent.value} - Cadence ${timeControl.value}`
})
const onlineNote = computed(() => {
  if (!isOnline.value) return ''
  if (onlineLoading.value) return 'Connexion au match en ligne...'
  if (onlinePending.value) return 'Envoi du coup...'
  if (onlineStatus.value === 'waiting') return 'En attente des joueurs.'
  if (onlineStatus.value === 'ready') {
    return readyCountdown.value > 0
      ? `Demarrage dans ${readyCountdown.value}s`
      : 'Demarrage en cours...'
  }
  if (onlineStatus.value === 'finished' || onlineStatus.value === 'aborted') {
    return 'Match termine. Vous pouvez proposer une revanche.'
  }
  return sideToMove.value === playerSide.value ? 'A vous de jouer.' : "En attente du coup adverse."
})


const ensureCurrentUserId = async () => {
  if (currentUserId.value) return
  const user = await getCurrentUser()
  currentUserId.value = user?.id ?? ''
}

watch(
  matchId,
  async () => {
    const nextMatchId = matchId.value || 'local'
    if (trackedMatch !== nextMatchId) {
      trackedMatch = nextMatchId
      trackEvent({
        name: 'start_game',
        payload: {
          matchId: nextMatchId,
          mode: mode.value,
        },
      })
    }

    stopOnlineSocket()
    stopOnlineStream()
    stopOnlinePolling()
    stopClock()
    stopAiTimer()
    stopReadyTimer()
    stopPresenceTimer()
    onlineMoves.value = []
    onlineMessages.value = []
    onlineError.value = ''
    onlinePending.value = false
    onlineSide.value = 'white'
    onlineSideToMove.value = 'white'
    onlineWhiteId.value = null
    onlineBlackId.value = null
    onlineWhiteReadyAt.value = null
    onlineBlackReadyAt.value = null
    onlineStatus.value = 'waiting'
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
    serverOffsetMs.value = 0
    readyCountdown.value = 0
    if (!matchId.value) {
      match.value = null
      resetLocalMatchState()
      return
    }

    const shouldLoadOnline = forceOnline.value
    if (shouldLoadOnline) {
      onlineMode.value = 'JcJ'
    }

    match.value = await getMatchById(matchId.value)
    if (match.value?.mode === 'JcJ') {
      await loadOnlineMatch()
    } else if (match.value) {
      resetLocalMatchState(false)
    } else if (shouldLoadOnline) {
      await loadOnlineMatch()
    }
  },
  { immediate: true },
)

const localConfigKey = computed(
  () =>
    `${localMode.value}|${localSide.value}|${localTimeControl.value}|${localDifficulty.value}|${localChapter.value}`,
)

watch(localConfigKey, () => {
  if (matchId.value) return
  resetLocalMatchState()
})

const sidePreference = computed(() => {
  if (match.value?.side) return match.value.side
  if (!matchId.value) return localSide.value
  return 'Aleatoire'
})
const playerSide = computed<Side>(() => {
  if (isOnline.value) return onlineSide.value
  if (sidePreference.value === 'Blancs') return 'white'
  if (sidePreference.value === 'Noirs') return 'black'
  const seed = matchId.value ? Number.parseInt(matchId.value.slice(-1) || '0', 10) : localSeed.value
  return seed % 2 === 0 ? 'white' : 'black'
})
const aiSide = computed<Side | null>(() => (isAiMatch.value ? (playerSide.value === 'white' ? 'black' : 'white') : null))

const matchEnded = computed(() =>
  isOnline.value ? ['finished', 'aborted'].includes(onlineStatus.value) : localMatchEnded.value,
)
const opponentId = computed(() => {
  if (!isOnline.value) return ''
  return playerSide.value === 'white' ? onlineBlackId.value ?? '' : onlineWhiteId.value ?? ''
})

const playerReady = computed(() => {
  if (!isOnline.value) return false
  return playerSide.value === 'white' ? !!onlineWhiteReadyAt.value : !!onlineBlackReadyAt.value
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
    return onlineStatus.value === 'started' && !onlineLoading.value && !onlinePending.value
  }
  return !localMatchEnded.value
})

const board = ref(createInitialBoard())
const sideToMove = ref<Side>('white')
const selectedSquare = ref<string | null>(null)
const lastMove = ref<{ from: string; to: string } | null>(null)
const moveHistory = ref<{ ply: number; side: Side; notation: string }[]>([])

const boardFiles = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
const boardRanks = [8, 7, 6, 5, 4, 3, 2, 1]
const squareToCoords = (square: string) => {
  const file = square[0] ?? ''
  const rank = Number(square[1])
  const col = boardFiles.indexOf(file)
  return { row: 8 - rank, col: col === -1 ? 0 : col }
}
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

const pieceNames: Record<string, string> = {
  p: 'pion noir',
  r: 'tour noire',
  n: 'cavalier noir',
  b: 'fou noir',
  q: 'dame noire',
  k: 'roi noir',
  P: 'pion blanc',
  R: 'tour blanche',
  N: 'cavalier blanc',
  B: 'fou blanc',
  Q: 'dame blanche',
  K: 'roi blanc',
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
      onlineStatus.value === 'started' &&
      !onlineLoading.value &&
      !onlinePending.value &&
      sideToMove.value === playerSide.value
    )
  }
  if (localMatchEnded.value) return false
  if (isAiMatch.value) {
    return sideToMove.value === playerSide.value && !aiPending.value
  }
  return true
})

const whiteLabel = computed(() => {
  if (mode.value === 'Local' && !isAiMatch.value) return 'Joueur 1'
  if (isAiMatch.value) return playerSide.value === 'white' ? 'Vous' : 'IA'
  return playerSide.value === 'white' ? 'Vous' : opponent.value
})

const blackLabel = computed(() => {
  if (mode.value === 'Local' && !isAiMatch.value) return 'Joueur 2'
  if (isAiMatch.value) return playerSide.value === 'black' ? 'Vous' : 'IA'
  return playerSide.value === 'black' ? 'Vous' : opponent.value
})

const aiDifficultyLabel = computed(() => {
  const labels: Record<DifficultyKey, string> = {
    facile: 'Facile',
    intermediaire: 'Intermediaire',
    difficile: 'Difficile',
    maitre: 'Maitre',
  }
  return labels[localDifficulty.value] ?? 'Intermediaire'
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
  onlineWhiteReadyAt.value = state.whiteReadyAt ?? null
  onlineBlackReadyAt.value = state.blackReadyAt ?? null
  onlineStatus.value = state.status ?? 'waiting'
  onlineMode.value = (state.mode as MatchRecord['mode'] | null) ?? 'JcJ'
  if (state.opponent) {
    onlineOpponent.value = state.opponent
  }
  if (state.timeControl) {
    onlineTimeControl.value = state.timeControl
  }
  sideToMove.value = state.sideToMove
  onlinePending.value = false
  updateServerOffset(state)
  applyOnlineMoves(onlineMoves.value)
  syncOnlineClocks(state)
  syncReadyCountdown(state)
}

const getServerNow = () => Date.now() + serverOffsetMs.value

const updateServerOffset = (state: MatchOnlineState) => {
  if (!state.serverTime) return
  const server = new Date(state.serverTime).getTime()
  if (!Number.isFinite(server)) return
  serverOffsetMs.value = server - Date.now()
}

const stopClock = () => {
  if (clockTimer) {
    clearInterval(clockTimer)
    clockTimer = null
  }
}

const stopReadyTimer = () => {
  if (readyTimer) {
    clearInterval(readyTimer)
    readyTimer = null
  }
}

const stopPresenceTimer = () => {
  if (presenceTimer) {
    clearInterval(presenceTimer)
    presenceTimer = null
  }
}

const stopAiTimer = () => {
  if (aiTimer) {
    clearTimeout(aiTimer)
    aiTimer = null
  }
  aiPending.value = false
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
  clockTickAt.value = isOnline.value ? getServerNow() : Date.now()
  clockTimer = setInterval(() => {
    if (!clockActive.value || matchEnded.value) {
      clockTickAt.value = isOnline.value ? getServerNow() : Date.now()
      return
    }
    const now = isOnline.value ? getServerNow() : Date.now()
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
  const now = isOnline.value ? getServerNow() : Date.now()
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

const resetLocalMatchState = (refreshSeed = true) => {
  stopAiTimer()
  stopClock()
  board.value = createInitialBoard()
  sideToMove.value = 'white'
  selectedSquare.value = null
  lastMove.value = null
  moveHistory.value = []
  if (refreshSeed) {
    localSeed.value = Math.floor(Math.random() * 1000)
  }
  resetLocalClocks()
  queueAiMove()
}

const queueAiMove = () => {
  if (!isAiMatch.value || !aiSide.value) return
  if (matchEnded.value || localMatchEnded.value) return
  if (sideToMove.value !== aiSide.value) return
  if (aiPending.value) return

  aiPending.value = true
  const delay = 450 + Math.floor(Math.random() * 650)
  aiTimer = setTimeout(() => {
    aiTimer = null
    if (!isAiMatch.value || !aiSide.value) {
      aiPending.value = false
      return
    }
    if (matchEnded.value || localMatchEnded.value || sideToMove.value !== aiSide.value) {
      aiPending.value = false
      return
    }
    const move = getAiMove(board.value, aiSide.value, localDifficulty.value)
    aiPending.value = false
    if (!move) {
      localMatchEnded.value = true
      clockNotice.value = 'IA bloquee. Match termine.'
      clockNoticeError.value = true
      stopClock()
      return
    }
    applyAndRecord(move)
  }, delay)
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
  const startAt = parseTimestamp(state.startAt ?? state.createdAt) ?? getServerNow()
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

  if (state.status === 'started') {
    const elapsed = Math.max(0, getServerNow() - lastTime)
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
    state.status === 'started' &&
    (!state.moves || state.moves.length === 0) &&
    (whiteLeft <= 0 || blackLeft <= 0)
  ) {
    whiteLeft = initialMs
    blackLeft = initialMs
  }

  whiteClockMs.value = whiteLeft
  blackClockMs.value = blackLeft
  clockTickAt.value = Date.now()
  timeoutTriggered.value = state.status !== 'started'
  checkTimeout()

  if (state.status === 'started') {
    startClock()
  } else {
    stopClock()
  }
}

const syncReadyCountdown = (state: MatchOnlineState) => {
  if (state.status !== 'ready' || !state.startAt) {
    readyCountdown.value = 0
    stopReadyTimer()
    return
  }

  const startTime = new Date(state.startAt).getTime()
  if (!Number.isFinite(startTime)) {
    readyCountdown.value = 0
    stopReadyTimer()
    return
  }

  const compute = () => {
    const diff = Math.ceil((startTime - getServerNow()) / 1000)
    readyCountdown.value = Math.max(0, diff)
    if (readyCountdown.value <= 0) {
      stopReadyTimer()
    }
  }

  compute()
  if (!readyTimer) {
    readyTimer = setInterval(compute, 250)
  }
}

const stopOnlineSocket = () => {
  if (!onlineSocket) return
  const socket = onlineSocket
  onlineSocket = null
  socket.close()
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

const refreshOnlineState = async (silent = false) => {
  if (!matchId.value || onlineRefreshPending) return
  onlineRefreshPending = true
  try {
    const state = await getMatchRoom(matchId.value)
    applyOnlineState(state)
    if (onlineError.value) {
      onlineError.value = ''
    }
  } catch (error) {
    if (!silent) {
      onlineError.value = (error as Error).message
    }
  } finally {
    onlineRefreshPending = false
  }
}

const handleSocketMessage = async (payload: MatchSocketMessage) => {
  if (!payload || payload.matchId !== matchId.value) return
  if (payload.type === 'state' && payload.match) {
    applyOnlineState(payload.match)
    if (onlineError.value) {
      onlineError.value = ''
    }
    return
  }
  if (payload.type === 'match-update') {
    await refreshOnlineState()
    return
  }
  if (payload.type === 'error') {
    onlineError.value = payload.message || 'Erreur temps reel.'
  }
}

const startOnlinePolling = () => {
  if (onlinePollTimer) return
  onlinePollTimer = setInterval(async () => {
    await refreshOnlineState(true)
  }, 3000)
}

const startPresenceTimer = () => {
  if (presenceTimer || !matchId.value) return
  presenceTimer = setInterval(async () => {
    if (!matchId.value) return
    try {
      const state = await sendMatchPresence(matchId.value)
      applyOnlineState(state)
    } catch {
      // Ignore presence failures.
    }
  }, 8000)
}

const startOnlineStream = () => {
  if (!matchId.value) return
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
}

const startOnlineRealtime = () => {
  if (!matchId.value) return
  stopOnlinePolling()
  stopOnlineStream()
  stopOnlineSocket()
  const socket = openMatchSocket(
    matchId.value,
    (payload) => {
      void handleSocketMessage(payload)
    },
    () => {
      if (!onlineError.value) {
        onlineError.value = 'Connexion temps reel interrompue.'
      }
      startOnlineStream()
    },
  )

  if (!socket) {
    startOnlineStream()
    return
  }

  onlineSocket = socket
  socket.addEventListener('close', () => {
    if (onlineSocket !== socket) return
    onlineSocket = null
    if (!onlineError.value) {
      onlineError.value = 'Connexion temps reel interrompue.'
    }
    startOnlineStream()
  })
}

const loadOnlineMatch = async () => {
  if (!matchId.value) return
  onlineLoading.value = true
  onlineError.value = ''
  stopOnlinePolling()
  stopOnlineStream()
  stopOnlineSocket()
  await ensureCurrentUserId()
  try {
    const state = await getMatchRoom(matchId.value)
    applyOnlineState(state)
    startOnlineRealtime()
    startPresenceTimer()
  } catch (error) {
    onlineError.value = (error as Error).message
    startOnlinePolling()
  } finally {
    onlineLoading.value = false
  }
}

const handleReady = async () => {
  if (!matchId.value || !isOnline.value) return
  try {
    const state = await markMatchReady(matchId.value)
    applyOnlineState(state)
  } catch (error) {
    onlineError.value = (error as Error).message
  }
}

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
  if (!isOnline.value && isAiMatch.value) {
    queueAiMove()
  }
}

const submitOnlineMove = async (move: Move) => {
  if (!matchId.value) return
  if (onlineStatus.value !== 'started') return
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
    trackEvent({
      name: 'finish_game',
      payload: {
        matchId: matchId.value,
        result,
      },
    })
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
  localMatchEnded.value = true
  clockNotice.value = 'Temps ecoule. Match termine.'
  clockNoticeError.value = true
  trackEvent({
    name: 'finish_game',
    payload: {
      matchId: matchId.value || 'local',
      result: 'timeout',
    },
  })
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
}

const handleAbandon = async () => {
  if (isOnline.value) {
    if (matchEnded.value) return
    await handleFinishMatch('resign')
    return
  }
  trackEvent({
    name: 'finish_game',
    payload: {
      matchId: matchId.value || 'local',
      result: 'resign',
    },
  })
  await router.push('/dashboard')
}

const handleDraw = async () => {
  if (isOnline.value) {
    if (matchEnded.value) return
    await handleFinishMatch('draw')
    return
  }
  trackEvent({
    name: 'finish_game',
    payload: {
      matchId: matchId.value || 'local',
      result: 'draw',
    },
  })
  await router.push('/dashboard')
}

const handleResetMatch = () => {
  if (isOnline.value) return
  resetLocalMatchState()
}

const handleLeaveMatch = async () => {
  await router.push('/dashboard')
}

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
  stopOnlineSocket()
  stopOnlineStream()
  stopOnlinePolling()
  stopClock()
  stopAiTimer()
  stopReadyTimer()
  stopPresenceTimer()
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
      const ariaLabel = piece
        ? `${squareId} ${pieceNames[piece] ?? 'piece'}`
        : `${squareId} vide`

      return {
        id: squareId,
        piece,
        symbol: pieceSymbols[piece] ?? '',
        image: piece ? getPieceImage(piece) : '',
        dark: isDark,
        tone,
        isSelected,
        isTarget,
        isLast,
        isArrival,
        ariaLabel,
      }
    }),
  ),
)
</script>

<template>
  <DashboardLayout eyebrow="Partie" :title="`Match ${matchId || 'Libre'}`" :subtitle="modeSubtitle">
    <section class="game-layout">
      <div class="game-stack">
        <div class="panel game-board">
          <div class="panel-header">
            <div>
              <p class="panel-title">Plateau</p>
              <h3 class="panel-headline">Tour: {{ sideToMove === 'white' ? 'Blancs' : 'Noirs' }}</h3>
            </div>
            <span class="badge-soft">{{ mode === 'JcJ' ? 'En ligne' : 'Local' }}</span>
          </div>

          <p v-if="onlineNote" class="form-message form-message--success">{{ onlineNote }}</p>
          <p v-if="onlineError" class="form-message form-message--error">{{ onlineError }}</p>
          <p v-if="clockNotice"
            :class="['form-message', clockNoticeError ? 'form-message--error' : 'form-message--success']">
            {{ clockNotice }}
          </p>

          <div class="player-strip">
            <div :class="['player-chip', sideToMove === 'white' && 'player-chip--active']">
              <div class="player-avatar">{{ initialsFrom(whiteLabel) }}</div>
              <div class="player-info">
                <p class="player-name">{{ whiteLabel }}</p>
                <p class="player-meta">Blancs</p>
              </div>
              <div :class="['player-clock', clockTone(whiteClockMs)]">{{ whiteClockLabel }}</div>
            </div>
            <span class="vs-pill">VS</span>
            <div :class="['player-chip', sideToMove === 'black' && 'player-chip--active']">
              <div class="player-avatar">{{ initialsFrom(blackLabel) }}</div>
              <div class="player-info">
                <p class="player-name">{{ blackLabel }}</p>
                <p class="player-meta">Noirs</p>
              </div>
              <div :class="['player-clock', clockTone(blackClockMs)]">{{ blackClockLabel }}</div>
            </div>
          </div>

          <div class="board-wrap">
            <div class="board" role="grid" aria-label="Plateau d'echecs">
              <button v-for="square in squares" :key="square.id" type="button" :class="[
                'square',
                square.dark ? 'square--dark' : 'square--light',
                square.isLast ? 'square--last' : '',
                square.isArrival ? 'square--arrival' : '',
                square.isSelected ? 'square--selected' : '',
                square.isTarget ? 'square--target' : '',
              ]" :aria-label="square.ariaLabel" :aria-pressed="square.isSelected" role="gridcell"
                @click="handleSquareClick(square.id, square.piece)">
                <img
                  v-if="square.piece && square.image"
                  :src="square.image"
                  alt=""
                  aria-hidden="true"
                  :class="[
                    'piece',
                    'piece-img',
                    square.tone === 'light' ? 'piece--light' : 'piece--dark',
                    square.isArrival ? 'piece--impact' : '',
                  ]"
                />
                <span
                  v-else-if="square.piece"
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
          <div v-if="isOnline && (onlineStatus === 'waiting' || onlineStatus === 'ready')" class="game-ready">
            <p class="panel-title">Synchronisation</p>
            <p class="panel-sub">
              {{ playerReady ? 'Presence confirmee.' : 'Confirmez votre presence pour lancer la partie.' }}
            </p>
            <button
              class="button-primary"
              type="button"
              :disabled="playerReady || onlineLoading"
              @click="handleReady"
            >
              {{ playerReady ? 'Pret' : 'Je suis pret' }}
            </button>
          </div>
          <button
            class="button-ghost game-action"
            type="button"
            :disabled="matchEnded || (isOnline && onlineStatus !== 'started')"
            @click="handleAbandon"
          >
            Abandonner
          </button>
          <button
            class="button-ghost game-action"
            type="button"
            :disabled="matchEnded || (isOnline && onlineStatus !== 'started')"
            @click="handleDraw"
          >
            Match Nul
          </button>
          <button class="button-ghost game-action" type="button" :disabled="isOnline" @click="handleResetMatch">
            Reinitialiser le match
          </button>
          <p v-if="finishNotice"
            :class="['form-message', finishNoticeError ? 'form-message--error' : 'form-message--success']">
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
            <p v-if="rematchNotice"
              :class="['form-message', rematchNoticeError ? 'form-message--error' : 'form-message--success']">
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
          <div v-if="isAiMatch">
            <p class="metric-label">Difficulte</p>
            <p class="metric-value">{{ aiDifficultyLabel }}</p>
          </div>
          <div v-if="mode === 'Histoire' && localChapter">
            <p class="metric-label">Chapitre</p>
            <p class="metric-value">#{{ localChapter }}</p>
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
            <input v-model="chatInput" type="text" placeholder="Ecrire un message..." aria-label="Message"
              :disabled="chatPending || onlineLoading" @keydown.enter.prevent="handleSendChat" />
            <button class="button-primary" type="button" :disabled="chatPending || onlineLoading || !chatInput.trim()"
              @click="handleSendChat">
              {{ chatPending ? 'Envoi...' : 'Envoyer' }}
            </button>
          </div>
          <p v-if="chatError" class="form-message form-message--error">{{ chatError }}</p>
        </div>
      </div>
    </section>
  </DashboardLayout>
</template>

