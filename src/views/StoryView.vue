<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import DashboardLayout from '@/components/DashboardLayout.vue'
import { getStoryChapters, getStoryProgress, markChapterComplete, setActiveChapter } from '@/lib/story'
import { getDailyPuzzle } from '@/lib/puzzles'

const router = useRouter()
const chapters = getStoryChapters()
const dailyPuzzle = getDailyPuzzle()
const progress = ref(getStoryProgress())

const isUnlocked = (chapterId: number) => {
  if (chapterId === 1) return true
  return progress.value.completed.includes(chapterId - 1)
}

const primaryChapter = computed(() =>
  chapters.find((chapter) => isUnlocked(chapter.id) && !progress.value.completed.includes(chapter.id)) ??
  chapters[0],
)

const setPlayAccess = () => {
  try {
    window.sessionStorage.setItem('warchess.play.access', '1')
  } catch {
    // Ignore storage failures.
  }
}

const startChapter = async (chapterId: number) => {
  const chapter = chapters.find((item) => item.id === chapterId)
  if (!chapter || !isUnlocked(chapter.id)) return
  setPlayAccess()
  setActiveChapter(chapter.id)
  const params = new URLSearchParams({
    allow: '1',
    mode: 'histoire',
    chapter: String(chapter.id),
    difficulty: chapter.difficulty.toLowerCase(),
    side: chapter.side,
    time: chapter.timeControl,
  })
  await router.push(`/play?${params.toString()}`)
}

const startDailyPuzzle = async () => {
  setPlayAccess()
  const params = new URLSearchParams({
    allow: '1',
    mode: 'local',
    puzzle: dailyPuzzle.id,
    side: 'Aleatoire',
    time: '10+0',
  })
  await router.push(`/play?${params.toString()}`)
}

const finishChapter = (chapterId: number) => {
  progress.value.completed = markChapterComplete(chapterId)
}
</script>

<template>
  <DashboardLayout
    eyebrow="Histoire"
    title="Mode histoire"
    subtitle="Progressez chapitre par chapitre dans une campagne dynamique."
  >
    <section class="story-layout">
      <article class="panel story-hero">
        <div>
          <p class="panel-title">Campagne</p>
          <h2 class="panel-headline">La chronique du royaume</h2>
          <p class="panel-sub">
            Chaque chapitre propose un objectif concret, une cadence adaptee et une progression sauvegardee.
          </p>
        </div>
        <div class="story-hero__actions">
          <button
            class="button-primary"
            type="button"
            :disabled="!primaryChapter"
            @click="primaryChapter && startChapter(primaryChapter.id)"
          >
            Continuer chapitre {{ primaryChapter?.id ?? 1 }}
          </button>
          <button class="button-ghost" type="button" @click="startDailyPuzzle">
            Daily puzzle
          </button>
          <RouterLink class="button-ghost" to="/matchs">Retour aux matchs</RouterLink>
        </div>
      </article>

      <div class="story-grid">
        <article v-for="chapter in chapters" :key="chapter.id" class="panel story-card">
          <div class="story-card__header">
            <p class="panel-title">Chapitre {{ chapter.id }}</p>
            <span :class="['badge-soft', !isUnlocked(chapter.id) ? 'badge-soft--muted' : '']">
              {{ isUnlocked(chapter.id) ? 'Disponible' : 'Verrouille' }}
            </span>
          </div>
          <h3 class="panel-headline">{{ chapter.title }}</h3>
          <p class="panel-sub">{{ chapter.summary }}</p>
          <div class="story-meta">
            <span class="story-pill">IA {{ chapter.difficulty }}</span>
            <span class="story-pill">Cadence {{ chapter.timeControl }}</span>
            <span class="story-pill">Couleur {{ chapter.side }}</span>
          </div>
          <div class="card-actions">
            <button
              class="button-primary"
              type="button"
              :disabled="!isUnlocked(chapter.id)"
              @click="startChapter(chapter.id)"
            >
              Lancer
            </button>
            <RouterLink class="button-ghost" :to="`/histoire/${chapter.id}`">Details</RouterLink>
            <button
              class="button-ghost"
              type="button"
              :disabled="!isUnlocked(chapter.id)"
              @click="finishChapter(chapter.id)"
            >
              Marquer termine
            </button>
          </div>
        </article>
      </div>
    </section>
  </DashboardLayout>
</template>
