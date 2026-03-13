<script setup lang="ts">
import { RouterLink } from 'vue-router'
import AppNavbar from '@/components/ui/AppNavbar.vue'
import logoUrl from '@/assets/brand-icon.png'

const navItems = [
  { label: 'Accueil', to: '/intro' },
  { label: 'Matchs', to: '/matchs' },
  { label: 'Connexion', to: '/auth' },
]
</script>

<template>
  <section class="notfound-page">
    <AppNavbar :items="navItems" brand-label="WarChess" :brand-logo="logoUrl" />

    <!-- Floating chess pieces background -->
    <div class="notfound-pieces" aria-hidden="true">
      <svg class="notfound-piece notfound-piece--king" viewBox="0 0 24 24" fill="none">
        <path d="M12 2v3M9 5h6M9 5L6 10h12l-3-5M6 10l-1 8h14l-1-8M5 18v2h14v-2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <svg class="notfound-piece notfound-piece--pawn" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="7" r="4" stroke="currentColor" stroke-width="1.2"/>
        <path d="M8 11c-2 3-3 6-3 9h14c0-3-1-6-3-9" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
      </svg>
      <svg class="notfound-piece notfound-piece--rook" viewBox="0 0 24 24" fill="none">
        <path d="M5 20h14M7 20V8h10v12M7 8V4h2v2h2V4h2v2h2V4h2v4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <svg class="notfound-piece notfound-piece--knight" viewBox="0 0 24 24" fill="none">
        <path d="M6 20h12l-1-6-4-3 2-4-1-3-3-1-2 2-3-1-2 3 1 3-2 3 3 2 1 5z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>

    <!-- Animated chessboard grid -->
    <div class="notfound-board" aria-hidden="true">
      <div v-for="i in 64" :key="i" class="notfound-cell" :class="{ 'notfound-cell--dark': (Math.floor((i-1)/8) + (i-1)%8) % 2 === 1 }" />
    </div>

    <div class="panel notfound-card">
      <div class="notfound-code">404</div>
      <p class="eyebrow">Echec au roi</p>
      <h1>Piece introuvable</h1>
      <p class="subhead">
        Cette case de l'echiquier est vide. La page demandee n'existe pas ou a ete deplacee.
      </p>
      <div class="notfound-actions">
        <RouterLink class="button-primary" to="/intro">Retour a l'accueil</RouterLink>
        <RouterLink class="button-ghost" to="/matchs">Lancer un match</RouterLink>
      </div>
    </div>
  </section>
</template>

<style scoped>
.notfound-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
  position: relative;
  overflow: hidden;
  isolation: isolate;
  background: linear-gradient(160deg, var(--bg), var(--bg-soft));
}

/* Floating chess pieces */
.notfound-pieces {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}

.notfound-piece {
  position: absolute;
  color: var(--text-faint);
  opacity: 0.08;
}

.notfound-piece--king {
  width: 120px;
  height: 120px;
  top: 10%;
  left: 8%;
  animation: nf-float 14s ease-in-out infinite;
}

.notfound-piece--pawn {
  width: 80px;
  height: 80px;
  top: 60%;
  left: 12%;
  animation: nf-float 10s ease-in-out infinite reverse;
  animation-delay: -3s;
}

.notfound-piece--rook {
  width: 100px;
  height: 100px;
  top: 15%;
  right: 10%;
  animation: nf-float 12s ease-in-out infinite;
  animation-delay: -5s;
}

.notfound-piece--knight {
  width: 140px;
  height: 140px;
  bottom: 10%;
  right: 15%;
  animation: nf-float 16s ease-in-out infinite reverse;
  animation-delay: -8s;
}

@keyframes nf-float {
  0%, 100% {
    transform: translate(0, 0) rotate(0deg);
    opacity: 0.08;
  }
  25% {
    transform: translate(12px, -18px) rotate(5deg);
    opacity: 0.12;
  }
  50% {
    transform: translate(-8px, -10px) rotate(-3deg);
    opacity: 0.1;
  }
  75% {
    transform: translate(15px, 8px) rotate(4deg);
    opacity: 0.14;
  }
}

/* Background chessboard grid */
.notfound-board {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) perspective(800px) rotateX(55deg) rotateZ(45deg);
  display: grid;
  grid-template-columns: repeat(8, 40px);
  grid-template-rows: repeat(8, 40px);
  gap: 0;
  pointer-events: none;
  z-index: 0;
  opacity: 0.06;
  animation: nf-board-fade 3s ease both;
}

.notfound-cell {
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.notfound-cell--dark {
  background: rgba(255, 255, 255, 0.04);
}

@keyframes nf-board-fade {
  from {
    opacity: 0;
    transform: translate(-50%, -50%) perspective(800px) rotateX(55deg) rotateZ(45deg) scale(0.8);
  }
  to {
    opacity: 0.06;
    transform: translate(-50%, -50%) perspective(800px) rotateX(55deg) rotateZ(45deg) scale(1);
  }
}

/* Card */
.notfound-card {
  position: relative;
  z-index: 1;
  text-align: center;
  max-width: 480px;
  padding: 48px 32px;
  display: grid;
  gap: 12px;
  justify-items: center;
  animation: nf-card-in 0.8s cubic-bezier(0.16, 1, 0.3, 1) both;
  animation-delay: 0.2s;
}

.notfound-code {
  font-family: var(--font-display);
  font-size: clamp(64px, 16vw, 120px);
  font-weight: 800;
  letter-spacing: 0.06em;
  color: transparent;
  background: linear-gradient(135deg, var(--accent-2), var(--accent));
  -webkit-background-clip: text;
  background-clip: text;
  line-height: 1;
  animation: nf-code-pulse 4s ease-in-out infinite;
}

@keyframes nf-code-pulse {
  0%, 100% {
    filter: brightness(1) drop-shadow(0 0 0 transparent);
  }
  50% {
    filter: brightness(1.15) drop-shadow(0 0 20px var(--accent-glow));
  }
}

@keyframes nf-card-in {
  from {
    opacity: 0;
    transform: scale(0.92) translateY(24px);
    filter: blur(6px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
    filter: blur(0);
  }
}

.notfound-card h1 {
  font-family: var(--font-display);
  font-size: 28px;
  font-weight: 600;
}

.notfound-card .subhead {
  color: var(--text-muted);
  font-size: 14px;
  max-width: 360px;
}

.notfound-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
  margin-top: 8px;
}

@media (prefers-reduced-motion: reduce) {
  .notfound-piece,
  .notfound-board,
  .notfound-card,
  .notfound-code {
    animation: none !important;
    opacity: 1;
  }
  .notfound-board { opacity: 0.06; }
  .notfound-piece { opacity: 0.08; }
}
</style>
