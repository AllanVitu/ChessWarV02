export type StoryChapter = {
  id: number
  title: string
  summary: string
  objective: string
  reward: string
  timeControl: string
  side: 'Blancs' | 'Noirs' | 'Aleatoire'
  difficulty: 'Facile' | 'Intermediaire' | 'Difficile'
}

const chapters: StoryChapter[] = [
  {
    id: 1,
    title: 'L eclaireur',
    summary: "Prenez le controle d un avant-poste et securisez l ouverture.",
    objective: 'Gagner en moins de 25 coups.',
    reward: '+20 XP',
    timeControl: '10+0',
    side: 'Blancs',
    difficulty: 'Facile',
  },
  {
    id: 2,
    title: 'L avant-garde',
    summary: 'Affronter un adversaire plus agressif en milieu de partie.',
    objective: 'Atteindre un final gagnant.',
    reward: '+35 XP',
    timeControl: '12+0',
    side: 'Noirs',
    difficulty: 'Intermediaire',
  },
  {
    id: 3,
    title: 'La citadelle',
    summary: 'Defendre une position delicate sous pression.',
    objective: 'Tenir 30 coups sans perdre de materiel.',
    reward: '+50 XP',
    timeControl: '15+10',
    side: 'Aleatoire',
    difficulty: 'Difficile',
  },
]

const STORAGE_KEY = 'warchess.story.progress'
const ACTIVE_KEY = 'warchess.story.active'

export const getStoryChapters = (): StoryChapter[] => chapters

export const getStoryProgress = (): { completed: number[]; active: number | null } => {
  if (typeof window === 'undefined') return { completed: [], active: null }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    const active = window.localStorage.getItem(ACTIVE_KEY)
    return {
      completed: stored ? (JSON.parse(stored) as number[]) : [],
      active: active ? Number.parseInt(active, 10) : null,
    }
  } catch {
    return { completed: [], active: null }
  }
}

export const setActiveChapter = (chapterId: number): void => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(ACTIVE_KEY, String(chapterId))
  } catch {
    // ignore
  }
}

export const markChapterComplete = (chapterId: number): number[] => {
  if (typeof window === 'undefined') return []
  const progress = getStoryProgress()
  const next = progress.completed.includes(chapterId)
    ? progress.completed
    : [...progress.completed, chapterId]
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // ignore
  }
  return next
}
