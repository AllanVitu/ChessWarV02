<script setup lang="ts">
import DashboardLayout from '@/components/DashboardLayout.vue'

const keyMetrics = [
  { label: 'Elo moyen', value: '2124', detail: '+38 sur 30 jours' },
  { label: 'Precision', value: '86%', detail: '+3.1% recent' },
  { label: 'Ouvertures jouees', value: '14', detail: 'Top 3 stables' },
  { label: 'Stabilite', value: '78%', detail: 'Moins de gaffes' },
]

const focusAreas = [
  { label: 'Finales techniques', progress: 68 },
  { label: 'Conversions tactiques', progress: 74 },
  { label: 'Gestion du temps', progress: 52 },
  { label: "Preparation d'ouverture", progress: 61 },
]

const highlights = [
  { title: 'Ouvertures solides', detail: '74% sur Ruy Lopez', tag: 'Fort' },
  { title: 'Pression au centre', detail: '62% de controle', tag: 'Stable' },
  { title: 'Finales propres', detail: '1.2 gaffe / 10', tag: 'Regulier' },
]

const alerts = [
  { title: 'Zeitnot recurrent', detail: 'Pic sous 2 min', tag: 'A corriger' },
  { title: 'Defenses passives', detail: 'Pieces en retard', tag: 'Vigilance' },
  { title: 'Echanges precipites', detail: 'Taux 38%', tag: 'A surveiller' },
]

const rivals = [
  { name: 'I. Alvarez', note: 'Tactique agressive', delta: '+12' },
  { name: 'C. Russo', note: 'Jeu positionnel', delta: '+8' },
  { name: 'T. Holm', note: 'Finales solides', delta: '+5' },
]
</script>

<template>
  <DashboardLayout
    eyebrow="Analyse"
    title="Analyse du profil"
    subtitle="Synthese de performance et tendances recentes."
  >
    <section class="content-grid">
      <div class="left-column">
        <div class="panel hero-card">
          <div class="panel-header">
            <div>
              <p class="panel-title">Apercu general</p>
              <h2 class="panel-headline">Niveau et progression</h2>
              <p class="panel-sub">Suivi des stats cles sur vos 30 derniers matchs.</p>
            </div>
            <span class="badge-soft">Semaine 02</span>
          </div>

          <div class="stats-grid">
            <div v-for="metric in keyMetrics" :key="metric.label" class="panel stat-card">
              <p class="stat-label">{{ metric.label }}</p>
              <p class="stat-value">{{ metric.value }}</p>
              <div class="stat-meta">
                <span class="stat-change">{{ metric.detail }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-header">
            <div>
              <p class="panel-title">Axes prioritaires</p>
              <h3 class="panel-headline">Progression ciblee</h3>
            </div>
            <button class="range-pill" type="button">Mensuel</button>
          </div>

          <div class="progress-list">
            <div v-for="focus in focusAreas" :key="focus.label" class="progress-item">
              <div class="progress-labels">
                <span>{{ focus.label }}</span>
                <span>{{ focus.progress }}%</span>
              </div>
              <div class="progress-bar">
                <span class="progress-fill" :style="{ width: `${focus.progress}%` }"></span>
              </div>
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-header">
            <div>
              <p class="panel-title">Moments forts</p>
              <h3 class="panel-headline">Ce qui fonctionne</h3>
            </div>
          </div>

          <div class="session-list">
            <div v-for="item in highlights" :key="item.title" class="session-item">
              <div>
                <p class="session-title">{{ item.title }}</p>
                <p class="session-time">{{ item.detail }}</p>
              </div>
              <span class="badge-soft">{{ item.tag }}</span>
            </div>
          </div>
        </div>
      </div>

      <aside class="right-column">
        <div class="panel">
          <div class="panel-header">
            <div>
              <p class="panel-title">Points d'alerte</p>
              <h3 class="panel-headline">A corriger</h3>
            </div>
          </div>

          <div class="session-list">
            <div v-for="item in alerts" :key="item.title" class="session-item">
              <div>
                <p class="session-title">{{ item.title }}</p>
                <p class="session-time">{{ item.detail }}</p>
              </div>
              <span class="badge-soft">{{ item.tag }}</span>
            </div>
          </div>
        </div>

        <div class="panel leaderboard-card">
          <div class="panel-header">
            <div>
              <p class="panel-title">Adversaires cle</p>
              <h3 class="panel-headline">Styles a preparer</h3>
            </div>
          </div>

          <div class="leaderboard-list">
            <div v-for="rival in rivals" :key="rival.name" class="leaderboard-item">
              <div class="leaderboard-user">
                <div class="leaderboard-avatar">{{ rival.name.slice(0, 1) }}</div>
                <div>
                  <p class="leaderboard-name">{{ rival.name }}</p>
                  <p class="leaderboard-meta">{{ rival.note }}</p>
                </div>
              </div>
              <span class="leaderboard-delta">{{ rival.delta }}</span>
            </div>
          </div>
        </div>
      </aside>
    </section>
  </DashboardLayout>
</template>
