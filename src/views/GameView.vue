<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import DashboardLayout from "@/components/DashboardLayout.vue";
import {
  clearMatchesCache,
  getMatchById,
  type MatchRecord,
} from "@/lib/matchesDb";
import { getCurrentUser } from "@/lib/auth";
import { saveLocalGameRecord } from "@/lib/localDb";
import {
  disposeStockfishReview,
  reviewGameWithStockfish,
  type StockfishGameReview,
} from "@/lib/stockfishReview";
import { getPuzzleById, type PuzzleItem } from "@/lib/puzzles";
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
} from "@/lib/matchOnline";
import { createMatchInvite } from "@/lib/notifications";
import {
  applyMove,
  createInitialFen,
  exportPgnFromMoves,
  fenToBoard,
  formatMove,
  getGameStatus,
  getTurnFromFen,
  isValidFen,
  loadPgn,
  getLegalMoves,
  type BotPersona,
  type DifficultyKey,
  type Move,
  type Side,
} from "@/lib/chessEngine";
import { disposeAiWorker, requestAiMove } from "@/lib/chessAiWorker";
import { trackEvent } from "@/lib/telemetry";
import { getPieceImage } from "@/lib/pieceAssets";

const route = useRoute();
const router = useRouter();
const matchId = computed(() =>
  route.params.id ? String(route.params.id) : "",
);
const match = ref<MatchRecord | null>(null);
const onlineMoves = ref<OnlineMove[]>([]);
const onlineMessages = ref<OnlineMessage[]>([]);
const onlineSide = ref<"white" | "black">("white");
const onlineSideToMove = ref<"white" | "black">("white");
const onlineWhiteId = ref<string | null>(null);
const onlineBlackId = ref<string | null>(null);
const onlineWhiteReadyAt = ref<string | null>(null);
const onlineBlackReadyAt = ref<string | null>(null);
const onlineStatus = ref<MatchStatus>("waiting");
const onlineMode = ref<MatchRecord["mode"] | null>(null);
const onlineOpponent = ref<string | null>(null);
const onlineTimeControl = ref<string | null>(null);
const onlineLoading = ref(false);
const onlineError = ref("");
const onlinePending = ref(false);
let onlineStream: EventSource | null = null;
let onlineSocket: WebSocket | null = null;
let onlineRefreshPending = false;
const chatInput = ref("");
const chatPending = ref(false);
const chatError = ref("");
const chatListRef = ref<HTMLDivElement | null>(null);
const rematchNotice = ref("");
const rematchNoticeError = ref(false);
const finishNotice = ref("");
const finishNoticeError = ref(false);
const whiteClockMs = ref(0);
const blackClockMs = ref(0);
const clockTickAt = ref(0);
const timeoutTriggered = ref(false);
const clockNotice = ref("");
const clockNoticeError = ref(false);
let clockTimer: ReturnType<typeof setInterval> | null = null;
const localMatchEnded = ref(false);
const currentUserId = ref("");
let onlinePollTimer: ReturnType<typeof setInterval> | null = null;
let trackedMatch = "";
const localSeed = ref(Math.floor(Math.random() * 1000));
const aiPending = ref(false);
let aiTimer: ReturnType<typeof setTimeout> | null = null;
const serverOffsetMs = ref(0);
const readyCountdown = ref(0);
let readyTimer: ReturnType<typeof setInterval> | null = null;
let presenceTimer: ReturnType<typeof setInterval> | null = null;
type RealtimeTransport = "auto" | "ws" | "sse" | "poll";
type ActiveRealtimeTransport = Exclude<RealtimeTransport, "auto">;

const resolveRealtimeTransport = (): RealtimeTransport => {
  const raw = String(import.meta.env.VITE_MATCH_TRANSPORT || "")
    .trim()
    .toLowerCase();
  if (raw === "ws" || raw === "sse" || raw === "poll" || raw === "auto") {
    return raw;
  }
  return "auto";
};

const preferredRealtimeTransport = resolveRealtimeTransport();
const activeRealtimeTransport = ref<ActiveRealtimeTransport | null>(null);

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const forceOnline = computed(() => isUuid(matchId.value));
const queryValue = (value: unknown) => {
  if (Array.isArray(value)) return value[0] ?? "";
  return typeof value === "string" ? value : "";
};

const localModeQuery = computed(() =>
  queryValue(route.query.mode).toLowerCase(),
);
const localMode = computed<MatchRecord["mode"]>(() => {
  if (localModeQuery.value === "ia") return "IA";
  if (localModeQuery.value === "histoire") return "Histoire";
  return "Local";
});
const localSide = computed<"Blancs" | "Noirs" | "Aleatoire">(() => {
  const value = queryValue(route.query.side);
  if (value === "Blancs" || value === "Noirs" || value === "Aleatoire")
    return value;
  return "Aleatoire";
});
const localTimeControl = computed(() => {
  const value = queryValue(route.query.time).trim();
  if (!value) return "10+0";
  if (/^\d+(?:\+\d+)?$/.test(value)) return value;
  return "10+0";
});
const localDifficulty = computed<DifficultyKey>(() => {
  const value = queryValue(route.query.difficulty);
  if (
    value === "facile" ||
    value === "intermediaire" ||
    value === "difficile" ||
    value === "maitre"
  ) {
    return value;
  }
  return "intermediaire";
});
const localPersona = computed<BotPersona>(() => {
  const value = queryValue(route.query.persona).toLowerCase();
  if (
    value === "equilibre" ||
    value === "agressif" ||
    value === "solide" ||
    value === "fou"
  ) {
    return value;
  }
  return "equilibre";
});
const localChapter = computed(() => {
  const value = Number.parseInt(queryValue(route.query.chapter), 10);
  return Number.isFinite(value) ? value : 0;
});
const localPuzzleId = computed(() => queryValue(route.query.puzzle).trim());
const activePuzzle = computed<PuzzleItem | null>(() => {
  if (matchId.value) return null;
  if (!localPuzzleId.value) return null;
  return getPuzzleById(localPuzzleId.value);
});
const localStartFen = computed(() => {
  if (activePuzzle.value) return activePuzzle.value.fen;
  const fen = queryValue(route.query.fen).trim();
  if (fen && isValidFen(fen)) return fen;
  return createInitialFen();
});

const mode = computed<MatchRecord["mode"]>(() => {
  if (!matchId.value) return localMode.value;
  return forceOnline.value
    ? "JcJ"
    : (match.value?.mode ?? onlineMode.value ?? "JcJ");
});
const isOnline = computed(() => mode.value === "JcJ");
const isAiMatch = computed(
  () => mode.value === "IA" || mode.value === "Histoire",
);
const modeLabel = computed(() =>
  mode.value === "JcJ" ? "En ligne" : mode.value,
);
const opponent = computed(() => {
  if (isAiMatch.value) return "IA";
  const direct = match.value?.opponent ?? onlineOpponent.value;
  if (direct) return direct;
  return "Adversaire";
});
const timeControl = computed(() => {
  if (!matchId.value) return localTimeControl.value;
  return match.value?.timeControl ?? onlineTimeControl.value ?? "10+0";
});
const sideLabel = computed(() =>
  mode.value === "Local" && !isAiMatch.value
    ? "Camp joueur 1"
    : "Votre couleur",
);
const opponentLabel = computed(() =>
  mode.value === "Local" && !isAiMatch.value ? "Joueur 2" : "Adversaire",
);
const modeSubtitle = computed(() => {
  if (mode.value === "Histoire" && localChapter.value) {
    return `Mode ${modeLabel.value} - Chapitre ${localChapter.value} - Cadence ${timeControl.value}`;
  }
  if (!isOnline.value && activePuzzle.value) {
    return `Mode Puzzle - ${activePuzzle.value.title} - Cadence ${timeControl.value}`;
  }
  return `Mode ${modeLabel.value} - ${opponent.value} - Cadence ${timeControl.value}`;
});
const onlineNote = computed(() => {
  if (!isOnline.value) return "";
  if (onlineLoading.value) return "Connexion au match en ligne...";
  if (onlinePending.value) return "Envoi du coup...";
  if (onlineStatus.value === "waiting") return "En attente des joueurs.";
  if (onlineStatus.value === "ready") {
    return readyCountdown.value > 0
      ? `Demarrage dans ${readyCountdown.value}s`
      : "Demarrage en cours...";
  }
  if (onlineStatus.value === "finished" || onlineStatus.value === "aborted") {
    return "Match termine. Vous pouvez proposer une revanche.";
  }
  return sideToMove.value === playerSide.value
    ? "A vous de jouer."
    : "En attente du coup adverse.";
});
const realtimeTransportLabel = computed(() => {
  if (!isOnline.value) return "";
  if (activeRealtimeTransport.value === "ws") return "WebSocket";
  if (activeRealtimeTransport.value === "sse") return "SSE";
  if (activeRealtimeTransport.value === "poll") return "Polling";
  return "N/A";
});

