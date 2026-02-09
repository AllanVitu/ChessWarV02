<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import DashboardLayout from '@/components/DashboardLayout.vue'
import { getStoryChapters, getStoryProgress, markChapterComplete, setActiveChapter } from '@/lib/story'

const route = useRoute()
const router = useRouter()
const chapters = getStoryChapters()
const chapterId = computed(() => Number.parseInt(String(route.params.id ?? '0'), 10))
const chapter = computed(() => chapters.find((item) => item.id === chapterId.value) ?? null)
const progress = ref(getStoryProgress())
const isUnlocked = computed(() => {
  if (!chapter.value) return false
  if (chapter.value.id === 1) return true
  return progress.value.completed.includes(chapter.value.id - 1)
})
const isCompleted = computed(() => chapter.value && progress.value.completed.includes(chapter.value.id))

const setPlayAccess = () => {
  try {
    window.sessionStorage.setItem('warchess.play.access', '1')
  } catch {
    // Ignore storage failures.
  }
}

const startChapter = async () => {
  if (!chapter.value || !isUnlocked.value) return
  setPlayAccess()
  setActiveChapter(chapter.value.id)
  const params = new URLSearchParams({
    allow: '1',
    mode: 'histoire',
    chapter: String(chapter.value.id),
    difficulty: chapter.value.difficulty.toLowerCase(),
    side: chapter.value.side,
    time: chapter.value.timeControl,
  })
  await router.push(`/play?${params.toString()}`)
}

const completeChapter = () => {
  if (!chapter.value) return
  progress.value.completed = markChapterComplete(chapter.value.id)
}
</script>

<template>
  <DashboardLayout
    eyebrow="Histoire"
    :title="chapter ? chapter.title : 'Chapitre'"
    subtitle="Detail du chapitre"
    :breadcrumbs="[{ label: 'Histoire', to: '/histoire' }, { label: chapter?.title || 'Chapitre' }]"
  >
    <section class="content-grid">
      <div class="left-column">
        <div class="panel hero-card">
          <div class="panel-header">
            <div>
              <p class="panel-title">Chapitre {{ chapter?.id }}</p>
              <h2 class="panel-headline">{{ chapter?.title }}</h2>
              <p class="panel-sub">{{ chapter?.summary }}</p>
            </div>
            <span class="badge-soft">{{ chapter?.difficulty }}</span>
          </div>

          <div class="hero-metrics">
            <div class="metric-card">
              <p class="metric-label">Objectif</p>
              <p class="metric-value">{{ chapter?.objective }}</p>
              <p class="metric-note">Recompense {{ chapter?.reward }}</p>
            </div>
            <div class="metric-card">
              <p class="metric-label">Cadence</p>
              <p class="metric-value">{{ chapter?.timeControl }}</p>
              <p class="metric-note">Couleur {{ chapter?.side }}</p>
            </div>
          </div>

          <div class="card-actions">
            <button class="button-primary" type="button" :disabled="!isUnlocked" @click="startChapter">
              Lancer le chapitre
            </button>
            <button class="button-ghost" type="button" :disabled="!isUnlocked" @click="completeChapter">
              {{ isCompleted ? 'Termine' : 'Marquer termine' }}
            </button>
            <RouterLink class="button-ghost" to="/histoire">Retour</RouterLink>
          </div>
        </div>
      </div>
    </section>
  </DashboardLayout>
</template>
