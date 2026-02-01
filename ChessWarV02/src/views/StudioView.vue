<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import DashboardLayout from '@/components/DashboardLayout.vue'

const modules = [
  { name: 'Archive', desc: 'Rejouez vos meilleures parties', accent: 'var(--accent-2)' },
  { name: 'Ouvertures', desc: 'Planifiez vos debuts de match', accent: 'var(--accent)' },
  { name: 'Analyse IA', desc: 'Lecture tactique et precision', accent: 'var(--accent-3)' },
  { name: 'Sessions', desc: 'Rythme et entrainement quotidien', accent: 'var(--analysis-green)' },
  { name: 'Challenges', desc: 'Defis d endurance et blitz', accent: 'var(--analysis-orange)' },
  { name: 'Equipes', desc: 'Parties en duo ou club', accent: 'var(--analysis-blue)' },
]

const today = computed(() => new Date().toLocaleDateString('fr-FR'))
</script>

<template>
  <DashboardLayout eyebrow="Studio" title="Atelier de jeu" subtitle="Configurez vos modules, themes et routines.">
    <section class="studio-grid">
      <article class="panel studio-hero">
        <div class="studio-hero__copy">
          <p class="panel-title">Plan du jour</p>
          <h2 class="panel-headline">Session focus - {{ today }}</h2>
          <p class="panel-sub">
            Activez le mode immersion, telechargez les derniers packs et lancez un match en un clic.
          </p>
          <div class="studio-hero__actions">
            <RouterLink class="button-primary" to="/matchs">Creer un match</RouterLink>
            <RouterLink class="button-ghost" to="/dashboard">Retour dashboard</RouterLink>
          </div>
        </div>
        <div class="studio-orbs" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </article>

      <article v-for="module in modules" :key="module.name" class="panel studio-card">
        <div class="studio-card__icon" :style="{ background: module.accent }"></div>
        <div>
          <h3>{{ module.name }}</h3>
          <p class="panel-sub">{{ module.desc }}</p>
        </div>
        <div class="studio-card__actions">
          <button class="button-ghost" type="button">Configurer</button>
          <button class="button-outline" type="button">Details</button>
        </div>
      </article>
    </section>
  </DashboardLayout>
</template>
