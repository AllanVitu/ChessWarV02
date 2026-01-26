<script setup lang="ts">
import { RouterLink, useRouter } from 'vue-router'
import AppNavbar from '@/components/ui/AppNavbar.vue'
import logoUrl from '@/assets/brand-icon.png'
import { startGuestSession } from '@/lib/guest'
import { notifyInfo } from '@/lib/toast'
import { trackEvent } from '@/lib/telemetry'

const router = useRouter()

const navItems = [
  { label: 'Jouer', to: '/play' },
  { label: 'Classement', to: '/leaderboard' },
  { label: 'Connexion', to: '/auth' },
]

const handleGuest = async () => {
  startGuestSession()
  notifyInfo('Mode invite', "Vous jouez en local sans compte.")
  trackEvent({ name: 'login_guest' })
  await router.push('/dashboard')
}
</script>

<template>
  <section class="landing-page">
    <AppNavbar :items="navItems" brand-label="WarChess" :brand-logo="logoUrl">
      <template #actions>
        <button class="button-ghost landing-guest" type="button" @click="handleGuest">
          Jouer en invite
        </button>
      </template>
    </AppNavbar>

    <div class="landing-hero">
      <div class="landing-copy">
        <p class="eyebrow">Nouvelle generation</p>
        <h1 class="landing-title">WarChess</h1>
        <p class="landing-subtitle">
          L'arene d'echecs premium pour jouer, progresser et analyser en quelques minutes.
        </p>
        <div class="landing-actions">
          <RouterLink class="button-primary" to="/play">Jouer maintenant</RouterLink>
          <RouterLink class="button-ghost" to="/help">Voir les regles (2 min)</RouterLink>
        </div>
        <div class="landing-proof">
          <div class="landing-proof__item">
            <p class="landing-proof__value">12 480</p>
            <p class="landing-proof__label">parties jouees</p>
          </div>
          <div class="landing-proof__item">
            <p class="landing-proof__value">2 min</p>
            <p class="landing-proof__label">pour demarrer</p>
          </div>
          <div class="landing-proof__item">
            <p class="landing-proof__value">4.9/5</p>
            <p class="landing-proof__label">satisfaction</p>
          </div>
        </div>
      </div>

      <div class="landing-visual">
        <div class="landing-visual__card">
          <p class="panel-title">Live arena</p>
          <h2 class="panel-headline">Match express</h2>
          <p class="panel-sub">
            Tableau fluide, reponse immediate, analyse legere et immersive.
          </p>
          <div class="landing-visual__grid" aria-hidden="true">
            <span v-for="index in 16" :key="index" class="landing-visual__tile"></span>
          </div>
        </div>
        <div class="landing-visual__stats">
          <div class="stat-chip">
            <p class="stat-chip-label">Elo moyen</p>
            <p class="stat-chip-value">1640</p>
          </div>
          <div class="stat-chip">
            <p class="stat-chip-label">Temps moyen</p>
            <p class="stat-chip-value">12 min</p>
          </div>
          <div class="stat-chip">
            <p class="stat-chip-label">Analyse IA</p>
            <p class="stat-chip-value">Temps reel</p>
          </div>
        </div>
      </div>
    </div>

    <section class="landing-features">
      <div class="landing-section">
        <p class="eyebrow">Fonctionnalites</p>
        <h2 class="landing-section__title">Tout pour jouer et progresser</h2>
      </div>
      <div class="landing-cards">
        <article class="feature-card">
          <h3>Parties rapides</h3>
          <p>Lancez un match en quelques secondes avec des cadences adaptees.</p>
        </article>
        <article class="feature-card">
          <h3>Classement vivant</h3>
          <p>Suivez votre progression et comparez-vous a vos amis.</p>
        </article>
        <article class="feature-card">
          <h3>Progression &amp; analyse</h3>
          <p>Statistiques claires, revues de parties et objectifs hebdo.</p>
        </article>
      </div>
    </section>

    <section class="landing-onboarding">
      <div class="landing-section">
        <p class="eyebrow">Demarrage</p>
        <h2 class="landing-section__title">3 etapes pour entrer dans l'arene</h2>
      </div>
      <ol class="landing-steps">
        <li>
          <span class="landing-step__count">01</span>
          <div>
            <h3>Choisir un mode</h3>
            <p>Invite, classe ou local selon votre rythme du jour.</p>
          </div>
        </li>
        <li>
          <span class="landing-step__count">02</span>
          <div>
            <h3>Jouer la partie</h3>
            <p>Interface rapide, feedback instantane, controle total.</p>
          </div>
        </li>
        <li>
          <span class="landing-step__count">03</span>
          <div>
            <h3>Analyser</h3>
            <p>Revoyez vos coups, detectez les patterns, progressez.</p>
          </div>
        </li>
      </ol>
    </section>

    <section class="landing-cta">
      <div>
        <p class="eyebrow">Pret a jouer</p>
        <h2 class="landing-section__title">Decouvrez votre meilleur niveau.</h2>
        <p class="landing-section__text">
          Lancez une partie maintenant ou consultez les regles en 2 minutes.
        </p>
      </div>
      <div class="landing-actions">
        <RouterLink class="button-primary" to="/play">Jouer maintenant</RouterLink>
        <RouterLink class="button-ghost" to="/help">Voir les regles</RouterLink>
      </div>
    </section>

    <footer class="landing-footer">
      <p>WarChess - Arena chess experience</p>
      <div class="landing-footer__links">
        <RouterLink to="/help">Aide</RouterLink>
        <RouterLink to="/auth">Connexion</RouterLink>
      </div>
    </footer>
  </section>
</template>