const ensureCurrentUserId = async () => {
  if (currentUserId.value) return;
  const user = await getCurrentUser();
  currentUserId.value = user?.id ?? "";
};

watch(
  matchId,
  async () => {
    const nextMatchId = matchId.value || "local";
    if (trackedMatch !== nextMatchId) {
      trackedMatch = nextMatchId;
      trackEvent({
        name: "start_game",
        payload: {
          matchId: nextMatchId,
          mode: mode.value,
        },
      });
    }

    stopOnlineSocket();
    stopOnlineStream();
    stopOnlinePolling();
    stopClock();
    stopAiTimer();
    stopReadyTimer();
    stopPresenceTimer();
    onlineMoves.value = [];
    onlineMessages.value = [];
    onlineError.value = "";
    onlinePending.value = false;
    onlineSide.value = "white";
    onlineSideToMove.value = "white";
    onlineWhiteId.value = null;
    onlineBlackId.value = null;
    onlineWhiteReadyAt.value = null;
    onlineBlackReadyAt.value = null;
    onlineStatus.value = "waiting";
    onlineMode.value = null;
    onlineOpponent.value = null;
    onlineTimeControl.value = null;
    activeRealtimeTransport.value = null;
    chatInput.value = "";
    chatPending.value = false;
    chatError.value = "";
    rematchNotice.value = "";
    rematchNoticeError.value = false;
    finishNotice.value = "";
    finishNoticeError.value = false;
    whiteClockMs.value = 0;
    blackClockMs.value = 0;
    clockTickAt.value = 0;
    timeoutTriggered.value = false;
    clockNotice.value = "";
    clockNoticeError.value = false;
    localMatchEnded.value = false;
    serverOffsetMs.value = 0;
    readyCountdown.value = 0;
    reviewLoading.value = false;
    reviewError.value = "";
    reviewResult.value = null;
    if (!matchId.value) {
      match.value = null;
      resetLocalMatchState();
      return;
    }

    const shouldLoadOnline = forceOnline.value;
    if (shouldLoadOnline) {
      onlineMode.value = "JcJ";
    }

    match.value = await getMatchById(matchId.value);
    if (match.value?.mode === "JcJ") {
      await loadOnlineMatch();
    } else if (match.value) {
      resetLocalMatchState(false);
    } else if (shouldLoadOnline) {
      await loadOnlineMatch();
    }
  },
  { immediate: true },
);

const localConfigKey = computed(
  () =>
    `${localMode.value}|${localSide.value}|${localTimeControl.value}|${localDifficulty.value}|${localPersona.value}|${localChapter.value}|${localPuzzleId.value}|${localStartFen.value}`,
);

watch(localConfigKey, () => {
  if (matchId.value) return;
  resetLocalMatchState();
});

const sidePreference = computed(() => {
  if (match.value?.side) return match.value.side;
  if (!matchId.value) return localSide.value;
  return "Aleatoire";
});
const playerSide = computed<Side>(() => {
  if (isOnline.value) return onlineSide.value;
  if (sidePreference.value === "Blancs") return "white";
  if (sidePreference.value === "Noirs") return "black";
  const seed = matchId.value
    ? Number.parseInt(matchId.value.slice(-1) || "0", 10)
    : localSeed.value;
  return seed % 2 === 0 ? "white" : "black";
});
const aiSide = computed<Side | null>(() =>
  isAiMatch.value ? (playerSide.value === "white" ? "black" : "white") : null,
);

const matchEnded = computed(() =>
  isOnline.value
    ? ["finished", "aborted"].includes(onlineStatus.value)
    : localMatchEnded.value,
);
const opponentId = computed(() => {
  if (!isOnline.value) return "";
  return playerSide.value === "white"
    ? (onlineBlackId.value ?? "")
    : (onlineWhiteId.value ?? "");
});

const playerReady = computed(() => {
  if (!isOnline.value) return false;
  return playerSide.value === "white"
    ? !!onlineWhiteReadyAt.value
    : !!onlineBlackReadyAt.value;
});
const whiteReady = computed(() => !!onlineWhiteReadyAt.value);
const blackReady = computed(() => !!onlineBlackReadyAt.value);
const opponentReady = computed(() => {
  if (!isOnline.value) return false;
  return playerSide.value === "white" ? blackReady.value : whiteReady.value;
});

const parseTimeControl = (value: string) => {
  const trimmed = value.trim();
  const match = /^(\d+)(?:\+(\d+))?$/.exec(trimmed);
  if (!match) {
    return { initialMs: 10 * 60 * 1000, incrementMs: 0 };
  }
  const minutes = Math.max(1, Number.parseInt(match[1] ?? "10", 10));
  const increment = Math.max(0, Number.parseInt(match[2] ?? "0", 10));
  return { initialMs: minutes * 60 * 1000, incrementMs: increment * 1000 };
};

const clockConfig = computed(() => parseTimeControl(timeControl.value));

