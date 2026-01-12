<script setup lang="ts">
import DashboardLayout from '@/components/DashboardLayout.vue'
import { getProfileAiAnalysis } from '@/lib/profileAnalysis'

const analysis = getProfileAiAnalysis()
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
            <div v-for="metric in analysis.keyMetrics" :key="metric.label" class="panel stat-card">
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
            <div v-for="focus in analysis.focusAreas" :key="focus.label" class="progress-item">
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
            <div v-for="item in analysis.highlights" :key="item.title" class="session-item">
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
            <div v-for="item in analysis.alerts" :key="item.title" class="session-item">
              <div>
                <p class="session-title">{{ item.title }}</p>
                <p class="session-time">{{ item.detail }}</p>
              </div>
              <span class="badge-soft">{{ item.tag }}</span>
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-header">
            <div>
              <p class="panel-title">Analyse IA</p>
              <h3 class="panel-headline">Lecture automatique</h3>
            </div>
          </div>

          <div class="hero-metrics">
            <div v-for="signal in analysis.aiSignals" :key="signal.label" class="metric-card">
              <p class="metric-label">{{ signal.label }}</p>
              <p class="metric-value">{{ signal.value }}</p>
              <p class="metric-note">{{ signal.note }}</p>
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
            <div v-for="rival in analysis.rivals" :key="rival.name" class="leaderboard-item">
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
