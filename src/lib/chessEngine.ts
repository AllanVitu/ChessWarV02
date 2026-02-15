import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js'

export type Side = 'white' | 'black'
export type DifficultyKey = 'facile' | 'intermediaire' | 'difficile' | 'maitre'
export type BotPersona = 'equilibre' | 'agressif' | 'solide' | 'fou'
export type PromotionPiece = 'q' | 'r' | 'b' | 'n'

export type Move = {
  from: string
  to: string
  piece: string
  capture?: string
  promotion?: PromotionPiece
  san?: string
}

export type MoveInput = {
  from: string
  to: string
  promotion?: PromotionPiece
}

export type GameStatus = {
  turn: Side
  inCheck: boolean
  isCheckmate: boolean
  isStalemate: boolean
  isDraw: boolean
  isThreefoldRepetition: boolean
  isInsufficientMaterial: boolean
  isFiftyMoves: boolean
  isGameOver: boolean
  winner: Side | null
  reason:
    | 'checkmate'
    | 'stalemate'
    | 'threefold-repetition'
    | 'insufficient-material'
    | 'fifty-moves'
    | 'draw'
    | null
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
const START_FEN = 'start'
const POSITIONAL_WEIGHT = 0.08

const pieceValues: Record<PieceSymbol, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 0,
}

const pawnTable = [
  0, 0, 0, 0, 0, 0, 0, 0,
  40, 40, 40, 45, 45, 40, 40, 40,
  18, 18, 25, 35, 35, 25, 18, 18,
  8, 10, 14, 24, 24, 14, 10, 8,
  4, 8, 12, 20, 20, 12, 8, 4,
  4, 4, 8, 10, 10, 8, 4, 4,
  5, 6, 6, -8, -8, 6, 6, 5,
  0, 0, 0, 0, 0, 0, 0, 0,
]

const knightTable = [
  -50, -40, -30, -30, -30, -30, -40, -50,
  -40, -20, 0, 2, 2, 0, -20, -40,
  -30, 2, 10, 15, 15, 10, 2, -30,
  -30, 4, 15, 20, 20, 15, 4, -30,
  -30, 2, 15, 20, 20, 15, 2, -30,
  -30, 4, 10, 15, 15, 10, 4, -30,
  -40, -20, 0, 4, 4, 0, -20, -40,
  -50, -40, -30, -30, -30, -30, -40, -50,
]

const bishopTable = [
  -20, -12, -10, -10, -10, -10, -12, -20,
  -12, 4, 0, 0, 0, 0, 4, -12,
  -10, 0, 8, 10, 10, 8, 0, -10,
  -10, 2, 10, 10, 10, 10, 2, -10,
  -10, 2, 10, 10, 10, 10, 2, -10,
  -10, 0, 8, 10, 10, 8, 0, -10,
  -12, 4, 0, 0, 0, 0, 4, -12,
  -20, -12, -10, -10, -10, -10, -12, -20,
]

const rookTable = [
  0, 0, 4, 8, 8, 4, 0, 0,
  -4, 0, 0, 0, 0, 0, 0, -4,
  -4, 0, 0, 0, 0, 0, 0, -4,
  -4, 0, 0, 0, 0, 0, 0, -4,
  -4, 0, 0, 0, 0, 0, 0, -4,
  -4, 0, 0, 0, 0, 0, 0, -4,
  4, 12, 12, 12, 12, 12, 12, 4,
  0, 0, 4, 8, 8, 4, 0, 0,
]

const queenTable = [
  -20, -10, -10, -5, -5, -10, -10, -20,
  -10, 0, 0, 0, 0, 0, 0, -10,
  -10, 0, 5, 5, 5, 5, 0, -10,
  -5, 0, 5, 5, 5, 5, 0, -5,
  -5, 0, 5, 5, 5, 5, 0, -5,
  -10, 5, 5, 5, 5, 5, 0, -10,
  -10, 0, 5, 0, 0, 0, 0, -10,
  -20, -10, -10, -5, -5, -10, -10, -20,
]

