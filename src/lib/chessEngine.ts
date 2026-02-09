export type Side = 'white' | 'black'
export type DifficultyKey = 'facile' | 'intermediaire' | 'difficile' | 'maitre'

export type Move = {
  from: string
  to: string
  piece: string
  capture?: string
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

const pieceValues: Record<string, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
}

export const createInitialBoard = (): string[][] => [
  ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
  ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
  ['', '', '', '', '', '', '', ''],
  ['', '', '', '', '', '', '', ''],
  ['', '', '', '', '', '', '', ''],
  ['', '', '', '', '', '', '', ''],
  ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
  ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'],
]

const isWhite = (piece: string) => piece !== '' && piece === piece.toUpperCase()
const isBlack = (piece: string) => piece !== '' && piece === piece.toLowerCase()

const getSide = (piece: string): Side => (isWhite(piece) ? 'white' : 'black')

const inBounds = (row: number, col: number) => row >= 0 && row < 8 && col >= 0 && col < 8

const toSquare = (row: number, col: number) => `${FILES[col] ?? ''}${8 - row}`

const toCoords = (square: string) => {
  const file = square[0] ?? ''
  const rank = Number(square[1])
  const col = FILES.indexOf(file)
  return { row: 8 - rank, col: col === -1 ? 0 : col }
}

const getSquare = (board: string[][], row: number, col: number) => board[row]?.[col] ?? ''

const scoreBoard = (board: string[][]): number => {
  let score = 0
  for (const row of board) {
    for (const piece of row) {
      if (!piece) continue
      const value = pieceValues[piece.toLowerCase()] ?? 0
      score += isWhite(piece) ? value : -value
    }
  }
  return score
}

export const evaluateBoard = (board: string[][]): number => scoreBoard(board)

const scoreForSide = (board: string[][], side: Side): number => {
  const score = scoreBoard(board)
  return side === 'white' ? score : -score
}

const pushMove = (
  moves: Move[],
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number,
  piece: string,
  capture?: string,
) => {
  moves.push({
    from: toSquare(fromRow, fromCol),
    to: toSquare(toRow, toCol),
    piece,
    capture,
  })
}

const getMovesForPiece = (board: string[][], row: number, col: number): Move[] => {
  const piece = getSquare(board, row, col)
  if (!piece) return []

  const side = getSide(piece)
  const moves: Move[] = []
  const lower = piece.toLowerCase()

  if (lower === 'p') {
    const direction = side === 'white' ? -1 : 1
    const startRow = side === 'white' ? 6 : 1
    const nextRow = row + direction

    if (inBounds(nextRow, col) && getSquare(board, nextRow, col) === '') {
      pushMove(moves, row, col, nextRow, col, piece)
      const doubleRow = row + direction * 2
      if (row === startRow && getSquare(board, doubleRow, col) === '') {
        pushMove(moves, row, col, doubleRow, col, piece)
      }
    }

    for (const captureCol of [col - 1, col + 1]) {
      if (!inBounds(nextRow, captureCol)) continue
      const target = getSquare(board, nextRow, captureCol)
      if (target && getSide(target) !== side) {
        pushMove(moves, row, col, nextRow, captureCol, piece, target)
      }
    }

    return moves
  }

  if (lower === 'n') {
    const jumps: Array<[number, number]> = [
      [-2, -1],
      [-2, 1],
      [-1, -2],
      [-1, 2],
      [1, -2],
      [1, 2],
      [2, -1],
      [2, 1],
    ]

    for (const [dr, dc] of jumps) {
      const r = row + dr
      const c = col + dc
      if (!inBounds(r, c)) continue
      const target = getSquare(board, r, c)
      if (!target || getSide(target) !== side) {
        pushMove(moves, row, col, r, c, piece, target || undefined)
      }
    }

    return moves
  }

  const slide = (directions: Array<[number, number]>) => {
    for (const [dr, dc] of directions) {
      let r = row + dr
      let c = col + dc
      while (inBounds(r, c)) {
        const target = getSquare(board, r, c)
        if (!target) {
          pushMove(moves, row, col, r, c, piece)
        } else {
          if (getSide(target) !== side) {
            pushMove(moves, row, col, r, c, piece, target)
          }
          break
        }
        r += dr
        c += dc
      }
    }
  }

  if (lower === 'b') {
    slide([
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ])
    return moves
  }

  if (lower === 'r') {
    slide([
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ])
    return moves
  }

  if (lower === 'q') {
    slide([
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ])
    return moves
  }

  if (lower === 'k') {
    const steps: Array<[number, number]> = [
      [-1, -1],
      [-1, 0],
      [-1, 1],
      [0, -1],
      [0, 1],
      [1, -1],
      [1, 0],
      [1, 1],
    ]

    for (const [dr, dc] of steps) {
      const r = row + dr
      const c = col + dc
      if (!inBounds(r, c)) continue
      const target = getSquare(board, r, c)
      if (!target || getSide(target) !== side) {
        pushMove(moves, row, col, r, c, piece, target || undefined)
      }
    }
  }

  return moves
}

export const getLegalMoves = (board: string[][], side: Side): Move[] => {
  const moves: Move[] = []
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const piece = getSquare(board, row, col)
      if (!piece) continue
      if (getSide(piece) !== side) continue
      moves.push(...getMovesForPiece(board, row, col))
    }
  }
  return moves
}

export const applyMove = (board: string[][], move: Move): string[][] => {
  const next = board.map((row) => row.slice())
  const from = toCoords(move.from)
  const to = toCoords(move.to)
  const piece = move.piece
  const fromRow = next[from.row]
  const toRow = next[to.row]
  if (!fromRow || !toRow) {
    return next
  }
  fromRow[from.col] = ''
  toRow[to.col] = piece

  if (piece.toLowerCase() === 'p' && (to.row === 0 || to.row === 7)) {
    toRow[to.col] = piece === piece.toUpperCase() ? 'Q' : 'q'
  }

  return next
}

export const formatMove = (move: Move): string => `${move.from}-${move.to}`

export const getAiMove = (
  board: string[][],
  side: Side,
  difficulty: DifficultyKey,
): Move | null => {
  const moves = getLegalMoves(board, side)
  if (!moves.length) return null

  if (difficulty === 'facile') {
    return moves[Math.floor(Math.random() * moves.length)] ?? null
  }

  if (difficulty === 'intermediaire') {
    const captures = moves.filter((move) => move.capture)
    if (!captures.length) {
      return moves[Math.floor(Math.random() * moves.length)] ?? null
    }

    const sorted = [...captures].sort((a, b) => {
      const valueA = pieceValues[a.capture?.toLowerCase() || 'p'] ?? 0
      const valueB = pieceValues[b.capture?.toLowerCase() || 'p'] ?? 0
      return valueB - valueA
    })

    return sorted[0] ?? null
  }

  const scored = moves.map((move) => {
    const next = applyMove(board, move)
    const score = scoreForSide(next, side)
    return { move, score }
  })

  scored.sort((a, b) => b.score - a.score)

  if (difficulty === 'difficile') {
    return scored[0]?.move ?? null
  }

  const top = scored.slice(0, 3)
  return top[Math.floor(Math.random() * top.length)]?.move ?? null
}
