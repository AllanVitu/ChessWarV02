import {
  type BotPersona,
  getAiMove,
  type DifficultyKey,
  type Move,
  type Side,
} from './chessEngine'

type PendingRequest = {
  resolve: (move: Move | null) => void
  reject: (error: Error) => void
}

type WorkerRequest = {
  id: number
  fen: string
  side: Side
  difficulty: DifficultyKey
  persona: BotPersona
}

type WorkerResponse = {
  id: number
  move: Move | null
}

let worker: Worker | null = null
let requestId = 0
const pending = new Map<number, PendingRequest>()

const rejectAll = (message: string) => {
  for (const entry of pending.values()) {
    entry.reject(new Error(message))
  }
  pending.clear()
}

const setupWorker = (): Worker | null => {
  if (typeof Worker === 'undefined') return null
  if (worker) return worker

  worker = new Worker(new URL('../workers/chessAiWorker.ts', import.meta.url), {
    type: 'module',
  })

  worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
    const payload = event.data
    const resolver = pending.get(payload.id)
    if (!resolver) return
    pending.delete(payload.id)
    resolver.resolve(payload.move ?? null)
  })

  worker.addEventListener('error', () => {
    rejectAll('Le moteur IA est indisponible.')
    if (worker) {
      worker.terminate()
      worker = null
    }
  })

  return worker
}

export const requestAiMove = async (
  fen: string,
  side: Side,
  difficulty: DifficultyKey,
  persona: BotPersona = 'equilibre',
): Promise<Move | null> => {
  const instance = setupWorker()
  if (!instance) {
    return getAiMove(fen, side, difficulty, persona)
  }

  const id = ++requestId
  return await new Promise<Move | null>((resolve, reject) => {
    pending.set(id, { resolve, reject })
    const payload: WorkerRequest = {
      id,
      fen,
      side,
      difficulty,
      persona,
    }
    instance.postMessage(payload)
  })
}

export const disposeAiWorker = (): void => {
  if (!worker) return
  worker.terminate()
  worker = null
  rejectAll('Le moteur IA a ete arrete.')
}
