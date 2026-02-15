/// <reference lib="webworker" />

import { getAiMove, type BotPersona, type DifficultyKey, type Side } from '@/lib/chessEngine'

type AiWorkerRequest = {
  id: number
  fen: string
  side: Side
  difficulty: DifficultyKey
  persona: BotPersona
}

type AiWorkerResponse = {
  id: number
  move: ReturnType<typeof getAiMove>
}

self.addEventListener('message', (event: MessageEvent<AiWorkerRequest>) => {
  const payload = event.data
  if (!payload || typeof payload.id !== 'number') return

  const move = getAiMove(payload.fen, payload.side, payload.difficulty, payload.persona)
  const response: AiWorkerResponse = {
    id: payload.id,
    move,
  }
  self.postMessage(response)
})

export {}
