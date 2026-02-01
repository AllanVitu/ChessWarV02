<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

type NavItem = {
  label: string
  to: string
  matches: string[]
  icon: string
}

const route = useRoute()

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    to: '/dashboard',
    matches: ['/dashboard', '/tableau-de-bord'],
    icon: 'M4 11.5L12 5l8 6.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z',
  },
  {
    label: 'Matchs',
    to: '/matchs',
    matches: ['/matchs', '/matches', '/play', '/jeu'],
    icon: 'M7 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zm3 3h4v4h-4z',
  },
  {
    label: 'Classement',
    to: '/leaderboard',
    matches: ['/leaderboard', '/classement'],
    icon: 'M6 6h4v12H6zM14 3h4v15h-4zM10 10h4v8h-4z',
  },
  {
    label: 'Profil',
    to: '/profile',
    matches: ['/profile', '/profil', '/profil/analyse', '/joueur'],
    icon: 'M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm-7 9a7 7 0 0 1 14 0',
  },
  {
    label: 'Parametres',
    to: '/settings',
    matches: ['/settings', '/parametres'],
    icon: 'M12 7a5 5 0 1 0 5 5 5 5 0 0 0-5-5zm9 5h-2.2a7.2 7.2 0 0 0-.7-1.8l1.6-1.6-1.4-1.4-1.6 1.6a7.2 7.2 0 0 0-1.8-.7V3h-2v2.2a7.2 7.2 0 0 0-1.8.7L8.5 4.3 7.1 5.7l1.6 1.6a7.2 7.2 0 0 0-.7 1.8H5v2h2.2a7.2 7.2 0 0 0 .7 1.8l-1.6 1.6 1.4 1.4 1.6-1.6a7.2 7.2 0 0 0 1.8.7V21h2v-2.2a7.2 7.2 0 0 0 1.8-.7l1.6 1.6 1.4-1.4-1.6-1.6a7.2 7.2 0 0 0 .7-1.8H21z',
  },
]

const isActive = (item: NavItem) =>
  item.matches.some((match) => route.path === match || route.path.startsWith(`${match}/`))

const navState = computed(() => navItems.map((item) => ({ ...item, active: isActive(item) })))
</script>

<template>
  <nav class="bottom-nav" aria-label="Navigation mobile">
    <RouterLink
      v-for="item in navState"
      :key="item.label"
      :to="item.to"
      :class="['bottom-nav__item', item.active ? 'bottom-nav__item--active' : '']"
      :aria-current="item.active ? 'page' : undefined"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path :d="item.icon" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
      </svg>
      <span>{{ item.label }}</span>
    </RouterLink>
  </nav>
</template>
