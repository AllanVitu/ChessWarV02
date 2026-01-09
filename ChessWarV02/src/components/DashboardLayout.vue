<script setup lang="ts">
import { RouterLink, useRouter } from 'vue-router'
import logoUrl from '@/assets/logo.svg'
import { getDashboardData } from '@/lib/localDb'
import { clearSession } from '@/lib/auth'

type DashboardLayoutProps = {
  eyebrow?: string
  title: string
  subtitle?: string
}

const props = withDefaults(defineProps<DashboardLayoutProps>(), {
  eyebrow: 'Bon retour',
  subtitle: '',
})

const router = useRouter()
const dashboard = getDashboardData()

const handleLogout = () => {
  clearSession()
  router.push('/connexion')
}
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar reveal">
      <div class="brand">
        <div class="brand-mark">
          <img class="brand-logo" :src="logoUrl" alt="WarChess" />
        </div>
        <div>
          <p class="brand-title">WarChess</p>
          <p class="brand-sub">Operations Arena</p>
        </div>
      </div>

      <div class="nav-group">
        <p class="nav-title">General</p>
        <RouterLink to="/tableau-de-bord" class="nav-link" exact-active-class="nav-link--active">
          <span class="nav-dot"></span>
          Vue d'ensemble
        </RouterLink>
        <RouterLink to="/matchs" class="nav-link" active-class="nav-link--active">
          <span class="nav-dot"></span>
          Matchs
        </RouterLink>
        <RouterLink to="/jeu" class="nav-link" active-class="nav-link--active">
          <span class="nav-dot"></span>
          Partie
        </RouterLink>
        <button class="nav-link nav-link--disabled" type="button" disabled>
          <span class="nav-dot"></span>
          Tournois
        </button>
      </div>

      <div class="nav-group">
        <p class="nav-title">Rapports</p>
        <RouterLink to="/profil/analyse" class="nav-link" active-class="nav-link--active">
          <span class="nav-dot"></span>
          Analyse du profil
        </RouterLink>
        <button class="nav-link nav-link--disabled" type="button" disabled>
          <span class="nav-dot"></span>
          Carte des menaces
        </button>
        <button class="nav-link nav-link--disabled" type="button" disabled>
          <span class="nav-dot"></span>
          Laboratoire d'ouverture
        </button>
        <button class="nav-link nav-link--disabled" type="button" disabled>
          <span class="nav-dot"></span>
          Tableau d'equipe
        </button>
      </div>

      <div class="nav-group">
        <p class="nav-title">Parametres</p>
        <RouterLink to="/parametres" class="nav-link" active-class="nav-link--active">
          <span class="nav-dot"></span>
          Parametres
        </RouterLink>
        <RouterLink to="/profil" class="nav-link" active-class="nav-link--active">
          <span class="nav-dot"></span>
          Profil & securite
        </RouterLink>
        <button class="nav-link nav-link--disabled" type="button" disabled>
          <span class="nav-dot"></span>
          Support
        </button>
      </div>

      <div class="sidebar-card">
        <p class="card-title">Acces Pro au laboratoire</p>
        <p class="card-text">
          Synchronisez ouvertures, puzzles, et revues de match sur tous vos appareils.
        </p>
        <button class="button-primary" type="button">Passer Pro</button>
      </div>

      <button class="logout" type="button" @click="handleLogout">Se deconnecter</button>
    </aside>

    <main class="main">
      <header class="topbar">
        <div class="welcome">
          <p class="eyebrow">{{ props.eyebrow }}</p>
          <h1 class="headline">{{ props.title }}</h1>
          <p v-if="props.subtitle" class="subhead">{{ props.subtitle }}</p>
        </div>

        <div class="top-actions">
          <label class="search">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.6" fill="none" />
              <path
                d="M16.5 16.5L21 21"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
              />
            </svg>
            <input type="text" placeholder="Rechercher parties, joueurs, ouvertures" />
          </label>

          <div class="top-buttons">
            <button class="icon-button" type="button" aria-label="Notifications">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M12 4a5 5 0 0 0-5 5v2.8l-1.4 2.2h12.8L17 11.8V9a5 5 0 0 0-5-5z"
                  stroke="currentColor"
                  stroke-width="1.6"
                  fill="none"
                />
                <path
                  d="M9.5 18a2.5 2.5 0 0 0 5 0"
                  stroke="currentColor"
                  stroke-width="1.6"
                  fill="none"
                />
              </svg>
            </button>
            <button class="icon-button" type="button" aria-label="Messages">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M4 6h16v9H7l-3 3V6z"
                  stroke="currentColor"
                  stroke-width="1.6"
                  fill="none"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
          </div>

          <div class="user-pill">
            <div class="avatar">KM</div>
            <div>
              <p class="user-name">{{ dashboard.profile.name }}</p>
              <p class="user-meta">{{ dashboard.profile.title }}</p>
            </div>
          </div>
        </div>
      </header>

      <slot />
    </main>
  </div>
</template>

