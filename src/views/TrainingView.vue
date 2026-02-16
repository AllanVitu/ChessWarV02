<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import DashboardLayout from "@/components/DashboardLayout.vue";
import { getDailyPuzzle, getPuzzles, type PuzzleItem } from "@/lib/puzzles";
import type { BotPersona, DifficultyKey } from "@/lib/chessEngine";

type LessonItem = {
  id: string;
  title: string;
  summary: string;
  goal: string;
  fen: string;
  side: "Blancs" | "Noirs" | "Aleatoire";
  timeControl: string;
};

type BotDrill = {
  id: string;
  title: string;
  detail: string;
  persona: BotPersona;
  difficulty: DifficultyKey;
};

const router = useRouter();
const puzzles = getPuzzles();
const dailyPuzzle = computed(() => getDailyPuzzle());

const lessons: LessonItem[] = [
  {
    id: "lesson-dev",
    title: "Developpement express",
    summary: "Prioriser pieces mineures et roque rapide.",
    goal: "Sortir les 4 pieces legeres avant le coup 10.",
    fen: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 2 3",
    side: "Noirs",
    timeControl: "5+0",
  },
  {
    id: "lesson-king",
    title: "Finale roi+pions",
    summary: "Activer le roi et creer un pion passe.",
    goal: "Convertir une majorite aile roi.",
    fen: "8/8/3k4/8/4P3/8/5K2/8 w - - 0 1",
    side: "Blancs",
    timeControl: "10+0",
  },
  {
    id: "lesson-attack",
    title: "Attaque sur le roque",
    summary: "Coordonner dame + fou + cavalier.",
    goal: "Identifier le sacrifice d'ouverture de lignes.",
    fen: "r1bq1rk1/pppp1ppp/2n2n2/4p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 4 6",
    side: "Blancs",
    timeControl: "10+0",
  },
];

const botDrills: BotDrill[] = [
  {
    id: "bot-balanced",
    title: "Sparring equilibre",
    detail: "Jeu generaliste pour repetition de plans standards.",
    persona: "equilibre",
    difficulty: "intermediaire",
  },
  {
    id: "bot-aggressive",
    title: "Pression agressive",
    detail: "Forcer la defense sous menace tactique constante.",
    persona: "agressif",
    difficulty: "difficile",
  },
  {
    id: "bot-solid",
    title: "Mur solide",
    detail: "Travail positionnel contre un style prudent.",
    persona: "solide",
    difficulty: "difficile",
  },
  {
    id: "bot-chaos",
    title: "Chaos blitz",
    detail: "Lecture tactique dans des positions instables.",
    persona: "fou",
    difficulty: "intermediaire",
  },
];

const setPlayAccess = () => {
  try {
    window.sessionStorage.setItem("warchess.play.access", "1");
  } catch {
    // Ignore storage failures.
  }
};

const launchPuzzle = async (puzzle: PuzzleItem) => {
  setPlayAccess();
  const params = new URLSearchParams({
    allow: "1",
    mode: "local",
    puzzle: puzzle.id,
    side: "Aleatoire",
    time: "10+0",
  });
  await router.push(`/play?${params.toString()}`);
};

const launchLesson = async (lesson: LessonItem) => {
  setPlayAccess();
  const params = new URLSearchParams({
    allow: "1",
    mode: "local",
    fen: lesson.fen,
    side: lesson.side,
    time: lesson.timeControl,
  });
  await router.push(`/play?${params.toString()}`);
};

const launchBotDrill = async (drill: BotDrill) => {
  setPlayAccess();
  const params = new URLSearchParams({
    allow: "1",
    mode: "ia",
    persona: drill.persona,
    difficulty: drill.difficulty,
    side: "Aleatoire",
    time: "10+0",
  });
  await router.push(`/play?${params.toString()}`);
};
</script>

<template>
  <DashboardLayout
    eyebrow="Entrainement"
    title="Atelier de maitrise"
    subtitle="Puzzles tactiques, lessons et sparring IA pour une progression continue."
  >
    <section class="content-grid">
      <div class="left-column">
        <article class="panel hero-card">
          <div class="panel-header">
            <div>
              <p class="panel-title">Puzzle du jour</p>
              <h3 class="panel-headline">{{ dailyPuzzle.title }}</h3>
              <p class="panel-sub">
                Themes: {{ dailyPuzzle.themes.join(", ") }} - Niveau {{ dailyPuzzle.difficulty }}
              </p>
            </div>
            <span class="badge-soft">#{{
              dailyPuzzle.id
            }}</span>
          </div>
          <div class="card-actions">
            <button class="button-primary" type="button" @click="launchPuzzle(dailyPuzzle)">
              Lancer le daily puzzle
            </button>
          </div>
        </article>

        <article class="panel">
          <div class="panel-header">
            <div>
              <p class="panel-title">Lessons</p>
              <h3 class="panel-headline">Ouvertures et finales</h3>
            </div>
          </div>
          <div class="session-list">
            <div v-for="lesson in lessons" :key="lesson.id" class="session-item">
              <div>
                <p class="session-title">{{ lesson.title }}</p>
                <p class="session-time">{{ lesson.summary }}</p>
                <p class="panel-sub">Objectif: {{ lesson.goal }}</p>
              </div>
              <div class="card-actions">
                <button class="button-ghost" type="button" @click="launchLesson(lesson)">
                  Jouer la lesson
                </button>
              </div>
            </div>
          </div>
        </article>
      </div>

      <aside class="right-column">
        <article class="panel">
          <div class="panel-header">
            <div>
              <p class="panel-title">Puzzles</p>
              <h3 class="panel-headline">Bibliotheque tactique</h3>
            </div>
          </div>
          <div class="move-list">
            <div v-for="puzzle in puzzles" :key="puzzle.id" class="move-item">
              <span class="move-side">{{ puzzle.difficulty }}</span>
              <span class="move-notation">{{ puzzle.title }}</span>
              <button class="button-ghost" type="button" @click="launchPuzzle(puzzle)">
                Ouvrir
              </button>
            </div>
          </div>
        </article>

        <article class="panel">
          <div class="panel-header">
            <div>
              <p class="panel-title">Personas IA</p>
              <h3 class="panel-headline">Sparring cible</h3>
            </div>
          </div>
          <div class="session-list">
            <div v-for="drill in botDrills" :key="drill.id" class="session-item">
              <div>
                <p class="session-title">{{ drill.title }}</p>
                <p class="session-time">{{ drill.detail }}</p>
              </div>
              <button class="button-ghost" type="button" @click="launchBotDrill(drill)">
                Lancer
              </button>
            </div>
          </div>
        </article>
      </aside>
    </section>
  </DashboardLayout>
</template>
