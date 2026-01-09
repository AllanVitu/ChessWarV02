<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <div class="about-page">
    <div class="panel">
      <p class="eyebrow">A propos</p>
      <h1>WarChess</h1>
      <p>
        Interface de tableau de bord pour les echecs, avec une base locale compatible hebergement statique.
      </p>
      <RouterLink class="link" to="/tableau-de-bord">Retour au tableau de bord</RouterLink>
    </div>
  </div>
</template>

<style scoped>
.about-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
}

.panel {
  background: var(--panel);
  border: 1px solid var(--panel-border);
  border-radius: var(--radius);
  padding: 24px;
  box-shadow: var(--shadow);
  max-width: 520px;
  display: grid;
  gap: 12px;
}

h1 {
  font-family: var(--font-display);
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.2em;
  font-size: 11px;
  color: var(--text-faint);
}

.link {
  color: var(--accent);
  font-weight: 600;
}
</style>
