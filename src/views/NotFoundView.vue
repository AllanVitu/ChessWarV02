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

    <div class="panel notfound-card">
      <p class="eyebrow">Erreur 404</p>
      <h1>Page introuvable</h1>
      <p class="subhead">
        La page demandee n'existe pas ou a ete deplacee.
      </p>
      <div class="notfound-actions">
        <RouterLink class="button-primary" to="/intro">Retour a l'accueil</RouterLink>
        <RouterLink class="button-ghost" to="/help">Consulter l'aide</RouterLink>
      </div>
    </div>
  </section>
</template>