const kingTable = [
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -20, -30, -30, -40, -40, -30, -30, -20,
  -10, -20, -20, -20, -20, -20, -20, -10,
  20, 20, 0, 0, 0, 0, 20, 20,
  20, 30, 10, 0, 0, 10, 30, 20,
]

const tables: Record<PieceSymbol, number[]> = {
  p: pawnTable,
  n: knightTable,
  b: bishopTable,
  r: rookTable,
  q: queenTable,
  k: kingTable,
}

const squareIndex = (square: string) => {
  const file = square[0] ?? ''
  const rank = Number.parseInt(square[1] ?? '', 10)
  const fileIndex = FILES.indexOf(file)
  if (fileIndex < 0 || rank < 1 || rank > 8) return -1
  const row = 8 - rank
  return row * 8 + fileIndex
}

const mirrorIndex = (index: number) => {
  const row = Math.floor(index / 8)
  const col = index % 8
  const mirroredRow = 7 - row
  return mirroredRow * 8 + col
}

const toPieceChar = (piece: { color: Color; type: PieceSymbol }): string =>
  piece.color === 'w' ? piece.type.toUpperCase() : piece.type

const toSide = (color: Color): Side => (color === 'w' ? 'white' : 'black')
const toColor = (side: Side): Color => (side === 'white' ? 'w' : 'b')

const createChess = (fen = START_FEN): Chess => {
  if (fen === START_FEN) return new Chess()
  return new Chess(fen)
}

const normalizeMove = (move: {
  from: string
  to: string
  piece: PieceSymbol
  color: Color
  captured?: PieceSymbol
  promotion?: PieceSymbol
  san: string
}): Move => ({
  from: move.from,
  to: move.to,
  piece: move.color === 'w' ? move.piece.toUpperCase() : move.piece,
  capture: move.captured
    ? move.color === 'w'
      ? move.captured
      : move.captured.toUpperCase()
    : undefined,
  promotion: move.promotion as PromotionPiece | undefined,
  san: move.san,
})

const needsAutoPromotion = (chess: Chess, move: MoveInput): boolean => {
  const piece = chess.get(move.from as Square)
  if (!piece || piece.type !== 'p') return false
  return move.to.endsWith('1') || move.to.endsWith('8')
}

const safeMove = (chess: Chess, input: MoveInput) => {
  const base = { from: input.from as Square, to: input.to as Square }
  if (input.promotion) {
    return chess.move({ ...base, promotion: input.promotion })
  }
  const moved = chess.move(base)
  if (moved) return moved
  if (!needsAutoPromotion(chess, input)) return null
  return chess.move({ ...base, promotion: 'q' })
}

const evaluateWithPosition = (chess: Chess, perspective: Side): number => {
  let score = 0
  const board = chess.board()
  for (let row = 0; row < board.length; row += 1) {
    const cells = board[row]
    if (!cells) continue
    for (let col = 0; col < cells.length; col += 1) {
      const piece = cells[col]
      if (!piece) continue
      const square = `${FILES[col] ?? 'a'}${8 - row}`
      const index = squareIndex(square)
      const table = tables[piece.type]
      const positional =
        index >= 0 ? (table[piece.color === 'w' ? index : mirrorIndex(index)] ?? 0) : 0
      const material = pieceValues[piece.type]
      const signed = material + positional * POSITIONAL_WEIGHT
      score += piece.color === toColor(perspective) ? signed : -signed
    }
  }
  return score
}

const scoreTerminal = (chess: Chess, side: Side): number | null => {
  if (!chess.isGameOver()) return null
  if (chess.isCheckmate()) {
    return chess.turn() === toColor(side) ? -100000 : 100000
  }
  return 0
}

