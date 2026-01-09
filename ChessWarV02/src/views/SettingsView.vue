<script setup lang="ts">
import DashboardLayout from '@/components/DashboardLayout.vue'

const notificationSettings = [
  {
    label: 'Alertes de match',
    hint: 'Rappels pour les parties planifiees.',
    enabled: true,
  },
  {
    label: 'Resultats de partie',
    hint: 'Resume automatique apres chaque match.',
    enabled: true,
  },
  {
    label: 'Conseils tactiques',
    hint: 'Suggestions basees sur vos parties.',
    enabled: false,
  },
]

const privacySettings = [
  {
    label: 'Profil public',
    hint: 'Afficher votre nom et votre Elo.',
    enabled: true,
  },
  {
    label: 'Historique visible',
    hint: 'Autoriser les autres a voir vos matchs.',
    enabled: false,
  },
  {
    label: 'Statistiques partagees',
    hint: 'Afficher les tendances globales.',
    enabled: true,
  },
]
</script>

<template>
  <DashboardLayout
    eyebrow="Parametres"
    title="Parametres"
    subtitle="Ajustez votre experience et vos preferences."
  >
    <section class="settings-grid">
      <div class="panel settings-card">
        <div class="panel-header">
          <div>
            <p class="panel-title">Preferences generales</p>
            <h3 class="panel-headline">Interface & rythme</h3>
          </div>
        </div>

        <form class="form-stack">
          <label class="form-field">
            <span class="form-label">Langue</span>
            <select class="form-input">
              <option>Francais</option>
              <option>English</option>
              <option>Espanol</option>
            </select>
          </label>

          <label class="form-field">
            <span class="form-label">Fuseau horaire</span>
            <select class="form-input">
              <option>Europe/Paris</option>
              <option>Europe/London</option>
              <option>America/Montreal</option>
            </select>
          </label>

          <label class="form-field">
            <span class="form-label">Cadence favorite</span>
            <select class="form-input">
              <option>10+0 Rapide</option>
              <option>5+0 Blitz</option>
              <option>15+10 Classique</option>
            </select>
          </label>

          <label class="form-field">
            <span class="form-label">Affichage plateau</span>
            <select class="form-input">
              <option>Theme botanique</option>
              <option>Theme sable</option>
              <option>Theme contraste</option>
            </select>
          </label>
        </form>
      </div>

      <div class="panel settings-card">
        <div class="panel-header">
          <div>
            <p class="panel-title">Notifications</p>
            <h3 class="panel-headline">Ce que vous recevez</h3>
          </div>
        </div>

        <div class="setting-list">
          <label v-for="item in notificationSettings" :key="item.label" class="setting-item">
            <div>
              <p class="setting-label">{{ item.label }}</p>
              <p class="setting-hint">{{ item.hint }}</p>
            </div>
            <input class="setting-toggle" type="checkbox" :checked="item.enabled" />
          </label>
        </div>
      </div>

      <div class="panel settings-card">
        <div class="panel-header">
          <div>
            <p class="panel-title">Confidentialite</p>
            <h3 class="panel-headline">Visibilite du profil</h3>
          </div>
        </div>

        <div class="setting-list">
          <label v-for="item in privacySettings" :key="item.label" class="setting-item">
            <div>
              <p class="setting-label">{{ item.label }}</p>
              <p class="setting-hint">{{ item.hint }}</p>
            </div>
            <input class="setting-toggle" type="checkbox" :checked="item.enabled" />
          </label>
        </div>
      </div>

      <div class="panel settings-card">
        <div class="panel-header">
          <div>
            <p class="panel-title">Sauvegarde</p>
            <h3 class="panel-headline">Synchronisation locale</h3>
          </div>
        </div>

        <p class="subhead">
          Vos parametres sont sauvegardes localement pour un deploiement statique.
        </p>

        <div class="settings-actions">
          <button class="button-ghost" type="button">Reinitialiser</button>
          <button class="button-primary" type="button">Enregistrer</button>
        </div>
      </div>
    </section>
  </DashboardLayout>
</template>
