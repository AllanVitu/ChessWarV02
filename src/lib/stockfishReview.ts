import { Chess, type PieceSymbol, type Square } from 'chess.js'
import stockfishJsUrl from 'stockfish/bin/stockfish-18-lite-single.js?url'
import stockfishWasmUrl from 'stockfish/bin/stockfish-18-lite-single.wasm?url'

export type ReviewMoveClass = 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder'

export type ReviewMove = {
  ply: number
  side: 'white' | 'black'
  played: string
  best: string
  cpLoss: number
  scoreBefore: number
  scoreAfterPlayed: number
  classification: ReviewMoveClass
}

export type StockfishGameReview = {
  analyzedPlies: number
  accuracy: number
  best: number
  good: number
  inaccuracies: number
  mistakes: number
  blunders: number
  moves: ReviewMove[]
}

const REVIEW_DEPTH = 11
const REVIEW_FOLLOWUP_DEPTH = 9
const REVIEW_MAX_PLIES = 36

type EvalResult = {
  bestMove: string
  scoreCp: number
  depth: number
}

type Waiter = {
  id: number
  predicate: (line: string) => boolean
  resolve: (line: string) => void
  reject: (error: Error) => void
  timeout: ReturnType<typeof setTimeout>
}

class StockfishClient {
  private worker: Worker | null = null
  private started = false
  private ready = false
  private waitingReady = false
  private waiters: Waiter[] = []
  private waiterId = 0

  private ensureWorker(): Worker {
    if (this.worker) return this.worker
    const url = `${stockfishJsUrl}#${encodeURIComponent(stockfishWasmUrl)},worker`
    const worker = new Worker(url)
    worker.addEventListener('message', (event) => {
      const line = String(event.data ?? '').trim()
      if (!line) return

      if (line === 'uciok' && this.waitingReady) {
        worker.postMessage('isready')
      }
      if (line === 'readyok') {
        this.ready = true
      }

      const nextWaiters: Waiter[] = []
      for (const waiter of this.waiters) {
        if (waiter.predicate(line)) {
          clearTimeout(waiter.timeout)
          waiter.resolve(line)
        } else {
          nextWaiters.push(waiter)
        }
      }
      this.waiters = nextWaiters
    })
    worker.addEventListener('error', () => {
      this.dispose(new Error('Stockfish indisponible.'))
    })
    this.worker = worker
    return worker
  }

  private waitForLine(
    predicate: (line: string) => boolean,
    timeoutMs = 15000,
  ): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const id = ++this.waiterId
      const timeout = setTimeout(() => {
        this.waiters = this.waiters.filter((entry) => entry.id !== id)
        reject(new Error('Timeout Stockfish.'))
      }, timeoutMs)
      this.waiters.push({
        id,
        predicate,
        resolve,
        reject,
        timeout,
      })
    })
  }

  async init(): Promise<void> {
    const worker = this.ensureWorker()
    if (this.ready) return
    if (this.waitingReady) {
      await this.waitForLine((line) => line === 'readyok')
      return
    }

    this.waitingReady = true
    if (!this.started) {
      this.started = true
      worker.postMessage('uci')
    }
    await this.waitForLine((line) => line === 'readyok')
  }

  async evaluateFen(fen: string, depth: number): Promise<EvalResult> {
    const worker = this.ensureWorker()
    await this.init()

    let bestMove = ''
    let scoreCp = 0
    let bestDepth = 0

    const infoWaiter = this.waitForLine((line) => {
      if (!line.startsWith('info ')) return false
      const depthMatch = /\bdepth\s+(\d+)/.exec(line)
      const scoreMatch = /\bscore\s+(cp|mate)\s+(-?\d+)/.exec(line)
      if (!depthMatch || !scoreMatch) return false

      const nextDepth = Number.parseInt(depthMatch[1] ?? '0', 10)
      if (!Number.isFinite(nextDepth) || nextDepth < bestDepth) return false

      bestDepth = nextDepth
      const kind = scoreMatch[1]
      const value = Number.parseInt(scoreMatch[2] ?? '0', 10)
      if (!Number.isFinite(value)) return false
      if (kind === 'cp') {
        scoreCp = value
      } else {
        const sign = value >= 0 ? 1 : -1
        scoreCp = sign * (100000 - Math.min(99, Math.abs(value)) * 100)
      }
      return false
    }, 20000).catch(() => '')

    worker.postMessage('position fen ' + fen)
    worker.postMessage('go depth ' + depth)

    const bestLine = await this.waitForLine((line) => line.startsWith('bestmove '), 25000)
    const bestMatch = /^bestmove\s+([a-h][1-8][a-h][1-8][qrbn]?)/.exec(bestLine)
    bestMove = bestMatch?.[1] ?? ''
    worker.postMessage('isready')
    await this.waitForLine((line) => line === 'readyok', 15000)
    await infoWaiter

    return {
      bestMove,
      scoreCp,
      depth: bestDepth,
    }
  }

  dispose(error?: Error): void {
    if (this.worker) {
      this.worker.terminate()
    }
    this.worker = null
    this.started = false
    this.ready = false
    this.waitingReady = false
    for (const waiter of this.waiters) {
      clearTimeout(waiter.timeout)
      waiter.reject(error ?? new Error('Stockfish arrete.'))
    }
    this.waiters = []
  }
}