const minimax = (
  chess: Chess,
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean,
  side: Side,
): number => {
  const terminal = scoreTerminal(chess, side)
  if (terminal !== null) return terminal
  if (depth <= 0) return evaluateWithPosition(chess, side)

  const moves = chess.moves({ verbose: true })
  if (!moves.length) return evaluateWithPosition(chess, side)

  if (maximizing) {
    let value = Number.NEGATIVE_INFINITY
    for (const move of moves) {
      const next = new Chess(chess.fen())
      next.move(move)
      value = Math.max(value, minimax(next, depth - 1, alpha, beta, false, side))
      alpha = Math.max(alpha, value)
      if (alpha >= beta) break
    }
    return value
  }

  let value = Number.POSITIVE_INFINITY
  for (const move of moves) {
    const next = new Chess(chess.fen())
    next.move(move)
    value = Math.min(value, minimax(next, depth - 1, alpha, beta, true, side))
    beta = Math.min(beta, value)
    if (beta <= alpha) break
  }
  return value
}

const depthForDifficulty = (difficulty: DifficultyKey): number => {
  if (difficulty === 'facile') return 0
  if (difficulty === 'intermediaire') return 1
  if (difficulty === 'difficile') return 2
  return 3
}

const captureBonus = (move: { captured?: PieceSymbol }): number =>
  move.captured ? (pieceValues[move.captured] ?? 0) * 0.4 : 0

const personaScoreBonus = (
  move: {
    captured?: PieceSymbol
    san: string
  },
  persona: BotPersona,
): number => {
  if (persona === 'agressif') {
    const checkBonus = move.san.includes('+') || move.san.includes('#') ? 60 : 0
    return captureBonus(move) + checkBonus
  }
  if (persona === 'solide') {
    const checkPenalty = move.san.includes('+') ? -5 : 0
    return captureBonus(move) * 0.25 + checkPenalty
  }
  return 0
}

export const createInitialFen = (): string => START_FEN

export const fenToBoard = (fen: string): string[][] => {
  const chess = createChess(fen)
  return chess.board().map((row) => row.map((piece) => (piece ? toPieceChar(piece) : '')))
}

export const createInitialBoard = (): string[][] => fenToBoard(START_FEN)

export const boardToFen = (board: string[][], side: Side = 'white'): string => {
  const rows = board.map((row) => {
    let empty = 0
    let result = ''
    for (const piece of row) {
      if (!piece) {
        empty += 1
      } else {
        if (empty > 0) {
          result += String(empty)
          empty = 0
        }
        result += piece
      }
    }
    if (empty > 0) result += String(empty)
    return result || '8'
  })
  return `${rows.join('/')} ${toColor(side)} - - 0 1`
}

export const evaluateBoard = (board: string[][]): number => {
  const fen = boardToFen(board, 'white')
  const chess = createChess(fen)
  return evaluateWithPosition(chess, 'white')
}

export const evaluateFen = (fen: string, perspective: Side): number => {
  const chess = createChess(fen)
  return evaluateWithPosition(chess, perspective)
}

export const isValidFen = (fen: string): boolean => {
  try {
    createChess(fen)
    return true
  } catch {
    return false
  }
}

export const getTurnFromFen = (fen: string): Side => {
  const chess = createChess(fen)
  return toSide(chess.turn())
}

export const getLegalMoves = (fen: string, side?: Side): Move[] => {
  const chess = createChess(fen)
  if (side && chess.turn() !== toColor(side)) return []
  return chess.moves({ verbose: true }).map(normalizeMove)
}

export const applyMove = (
  fen: string,
  move: MoveInput,
): { fen: string; move: Move | null } => {
  const chess = createChess(fen)
  const moved = safeMove(chess, move)
  if (!moved) return { fen, move: null }
  return {
    fen: chess.fen(),
    move: normalizeMove(moved),
  }
}

export const formatMove = (move: Move): string => move.san ?? `${move.from}-${move.to}`

