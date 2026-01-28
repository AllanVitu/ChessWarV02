<script setup lang="ts">
import { computed, ref } from 'vue'
import DashboardLayout from '@/components/DashboardLayout.vue'
import {
  clearObservability,
  getErrorSamples,
  getPerfSamples,
} from '@/lib/observability'

const refreshToken = ref(0)

const perfSamples = computed(() => {
  refreshToken.value
  return getPerfSamples().slice(-12).reverse()
})

const errorSamples = computed(() => {
  refreshToken.value
  return getErrorSamples().slice(-12).reverse()
})

const handleClear = () => {
  clearObservability()
  refreshToken.value += 1
}
</script>

<template>
  <DashboardLayout
    eyebrow="Diagnostics"
    title="Tableau performance"
    subtitle="Suivez les temps de chargement et les erreurs recents."
  >
    <section class="content-grid">
      <div class="left-column">
        <div class="panel">
          <div class="panel-header">
            <div>
              <p class="panel-title">Temps de chargement</p>
              <h3 class="panel-headline">Dernieres mesures</h3>
            </div>
            <button class="button-ghost" type="button" @click="handleClear">
              Effacer
            </button>
          </div>

          <div v-if="!perfSamples.length" class="empty-state">
            <p class="empty-state__title">Aucune mesure disponible</p>
            <p class="empty-state__subtitle">Naviguez dans l'app pour generer des statistiques.</p>
          </div>

          <div v-else class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Nom</th>
                  <th>Valeur (ms)</th>
                  <th>Moment</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="sample in perfSamples" :key="sample.id">
                  <td>{{ sample.type }}</td>
                  <td>{{ sample.name }}</td>
                  <td>{{ Math.round(sample.value) }}</td>
                  <td>{{ new Date(sample.time).toLocaleTimeString() }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <aside class="right-column">
        <div class="panel">
          <div class="panel-header">
            <div>
              <p class="panel-title">Erreurs client</p>
              <h3 class="panel-headline">Derniers incidents</h3>
            </div>
          </div>

          <div v-if="!errorSamples.length" class="empty-state">
            <p class="empty-state__title">Aucune erreur recente</p>
            <p class="empty-state__subtitle">Les erreurs client apparaitront ici.</p>
          </div>

          <div v-else class="progress-list">
            <div v-for="error in errorSamples" :key="error.id" class="onboarding-step">
              <p class="onboarding-step__title">{{ error.message }}</p>
              <p class="onboarding-step__text">
                {{ new Date(error.time).toLocaleString() }}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </section>
  </DashboardLayout>
</template>