const formatClock = (ms: number) => {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

const clockTone = (ms: number) => {
  if (ms <= 10000) return "player-clock--danger";
  if (ms <= 30000) return "player-clock--warning";
  return "";
};

const whiteClockLabel = computed(() => formatClock(whiteClockMs.value));
const blackClockLabel = computed(() => formatClock(blackClockMs.value));

const clockActive = computed(() => {
  if (isOnline.value) {
    return (
      onlineStatus.value === "started" &&
      !onlineLoading.value &&
      !onlinePending.value
    );
  }
  return !localMatchEnded.value;
});

const gameFen = ref(createInitialFen());
const board = ref(fenToBoard(gameFen.value));
const sideToMove = ref<Side>(getTurnFromFen(gameFen.value));
const selectedSquare = ref<string | null>(null);
const lastMove = ref<{ from: string; to: string } | null>(null);
const moveHistory = ref<{ ply: number; side: Side; notation: string }[]>([]);
const rawMoves = ref<Array<{ from: string; to: string; promotion?: "q" | "r" | "b" | "n" }>>([]);
const gameStatus = computed(() => getGameStatus(gameFen.value));
const pgnValue = computed(() => exportPgnFromMoves(rawMoves.value));
const importFen = ref("");
const importPgn = ref("");
const analysisError = ref("");
const puzzleNotice = ref("");
const puzzleNoticeError = ref(false);
const puzzleSolved = ref(false);
const reviewLoading = ref(false);
const reviewError = ref("");
const reviewResult = ref<StockfishGameReview | null>(null);

type AnalysisNode = {
  id: string;
  parentId: string | null;
  fen: string;
  moveUci: string | null;
  notation: string | null;
  children: string[];
  ply: number;
};

const analysisRootId = "analysis-root";
const analysisNodes = ref<Record<string, AnalysisNode>>({});
const analysisCurrentId = ref(analysisRootId);
const analysisMainlinePath = ref<string[]>([analysisRootId]);
const analysisSelectedSquare = ref<string | null>(null);
let analysisNodeCounter = 0;

const boardFiles = ["a", "b", "c", "d", "e", "f", "g", "h"];
const boardRanks = [8, 7, 6, 5, 4, 3, 2, 1];
const pieceSymbols: Record<string, string> = {
  p: "p",
  r: "r",
  n: "n",
  b: "b",
  q: "q",
  k: "k",
  P: "P",
  R: "R",
  N: "N",
  B: "B",
  Q: "Q",
  K: "K",
};

const pieceNames: Record<string, string> = {
  p: "pion noir",
  r: "tour noire",
  n: "cavalier noir",
  b: "fou noir",
  q: "dame noire",
  k: "roi noir",
  P: "pion blanc",
  R: "tour blanche",
  N: "cavalier blanc",
  B: "fou blanc",
  Q: "dame blanche",
  K: "roi blanc",
};

const legalMoves = computed(() => getLegalMoves(gameFen.value, sideToMove.value));

watch(
  gameFen,
  (fen) => {
    board.value = fenToBoard(fen);
    sideToMove.value = getTurnFromFen(fen);
  },
  { immediate: true },
);

const movesFromSelected = computed(() => {
  if (!selectedSquare.value) return [];
  return legalMoves.value.filter((move) => move.from === selectedSquare.value);
});

const targetSquares = computed(
  () => new Set(movesFromSelected.value.map((move) => move.to)),
);

const nextAnalysisId = () => {
  analysisNodeCounter += 1;
  return `analysis-${analysisNodeCounter}`;
};

const rebuildAnalysisTree = () => {
  analysisNodeCounter = 0;
  const root: AnalysisNode = {
    id: analysisRootId,
    parentId: null,
    fen: createInitialFen(),
    moveUci: null,
    notation: null,
    children: [],
    ply: 0,
  };
  const nodes: Record<string, AnalysisNode> = {
    [analysisRootId]: root,
  };
  const mainline: string[] = [analysisRootId];
  let cursor = root;

  for (const move of rawMoves.value) {
    const applied = applyMove(cursor.fen, move);
    if (!applied.move) break;
    const id = nextAnalysisId();
    const node: AnalysisNode = {
      id,
      parentId: cursor.id,
      fen: applied.fen,
      moveUci: `${applied.move.from}${applied.move.to}${applied.move.promotion ?? ""}`,
      notation: formatMove(applied.move),
      children: [],
      ply: cursor.ply + 1,
    };
    nodes[id] = node;
    const parentNode = nodes[cursor.id];
    if (!parentNode) break;
    parentNode.children = [...parentNode.children, id];
    mainline.push(id);
    cursor = node;
  }

  analysisNodes.value = nodes;
  analysisMainlinePath.value = mainline;
  analysisCurrentId.value = mainline[mainline.length - 1] ?? analysisRootId;
  analysisSelectedSquare.value = null;
};

watch(
  rawMoves,
  () => {
    if (!isOnline.value) {
      rebuildAnalysisTree();
    }
    evaluatePuzzleProgress();
  },
  { deep: true, immediate: true },
);

const analysisCurrentNode = computed<AnalysisNode>(() => {
  return (
    analysisNodes.value[analysisCurrentId.value] ?? {
      id: analysisRootId,
      parentId: null,
      fen: createInitialFen(),
      moveUci: null,
      notation: null,
      children: [],
      ply: 0,
    }
  );
});

const analysisFen = computed(() => analysisCurrentNode.value.fen);
const analysisTurn = computed<Side>(() => getTurnFromFen(analysisFen.value));
const analysisBoard = computed(() => fenToBoard(analysisFen.value));
const analysisLegalMoves = computed(() =>
  getLegalMoves(analysisFen.value, analysisTurn.value),
);
const analysisMovesFromSelected = computed(() => {
  if (!analysisSelectedSquare.value) return [];
  return analysisLegalMoves.value.filter(
    (move) => move.from === analysisSelectedSquare.value,
  );
});
const analysisTargetSquares = computed(
  () => new Set(analysisMovesFromSelected.value.map((move) => move.to)),
);
const analysisChildren = computed(() =>
  analysisCurrentNode.value.children
    .map((id) => analysisNodes.value[id])
    .filter((node): node is AnalysisNode => Boolean(node)),
);

const analysisPath = computed(() => {
  const path: AnalysisNode[] = [];
  let node: AnalysisNode | undefined = analysisCurrentNode.value;
  while (node) {
    path.unshift(node);
    if (!node.parentId) break;
    node = analysisNodes.value[node.parentId];
  }
  return path;
});

const canUserMove = computed(() => {
  if (isOnline.value) {
    return (
      onlineStatus.value === "started" &&
      !onlineLoading.value &&
      !onlinePending.value &&
      sideToMove.value === playerSide.value
    );
  }
  if (localMatchEnded.value) return false;
  if (isAiMatch.value) {
    return sideToMove.value === playerSide.value && !aiPending.value;
  }
  return true;
});

const whiteLabel = computed(() => {
  if (mode.value === "Local" && !isAiMatch.value) return "Joueur 1";
  if (isAiMatch.value) return playerSide.value === "white" ? "Vous" : "IA";
  return playerSide.value === "white" ? "Vous" : opponent.value;
});

const blackLabel = computed(() => {
  if (mode.value === "Local" && !isAiMatch.value) return "Joueur 2";
  if (isAiMatch.value) return playerSide.value === "black" ? "Vous" : "IA";
  return playerSide.value === "black" ? "Vous" : opponent.value;
});

const aiDifficultyLabel = computed(() => {
  const labels: Record<DifficultyKey, string> = {
    facile: "Facile",
    intermediaire: "Intermediaire",
    difficile: "Difficile",
    maitre: "Maitre",
  };
  return labels[localDifficulty.value] ?? "Intermediaire";
});

const aiPersonaLabel = computed(() => {
  const labels: Record<BotPersona, string> = {
    equilibre: "Equilibre",
    agressif: "Agressif",
    solide: "Solide",
    fou: "Chaos",
  };
  return labels[localPersona.value] ?? "Equilibre";
});

const gamePhaseLabel = computed(() => {
  if (gameStatus.value.isCheckmate) return "Echec et mat";
  if (gameStatus.value.isStalemate) return "Pat";
  if (gameStatus.value.isDraw) return "Nulle";
  if (gameStatus.value.inCheck) {
    return sideToMove.value === "white"
      ? "Blancs en echec"
      : "Noirs en echec";
  }
  return "En cours";
});

const initialsFrom = (label: string) => {
  const clean = label.trim();
  if (!clean) return "?";
  return (
    clean
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
};

const applyOnlineMoves = (moves: OnlineMove[]) => {
  let nextFen = createInitialFen();
  const history: { ply: number; side: Side; notation: string }[] = [];
  const raw: Array<{ from: string; to: string; promotion?: "q" | "r" | "b" | "n" }> = [];
  let last: { from: string; to: string } | null = null;

  for (const move of moves) {
    const applied = applyMove(nextFen, {
      from: move.from,
      to: move.to,
      promotion: move.promotion,
    });
    if (!applied.move) {
      continue;
    }
    nextFen = applied.fen;
    raw.push({
      from: applied.move.from,
      to: applied.move.to,
      promotion: applied.move.promotion,
    });
    history.push({
      ply: move.ply,
      side: move.side === "white" ? "white" : "black",
      notation: move.notation || formatMove(applied.move),
    });
    last = { from: move.from, to: move.to };
  }

  gameFen.value = nextFen;
  rawMoves.value = raw;
  moveHistory.value = history;
  lastMove.value = last;
  selectedSquare.value = null;
};

const applyOnlineState = (state: MatchOnlineState) => {
  onlineMoves.value = state.moves ?? [];
  onlineMessages.value = state.messages ?? [];
  let resolvedSide = state.yourSide;
  if (currentUserId.value) {
    if (state.whiteId && state.whiteId === currentUserId.value) {
      resolvedSide = "white";
    } else if (state.blackId && state.blackId === currentUserId.value) {
      resolvedSide = "black";
    }
  }
  onlineSide.value = resolvedSide ?? "white";
  onlineSideToMove.value = state.sideToMove;
  onlineWhiteId.value = state.whiteId ?? null;
  onlineBlackId.value = state.blackId ?? null;
  onlineWhiteReadyAt.value = state.whiteReadyAt ?? null;
  onlineBlackReadyAt.value = state.blackReadyAt ?? null;
  onlineStatus.value = state.status ?? "waiting";
  onlineMode.value = (state.mode as MatchRecord["mode"] | null) ?? "JcJ";
  if (state.opponent) {
    onlineOpponent.value = state.opponent;
  }
  if (state.timeControl) {
    onlineTimeControl.value = state.timeControl;
  }
  onlinePending.value = false;
  updateServerOffset(state);
  applyOnlineMoves(onlineMoves.value);
  syncOnlineClocks(state);
  syncReadyCountdown(state);
};

const getServerNow = () => Date.now() + serverOffsetMs.value;

const updateServerOffset = (state: MatchOnlineState) => {
  if (!state.serverTime) return;
  const server = new Date(state.serverTime).getTime();
  if (!Number.isFinite(server)) return;
  serverOffsetMs.value = server - Date.now();
};

const stopClock = () => {
  if (clockTimer) {
    clearInterval(clockTimer);
    clockTimer = null;
  }
};

const stopReadyTimer = () => {
  if (readyTimer) {
    clearInterval(readyTimer);
    readyTimer = null;
  }
};

const stopPresenceTimer = () => {
  if (presenceTimer) {
    clearInterval(presenceTimer);
    presenceTimer = null;
  }
};

const stopAiTimer = () => {
  if (aiTimer) {
    clearTimeout(aiTimer);
    aiTimer = null;
  }
  aiPending.value = false;
};

const checkTimeout = () => {
  if (timeoutTriggered.value) return;
  if (whiteClockMs.value === 0 || blackClockMs.value === 0) {
    timeoutTriggered.value = true;
    void handleTimeout();
  }
};

const startClock = () => {
  stopClock();
  clockTickAt.value = isOnline.value ? getServerNow() : Date.now();
  clockTimer = setInterval(() => {
    if (!clockActive.value || matchEnded.value) {
      clockTickAt.value = isOnline.value ? getServerNow() : Date.now();
      return;
    }
    const now = isOnline.value ? getServerNow() : Date.now();
    const elapsed = now - clockTickAt.value;
    clockTickAt.value = now;
    if (sideToMove.value === "white") {
      whiteClockMs.value = Math.max(0, whiteClockMs.value - elapsed);
    } else {
      blackClockMs.value = Math.max(0, blackClockMs.value - elapsed);
    }
    checkTimeout();
  }, 250);
};

const commitClockTick = () => {
  if (!clockActive.value || matchEnded.value) return;
  const now = isOnline.value ? getServerNow() : Date.now();
  const elapsed = now - clockTickAt.value;
  clockTickAt.value = now;
  if (sideToMove.value === "white") {
    whiteClockMs.value = Math.max(0, whiteClockMs.value - elapsed);
  } else {
    blackClockMs.value = Math.max(0, blackClockMs.value - elapsed);
  }
};

const applyIncrement = (side: Side) => {
  const { incrementMs } = clockConfig.value;
  if (incrementMs <= 0) return;
  if (side === "white") {
    whiteClockMs.value += incrementMs;
  } else {
    blackClockMs.value += incrementMs;
  }
};

const resetLocalClocks = () => {
  const { initialMs } = clockConfig.value;
  whiteClockMs.value = initialMs;
  blackClockMs.value = initialMs;
  localMatchEnded.value = false;
  timeoutTriggered.value = false;
  clockNotice.value = "";
  clockNoticeError.value = false;
  clockTickAt.value = Date.now();
  startClock();
};

const resetLocalMatchState = (refreshSeed = true) => {
  stopAiTimer();
  stopClock();
  gameFen.value = localStartFen.value;
  selectedSquare.value = null;
  lastMove.value = null;
  moveHistory.value = [];
  rawMoves.value = [];
  importFen.value = localStartFen.value === createInitialFen() ? "" : localStartFen.value;
  importPgn.value = "";
  analysisError.value = "";
  puzzleNotice.value = "";
  puzzleNoticeError.value = false;
  puzzleSolved.value = false;
  reviewLoading.value = false;
  reviewError.value = "";
  reviewResult.value = null;
  if (refreshSeed) {
    localSeed.value = Math.floor(Math.random() * 1000);
  }
  resetLocalClocks();
  queueAiMove();
};

const queueAiMove = () => {
  if (!isAiMatch.value || !aiSide.value) return;
  if (matchEnded.value || localMatchEnded.value) return;
  if (sideToMove.value !== aiSide.value) return;
  if (aiPending.value) return;

  aiPending.value = true;
  const delay = 450 + Math.floor(Math.random() * 650);
  aiTimer = setTimeout(() => {
    aiTimer = null;
    void (async () => {
      if (!isAiMatch.value || !aiSide.value) {
        aiPending.value = false;
        return;
      }
      if (
        matchEnded.value ||
        localMatchEnded.value ||
        sideToMove.value !== aiSide.value
      ) {
        aiPending.value = false;
        return;
      }
      const move = await requestAiMove(
        gameFen.value,
        aiSide.value,
        localDifficulty.value,
        localPersona.value,
      ).catch(() => null);
      aiPending.value = false;
      if (!move) {
        localMatchEnded.value = true;
        clockNotice.value = "IA bloquee. Match termine.";
        clockNoticeError.value = true;
        stopClock();
        return;
      }
      applyAndRecord(move);
    })();
  }, delay);
};

const syncOnlineClocks = (state: MatchOnlineState) => {
  const { initialMs, incrementMs } = clockConfig.value;
  let whiteLeft = initialMs;
  let blackLeft = initialMs;
  const parseTimestamp = (value?: string | null) => {
    if (!value) return null;
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : null;
  };
  const startAt =
    parseTimestamp(state.startAt ?? state.createdAt) ?? getServerNow();
  let lastTime = startAt;

  for (const move of state.moves ?? []) {
    const moveTime = parseTimestamp(move.createdAt);
    if (!moveTime) continue;
    const elapsed = Math.max(0, moveTime - lastTime);
    if (move.side === "white") {
      whiteLeft = Math.max(0, whiteLeft - elapsed + incrementMs);
    } else {
      blackLeft = Math.max(0, blackLeft - elapsed + incrementMs);
    }
    lastTime = moveTime;
  }

  if (state.status === "started") {
    const elapsed = Math.max(0, getServerNow() - lastTime);
    if (state.sideToMove === "white") {
      whiteLeft = Math.max(0, whiteLeft - elapsed);
    } else {
      blackLeft = Math.max(0, blackLeft - elapsed);
    }
  }

  if (!Number.isFinite(whiteLeft) || !Number.isFinite(blackLeft)) {
    whiteLeft = initialMs;
    blackLeft = initialMs;
  }
  if (
    state.status === "started" &&
    (!state.moves || state.moves.length === 0) &&
    (whiteLeft <= 0 || blackLeft <= 0)
  ) {
    whiteLeft = initialMs;
    blackLeft = initialMs;
  }

  whiteClockMs.value = whiteLeft;
  blackClockMs.value = blackLeft;
  clockTickAt.value = Date.now();
  timeoutTriggered.value = state.status !== "started";
  checkTimeout();

  if (state.status === "started") {
    startClock();
  } else {
    stopClock();
  }
};

const syncReadyCountdown = (state: MatchOnlineState) => {
  if (state.status !== "ready" || !state.startAt) {
    readyCountdown.value = 0;
    stopReadyTimer();
    return;
  }

  const startTime = new Date(state.startAt).getTime();
  if (!Number.isFinite(startTime)) {
    readyCountdown.value = 0;
    stopReadyTimer();
    return;
  }

  const compute = () => {
    const diff = Math.ceil((startTime - getServerNow()) / 1000);
    readyCountdown.value = Math.max(0, diff);
    if (readyCountdown.value <= 0) {
      stopReadyTimer();
    }
  };

  compute();
  if (!readyTimer) {
    readyTimer = setInterval(compute, 250);
  }
};

const stopOnlineSocket = () => {
  if (!onlineSocket) return;
  const socket = onlineSocket;
  onlineSocket = null;
  socket.close();
  if (activeRealtimeTransport.value === "ws") {
    activeRealtimeTransport.value = null;
  }
};

const stopOnlineStream = () => {
  if (onlineStream) {
    onlineStream.close();
    onlineStream = null;
  }
  if (activeRealtimeTransport.value === "sse") {
    activeRealtimeTransport.value = null;
  }
};

const stopOnlinePolling = () => {
  if (onlinePollTimer) {
    clearInterval(onlinePollTimer);
    onlinePollTimer = null;
  }
  if (activeRealtimeTransport.value === "poll") {
    activeRealtimeTransport.value = null;
  }
};

const refreshOnlineState = async (silent = false) => {
  if (!matchId.value || onlineRefreshPending) return;
  onlineRefreshPending = true;
  try {
    const state = await getMatchRoom(matchId.value);
    applyOnlineState(state);
    if (onlineError.value) {
      onlineError.value = "";
    }
  } catch (error) {
    if (!silent) {
      onlineError.value = (error as Error).message;
    }
  } finally {
    onlineRefreshPending = false;
  }
};

const handleSocketMessage = async (payload: MatchSocketMessage) => {
  if (!payload || payload.matchId !== matchId.value) return;
  if (payload.type === "state" && payload.match) {
    applyOnlineState(payload.match);
    if (onlineError.value) {
      onlineError.value = "";
    }
    return;
  }
  if (payload.type === "match-update") {
    await refreshOnlineState();
    return;
  }
  if (payload.type === "error") {
    onlineError.value = payload.message || "Erreur temps reel.";
  }
};

const startOnlinePolling = () => {
  stopOnlineSocket();
  stopOnlineStream();
  if (onlinePollTimer) return;
  activeRealtimeTransport.value = "poll";
  onlinePollTimer = setInterval(async () => {
    await refreshOnlineState(true);
  }, 3000);
};

const startPresenceTimer = () => {
  if (presenceTimer || !matchId.value) return;
  presenceTimer = setInterval(async () => {
    if (!matchId.value) return;
    try {
      const state = await sendMatchPresence(matchId.value);
      applyOnlineState(state);
    } catch {
      // Ignore presence failures.
    }
  }, 8000);
};

const startOnlineStream = () => {
  if (!matchId.value) return false;
  stopOnlineSocket();
  stopOnlineStream();
  stopOnlinePolling();
  onlineStream = openMatchStream(
    matchId.value,
    (payload) => {
      applyOnlineState(payload);
      if (onlineError.value) {
        onlineError.value = "";
      }
    },
    () => {
      if (!onlineError.value) {
        onlineError.value = "Connexion temps reel interrompue.";
      }
      startOnlinePolling();
    },
  );
  if (!onlineStream) {
    startOnlinePolling();
    return false;
  }
  activeRealtimeTransport.value = "sse";
  return true;
};

const startOnlineSocketChannel = () => {
  if (!matchId.value) return false;
  stopOnlineSocket();
  stopOnlineStream();
  stopOnlinePolling();
  const socket = openMatchSocket(
    matchId.value,
    (payload) => {
      void handleSocketMessage(payload);
    },
  );

  if (!socket) {
    return false;
  }

  onlineSocket = socket;
  activeRealtimeTransport.value = "ws";

  const fallback = () => {
    if (onlineSocket !== socket) return;
    onlineSocket = null;
    if (!onlineError.value) {
      onlineError.value = "Connexion temps reel interrompue.";
    }
    if (
      preferredRealtimeTransport === "ws" ||
      preferredRealtimeTransport === "auto"
    ) {
      if (startOnlineStream()) return;
    }
    startOnlinePolling();
  };

  socket.addEventListener("error", fallback);
  socket.addEventListener("close", () => {
    fallback();
  });
  return true;
};

const startOnlineRealtime = () => {
  if (!matchId.value) return;
  stopOnlinePolling();
  stopOnlineStream();
  stopOnlineSocket();

  if (preferredRealtimeTransport === "poll") {
    startOnlinePolling();
    return;
  }

  if (preferredRealtimeTransport === "sse") {
    if (!startOnlineStream()) {
      startOnlinePolling();
    }
    return;
  }

  if (preferredRealtimeTransport === "ws") {
    if (!startOnlineSocketChannel() && !startOnlineStream()) {
      startOnlinePolling();
    }
    return;
  }

  if (startOnlineSocketChannel()) return;
  if (startOnlineStream()) return;
  startOnlinePolling();
};

const loadOnlineMatch = async () => {
  if (!matchId.value) return;
  onlineLoading.value = true;
  onlineError.value = "";
  stopOnlinePolling();
  stopOnlineStream();
  stopOnlineSocket();
  await ensureCurrentUserId();
  try {
    const state = await getMatchRoom(matchId.value);
    applyOnlineState(state);
    startOnlineRealtime();
    startPresenceTimer();
  } catch (error) {
    onlineError.value = (error as Error).message;
    startOnlinePolling();
  } finally {
    onlineLoading.value = false;
  }
};

const handleReady = async () => {
  if (!matchId.value || !isOnline.value) return;
  try {
    const state = await markMatchReady(matchId.value);
    applyOnlineState(state);
  } catch (error) {
    onlineError.value = (error as Error).message;
  }
};

const isOwnedBySide = (piece: string, side: Side) => {
  if (!piece) return false;
  return side === "white"
    ? piece === piece.toUpperCase()
    : piece === piece.toLowerCase();
};

const localEndLabel = (reason: ReturnType<typeof getGameStatus>["reason"]) => {
  if (reason === "checkmate") return "Echec et mat.";
  if (reason === "stalemate") return "Pat. Match nul.";
  if (reason === "threefold-repetition") return "Nulle par repetition.";
  if (reason === "insufficient-material") {
    return "Nulle: materiel insuffisant.";
  }
  if (reason === "fifty-moves") return "Nulle: regle des 50 coups.";
  if (reason === "draw") return "Match nul.";
  return "Partie terminee.";
};

const buildFallbackReview = () => {
  const played = Math.max(1, moveHistory.value.length);
  const blunders = Math.max(0, Math.round(played * 0.05));
  const mistakes = Math.max(0, Math.round(played * 0.12));
  const best = Math.max(0, played - blunders - mistakes);
  const accuracy = Math.max(0, Math.min(100, 100 - mistakes * 5 - blunders * 14));
  return { accuracy, best, mistakes, blunders };
};

const persistLocalGame = (result: "win" | "loss" | "draw") => {
  const gameId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const fallback = buildFallbackReview();
  const snapshotMoves = rawMoves.value.map((move) => ({ ...move }));
  const snapshotPgn = pgnValue.value;
  const snapshotFen = gameFen.value;
  const snapshotMoveCount = moveHistory.value.length;
  const snapshotOpponent = isAiMatch.value
    ? `IA ${aiPersonaLabel.value} ${aiDifficultyLabel.value}`
    : "Local";
  const snapshotDate = new Date().toISOString();

  saveLocalGameRecord({
    id: gameId,
    opponent: snapshotOpponent,
    result,
    opening: "Inconnue",
    date: snapshotDate,
    moves: snapshotMoveCount,
    accuracy: fallback.accuracy,
    pgn: snapshotPgn,
    finalFen: snapshotFen,
    review: {
      best: fallback.best,
      mistakes: fallback.mistakes,
      blunders: fallback.blunders,
    },
  });

  reviewLoading.value = true;
  reviewError.value = "";
  reviewResult.value = null;

  void reviewGameWithStockfish(snapshotMoves)
    .then((review) => {
      reviewResult.value = review;
      saveLocalGameRecord({
        id: gameId,
        opponent: snapshotOpponent,
        result,
        opening: "Inconnue",
        date: snapshotDate,
        moves: snapshotMoveCount,
        accuracy: review.accuracy,
        pgn: snapshotPgn,
        finalFen: snapshotFen,
        review: {
          best: review.best + review.good,
          good: review.good,
          inaccuracies: review.inaccuracies,
          mistakes: review.mistakes,
          blunders: review.blunders,
        },
      });
    })
    .catch((error) => {
      reviewError.value = (error as Error).message || "Review indisponible.";
    })
    .finally(() => {
      reviewLoading.value = false;
    });
};

const applyAndRecord = (move: Move) => {
  if (!isOnline.value) {
    commitClockTick();
    applyIncrement(sideToMove.value);
    checkTimeout();
  }
  const applied = applyMove(gameFen.value, {
    from: move.from,
    to: move.to,
    promotion: move.promotion,
  });
  if (!applied.move) return;
  gameFen.value = applied.fen;
  rawMoves.value = [
    ...rawMoves.value,
    {
      from: applied.move.from,
      to: applied.move.to,
      promotion: applied.move.promotion,
    },
  ];
  moveHistory.value = [
    ...moveHistory.value,
    {
      ply: moveHistory.value.length + 1,
      side: sideToMove.value,
      notation: formatMove(applied.move),
    },
  ];
  lastMove.value = { from: applied.move.from, to: applied.move.to };
  selectedSquare.value = null;

  const status = getGameStatus(applied.fen);
  if (!isOnline.value && status.isGameOver) {
    localMatchEnded.value = true;
    stopClock();
    clockNotice.value = localEndLabel(status.reason);
    clockNoticeError.value = false;
    if (status.reason === "checkmate" && status.winner) {
      persistLocalGame(status.winner === playerSide.value ? "win" : "loss");
    } else {
      persistLocalGame("draw");
    }
    trackEvent({
      name: "finish_game",
      payload: {
        matchId: matchId.value || "local",
        result: status.reason ?? "game-over",
      },
    });
    return;
  }

  clockTickAt.value = Date.now();
  if (!isOnline.value && isAiMatch.value) {
    queueAiMove();
  }
};

const submitOnlineMove = async (move: Move) => {
  if (!matchId.value) return;
  if (onlineStatus.value !== "started") return;
  onlinePending.value = true;
  onlineError.value = "";
  stopClock();
  try {
    const state = await addMatchMove(matchId.value, {
      from: move.from,
      to: move.to,
      notation: formatMove(move),
      promotion: move.promotion,
    });
    applyOnlineState(state);
  } catch (error) {
    onlineError.value = (error as Error).message;
  } finally {
    onlinePending.value = false;
  }
};

const formatChatTime = (value: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const handleSendChat = async () => {
  if (!matchId.value || !isOnline.value) return;
  const next = chatInput.value.trim();
  if (!next) return;

  chatPending.value = true;
  chatError.value = "";
  try {
    const state = await addMatchMessage(matchId.value, next);
    applyOnlineState(state);
    chatInput.value = "";
    await nextTick();
    if (chatListRef.value) {
      chatListRef.value.scrollTop = chatListRef.value.scrollHeight;
    }
  } catch (error) {
    chatError.value = (error as Error).message;
  } finally {
    chatPending.value = false;
  }
};

const handleRematch = async () => {
  if (!opponentId.value) {
    rematchNotice.value = "Adversaire introuvable.";
    rematchNoticeError.value = true;
    return;
  }

  rematchNotice.value = "";
  rematchNoticeError.value = false;
  try {
    const response = await createMatchInvite(
      opponentId.value,
      timeControl.value,
      "Aleatoire",
    );
    rematchNotice.value = response.message;
    rematchNoticeError.value = !response.ok;
    if (response.ok && response.status === "accepted" && response.matchId) {
      clearMatchesCache();
      await router.push(`/jeu/${response.matchId}`);
    }
  } catch (error) {
    rematchNotice.value = (error as Error).message;
    rematchNoticeError.value = true;
  }
};

const handleFinishMatch = async (result: "resign" | "draw" | "timeout") => {
  if (!matchId.value || !isOnline.value) return;
  finishNotice.value = "";
  finishNoticeError.value = false;
  try {
    const state = await finishMatch(matchId.value, result);
    applyOnlineState(state);
    if (result === "draw") {
      finishNotice.value = "Match nul enregistre.";
    } else if (result === "timeout") {
      finishNotice.value = "Temps ecoule.";
    } else {
      finishNotice.value = "Match termine.";
    }
    trackEvent({
      name: "finish_game",
      payload: {
        matchId: matchId.value,
        result,
      },
    });
  } catch (error) {
    finishNotice.value = (error as Error).message;
    finishNoticeError.value = true;
  }
};

const handleTimeout = async () => {
  if (matchEnded.value) return;
  stopClock();
  if (isOnline.value) {
    await handleFinishMatch("timeout");
    return;
  }
  localMatchEnded.value = true;
  const timedOutSide = sideToMove.value;
  persistLocalGame(timedOutSide === playerSide.value ? "loss" : "win");
  clockNotice.value = "Temps ecoule. Match termine.";
  clockNoticeError.value = true;
  trackEvent({
    name: "finish_game",
    payload: {
      matchId: matchId.value || "local",
      result: "timeout",
    },
  });
};

const handleSquareClick = (squareId: string, piece: string) => {
  if (!canUserMove.value) return;

  if (!selectedSquare.value) {
    if (!piece || !isOwnedBySide(piece, sideToMove.value)) return;
    selectedSquare.value = squareId;
    return;
  }

  if (squareId === selectedSquare.value) {
    selectedSquare.value = null;
    return;
  }

  const move = movesFromSelected.value.find(
    (candidate) => candidate.to === squareId,
  );
  if (!move) {
    if (piece && isOwnedBySide(piece, sideToMove.value)) {
      selectedSquare.value = squareId;
    }
    return;
  }

  if (isOnline.value) {
    void submitOnlineMove(move);
    return;
  }

  applyAndRecord(move);
};

const handleAbandon = async () => {
  if (isOnline.value) {
    if (matchEnded.value) return;
    await handleFinishMatch("resign");
    return;
  }
  persistLocalGame("loss");
  trackEvent({
    name: "finish_game",
    payload: {
      matchId: matchId.value || "local",
      result: "resign",
    },
  });
  await router.push("/dashboard");
};

const handleDraw = async () => {
  if (isOnline.value) {
    if (matchEnded.value) return;
    await handleFinishMatch("draw");
    return;
  }
  persistLocalGame("draw");
  trackEvent({
    name: "finish_game",
    payload: {
      matchId: matchId.value || "local",
      result: "draw",
    },
  });
  await router.push("/dashboard");
};

const handleResetMatch = () => {
  if (isOnline.value) return;
  resetLocalMatchState();
};

const restoreFromRawMoves = (
  moves: Array<{ from: string; to: string; promotion?: "q" | "r" | "b" | "n" }>,
) => {
  let fen = createInitialFen();
  const history: { ply: number; side: Side; notation: string }[] = [];
  const raw: Array<{ from: string; to: string; promotion?: "q" | "r" | "b" | "n" }> = [];
  for (const move of moves) {
    const applied = applyMove(fen, move);
    if (!applied.move) break;
    fen = applied.fen;
    raw.push({
      from: applied.move.from,
      to: applied.move.to,
      promotion: applied.move.promotion,
    });
    history.push({
      ply: history.length + 1,
      side: history.length % 2 === 0 ? "white" : "black",
      notation: formatMove(applied.move),
    });
  }
  gameFen.value = fen;
  rawMoves.value = raw;
  moveHistory.value = history;
  lastMove.value = history.length
    ? {
        from: raw[raw.length - 1]?.from ?? "",
        to: raw[raw.length - 1]?.to ?? "",
      }
    : null;
};

const syncLocalStatus = () => {
  if (isOnline.value) return;
  const status = getGameStatus(gameFen.value);
  if (status.isGameOver) {
    localMatchEnded.value = true;
    stopClock();
    clockNotice.value = localEndLabel(status.reason);
    clockNoticeError.value = false;
    return;
  }
  localMatchEnded.value = false;
  clockNotice.value = "";
  clockNoticeError.value = false;
  resetLocalClocks();
  queueAiMove();
};

const evaluatePuzzleProgress = () => {
  if (!activePuzzle.value || isOnline.value) {
    puzzleNotice.value = "";
    puzzleNoticeError.value = false;
    puzzleSolved.value = false;
    return;
  }

  const played = rawMoves.value.map(
    (move) => `${move.from}${move.to}${move.promotion ?? ""}`,
  );
  const solution = activePuzzle.value.solution;
  const compared = Math.min(played.length, solution.length);

  for (let index = 0; index < compared; index += 1) {
    const playedMove = played[index] ?? "";
    const expectedMove = solution[index] ?? "";
    if (playedMove !== expectedMove) {
      puzzleSolved.value = false;
      puzzleNoticeError.value = true;
      puzzleNotice.value = `Ligne incorrecte au coup ${
        index + 1
      }. Attendu: ${expectedMove}.`;
      return;
    }
  }

  if (played.length >= solution.length) {
    puzzleSolved.value = true;
    puzzleNoticeError.value = false;
    puzzleNotice.value = "Puzzle resolu. Bonne ligne tactique.";
    return;
  }

  puzzleSolved.value = false;
  puzzleNoticeError.value = false;
  puzzleNotice.value = `Ligne correcte (${played.length}/${solution.length}).`;
};

const handleImportFen = () => {
  if (isOnline.value) return;
  const fen = importFen.value.trim();
  if (!fen || !isValidFen(fen)) {
    analysisError.value = "FEN invalide.";
    return;
  }
  analysisError.value = "";
  gameFen.value = fen;
  moveHistory.value = [];
  rawMoves.value = [];
  lastMove.value = null;
  syncLocalStatus();
};

const handleImportPgn = () => {
  if (isOnline.value) return;
  const pgn = importPgn.value.trim();
  if (!pgn) {
    analysisError.value = "PGN vide.";
    return;
  }
  const loaded = loadPgn(pgn);
  if (!loaded.ok) {
    analysisError.value = loaded.error || "PGN invalide.";
    return;
  }
  analysisError.value = "";
  const moves = loaded.moves.map((move) => ({
    from: move.from,
    to: move.to,
    promotion: move.promotion,
  }));
  restoreFromRawMoves(moves);
  importFen.value = loaded.fen;
  syncLocalStatus();
};

const selectAnalysisNode = (nodeId: string) => {
  if (!analysisNodes.value[nodeId]) return;
  analysisCurrentId.value = nodeId;
  analysisSelectedSquare.value = null;
};

const addAnalysisMove = (move: Move) => {
  const current = analysisCurrentNode.value;
  const applied = applyMove(current.fen, {
    from: move.from,
    to: move.to,
    promotion: move.promotion,
  });
  if (!applied.move) return;
  const uci = `${applied.move.from}${applied.move.to}${applied.move.promotion ?? ""}`;

  const existing = current.children
    .map((id) => analysisNodes.value[id])
    .find((child) => child && child.moveUci === uci);
  if (existing) {
    analysisCurrentId.value = existing.id;
    analysisSelectedSquare.value = null;
    return;
  }

  const id = nextAnalysisId();
  const node: AnalysisNode = {
    id,
    parentId: current.id,
    fen: applied.fen,
    moveUci: uci,
    notation: formatMove(applied.move),
    children: [],
    ply: current.ply + 1,
  };
  analysisNodes.value = {
    ...analysisNodes.value,
    [id]: node,
    [current.id]: {
      ...current,
      children: [...current.children, id],
    },
  };
  analysisCurrentId.value = id;
  analysisSelectedSquare.value = null;
};

const handleAnalysisSquareClick = (squareId: string, piece: string) => {
  if (!analysisSelectedSquare.value) {
    if (!piece || !isOwnedBySide(piece, analysisTurn.value)) return;
    analysisSelectedSquare.value = squareId;
    return;
  }

  if (analysisSelectedSquare.value === squareId) {
    analysisSelectedSquare.value = null;
    return;
  }

  const move = analysisMovesFromSelected.value.find(
    (candidate) => candidate.to === squareId,
  );
  if (!move) {
    if (piece && isOwnedBySide(piece, analysisTurn.value)) {
      analysisSelectedSquare.value = squareId;
    }
    return;
  }

  addAnalysisMove(move);
};

const analysisSquares = computed(() =>
  boardRanks.flatMap((rank, rowIndex) =>
    boardFiles.map((file, colIndex) => {
      const piece = analysisBoard.value[rowIndex]?.[colIndex] ?? "";
      const squareId = `${file}${rank}`;
      const isDark = (rowIndex + colIndex) % 2 === 1;
      const tone = piece
        ? piece === piece.toUpperCase()
          ? "light"
          : "dark"
        : "";
      const isSelected = analysisSelectedSquare.value === squareId;
      const isTarget = analysisTargetSquares.value.has(squareId);
      const ariaLabel = piece
        ? `${squareId} ${pieceNames[piece] ?? "piece"}`
        : `${squareId} vide`;

      return {
        id: squareId,
        piece,
        symbol: pieceSymbols[piece] ?? "",
        image: piece ? getPieceImage(piece) : "",
        dark: isDark,
        tone,
        isSelected,
        isTarget,
        ariaLabel,
      };
    }),
  ),
);

const handleLeaveMatch = async () => {
  await router.push("/dashboard");
};

watch(
  () => onlineMessages.value.length,
  async () => {
    await nextTick();
    if (chatListRef.value) {
      chatListRef.value.scrollTop = chatListRef.value.scrollHeight;
    }
  },
);

onBeforeUnmount(() => {
  stopOnlineSocket();
  stopOnlineStream();
  stopOnlinePolling();
  stopClock();
  stopAiTimer();
  stopReadyTimer();
  stopPresenceTimer();
  disposeAiWorker();
  disposeStockfishReview();
});

const squares = computed(() =>
  boardRanks.flatMap((rank, rowIndex) =>
    boardFiles.map((file, colIndex) => {
      const piece = board.value[rowIndex]?.[colIndex] ?? "";
      const squareId = `${file}${rank}`;
      const isDark = (rowIndex + colIndex) % 2 === 1;
      const tone = piece
        ? piece === piece.toUpperCase()
          ? "light"
          : "dark"
        : "";
      const isSelected = selectedSquare.value === squareId;
      const isTarget = targetSquares.value.has(squareId);
      const isLast =
        lastMove.value?.from === squareId || lastMove.value?.to === squareId;
      const isArrival = lastMove.value?.to === squareId;
      const ariaLabel = piece
        ? `${squareId} ${pieceNames[piece] ?? "piece"}`
        : `${squareId} vide`;

      return {
        id: squareId,
        piece,
        symbol: pieceSymbols[piece] ?? "",
        image: piece ? getPieceImage(piece) : "",
        dark: isDark,
        tone,
        isSelected,
        isTarget,
        isLast,
        isArrival,
        ariaLabel,
      };
    }),
  ),
);
</script>

<template>
  <DashboardLayout
    eyebrow="Partie"
    :title="`Match ${matchId || 'Libre'}`"
    :subtitle="modeSubtitle"
  >
    <section class="game-layout">
      <div class="game-stack">
        <div class="panel game-board">
          <div class="panel-header">
            <div>
              <p class="panel-title">Plateau</p>
              <h3 class="panel-headline">
                Tour: {{ sideToMove === "white" ? "Blancs" : "Noirs" }}
              </h3>
            </div>
            <span class="badge-soft">{{
              mode === "JcJ" ? "En ligne" : "Local"
            }}</span>
          </div>

          <p v-if="onlineNote" class="form-message form-message--success">
            {{ onlineNote }}
          </p>
          <p v-if="isOnline && realtimeTransportLabel" class="panel-sub">
            Transport actif: {{ realtimeTransportLabel }}
          </p>
          <p v-if="onlineError" class="form-message form-message--error">
            {{ onlineError }}
          </p>
          <p
            v-if="clockNotice"
            :class="[
              'form-message',
              clockNoticeError
                ? 'form-message--error'
                : 'form-message--success',
            ]"
          >
            {{ clockNotice }}
          </p>

          <div class="player-strip">
            <div
              :class="[
                'player-chip',
                sideToMove === 'white' && 'player-chip--active',
              ]"
            >
              <div class="player-avatar">{{ initialsFrom(whiteLabel) }}</div>
              <div class="player-info">
                <p class="player-name">{{ whiteLabel }}</p>
                <p class="player-meta">
                  Blancs
                  <span
                    v-if="isOnline"
                    :class="[
                      'live-indicator',
                      whiteReady ? 'live-indicator--on' : 'live-indicator--off',
                    ]"
                  >
                    {{ whiteReady ? "Pret" : "Attente" }}
                  </span>
                </p>
              </div>
              <div :class="['player-clock', clockTone(whiteClockMs)]">
                {{ whiteClockLabel }}
              </div>
            </div>
            <span class="vs-pill">VS</span>
            <div
              :class="[
                'player-chip',
                sideToMove === 'black' && 'player-chip--active',
              ]"
            >
              <div class="player-avatar">{{ initialsFrom(blackLabel) }}</div>
              <div class="player-info">
                <p class="player-name">{{ blackLabel }}</p>
                <p class="player-meta">
                  Noirs
                  <span
                    v-if="isOnline"
                    :class="[
                      'live-indicator',
                      blackReady ? 'live-indicator--on' : 'live-indicator--off',
                    ]"
                  >
                    {{ blackReady ? "Pret" : "Attente" }}
                  </span>
                </p>
              </div>
              <div :class="['player-clock', clockTone(blackClockMs)]">
                {{ blackClockLabel }}
              </div>
            </div>
          </div>

          <div class="board-wrap">
            <div class="board">
              <div class="board-grid" role="grid" aria-label="Plateau d'echecs">
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
                  :aria-label="square.ariaLabel"
                  :aria-pressed="square.isSelected"
                  role="gridcell"
                  @click="handleSquareClick(square.id, square.piece)"
                >
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
        </div>

        <div class="panel game-actions">
          <div>
            <p class="panel-title">Actions</p>
            <h3 class="panel-headline">Fin de match</h3>
            <p class="panel-sub">Gerez la partie en cours en un clic.</p>
          </div>
          <div
            v-if="
              isOnline &&
              (onlineStatus === 'waiting' || onlineStatus === 'ready')
            "
            class="game-ready"
          >
            <p class="panel-title">Synchronisation</p>
            <p class="panel-sub">
              {{
                playerReady
                  ? "Presence confirmee."
                  : "Confirmez votre presence pour lancer la partie."
              }}
            </p>
            <div class="ready-lane">
              <span
                :class="[
                  'ready-chip',
                  playerReady ? 'ready-chip--ok' : 'ready-chip--pending',
                ]"
              >
                Vous: {{ playerReady ? "pret" : "attente" }}
              </span>
              <span
                :class="[
                  'ready-chip',
                  opponentReady ? 'ready-chip--ok' : 'ready-chip--pending',
                ]"
              >
                Adversaire: {{ opponentReady ? "pret" : "attente" }}
              </span>
            </div>
            <button
              class="button-primary"
              type="button"
              :disabled="playerReady || onlineLoading"
              @click="handleReady"
            >
              {{ playerReady ? "Pret" : "Je suis pret" }}
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
          <button
            class="button-ghost game-action"
            type="button"
            :disabled="isOnline"
            @click="handleResetMatch"
          >
            Reinitialiser le match
          </button>
          <p
            v-if="finishNotice"
            :class="[
              'form-message',
              finishNoticeError
                ? 'form-message--error'
                : 'form-message--success',
            ]"
          >
            {{ finishNotice }}
          </p>

          <div v-if="isOnline && matchEnded" class="game-rematch">
            <p class="panel-title">Revanche</p>
            <p class="panel-sub">
              Proposez une nouvelle partie a votre adversaire.
            </p>
            <div class="game-rematch-actions">
              <button
                class="button-primary"
                type="button"
                @click="handleRematch"
              >
                Proposer une revanche
              </button>
              <button
                class="button-ghost"
                type="button"
                @click="handleLeaveMatch"
              >
                Retour au tableau
              </button>
            </div>
            <p
              v-if="rematchNotice"
              :class="[
                'form-message',
                rematchNoticeError
                  ? 'form-message--error'
                  : 'form-message--success',
              ]"
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
            <p class="metric-value">
              {{ playerSide === "white" ? "Blancs" : "Noirs" }}
            </p>
          </div>
          <div>
            <p class="metric-label">{{ opponentLabel }}</p>
            <p class="metric-value">{{ opponent }}</p>
          </div>
          <div>
            <p class="metric-label">Cadence</p>
            <p class="metric-value">{{ timeControl }}</p>
          </div>
          <div>
            <p class="metric-label">Etat</p>
            <p class="metric-value">{{ gamePhaseLabel }}</p>
          </div>
          <div v-if="isAiMatch">
            <p class="metric-label">Difficulte</p>
            <p class="metric-value">{{ aiDifficultyLabel }}</p>
          </div>
          <div v-if="isAiMatch">
            <p class="metric-label">Profil IA</p>
            <p class="metric-value">{{ aiPersonaLabel }}</p>
          </div>
          <div v-if="mode === 'Histoire' && localChapter">
            <p class="metric-label">Chapitre</p>
            <p class="metric-value">#{{ localChapter }}</p>
          </div>
          <div v-if="activePuzzle">
            <p class="metric-label">Puzzle</p>
            <p class="metric-value">{{ activePuzzle.title }}</p>
          </div>
          <div v-if="activePuzzle">
            <p class="metric-label">Progression</p>
            <p class="metric-value">
              {{ Math.min(rawMoves.length, activePuzzle.solution.length) }}/{{ activePuzzle.solution.length }}
            </p>
          </div>
          <div v-if="activePuzzle">
            <p class="metric-label">Statut</p>
            <p class="metric-value">{{ puzzleSolved ? "Resolu" : "En cours" }}</p>
          </div>
        </div>
        <p
          v-if="puzzleNotice"
          :class="[
            'form-message',
            puzzleNoticeError ? 'form-message--error' : 'form-message--success',
          ]"
        >
          {{ puzzleNotice }}
        </p>

        <div class="panel-subsection">
          <p class="panel-title">Historique</p>
          <div class="move-list">
            <div v-if="!moveHistory.length" class="empty-state">
              Aucun coup joue.
            </div>
            <div v-for="move in moveHistory" :key="move.ply" class="move-item">
              <span class="move-ply">#{{ move.ply }}</span>
              <span class="move-side">{{
                move.side === "white" ? "Blancs" : "Noirs"
              }}</span>
              <span class="move-notation">{{ move.notation }}</span>
            </div>
          </div>
        </div>

        <div v-if="!isOnline" class="panel-subsection">
          <p class="panel-title">Analyse (FEN / PGN)</p>
          <div class="form-stack">
            <label class="form-field">
              <span class="form-label">FEN courant</span>
              <textarea class="form-input" rows="2" :value="gameFen" readonly />
            </label>
            <label class="form-field">
              <span class="form-label">PGN courant</span>
              <textarea class="form-input" rows="5" :value="pgnValue" readonly />
            </label>
            <label class="form-field">
              <span class="form-label">Importer FEN</span>
              <input
                v-model="importFen"
                class="form-input"
                type="text"
                placeholder="ex: rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
              />
            </label>
            <button class="button-ghost game-action" type="button" @click="handleImportFen">
              Charger FEN
            </button>
            <label class="form-field">
              <span class="form-label">Importer PGN</span>
              <textarea
                v-model="importPgn"
                class="form-input"
                rows="4"
                placeholder="Collez un PGN complet"
              />
            </label>
            <button class="button-ghost game-action" type="button" @click="handleImportPgn">
              Charger PGN
            </button>
            <p v-if="analysisError" class="form-message form-message--error">
              {{ analysisError }}
            </p>
            <p v-if="reviewLoading" class="form-message form-message--success">
              Analyse Stockfish en cours...
            </p>
            <p v-if="reviewError" class="form-message form-message--error">
              {{ reviewError }}
            </p>
            <div v-if="reviewResult" class="game-info">
              <div>
                <p class="metric-label">Precision</p>
                <p class="metric-value">{{ reviewResult.accuracy }}%</p>
              </div>
              <div>
                <p class="metric-label">Best / Good</p>
                <p class="metric-value">{{ reviewResult.best }} / {{ reviewResult.good }}</p>
              </div>
              <div>
                <p class="metric-label">Inexactitudes</p>
                <p class="metric-value">{{ reviewResult.inaccuracies }}</p>
              </div>
              <div>
                <p class="metric-label">Erreurs / Gaffes</p>
                <p class="metric-value">{{ reviewResult.mistakes }} / {{ reviewResult.blunders }}</p>
              </div>
            </div>

            <div class="panel-subsection">
              <p class="panel-title">Board d'analyse (variantes)</p>
              <p class="panel-sub">
                Cliquez les cases pour explorer une ligne. Un coup non present cree une nouvelle variante.
              </p>
              <div class="board-wrap">
                <div class="board">
                  <div class="board-grid" role="grid" aria-label="Board analyse">
                    <button
                      v-for="square in analysisSquares"
                      :key="`analysis-${square.id}`"
                      type="button"
                      :class="[
                        'square',
                        square.dark ? 'square--dark' : 'square--light',
                        square.isSelected ? 'square--selected' : '',
                        square.isTarget ? 'square--target' : '',
                      ]"
                      :aria-label="square.ariaLabel"
                      :aria-pressed="square.isSelected"
                      role="gridcell"
                      @click="handleAnalysisSquareClick(square.id, square.piece)"
                    >
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
                    </button>
                  </div>
                </div>
              </div>
              <div class="game-info">
                <div>
                  <p class="metric-label">Noeud</p>
                  <p class="metric-value">#{{ analysisCurrentNode.ply }}</p>
                </div>
                <div>
                  <p class="metric-label">Trait</p>
                  <p class="metric-value">{{ analysisTurn === "white" ? "Blancs" : "Noirs" }}</p>
                </div>
              </div>
              <div class="move-list">
                <div class="move-item">
                  <span class="move-side">Chemin</span>
                  <span class="move-notation">
                    <button
                      v-for="node in analysisPath"
                      :key="`path-${node.id}`"
                      class="button-ghost"
                      type="button"
                      @click="selectAnalysisNode(node.id)"
                    >
                      {{ node.notation || "Depart" }}
                    </button>
                  </span>
                </div>
                <div v-if="analysisChildren.length" class="move-item">
                  <span class="move-side">Branches</span>
                  <span class="move-notation">
                    <button
                      v-for="node in analysisChildren"
                      :key="`branch-${node.id}`"
                      class="button-ghost"
                      type="button"
                      @click="selectAnalysisNode(node.id)"
                    >
                      {{ node.notation || "..." }}
                    </button>
                  </span>
                </div>
                <div v-else class="empty-state">Aucune branche depuis ce noeud.</div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="isOnline" class="panel-subsection match-chat">
          <p class="panel-title">Chat</p>
          <div ref="chatListRef" class="chat-list">
            <div v-if="!onlineMessages.length" class="empty-state">
              Aucun message.
            </div>
            <div
              v-for="message in onlineMessages"
              :key="message.id"
              class="chat-item"
            >
              <div class="chat-row">
                <span class="chat-name">{{ message.userName }}</span>
                <span class="chat-time">{{
                  formatChatTime(message.createdAt)
                }}</span>
              </div>
              <p class="chat-text">{{ message.message }}</p>
            </div>
          </div>
          <div class="chat-input-row">
            <input
              v-model="chatInput"
              type="text"
              placeholder="Ecrire un message..."
              aria-label="Message"
              :disabled="chatPending || onlineLoading"
              @keydown.enter.prevent="handleSendChat"
            />
            <button
              class="button-primary"
              type="button"
              :disabled="chatPending || onlineLoading || !chatInput.trim()"
              @click="handleSendChat"
            >
              {{ chatPending ? "Envoi..." : "Envoyer" }}
            </button>
          </div>
          <p v-if="chatError" class="form-message form-message--error">
            {{ chatError }}
          </p>
        </div>
      </div>
    </section>
  </DashboardLayout>
</template>