export const getGameStatus = (fen: string): GameStatus => {
  const chess = createChess(fen)
  const turn = toSide(chess.turn())
  const isCheckmate = chess.isCheckmate()
  const isStalemate = chess.isStalemate()
  const isThreefoldRepetition = chess.isThreefoldRepetition()
  const isInsufficientMaterial = chess.isInsufficientMaterial()
  const isFiftyMoves = chess.isDrawByFiftyMoves()
  const isDraw =
    chess.isDraw() || isStalemate || isThreefoldRepetition || isInsufficientMaterial || isFiftyMoves

  let winner: Side | null = null
  let reason: GameStatus['reason'] = null

  if (isCheckmate) {
    winner = turn === 'white' ? 'black' : 'white'
    reason = 'checkmate'
  } else if (isStalemate) {
    reason = 'stalemate'
  } else if (isThreefoldRepetition) {
    reason = 'threefold-repetition'
  } else if (isInsufficientMaterial) {
    reason = 'insufficient-material'
  } else if (isFiftyMoves) {
    reason = 'fifty-moves'
  } else if (isDraw) {
    reason = 'draw'
  }

  return {
    turn,
    inCheck: chess.inCheck(),
    isCheckmate,
    isStalemate,
    isDraw,
    isThreefoldRepetition,
    isInsufficientMaterial,
    isFiftyMoves,
    isGameOver: chess.isGameOver(),
    winner,
    reason,
  }
}

export const exportPgnFromMoves = (moves: MoveInput[]): string => {
  const chess = new Chess()
  for (const move of moves) {
    const moved = safeMove(chess, move)
    if (!moved) break
  }
  return chess.pgn()
}

export const loadPgn = (
  pgn: string,
): { ok: true; fen: string; moves: Move[]; pgn: string } | { ok: false; error: string } => {
  const chess = new Chess()
  try {
    chess.loadPgn(pgn, { strict: false })
  } catch (error) {
    return { ok: false, error: (error as Error).message }
  }
  const moves = chess.history({ verbose: true }).map(normalizeMove)
  return { ok: true, fen: chess.fen(), moves, pgn: chess.pgn() }
}

export const getAiMove = (
  fen: string,
  side: Side,
  difficulty: DifficultyKey,
  persona: BotPersona = 'equilibre',
): Move | null => {
  const chess = createChess(fen)
  if (chess.turn() !== toColor(side)) return null

  const legal = chess.moves({ verbose: true })
  if (!legal.length) return null

  if (persona === 'fou') {
    const random = legal[Math.floor(Math.random() * legal.length)]
    return random ? normalizeMove(random) : null
  }

  if (difficulty === 'facile') {
    const random = legal[Math.floor(Math.random() * legal.length)] ?? null
    return random ? normalizeMove(random) : null
  }

  if (difficulty === 'intermediaire') {
    const captures = legal.filter((move) => Boolean(move.captured))
    const pool = captures.length ? captures : legal
    const sorted = [...pool].sort((a, b) => {
      const valueA = a.captured ? pieceValues[a.captured] : 0
      const valueB = b.captured ? pieceValues[b.captured] : 0
      return valueB - valueA
    })
    if (persona === 'agressif') {
      return sorted[0] ? normalizeMove(sorted[0]) : null
    }
    const pick = sorted[Math.floor(Math.random() * Math.min(sorted.length, 3))] ?? sorted[0]
    return pick ? normalizeMove(pick) : null
  }

  const depth = depthForDifficulty(difficulty)
  let bestScore = Number.NEGATIVE_INFINITY
  let bestMoves: ReturnType<Chess['moves']> = []

  for (const move of legal) {
    const next = new Chess(chess.fen())
    next.move(move)
    const score =
      minimax(
      next,
      Math.max(0, depth - 1),
      Number.NEGATIVE_INFINITY,
      Number.POSITIVE_INFINITY,
      false,
      side,
      ) + personaScoreBonus(move, persona)

    if (score > bestScore) {
      bestScore = score
      bestMoves = [move]
    } else if (score === bestScore) {
      bestMoves.push(move)
    }
  }

  if (persona === 'solide') {
    const pickedSolid = bestMoves[0] ?? legal[0] ?? null
    return pickedSolid ? normalizeMove(pickedSolid) : null
  }

  const picked = bestMoves[Math.floor(Math.random() * bestMoves.length)] ?? legal[0] ?? null
  return picked ? normalizeMove(picked) : null
}
