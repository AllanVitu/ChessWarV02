<script setup lang="ts">
import { RouterLink } from 'vue-router'
import AppNavbar from '@/components/ui/AppNavbar.vue'
import logoUrl from '@/assets/brand-icon.png'

const navItems = [
  { label: 'Matchs', to: '/matchs' },
  { label: 'Classement', to: '/leaderboard' },
  { label: 'Connexion', to: '/auth' },
]
</script>

<template>
  <section class="help-page">
    <AppNavbar :items="navItems" brand-label="WarChess" :brand-logo="logoUrl" />

    <div class="help-hero">
      <div>
        <p class="eyebrow">Regles express</p>
        <h1>Comprendre en 2 minutes</h1>
        <p class="subhead">
          Tout le necessaire pour lancer une partie, inviter un ami et analyser vos coups.
        </p>
      </div>
      <div class="help-actions">
        <RouterLink class="button-primary" to="/matchs">Lancer un match</RouterLink>
        <RouterLink class="button-ghost" to="/intro">Retour a l'accueil</RouterLink>
      </div>
    </div>

    <div class="help-grid">
      <article class="panel help-card">
        <p class="panel-title">1. Objectif</p>
        <h2 class="panel-headline">Mettre le roi en echec et mat</h2>
        <p class="panel-sub">
          Chaque joueur alterne les coups. Le roi ne peut jamais rester en echec.
        </p>
      </article>

      <article class="panel help-card">
        <p class="panel-title">2. Cadences</p>
        <h2 class="panel-headline">Choisissez votre rythme</h2>
        <p class="panel-sub">
          Rapide, blitz ou classique. Le chrono tombe a chaque coup.
        </p>
      </article>

      <article class="panel help-card">
        <p class="panel-title">3. Analyse</p>
        <h2 class="panel-headline">Comprendre vos parties</h2>
        <p class="panel-sub">
          Revoyez les coups critiques et utilisez les tendances pour progresser.
        </p>
      </article>
    </div>

    <div class="panel help-faq">
      <div class="panel-header">
        <div>
          <p class="panel-title">FAQ</p>
          <h2 class="panel-headline">Questions frequentes</h2>
        </div>
      </div>
      <div class="help-faq__list">
        <div class="help-faq__item">
          <h3>Comment jouer en invite ?</h3>
          <p>Depuis la page connexion ou l'accueil, cliquez sur "Jouer en invite".</p>
        </div>
        <div class="help-faq__item">
          <h3>Comment acceder a une analyse ?</h3>
          <p>Depuis le dashboard, ouvrez "Analyse du profil" pour vos tendances.</p>
        </div>
        <div class="help-faq__item">
          <h3>Puis-je jouer sur mobile ?</h3>
          <p>Oui, l'interface est optimisee pour mobile avec un menu en bas.</p>
        </div>
      </div>
    </div>
  </section>
</template>