let client: StockfishClient | null = null

const getClient = (): StockfishClient => {
  if (!client) {
    client = new StockfishClient()
  }
  return client
}

const classifyMove = (cpLoss: number): ReviewMoveClass => {
  if (cpLoss <= 30) return 'best'
  if (cpLoss <= 90) return 'good'
  if (cpLoss <= 170) return 'inaccuracy'
  if (cpLoss <= 300) return 'mistake'
  return 'blunder'
}

const parseUciMove = (
  uci: string,
): { from: string; to: string; promotion?: PieceSymbol } | null => {
  const match = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/.exec(uci.trim())
  if (!match) return null
  const promotion = match[3] as PieceSymbol | undefined
  return {
    from: match[1] ?? '',
    to: match[2] ?? '',
    ...(promotion ? { promotion } : {}),
  }
}

const moveToUci = (move: { from: string; to: string; promotion?: string }): string =>
  `${move.from}${move.to}${move.promotion ?? ''}`

export const reviewGameWithStockfish = async (
  moves: Array<{ from: string; to: string; promotion?: string }>,
): Promise<StockfishGameReview> => {
  const chess = new Chess()
  const start = Math.max(0, moves.length - REVIEW_MAX_PLIES)
  for (let index = 0; index < start; index += 1) {
    const move = moves[index]
    if (!move) continue
    const played = chess.move({
      from: move.from as Square,
      to: move.to as Square,
      ...(move.promotion ? { promotion: move.promotion as PieceSymbol } : {}),
    })
    if (!played) break
  }

  const reviewMoves: ReviewMove[] = []
  const sf = getClient()

  for (let index = start; index < moves.length; index += 1) {
    const move = moves[index]
    if (!move) continue
    const side = chess.turn() === 'w' ? 'white' : 'black'
    const beforeFen = chess.fen()
    const bestEval = await sf.evaluateFen(beforeFen, REVIEW_DEPTH)

    const playedResult = chess.move({
      from: move.from as Square,
      to: move.to as Square,
      ...(move.promotion ? { promotion: move.promotion as PieceSymbol } : {}),
    })
    if (!playedResult) break

    const afterFen = chess.fen()
    const afterEval = await sf.evaluateFen(afterFen, REVIEW_FOLLOWUP_DEPTH)
    const bestScore = bestEval.scoreCp
    const playedScore = -afterEval.scoreCp
    const cpLoss = Math.max(0, bestScore - playedScore)

    const bestParsed = parseUciMove(bestEval.bestMove)
    const bestUci = bestParsed ? moveToUci(bestParsed) : bestEval.bestMove

    reviewMoves.push({
      ply: index + 1,
      side,
      played: moveToUci(move),
      best: bestUci,
      cpLoss,
      scoreBefore: bestScore,
      scoreAfterPlayed: playedScore,
      classification: classifyMove(cpLoss),
    })
  }

  const counts = {
    best: reviewMoves.filter((item) => item.classification === 'best').length,
    good: reviewMoves.filter((item) => item.classification === 'good').length,
    inaccuracies: reviewMoves.filter((item) => item.classification === 'inaccuracy').length,
    mistakes: reviewMoves.filter((item) => item.classification === 'mistake').length,
    blunders: reviewMoves.filter((item) => item.classification === 'blunder').length,
  }

  const avgLoss = reviewMoves.length
    ? reviewMoves.reduce((sum, item) => sum + item.cpLoss, 0) / reviewMoves.length
    : 0
  const accuracy = Math.max(0, Math.min(100, Math.round(100 - avgLoss / 8)))

  return {
    analyzedPlies: reviewMoves.length,
    accuracy,
    best: counts.best,
    good: counts.good,
    inaccuracies: counts.inaccuracies,
    mistakes: counts.mistakes,
    blunders: counts.blunders,
    moves: reviewMoves,
  }
}

export const disposeStockfishReview = (): void => {
  if (!client) return
  client.dispose()
  client = null
}
