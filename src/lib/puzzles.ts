export type PuzzleDifficulty = 'Facile' | 'Intermediaire' | 'Difficile'

export type PuzzleItem = {
  id: string
  title: string
  fen: string
  solution: string[]
  themes: string[]
  difficulty: PuzzleDifficulty
}

const puzzles: PuzzleItem[] = [
  {
    id: 'pzl-001',
    title: 'Mat du couloir',
    fen: '6k1/5ppp/8/8/8/8/5PPP/5RK1 w - - 0 1',
    solution: ['f1e1', 'g8f8', 'e1e8'],
    themes: ['mat', 'finale'],
    difficulty: 'Facile',
  },
  {
    id: 'pzl-002',
    title: 'Clouage tactique',
    fen: 'r2q1rk1/ppp2ppp/2n5/3np3/3P4/2P2N2/PP1N1PPP/R1BQ1RK1 w - - 0 1',
    solution: ['d4e5', 'd5e5', 'd2c4'],
    themes: ['tactique', 'clouage'],
    difficulty: 'Intermediaire',
  },
  {
    id: 'pzl-003',
    title: 'Combination en 3',
    fen: 'r1bq1rk1/pp3ppp/2n1pn2/2bp4/2B5/2NP1N2/PPPQ1PPP/R3KB1R w KQ - 0 1',
    solution: ['c4d5', 'e6d5', 'd2g5'],
    themes: ['attaque', 'developpement'],
    difficulty: 'Intermediaire',
  },
  {
    id: 'pzl-004',
    title: 'Finale de pions',
    fen: '8/8/8/3k4/4P3/8/5K2/8 w - - 0 1',
    solution: ['f2e3', 'd5e5', 'e3d3'],
    themes: ['finale', 'roi'],
    difficulty: 'Facile',
  },
  {
    id: 'pzl-005',
    title: 'Sacrifice sur h7',
    fen: 'r1bq1rk1/ppp2ppp/2np1n2/4p3/2B1P3/2PP1N2/PP1N1PPP/R1BQ1RK1 w - - 0 1',
    solution: ['c4f7', 'f8f7', 'f3g5'],
    themes: ['sacrifice', 'attaque roi'],
    difficulty: 'Difficile',
  },
]

export const getPuzzles = (): PuzzleItem[] => puzzles

export const getPuzzleById = (id: string): PuzzleItem | null =>
  puzzles.find((item) => item.id === id) ?? null

const daySeed = (date: Date): number => {
  const year = date.getUTCFullYear()
  const start = Date.UTC(year, 0, 0)
  const now = Date.UTC(year, date.getUTCMonth(), date.getUTCDate())
  const dayOfYear = Math.floor((now - start) / 86400000)
  return year * 1000 + dayOfYear
}

export const getDailyPuzzle = (date = new Date()): PuzzleItem => {
  const list = getPuzzles()
  if (!list.length) {
    throw new Error('No puzzles available')
  }
  const seed = daySeed(date)
  const index = Math.abs(seed) % list.length
  const puzzle = list[index]
  if (!puzzle) {
    throw new Error('Daily puzzle index out of range')
  }
  return puzzle
}
